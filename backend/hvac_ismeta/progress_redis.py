"""F8-Sprint4: чтение live-progress recognition'а из Redis.

Recognition пишет state по ключу `recognition:progress:<job_id>` (raw redis-py,
без django KEY_PREFIX). Backend `/progress` endpoint мерджит БД (job.status,
финал) с Redis live-state (phase, current_page_label, eta).

Fail-open: если Redis недоступен / redis package не установлен — возвращаем
None и поверх БД ничего не добавляем (фронт продолжает poll'ить, увидит
финал из БД).
"""
from __future__ import annotations

import json
import logging
from typing import Any

from django.conf import settings

logger = logging.getLogger(__name__)

LIVE_KEY_TEMPLATE = "recognition:progress:{job_id}"


def read_live_progress(job_id: str) -> dict[str, Any] | None:
    """Прочитать live-state recognition'а из Redis. None если нет/ошибка.

    Не кэшируем redis client между вызовами умышленно: /progress polling
    идёт раз в 2.5s на job, latency на from_url ничтожна, зато не висит
    «пожизненный» pool на каждый процесс при отсутствии Redis.
    """
    if not job_id:
        return None
    url = getattr(settings, "RECOGNITION_PROGRESS_REDIS_URL", "") or ""
    if not url:
        return None
    try:
        import redis  # type: ignore[import-not-found]

        client = redis.Redis.from_url(
            url,
            socket_connect_timeout=1,
            socket_timeout=1,
            decode_responses=True,
        )
        raw = client.get(LIVE_KEY_TEMPLATE.format(job_id=job_id))
    except Exception as exc:
        logger.debug(
            "live progress redis unavailable",
            extra={"job_id": job_id, "error": str(exc)},
        )
        return None
    if not raw:
        return None
    try:
        return json.loads(raw)
    except (TypeError, ValueError) as exc:
        logger.warning(
            "live progress json invalid",
            extra={"job_id": job_id, "error": str(exc)},
        )
        return None
