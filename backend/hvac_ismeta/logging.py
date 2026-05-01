"""Structured JSON-логирование событий публичного ISMeta API (F8-06).

Все события идут через стандартный logger `hvac_ismeta.events` с extra полями.
Privacy-respecting: не пишем raw IP / full filename / содержимое PDF — только
короткий хеш IP, расширение и размер.

Подключение в product config: настройка форматтера на JSON в LOGGING dict
(json-logging-py / python-json-logger). Если форматтер plain — extra поля
видны через `%(message)s` всё равно благодаря `_emit` — собираем dict и
сериализуем сами через json.dumps.
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
from typing import Any

logger = logging.getLogger("hvac_ismeta.events")

_IP_HASH_PREFIX_LEN = 12  # SHA-256 hex truncated — privacy mitigation


def _hash_ip(ip: str) -> str:
    if not ip:
        return ""
    return hashlib.sha256(ip.encode("utf-8")).hexdigest()[:_IP_HASH_PREFIX_LEN]


def _hash_session(session_key: str) -> str:
    if not session_key:
        return ""
    return hashlib.sha256(session_key.encode("utf-8")).hexdigest()[:_IP_HASH_PREFIX_LEN]


def _file_ext(filename: str) -> str:
    if not filename:
        return ""
    _, ext = os.path.splitext(filename)
    return ext.lower().lstrip(".") or ""


def _emit(event: str, **fields: Any) -> None:
    """Логируем JSON-строкой — даже если форматтер plain, лог разбираемый."""
    payload: dict[str, Any] = {"event": event}
    for key, value in fields.items():
        if value is None:
            continue
        payload[key] = value
    try:
        rendered = json.dumps(payload, ensure_ascii=False, default=str)
    except (TypeError, ValueError):
        rendered = json.dumps({"event": event, "error": "non_serializable"})
    logger.info(rendered)


def log_job_started(job: Any) -> None:
    _emit(
        "ismeta_job_started",
        job_id=str(getattr(job, "id", "")),
        session=_hash_session(getattr(job, "session_key", "") or ""),
        ip_hash=_hash_ip(getattr(job, "ip_address", "") or ""),
        pdf_ext=_file_ext(getattr(job, "pdf_filename", "") or ""),
        pdf_size_bytes=getattr(job, "pdf_size_bytes", None),
        pipeline=getattr(job, "pipeline", None),
        llm_profile_id=getattr(job, "llm_profile_id", None),
    )


def log_job_completed(job: Any, duration_seconds: float | None = None) -> None:
    _emit(
        "ismeta_job_completed",
        job_id=str(getattr(job, "id", "")),
        duration_seconds=round(duration_seconds, 2) if duration_seconds is not None else None,
        pages_total=getattr(job, "pages_total", None),
        pages_processed=getattr(job, "pages_processed", None),
        items_count=getattr(job, "items_count", None),
        pipeline=getattr(job, "pipeline", None),
        cost_usd=float(getattr(job, "cost_usd", 0) or 0),
    )


def log_job_failed(job: Any, error: str | None = None) -> None:
    _emit(
        "ismeta_job_failed",
        job_id=str(getattr(job, "id", "")),
        pipeline=getattr(job, "pipeline", None),
        error=(error[:300] if error else getattr(job, "error_message", "")[:300] if getattr(job, "error_message", "") else None),
    )


def log_rate_limit_hit(*, session_key: str, ip: str, code: str, limit: int, current: int) -> None:
    _emit(
        "ismeta_rate_limit_hit",
        code=code,
        limit=limit,
        current=current,
        session=_hash_session(session_key),
        ip_hash=_hash_ip(ip),
    )


def log_concurrency_block(*, session_key: str, ip: str, active_job_id: str) -> None:
    _emit(
        "ismeta_concurrency_block",
        active_job_id=active_job_id,
        session=_hash_session(session_key),
        ip_hash=_hash_ip(ip),
    )
