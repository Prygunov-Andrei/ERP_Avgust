"""F8-Sprint4: live-progress writer в Redis.

`SpecParser` принимает опциональный `ProgressEmitter` и вызывает `emit()` после
каждой ключевой фазы (extract, tabletransformer, camelot, vision_llm,
llm_normalize, merge). Backend `/progress` endpoint читает Redis-ключ
`recognition:progress:<job_id>` и сливает live state с БД.

Дизайн-решения:

- Optional. Если redis_url или job_id пусты — emitter в noop режиме (для
  standalone usage без backend и для тестов без Redis-контейнера).
- Best-effort. Любая ошибка Redis ловится, логируется WARNING и не валит
  parse. Backend всё равно увидит финал из БД.
- Sync redis client. recognition не использует asyncio Redis (ради простой
  fail-safe схемы). emit() выполняется на event loop'е, но writev короткий
  (один SETEX), latency пренебрежимо мала.
- Self-contained TTL. Каждый SETEX обновляет TTL = progress_ttl_seconds, так
  что мы не «мусорим» ключами у zombie-jobs.
"""
from __future__ import annotations

import json
import logging
import time
from typing import Any

logger = logging.getLogger(__name__)

PROGRESS_KEY_TEMPLATE = "recognition:progress:{job_id}"

PHASES: tuple[str, ...] = (
    "queued",
    "extract",
    "tabletransformer",
    "camelot",
    "vision_llm",
    "llm_normalize",
    "merge",
    "done",
)


class ProgressEmitter:
    """Best-effort писатель live-state в Redis.

    Если `redis_url` или `job_id` пусты — `emit()` no-op. Внутренних retry
    нет: ETA backend'а poll'ит /progress каждые 2.5s, потеря одного emit
    приемлема.
    """

    def __init__(
        self,
        *,
        redis_url: str | None,
        job_id: str | None,
        ttl_seconds: int = 3600,
    ) -> None:
        self.job_id = (job_id or "").strip()
        self.ttl_seconds = ttl_seconds
        self._key = (
            PROGRESS_KEY_TEMPLATE.format(job_id=self.job_id) if self.job_id else ""
        )
        self._client: Any = None
        self._enabled = False
        self._started_at = time.monotonic()
        if not self.job_id or not redis_url:
            return
        try:
            import redis  # type: ignore[import-not-found]

            self._client = redis.Redis.from_url(
                redis_url,
                socket_connect_timeout=2,
                socket_timeout=2,
                decode_responses=True,
            )
            self._enabled = True
        except Exception as exc:  # pragma: no cover — defensive
            logger.warning(
                "progress_emitter init failed",
                extra={"job_id": self.job_id, "error": str(exc)},
            )
            self._client = None
            self._enabled = False

    @property
    def enabled(self) -> bool:
        return self._enabled

    @property
    def job_key(self) -> str:
        return self._key

    def emit(
        self,
        *,
        phase: str,
        pages_processed: int = 0,
        pages_total: int = 0,
        items_count: int = 0,
        label: str = "",
        eta_seconds: int | None = None,
        extra: dict[str, Any] | None = None,
    ) -> None:
        """Запись live-state в Redis. Безопасно вызывается из event loop'а.

        Если phase не в `PHASES` — логируем WARNING, но запись всё равно идём
        (UI может показать неизвестную фазу, главное — не уронить parse).
        """
        if not self._enabled or self._client is None:
            return
        if phase not in PHASES:
            logger.warning(
                "progress_emitter unknown phase",
                extra={"job_id": self.job_id, "phase": phase},
            )
        elapsed = max(0, int(time.monotonic() - self._started_at))
        payload: dict[str, Any] = {
            "phase": phase,
            "pages_processed": int(pages_processed),
            "pages_total": int(pages_total),
            "items_count": int(items_count),
            "current_page_label": label or _default_label(phase, pages_processed, pages_total),
            "elapsed_seconds": elapsed,
            "last_event_ts": _utc_now_iso(),
        }
        if eta_seconds is not None:
            payload["eta_seconds"] = max(0, int(eta_seconds))
        if extra:
            for k, v in extra.items():
                if k not in payload:
                    payload[k] = v
        try:
            self._client.setex(self._key, self.ttl_seconds, json.dumps(payload))
        except Exception as exc:  # pragma: no cover — defensive
            logger.warning(
                "progress_emitter emit failed",
                extra={
                    "job_id": self.job_id,
                    "phase": phase,
                    "error": str(exc),
                },
            )


def _default_label(phase: str, pages_processed: int, pages_total: int) -> str:
    phase_ru = {
        "queued": "В очереди",
        "extract": "Извлечение текста",
        "tabletransformer": "Распознавание таблиц",
        "camelot": "Lattice-extract",
        "vision_llm": "Vision LLM",
        "llm_normalize": "Нормализация LLM",
        "merge": "Сборка результата",
        "done": "Готово",
    }.get(phase, phase)
    if pages_total > 0 and phase not in ("queued", "merge", "done"):
        return f"{phase_ru} — стр. {pages_processed} из {pages_total}"
    return phase_ru


def _utc_now_iso() -> str:
    from datetime import UTC, datetime

    return datetime.now(UTC).isoformat(timespec="seconds")


_NOOP_EMITTER: ProgressEmitter | None = None


def noop_emitter() -> ProgressEmitter:
    """Singleton noop-emitter для тестов / sync route без X-Job-Id."""
    global _NOOP_EMITTER
    if _NOOP_EMITTER is None:
        _NOOP_EMITTER = ProgressEmitter(redis_url=None, job_id=None)
    return _NOOP_EMITTER
