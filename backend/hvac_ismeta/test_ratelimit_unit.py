"""Unit-тесты hvac_ismeta.ratelimit без Django REST API.

Покрывают граничные случаи:
* пустой identity / нулевой limit
* счётчик переходит границу
* fail-open при бросании cache

Изоляция:
* Каждый тест получает СВОЙ LocMemCache (override_settings + uuid LOCATION),
  чтобы pytest-xdist параллелизм не давал кросс-pollution через общий Redis
  и чтобы cache.clear() одного теста не вытирал bucket'ы другого worker'а.
"""
from __future__ import annotations

import os
import uuid

import pytest
from django.core.cache import cache
from django.test import override_settings

from . import ratelimit


@pytest.fixture(autouse=True)
def _isolated_cache():
    """LocMemCache с уникальным LOCATION на каждый тест — process-level isolation.

    LocMemCache хранит данные в Python-словаре на процесс. Уникальный LOCATION
    делает каждый тест работающим со свежим словарём. Закрываем override до
    yield и после — гарантируем что cache.incr идёт именно в наш backend.
    """
    location = f"ismeta-test-{os.getpid()}-{uuid.uuid4().hex}"
    with override_settings(
        CACHES={
            "default": {
                "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
                "LOCATION": location,
            }
        }
    ):
        # override_settings + setting_changed signal ресетит caches handler,
        # но `from django.core.cache import cache` остаётся валидным — он
        # резолвит backend через caches[DEFAULT_CACHE_ALIAS] на каждый __getattr__.
        cache.clear()
        yield
        cache.clear()


def test_empty_identity_passes_through():
    assert ratelimit.check_hourly_session("", 5).allowed is True
    assert ratelimit.check_hourly_ip("", 5).allowed is True
    assert ratelimit.check_daily_ip("", 5).allowed is True


def test_zero_limit_passes_through():
    assert ratelimit.check_hourly_session("s", 0).allowed is True


def test_counter_blocks_on_limit_exceeded():
    for _ in range(3):
        outcome = ratelimit.check_hourly_session("alice", 3)
        assert outcome.allowed is True
    blocked = ratelimit.check_hourly_session("alice", 3)
    assert blocked.allowed is False
    assert blocked.code == "rate_session"
    assert blocked.current == 4
    assert blocked.limit == 3


def test_different_identities_isolated():
    for _ in range(3):
        assert ratelimit.check_hourly_session("a", 3).allowed
    # bob свежий — должен пройти полные 3 раза
    for _ in range(3):
        assert ratelimit.check_hourly_session("b", 3).allowed
    assert ratelimit.check_hourly_session("a", 3).allowed is False
    assert ratelimit.check_hourly_session("b", 3).allowed is False


class _BrokenCache:
    """Stand-in cache, у которого ВСЕ методы поднимают ConnectionError.

    Заменяет `ratelimit.cache` целиком — это надёжнее чем patch.object на
    proxy-атрибуты `incr`/`set`, потому что `django.core.cache.cache` это
    DefaultCacheProxy, и в разных backend'ах поведение setattr на attribute
    может отличаться (см. CI failure on RedisCache backend).
    """

    def __getattr__(self, name):  # pragma: no cover — все ветки тригерят ConnectionError
        def _raise(*_args, **_kwargs):
            raise ConnectionError("redis down")

        return _raise


def test_fail_open_on_cache_error(monkeypatch):
    monkeypatch.setattr(ratelimit, "cache", _BrokenCache())
    outcome = ratelimit.check_hourly_session("z", 1)
    assert outcome.allowed is True
    assert outcome.current == 0


def test_codes_match_spec():
    assert ratelimit.check_hourly_session("x", 1).code == "rate_session"
    assert ratelimit.check_hourly_ip("x", 1).code == "rate_ip_hourly"
    assert ratelimit.check_daily_ip("x", 1).code == "rate_ip_daily"
