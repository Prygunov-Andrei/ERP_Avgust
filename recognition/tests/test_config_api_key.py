"""TD-04: rename OPENAI_API_KEY → LLM_API_KEY с alias для backward compat.

Settings._resolve_api_key должен:
- читать LLM_API_KEY как primary;
- fallback на OPENAI_API_KEY если LLM_API_KEY пуст;
- LLM_API_KEY побеждает если оба заданы.
"""

from __future__ import annotations

import pytest

from app.config import Settings


def _make_settings(
    monkeypatch: pytest.MonkeyPatch,
    *,
    llm_key: str | None,
    openai_key: str | None,
) -> Settings:
    monkeypatch.delenv("LLM_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    if llm_key is not None:
        monkeypatch.setenv("LLM_API_KEY", llm_key)
    if openai_key is not None:
        monkeypatch.setenv("OPENAI_API_KEY", openai_key)
    # Игнорим .env файл чтобы тест был герметичным.
    return Settings(_env_file=None)  # type: ignore[arg-type]


def test_settings_reads_llm_api_key_directly(monkeypatch: pytest.MonkeyPatch) -> None:
    s = _make_settings(monkeypatch, llm_key="sk-llm-new", openai_key=None)
    assert s.llm_api_key == "sk-llm-new"
    assert s.openai_api_key == ""


def test_settings_falls_back_to_openai_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    s = _make_settings(monkeypatch, llm_key=None, openai_key="sk-old-openai")
    assert s.llm_api_key == "sk-old-openai", "fallback alias должен подхватить OPENAI_API_KEY"
    assert s.openai_api_key == "sk-old-openai"


def test_settings_prefers_new_var_over_old(monkeypatch: pytest.MonkeyPatch) -> None:
    s = _make_settings(
        monkeypatch, llm_key="sk-llm-wins", openai_key="sk-old-loses"
    )
    assert s.llm_api_key == "sk-llm-wins"


def test_settings_empty_when_neither_set(monkeypatch: pytest.MonkeyPatch) -> None:
    s = _make_settings(monkeypatch, llm_key=None, openai_key=None)
    assert s.llm_api_key == ""
    assert s.openai_api_key == ""


def test_provider_uses_llm_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    """OpenAIVisionProvider() без явного api_key читает settings.llm_api_key."""
    from app.providers.openai_vision import OpenAIVisionProvider

    monkeypatch.setattr("app.providers.openai_vision.settings.llm_api_key", "sk-from-settings")
    provider = OpenAIVisionProvider()
    try:
        assert provider.api_key == "sk-from-settings"
    finally:
        # aclose требует event loop; не закрываем — http client сам очистится при GC.
        pass
