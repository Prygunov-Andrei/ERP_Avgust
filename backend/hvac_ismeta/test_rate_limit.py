"""F8-06: тесты rate-limit поверх concurrency check.

Покрывают:
* hourly_per_session (3 sessions → 4-ый = 429 code=rate_session)
* hourly_per_ip (5 → 6-ой = 429 code=rate_ip_hourly)
* daily_per_ip (10 → 11-ый = 429 code=rate_ip_daily)
* fail-open при недоступности Redis (заменяем `ratelimit.cache` объект целиком)
* concurrency block теперь возвращает code=concurrency + active_job_id

Изоляция кэша:
* `_isolated_cache` autouse-fixture даёт каждому тесту СВОЙ LocMemCache с
  уникальным LOCATION — нужно для pytest-xdist параллелизма (общий Redis
  в CI давал cross-worker pollution: cache.clear() одного worker'а вытирал
  bucket'ы другого).
"""
from __future__ import annotations

import io
import os
import uuid
from unittest import mock

import pytest
from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from . import ratelimit, tasks as tasks_module
from .models import HvacIsmetaSettings, IsmetaJob


def _make_pdf(name: str = "test.pdf", size_bytes: int = 2048) -> io.BytesIO:
    buf = io.BytesIO(b"%PDF-1.4\n%fake\n" + b"x" * (size_bytes - 16))
    buf.name = name
    return buf


@pytest.fixture(autouse=True)
def _isolated_cache():
    """LocMemCache с уникальным LOCATION → изоляция между xdist-workers.

    Без этого override CI падал с cross-pollution: общий Redis + параллельные
    тесты + cache.clear() в одном worker'е вытирал счётчики другого.
    """
    location = f"ismeta-rate-test-{os.getpid()}-{uuid.uuid4().hex}"
    with override_settings(
        CACHES={
            "default": {
                "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
                "LOCATION": location,
            }
        }
    ):
        cache.clear()
        yield
        cache.clear()


@pytest.fixture
def storage_dir(tmp_path):
    path = tmp_path / "ismeta-uploads"
    path.mkdir()
    return str(path)


@pytest.fixture
def configured_settings(db, storage_dir):
    obj = HvacIsmetaSettings.get_settings()
    obj.pdf_storage_path = storage_dir
    obj.default_pipeline = "td17g"
    obj.default_llm_profile_id = 1
    obj.concurrency_limit_enabled = False  # выключаем — изолируем rate-limit логику
    obj.max_file_size_mb = 5
    obj.enabled = True
    obj.hourly_per_session = 3
    obj.hourly_per_ip = 5
    obj.daily_per_ip = 10
    obj.save()
    return obj


@pytest.fixture
def client():
    return APIClient()


def _post(client: APIClient, **extra):
    return client.post(
        reverse("ismeta-public-parse"),
        data={"file": _make_pdf("a.pdf"), **extra},
        format="multipart",
    )


def _force_new_session(client: APIClient) -> None:
    """Сбрасываем cookie, чтобы получить новую session_key."""
    client.cookies.clear()


def test_hourly_per_session_blocks_after_limit(client, configured_settings):
    """3 запроса проходят, 4-ый = 429 code=rate_session."""
    with mock.patch.object(tasks_module.process_ismeta_job, "delay"):
        for _ in range(3):
            resp = _post(client)
            assert resp.status_code == status.HTTP_202_ACCEPTED, resp.json()
        resp = _post(client)
    assert resp.status_code == status.HTTP_429_TOO_MANY_REQUESTS
    body = resp.json()
    assert body["code"] == "rate_session"
    assert body["limit"] == 3
    assert "сесси" in body["error"].lower()


def test_hourly_per_ip_blocks_across_sessions(client, configured_settings):
    """С одного IP, но разных session_keys: 5 проходят, 6-ой = rate_ip_hourly.

    hourly_per_session=3, поэтому каждой сессии хватает на 3 запроса до session-блока,
    но мы делаем по 1 запросу с каждой → counter сессии не успевает.
    Лимит IP=5, итого 6-ой получит rate_ip_hourly.
    """
    with mock.patch.object(tasks_module.process_ismeta_job, "delay"):
        for _ in range(5):
            _force_new_session(client)
            resp = _post(client)
            assert resp.status_code == status.HTTP_202_ACCEPTED, resp.json()
        _force_new_session(client)
        resp = _post(client)
    assert resp.status_code == status.HTTP_429_TOO_MANY_REQUESTS
    body = resp.json()
    assert body["code"] == "rate_ip_hourly"


def test_daily_per_ip_blocks_after_hourly_resets(client, configured_settings):
    """Эмуляция: вручную выставляем counter day_ip=10/10, оставляем hour-buckets свободными."""
    ip = "127.0.0.1"
    for _ in range(10):
        outcome = ratelimit.check_daily_ip(ip, configured_settings.daily_per_ip)
        assert outcome.allowed

    with mock.patch.object(tasks_module.process_ismeta_job, "delay"):
        _force_new_session(client)
        resp = _post(client)
    assert resp.status_code == status.HTTP_429_TOO_MANY_REQUESTS
    body = resp.json()
    assert body["code"] == "rate_ip_daily"
    assert "сутки" in body["error"].lower() or "завтра" in body["error"].lower()


class _BrokenCache:
    """Cache stand-in — все методы поднимают ConnectionError. Используется
    чтобы проверить fail-open path в `ratelimit._consume`. Заменяем `cache`
    целиком (а не patch.object на attribute) — это надёжнее чем mock на
    DefaultCacheProxy attribute, который в разных backend'ах ведёт себя
    по-разному."""

    def __getattr__(self, name):  # pragma: no cover
        def _raise(*_args, **_kwargs):
            raise ConnectionError("redis down")

        return _raise


def test_fail_open_when_redis_down(client, configured_settings, monkeypatch):
    """cache бросает ConnectionError на любую операцию → ratelimit пропускает (fail-open)."""
    monkeypatch.setattr(ratelimit, "cache", _BrokenCache())

    with mock.patch.object(tasks_module.process_ismeta_job, "delay"):
        for _ in range(5):  # больше hourly_per_session=3 — был бы блок при работающем cache
            resp = _post(client)
            assert resp.status_code == status.HTTP_202_ACCEPTED, resp.json()


def test_concurrency_block_returns_code_and_active_job(client, configured_settings):
    """Когда включена concurrency, 429 содержит code=concurrency + active_job_id."""
    configured_settings.concurrency_limit_enabled = True
    configured_settings.save()

    with mock.patch.object(tasks_module.process_ismeta_job, "delay"):
        first = _post(client)
        assert first.status_code == status.HTTP_202_ACCEPTED
        first_job_id = first.json()["job_id"]
        # Не сбрасываем cookie — той же сессией шлём второй запрос.
        second = _post(client)
    assert second.status_code == status.HTTP_429_TOO_MANY_REQUESTS
    body = second.json()
    assert body["code"] == "concurrency"
    assert body["active_job_id"] == first_job_id


def test_zero_limit_disables_check(client, configured_settings):
    """hourly_per_session=0 → лимит выключён, все запросы проходят."""
    configured_settings.hourly_per_session = 0
    configured_settings.hourly_per_ip = 0
    configured_settings.daily_per_ip = 0
    configured_settings.save()

    with mock.patch.object(tasks_module.process_ismeta_job, "delay"):
        for _ in range(5):
            resp = _post(client)
            assert resp.status_code == status.HTTP_202_ACCEPTED


def test_session_limit_isolates_different_sessions(client, configured_settings):
    """Лимит per-session не блокирует другую session с того же IP (если IP лимит ОК)."""
    # session A исчерпывает свой лимит (3)
    with mock.patch.object(tasks_module.process_ismeta_job, "delay"):
        for _ in range(3):
            resp = _post(client)
            assert resp.status_code == status.HTTP_202_ACCEPTED
        # 4-ый с той же сессии — заблокирован
        blocked = _post(client)
    assert blocked.status_code == status.HTTP_429_TOO_MANY_REQUESTS
    assert blocked.json()["code"] == "rate_session"

    # Новая session с того же IP — проходит (IP limit=5, использовано 3).
    _force_new_session(client)
    with mock.patch.object(tasks_module.process_ismeta_job, "delay"):
        resp = _post(client)
    assert resp.status_code == status.HTTP_202_ACCEPTED
