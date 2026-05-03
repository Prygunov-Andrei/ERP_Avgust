"""Публичные endpoints под /api/hvac/ismeta/ для hvac-info.com.

Auth не требуется (permission_classes=[]). Concurrency лимит — по
session_key (cookie) и IP, читается из HvacIsmetaSettings.

Endpoints:
    GET  /api/hvac/ismeta/options
    POST /api/hvac/ismeta/parse
    GET  /api/hvac/ismeta/jobs/<id>/progress
    GET  /api/hvac/ismeta/jobs/<id>/result
    GET  /api/hvac/ismeta/jobs/<id>/excel
    POST /api/hvac/ismeta/feedback
"""
from __future__ import annotations

import logging
import os
import re
import secrets
from datetime import datetime, timezone as _tz
from urllib.parse import quote

from django.db.models import Q
from django.http import HttpResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response

from .excel import build_workbook
from .llm_profile_client import list_llm_profiles
from .logging import log_concurrency_block, log_rate_limit_hit
from .models import HvacIsmetaSettings, IsmetaFeedback, IsmetaJob
from .progress_redis import read_live_progress
from .ratelimit import check_daily_ip, check_hourly_ip, check_hourly_session
from .tasks import process_ismeta_job

logger = logging.getLogger(__name__)

SESSION_COOKIE_NAME = "ismeta_session"
SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30  # 30 дней
PIPELINE_LABELS = {
    "main": "Точный (main / DeepSeek pure-LLM)",
    "td17g": "Быстрый (td17g / Docling+Camelot+Vision)",
}
SAFE_FILENAME_RE = re.compile(r"[^\w\-. ]+", flags=re.UNICODE)


def _sanitize_filename(name: str) -> str:
    base = os.path.basename(name).strip() or "upload.pdf"
    cleaned = SAFE_FILENAME_RE.sub("_", base)
    return cleaned[:200] or "upload.pdf"


def _client_ip(request: Request) -> str:
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "0.0.0.0") or "0.0.0.0"


def _get_or_set_session_key(request: Request) -> tuple[str, bool]:
    """Возвращает (session_key, was_created). Если cookie не было — генерим новый."""
    existing = request.COOKIES.get(SESSION_COOKIE_NAME, "").strip()
    if existing:
        return existing, False
    return secrets.token_urlsafe(24), True


def _set_session_cookie_if_needed(response: Response, session_key: str, created: bool) -> None:
    if not created:
        return
    response.set_cookie(
        SESSION_COOKIE_NAME,
        session_key,
        max_age=SESSION_COOKIE_MAX_AGE,
        httponly=True,
        samesite="Lax",
    )


class IsmetaPublicViewSet(viewsets.ViewSet):
    """Публичный API ISMeta для hvac-info.com — без auth."""

    permission_classes = [AllowAny]
    authentication_classes: list = []
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    @action(detail=False, methods=["get"], url_path="options")
    def options_list(self, request: Request) -> Response:
        settings_obj = HvacIsmetaSettings.get_settings()
        profiles = list_llm_profiles()
        return Response(
            {
                "enabled": settings_obj.enabled,
                "max_file_size_mb": settings_obj.max_file_size_mb,
                "default_pipeline": settings_obj.default_pipeline,
                "default_llm_profile_id": settings_obj.default_llm_profile_id,
                "pipelines": [
                    {
                        "id": pid,
                        "label": PIPELINE_LABELS[pid],
                        "default": pid == settings_obj.default_pipeline,
                    }
                    for pid in ("main", "td17g")
                ],
                "llm_profiles": [
                    {
                        "id": p["id"],
                        "name": p["name"],
                        "vision_supported": p["vision_supported"],
                        "default": p["id"] == settings_obj.default_llm_profile_id
                        or (settings_obj.default_llm_profile_id is None and p["is_default"]),
                    }
                    for p in profiles
                ],
            }
        )

    @action(detail=False, methods=["post"], url_path="parse")
    def parse(self, request: Request) -> Response:
        settings_obj = HvacIsmetaSettings.get_settings()
        if not settings_obj.enabled:
            return Response(
                {"error": "Сервис временно недоступен"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        session_key, session_created = _get_or_set_session_key(request)
        ip = _client_ip(request)

        if settings_obj.concurrency_limit_enabled:
            active = IsmetaJob.objects.filter(
                Q(session_key=session_key) | Q(ip_address=ip),
                status__in=IsmetaJob.ACTIVE_STATUSES,
            ).first()
            if active is not None:
                log_concurrency_block(session_key=session_key, ip=ip, active_job_id=str(active.id))
                resp = Response(
                    {
                        "error": "У вас уже идёт обработка PDF. Дождитесь завершения "
                        "и попробуйте снова.",
                        "code": "concurrency",
                        "active_job_id": str(active.id),
                    },
                    status=status.HTTP_429_TOO_MANY_REQUESTS,
                )
                _set_session_cookie_if_needed(resp, session_key, session_created)
                return resp

        rate_outcome = check_hourly_session(session_key, settings_obj.hourly_per_session)
        if not rate_outcome.allowed:
            log_rate_limit_hit(
                session_key=session_key,
                ip=ip,
                code=rate_outcome.code,
                limit=rate_outcome.limit,
                current=rate_outcome.current,
            )
            resp = Response(
                {
                    "error": "Превышен часовой лимит загрузок с вашей сессии. "
                    "Попробуйте через час.",
                    "code": rate_outcome.code,
                    "limit": rate_outcome.limit,
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
            _set_session_cookie_if_needed(resp, session_key, session_created)
            return resp

        rate_outcome = check_hourly_ip(ip, settings_obj.hourly_per_ip)
        if not rate_outcome.allowed:
            log_rate_limit_hit(
                session_key=session_key,
                ip=ip,
                code=rate_outcome.code,
                limit=rate_outcome.limit,
                current=rate_outcome.current,
            )
            resp = Response(
                {
                    "error": "Превышен часовой лимит загрузок с вашего IP. "
                    "Попробуйте через час.",
                    "code": rate_outcome.code,
                    "limit": rate_outcome.limit,
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
            _set_session_cookie_if_needed(resp, session_key, session_created)
            return resp

        rate_outcome = check_daily_ip(ip, settings_obj.daily_per_ip)
        if not rate_outcome.allowed:
            log_rate_limit_hit(
                session_key=session_key,
                ip=ip,
                code=rate_outcome.code,
                limit=rate_outcome.limit,
                current=rate_outcome.current,
            )
            resp = Response(
                {
                    "error": "Превышен суточный лимит загрузок с вашего IP. "
                    "Попробуйте завтра.",
                    "code": rate_outcome.code,
                    "limit": rate_outcome.limit,
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
            _set_session_cookie_if_needed(resp, session_key, session_created)
            return resp

        pdf_file = request.FILES.get("file")
        if not pdf_file:
            return Response({"error": "PDF не приложен"}, status=status.HTTP_400_BAD_REQUEST)
        if not pdf_file.name.lower().endswith(".pdf"):
            return Response(
                {"error": "Поддерживаются только PDF файлы"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        max_bytes = settings_obj.max_file_size_mb * 1024 * 1024
        if pdf_file.size > max_bytes:
            return Response(
                {"error": f"Размер файла превышает {settings_obj.max_file_size_mb} MB"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        pipeline = (request.data.get("pipeline") or settings_obj.default_pipeline).strip()
        if pipeline not in PIPELINE_LABELS:
            return Response(
                {"error": f"Unknown pipeline: {pipeline}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        llm_profile_id = request.data.get("llm_profile_id")
        if llm_profile_id in ("", None):
            llm_profile_id = settings_obj.default_llm_profile_id
        else:
            try:
                llm_profile_id = int(llm_profile_id)
            except (TypeError, ValueError):
                return Response(
                    {"error": "llm_profile_id должен быть числом"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        feedback_email = (request.data.get("email") or "").strip()[:254]

        os.makedirs(settings_obj.pdf_storage_path, exist_ok=True)
        timestamp = datetime.now(_tz.utc).strftime("%Y%m%dT%H%M%S")
        safe_name = _sanitize_filename(pdf_file.name)
        local_path = os.path.join(
            settings_obj.pdf_storage_path,
            f"{timestamp}-{secrets.token_hex(4)}-{safe_name}",
        )
        with open(local_path, "wb") as fh:
            for chunk in pdf_file.chunks():
                fh.write(chunk)

        job = IsmetaJob.objects.create(
            session_key=session_key,
            ip_address=ip,
            user_agent=request.META.get("HTTP_USER_AGENT", "")[:1000],
            pdf_filename=pdf_file.name[:255],
            pdf_storage_path=local_path,
            pdf_size_bytes=pdf_file.size,
            pipeline=pipeline,
            llm_profile_id=llm_profile_id,
            feedback_email=feedback_email,
        )

        process_ismeta_job.delay(str(job.id))

        resp = Response(
            {
                "job_id": str(job.id),
                "status": job.status,
                "pipeline": job.pipeline,
                "llm_profile_id": job.llm_profile_id,
            },
            status=status.HTTP_202_ACCEPTED,
        )
        _set_session_cookie_if_needed(resp, session_key, session_created)
        return resp

    def _get_job(self, pk: str) -> IsmetaJob | None:
        try:
            return IsmetaJob.objects.get(id=pk)
        except (IsmetaJob.DoesNotExist, ValueError, ValidationError):
            return None

    @action(detail=True, methods=["get"], url_path="progress")
    def progress(self, request: Request, pk: str | None = None) -> Response:
        """F8-Sprint4: БД + Redis live-state.

        Recognition пишет phase/pages_processed/items_count в Redis после
        каждой ключевой фазы. Backend склеивает: финальное состояние из БД
        для done/error/cancelled, иначе берёт processing-снапшот и поверх
        накатывает свежий live-state (явный приоритет live над БД для
        полей pages_processed, items_count, phase, current_page_label, eta).
        """
        job = self._get_job(pk or "")
        if job is None:
            return Response({"error": "Не найдено"}, status=status.HTTP_404_NOT_FOUND)

        base = {
            "job_id": str(job.id),
            "status": job.status,
            "pages_total": job.pages_total,
            "pages_processed": job.pages_processed,
            "items_count": job.items_count,
            "pipeline": job.pipeline,
            "started_at": job.started_at,
            "completed_at": job.completed_at,
            "error_message": job.error_message,
            # Поля live-state. Если Redis нет — заполнятся defaults, фронт
            # покажет minimal info (как до Sprint 4).
            "phase": "",
            "current_page_label": "",
            "elapsed_seconds": None,
            "eta_seconds": None,
            "last_event_ts": None,
        }

        # Финальное состояние — БД источник истины. Live-state в Redis может
        # отстать на 1-2 polling-цикла после save(); если status уже done —
        # игнорируем live, чтобы UI сразу переключился на ResultView.
        if job.status in (
            IsmetaJob.STATUS_DONE,
            IsmetaJob.STATUS_ERROR,
            IsmetaJob.STATUS_CANCELLED,
        ):
            base["phase"] = "done" if job.status == IsmetaJob.STATUS_DONE else job.status
            return Response(base)

        live = read_live_progress(str(job.id))
        if live:
            # Live source выигрывает у БД для активных полей. БД pages_*/items_*
            # обновляются только в финале task'а — тут они нули.
            for key in (
                "phase",
                "current_page_label",
                "elapsed_seconds",
                "eta_seconds",
                "last_event_ts",
            ):
                if key in live:
                    base[key] = live[key]
            for key in ("pages_total", "pages_processed", "items_count"):
                if key in live and isinstance(live[key], int):
                    # pages_total в Redis может быть точнее (recognition уже
                    # открыл PDF), pages_processed/items_count — единственный
                    # источник live-цифр до финала.
                    base[key] = live[key]
        return Response(base)

    @action(detail=True, methods=["get"], url_path="result")
    def result(self, request: Request, pk: str | None = None) -> Response:
        job = self._get_job(pk or "")
        if job is None:
            return Response({"error": "Не найдено"}, status=status.HTTP_404_NOT_FOUND)
        if job.status != IsmetaJob.STATUS_DONE:
            return Response(
                {"error": "Результат ещё не готов", "status": job.status},
                status=status.HTTP_409_CONFLICT,
            )
        data = job.result_json or {}
        return Response(
            {
                "job_id": str(job.id),
                "items": data.get("items", []),
                "pages_stats": data.get("pages_stats", {}),
                "pages_summary": data.get("pages_summary", []),
                "errors": data.get("errors", []),
                "cost_usd": float(job.cost_usd or 0),
                "llm_costs": data.get("llm_costs", {}),
            }
        )

    @action(detail=True, methods=["get"], url_path="excel")
    def excel(self, request: Request, pk: str | None = None):
        job = self._get_job(pk or "")
        if job is None:
            return Response({"error": "Не найдено"}, status=status.HTTP_404_NOT_FOUND)
        if job.status != IsmetaJob.STATUS_DONE:
            return Response(
                {"error": "Результат ещё не готов", "status": job.status},
                status=status.HTTP_409_CONFLICT,
            )
        items = (job.result_json or {}).get("items", [])
        content = build_workbook(items)
        download_name = os.path.splitext(job.pdf_filename or "ismeta")[0] or "ismeta"
        download_name = _sanitize_filename(f"{download_name}.xlsx")

        response = HttpResponse(
            content,
            content_type=(
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            ),
        )
        # filename* per RFC 5987 — поддержка кириллицы.
        response["Content-Disposition"] = (
            f"attachment; filename=\"ismeta.xlsx\"; "
            f"filename*=UTF-8''{quote(download_name)}"
        )
        return response

    @action(detail=False, methods=["post"], url_path="feedback")
    def feedback(self, request: Request) -> Response:
        helpful = request.data.get("helpful")
        if helpful is None:
            return Response(
                {"error": "Поле helpful обязательно"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if isinstance(helpful, str):
            helpful_bool = helpful.lower() in ("1", "true", "yes")
        else:
            helpful_bool = bool(helpful)

        job = None
        job_id = request.data.get("job_id")
        if job_id:
            job = self._get_job(str(job_id))

        comment = (request.data.get("comment") or "").strip()[:5000]
        contact_email = (request.data.get("contact_email") or "").strip()[:254]

        feedback = IsmetaFeedback.objects.create(
            job=job,
            helpful=helpful_bool,
            comment=comment,
            contact_email=contact_email,
        )
        return Response(
            {"id": feedback.id, "saved": True},
            status=status.HTTP_201_CREATED,
        )
