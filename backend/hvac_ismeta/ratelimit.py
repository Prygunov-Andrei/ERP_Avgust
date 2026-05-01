"""Redis-based rate limit для публичного ISMeta API (F8-06).

Три уровня поверх concurrency-check:
* `check_hourly_session(session_key, limit)` — N запросов в час с одной сессии;
* `check_hourly_ip(ip, limit)`             — N запросов в час с одного IP;
* `check_daily_ip(ip, limit)`              — N запросов в сутки с одного IP.

Bucket-key привязан к фиксированному окну (`%Y%m%d%H` / `%Y%m%d`), счётчик
увеличивается атомарно через `cache.incr()` с TTL равным длине окна.

При недоступности Redis (ConnectionError, любая ошибка cache backend) —
**fail-open**: возвращаем True (под лимитом). Для защиты от malicious traffic
при долгосрочной недоступности есть admin alert на Redis health, плюс
concurrency check (без Redis) остаётся первым уровнем.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Literal

from django.core.cache import cache
from django.utils import timezone

logger = logging.getLogger(__name__)

WindowKind = Literal["hour_session", "hour_ip", "day_ip"]

_HOUR_TTL = 3600
_DAY_TTL = 86400


@dataclass(frozen=True)
class RateLimitOutcome:
    allowed: bool
    code: str
    limit: int
    current: int


def _bucket_now(kind: WindowKind, identity: str) -> tuple[str, int]:
    now = timezone.now()
    if kind == "day_ip":
        return f"rate:day:ip:{identity}:{now:%Y%m%d}", _DAY_TTL
    if kind == "hour_ip":
        return f"rate:hour:ip:{identity}:{now:%Y%m%d%H}", _HOUR_TTL
    return f"rate:hour:session:{identity}:{now:%Y%m%d%H}", _HOUR_TTL


def _consume(kind: WindowKind, identity: str, limit: int, code: str) -> RateLimitOutcome:
    if not identity:
        return RateLimitOutcome(allowed=True, code=code, limit=limit, current=0)
    if limit <= 0:
        return RateLimitOutcome(allowed=True, code=code, limit=limit, current=0)

    key, ttl = _bucket_now(kind, identity)
    try:
        try:
            current = cache.incr(key)
        except ValueError:
            # Ключ отсутствовал → инициализируем с TTL равным длине окна.
            # Гонка между двумя одновременными add()/incr() допустима — fail-open.
            cache.set(key, 1, timeout=ttl)
            current = 1
        else:
            # cache.incr НЕ продлевает TTL → если bucket был создан с TTL=ttl и сейчас
            # на его границе — refresh через touch (no-op если уже свежий).
            cache.touch(key, ttl)
    except Exception:  # noqa: BLE001 — fail-open при любой проблеме с Redis
        logger.warning("ismeta rate-limit cache error (fail-open)", exc_info=True)
        return RateLimitOutcome(allowed=True, code=code, limit=limit, current=0)

    return RateLimitOutcome(allowed=current <= limit, code=code, limit=limit, current=current)


def check_hourly_session(session_key: str, limit: int) -> RateLimitOutcome:
    return _consume("hour_session", session_key, limit, "rate_session")


def check_hourly_ip(ip: str, limit: int) -> RateLimitOutcome:
    return _consume("hour_ip", ip, limit, "rate_ip_hourly")


def check_daily_ip(ip: str, limit: int) -> RateLimitOutcome:
    return _consume("day_ip", ip, limit, "rate_ip_daily")
