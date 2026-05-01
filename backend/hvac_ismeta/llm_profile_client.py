"""Кросс-БД клиент к llm_profile в ismeta-postgres.

ERP backend подключён к finans_assistant; LLMProfile живёт в отдельной
ismeta-postgres БД. Используем raw psycopg2 query через ISMETA_DATABASE_URL
и расшифровываем api_key_encrypted через Fernet (LLM_PROFILE_ENCRYPTION_KEY).

См. memory feedback_no_wrappers — НЕ делаем HTTP-обёртку к ismeta-backend.

Публичные API:
    list_llm_profiles() -> list[dict]   # для /options endpoint, без api_key
    fetch_llm_credentials(profile_id) -> dict | None   # для Celery task
"""
from __future__ import annotations

import logging
from typing import Any

import psycopg2
from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings

logger = logging.getLogger(__name__)


class LLMProfileLookupError(RuntimeError):
    """Не удалось получить данные LLMProfile."""


def _connect():
    if not settings.ISMETA_DATABASE_URL:
        raise LLMProfileLookupError("ISMETA_DATABASE_URL не задан")
    return psycopg2.connect(settings.ISMETA_DATABASE_URL)


def _fernet() -> Fernet:
    key = settings.LLM_PROFILE_ENCRYPTION_KEY
    if not key:
        raise LLMProfileLookupError("LLM_PROFILE_ENCRYPTION_KEY не задан")
    try:
        return Fernet(key.encode("utf-8"))
    except (ValueError, TypeError) as exc:
        raise LLMProfileLookupError(f"LLM_PROFILE_ENCRYPTION_KEY невалидный: {exc}") from exc


def list_llm_profiles() -> list[dict[str, Any]]:
    """Список доступных LLM профилей (без api_key) — для UI dropdown.

    Возвращает [] если ISMETA_DATABASE_URL не задан или БД недоступна
    (UI должен gracefully обрабатывать пустой список).
    """
    try:
        with _connect() as conn, conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, name, base_url,
                       extract_model, multimodal_model, classify_model,
                       vision_supported, is_default
                  FROM llm_profile
                 ORDER BY is_default DESC, name ASC
                """
            )
            rows = cur.fetchall()
    except (LLMProfileLookupError, psycopg2.Error) as exc:
        logger.warning("list_llm_profiles failed: %s", exc)
        return []

    return [
        {
            "id": row[0],
            "name": row[1],
            "base_url": row[2],
            "extract_model": row[3],
            "multimodal_model": row[4],
            "classify_model": row[5],
            "vision_supported": bool(row[6]),
            "is_default": bool(row[7]),
        }
        for row in rows
    ]


def fetch_llm_credentials(profile_id: int) -> dict[str, Any]:
    """Возвращает расшифрованные api_key + base_url + models для Celery task.

    Raises:
        LLMProfileLookupError — если профиль не найден / API key не расшифровался.
    """
    fernet = _fernet()
    try:
        with _connect() as conn, conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, name, base_url, api_key_encrypted,
                       extract_model, multimodal_model, classify_model,
                       vision_supported
                  FROM llm_profile
                 WHERE id = %s
                """,
                (profile_id,),
            )
            row = cur.fetchone()
    except psycopg2.Error as exc:
        raise LLMProfileLookupError(f"DB error: {exc}") from exc

    if row is None:
        raise LLMProfileLookupError(f"LLMProfile id={profile_id} не найден")

    api_key_encrypted = bytes(row[3])
    try:
        api_key = fernet.decrypt(api_key_encrypted).decode("utf-8")
    except InvalidToken as exc:
        raise LLMProfileLookupError(
            f"api_key_encrypted не расшифровывается (Fernet mismatch?): {exc}"
        ) from exc

    return {
        "id": row[0],
        "name": row[1],
        "base_url": row[2],
        "api_key": api_key,
        "extract_model": row[4],
        "multimodal_model": row[5],
        "classify_model": row[6],
        "vision_supported": bool(row[7]),
    }
