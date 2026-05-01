"""Celery task для async обработки IsmetaJob.

Sync POST к recognition (/v1/parse/spec) с X-LLM-* headers per-request override.
Прогресс в текущей версии обновляется только в финальном статусе (pages_processed
заполняется из ответа recognition). Future: переход на /v1/parse/spec/async с
callback endpoint для инкрементального progress.
"""
from __future__ import annotations

import logging
from decimal import Decimal

import requests
from celery import shared_task
from django.conf import settings
from django.utils import timezone

from .llm_profile_client import LLMProfileLookupError, fetch_llm_credentials
from .logging import log_job_completed, log_job_failed, log_job_started
from .models import IsmetaJob

logger = logging.getLogger(__name__)

# /v1/parse/spec — sync endpoint, ждём финальный SpecParseResponse.
RECOGNITION_TIMEOUT_SECONDS = 60 * 60  # 1 час хватает для самой большой спеки.


def _resolve_recognition_url(pipeline: str) -> str:
    """td17g → новый public контейнер, остальное → исторический ismeta-recognition."""
    if pipeline == "td17g":
        return settings.RECOGNITION_PUBLIC_URL
    return settings.RECOGNITION_MAIN_URL


def _build_headers(job: IsmetaJob) -> dict[str, str]:
    """Собирает headers для recognition: X-API-Key + X-LLM-* override.

    Если llm_profile_id не задан — recognition использует свой default
    (settings.llm_api_key), что для public endpoint обычно не желательно.
    Логируем warning и оставляем выбор за оператором (через UI/настройки).
    """
    headers: dict[str, str] = {"X-API-Key": settings.RECOGNITION_API_KEY}

    if job.llm_profile_id is None:
        logger.warning("IsmetaJob %s без llm_profile_id; recognition использует default", job.id)
        return headers

    creds = fetch_llm_credentials(job.llm_profile_id)
    headers["X-LLM-API-Key"] = creds["api_key"]
    headers["X-LLM-Base-URL"] = creds["base_url"]
    if creds.get("extract_model"):
        headers["X-LLM-Extract-Model"] = creds["extract_model"]
    if creds.get("multimodal_model"):
        headers["X-LLM-Multimodal-Model"] = creds["multimodal_model"]
    if creds.get("classify_model"):
        headers["X-LLM-Classify-Model"] = creds["classify_model"]
    return headers


@shared_task(
    name="hvac_ismeta.process_ismeta_job",
    bind=True,
    # Глобальный CELERY_TASK_TIME_LIMIT=300s — мало для recognition (3-30 мин).
    # Hard limit = 1h, soft = 55 мин — даём task'е шанс корректно сохранить error.
    time_limit=60 * 60,
    soft_time_limit=55 * 60,
)
def process_ismeta_job(self, job_id: str) -> str:
    """Обработка одного IsmetaJob: POST PDF в recognition, сохранение результата."""
    try:
        job = IsmetaJob.objects.get(id=job_id)
    except IsmetaJob.DoesNotExist:
        logger.error("process_ismeta_job: job %s not found", job_id)
        return "missing"

    job.status = IsmetaJob.STATUS_PROCESSING
    job.started_at = timezone.now()
    job.save(update_fields=["status", "started_at"])
    log_job_started(job)

    try:
        recognition_url = _resolve_recognition_url(job.pipeline)
        try:
            headers = _build_headers(job)
        except LLMProfileLookupError as exc:
            raise RuntimeError(f"LLM profile error: {exc}") from exc

        with open(job.pdf_storage_path, "rb") as fh:
            files = {"file": (job.pdf_filename, fh, "application/pdf")}
            response = requests.post(
                f"{recognition_url}/v1/parse/spec",
                files=files,
                headers=headers,
                timeout=RECOGNITION_TIMEOUT_SECONDS,
            )

        if response.status_code != 200:
            raise RuntimeError(
                f"recognition HTTP {response.status_code}: {response.text[:500]}"
            )

        data = response.json()
        items = data.get("items", []) or []
        pages_stats = data.get("pages_stats", {}) or {}
        llm_costs = data.get("llm_costs", {}) or {}
        cost_total = llm_costs.get("total_usd") or 0.0

        job.result_json = data
        job.items_count = len(items)
        job.pages_total = pages_stats.get("total", 0) or 0
        job.pages_processed = pages_stats.get("processed", 0) or 0
        job.cost_usd = Decimal(str(cost_total))
        job.status = IsmetaJob.STATUS_DONE
        job.completed_at = timezone.now()
        job.save()
        duration = (job.completed_at - job.started_at).total_seconds() if job.started_at else None
        log_job_completed(job, duration_seconds=duration)
        return "done"

    except Exception as exc:  # noqa: BLE001 — фиксируем любую ошибку в job
        logger.exception("process_ismeta_job failed for %s", job_id)
        job.status = IsmetaJob.STATUS_ERROR
        job.error_message = str(exc)[:2000]
        job.completed_at = timezone.now()
        job.save(update_fields=["status", "error_message", "completed_at"])
        log_job_failed(job, error=str(exc))
        return "error"
