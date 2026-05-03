"""F8-Sprint4: unit-тесты ProgressEmitter."""
from __future__ import annotations

import json
from typing import Any
from unittest.mock import MagicMock

from app.services.progress_emitter import (
    PHASES,
    PROGRESS_KEY_TEMPLATE,
    ProgressEmitter,
    noop_emitter,
)


def test_noop_when_no_job_id() -> None:
    emitter = ProgressEmitter(redis_url="redis://x", job_id=None)
    assert emitter.enabled is False
    # emit не должен бросать даже на пустом emitter.
    emitter.emit(phase="extract", pages_total=10)


def test_noop_when_no_redis_url() -> None:
    emitter = ProgressEmitter(redis_url="", job_id="job-1")
    assert emitter.enabled is False
    emitter.emit(phase="extract", pages_total=10)


def test_singleton_noop_emitter() -> None:
    a = noop_emitter()
    b = noop_emitter()
    assert a is b
    assert a.enabled is False


def test_emit_writes_setex_with_payload(monkeypatch) -> None:
    fake_client = MagicMock()
    fake_redis_module = MagicMock()
    fake_redis_module.Redis.from_url.return_value = fake_client

    import app.services.progress_emitter as pe
    monkeypatch.setitem(__import__("sys").modules, "redis", fake_redis_module)
    emitter = ProgressEmitter(
        redis_url="redis://test:6379/2",
        job_id="job-abc",
        ttl_seconds=900,
    )
    assert emitter.enabled is True
    assert emitter.job_key == PROGRESS_KEY_TEMPLATE.format(job_id="job-abc")

    emitter.emit(
        phase="llm_normalize",
        pages_processed=3,
        pages_total=10,
        items_count=42,
        label="Страница 3 из 10",
        eta_seconds=70,
    )

    fake_client.setex.assert_called_once()
    args, _ = fake_client.setex.call_args
    key, ttl, payload_raw = args
    assert key == "recognition:progress:job-abc"
    assert ttl == 900
    payload = json.loads(payload_raw)
    assert payload["phase"] == "llm_normalize"
    assert payload["pages_processed"] == 3
    assert payload["pages_total"] == 10
    assert payload["items_count"] == 42
    assert payload["current_page_label"] == "Страница 3 из 10"
    assert payload["eta_seconds"] == 70
    assert "elapsed_seconds" in payload
    assert "last_event_ts" in payload
    # phases enum sanity
    assert payload["phase"] in PHASES
    # nuance: phase ordering reference
    assert "extract" in PHASES
    assert "merge" in PHASES


def test_emit_swallows_redis_errors(monkeypatch) -> None:
    fake_client = MagicMock()
    fake_client.setex.side_effect = RuntimeError("boom")
    fake_redis_module = MagicMock()
    fake_redis_module.Redis.from_url.return_value = fake_client
    monkeypatch.setitem(__import__("sys").modules, "redis", fake_redis_module)

    emitter = ProgressEmitter(redis_url="redis://test", job_id="j1")
    # Не должно поднять — best-effort.
    emitter.emit(phase="extract", pages_total=5)


def test_default_label_for_phase() -> None:
    """label='' → автогенерация по фазе + pages."""
    fake_client = MagicMock()
    fake_redis_module = MagicMock()
    fake_redis_module.Redis.from_url.return_value = fake_client

    import sys
    sys.modules["redis"] = fake_redis_module
    try:
        emitter = ProgressEmitter(redis_url="redis://x", job_id="j1")
        emitter.emit(phase="llm_normalize", pages_processed=2, pages_total=8)
        payload = json.loads(fake_client.setex.call_args.args[2])
        assert "Нормализация LLM" in payload["current_page_label"]
        assert "2 из 8" in payload["current_page_label"]
    finally:
        sys.modules.pop("redis", None)


def test_unknown_phase_still_writes(monkeypatch) -> None:
    """Неизвестная фаза не блокирует write — UI справится."""
    fake_client = MagicMock()
    fake_redis_module = MagicMock()
    fake_redis_module.Redis.from_url.return_value = fake_client
    monkeypatch.setitem(__import__("sys").modules, "redis", fake_redis_module)

    emitter = ProgressEmitter(redis_url="redis://x", job_id="j1")
    emitter.emit(phase="brand_new_phase", pages_total=1)  # type: ignore[arg-type]
    fake_client.setex.assert_called_once()


def test_extra_fields_passed_through(monkeypatch) -> None:
    fake_client = MagicMock()
    fake_redis_module = MagicMock()
    fake_redis_module.Redis.from_url.return_value = fake_client
    monkeypatch.setitem(__import__("sys").modules, "redis", fake_redis_module)

    emitter = ProgressEmitter(redis_url="redis://x", job_id="j1")
    emitter.emit(
        phase="extract",
        pages_total=10,
        extra={"pipeline": "td17g", "phase": "ignored-since-already-in-payload"},
    )
    payload = json.loads(fake_client.setex.call_args.args[2])
    assert payload["pipeline"] == "td17g"
    # extra не должен переопределить ключ из основного payload
    assert payload["phase"] == "extract"


def test_init_handles_redis_import_failure(monkeypatch) -> None:
    """Если redis package сломан / отсутствует — emitter в noop."""
    import sys
    saved = sys.modules.pop("redis", None)
    sys.modules["redis"] = None  # type: ignore[assignment]
    try:
        emitter = ProgressEmitter(redis_url="redis://x", job_id="j1")
        assert emitter.enabled is False
        emitter.emit(phase="extract", pages_total=1)
    finally:
        if saved is not None:
            sys.modules["redis"] = saved
        else:
            sys.modules.pop("redis", None)


# Sanity: payload контракт (поля для backend /progress merge)
EXPECTED_PAYLOAD_FIELDS: tuple[str, ...] = (
    "phase",
    "pages_processed",
    "pages_total",
    "items_count",
    "current_page_label",
    "elapsed_seconds",
    "last_event_ts",
)


def test_payload_contract(monkeypatch) -> None:
    fake_client = MagicMock()
    fake_redis_module = MagicMock()
    fake_redis_module.Redis.from_url.return_value = fake_client
    monkeypatch.setitem(__import__("sys").modules, "redis", fake_redis_module)

    emitter = ProgressEmitter(redis_url="redis://x", job_id="j1")
    emitter.emit(phase="merge", pages_processed=10, pages_total=10, items_count=120)
    payload: dict[str, Any] = json.loads(fake_client.setex.call_args.args[2])
    for f in EXPECTED_PAYLOAD_FIELDS:
        assert f in payload, f"missing field: {f}"
