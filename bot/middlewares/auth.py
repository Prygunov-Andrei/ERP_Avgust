"""Middleware для авторизации пользователей через worklog_worker."""

import logging
import time
from typing import Callable, Dict, Any, Awaitable, Optional

from aiogram import BaseMiddleware
from aiogram.types import Message, CallbackQuery

from services.db import find_worker_by_telegram_id

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# In-memory TTL-кеш для worker lookup (снижает нагрузку на БД)
# ---------------------------------------------------------------------------

_worker_cache: dict[int, tuple[Optional[dict], float]] = {}
_CACHE_TTL = 60  # seconds


def _get_cached_worker(telegram_id: int) -> Optional[dict]:
    """Возвращает worker из кеша или None если протух / отсутствует."""
    if telegram_id in _worker_cache:
        data, ts = _worker_cache[telegram_id]
        if time.monotonic() - ts < _CACHE_TTL:
            return data
        del _worker_cache[telegram_id]
    return None


def _set_cached_worker(telegram_id: int, data: Optional[dict]) -> None:
    """Сохраняет worker в кеш с текущим timestamp."""
    _worker_cache[telegram_id] = (data, time.monotonic())


def invalidate_worker_cache(telegram_id: int) -> None:
    """Удаляет запись из кеша (вызывать при регистрации / обновлении worker)."""
    _worker_cache.pop(telegram_id, None)


class WorkerAuthMiddleware(BaseMiddleware):
    """
    Middleware для автоматического поиска worker по telegram_id.

    Если worker найден — добавляет в data['worker'].
    Если worker не найден — пропускает (handler решает сам, как обрабатывать).
    """

    async def __call__(
        self,
        handler: Callable[[Message, Dict[str, Any]], Awaitable[Any]],
        event: Message,
        data: Dict[str, Any],
    ) -> Any:
        telegram_id = None

        if isinstance(event, Message) and event.from_user:
            telegram_id = event.from_user.id
        elif isinstance(event, CallbackQuery) and event.from_user:
            telegram_id = event.from_user.id

        if telegram_id:
            worker = _get_cached_worker(telegram_id)
            if worker is None:
                worker = await find_worker_by_telegram_id(telegram_id)
                _set_cached_worker(telegram_id, worker)
            data['worker'] = worker
        else:
            data['worker'] = None

        return await handler(event, data)


class RequireWorkerMiddleware(BaseMiddleware):
    """
    Middleware, который блокирует обработку если worker не найден.

    Используется на роутерах, где нужна обязательная авторизация (media).
    Для корректной работы должен стоять ПОСЛЕ WorkerAuthMiddleware.
    """

    async def __call__(
        self,
        handler: Callable[[Message, Dict[str, Any]], Awaitable[Any]],
        event: Message,
        data: Dict[str, Any],
    ) -> Any:
        worker = data.get('worker')

        if not worker:
            logger.debug(
                f"RequireWorkerMiddleware: unauthorized user "
                f"{getattr(event, 'from_user', None) and event.from_user.id}"
            )
            # Не отвечаем — просто молча игнорируем
            return None

        return await handler(event, data)
