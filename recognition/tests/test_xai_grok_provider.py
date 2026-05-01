"""F8-04: xAI Grok через generic OpenAIVisionProvider.

Recognition не имеет отдельного XaiProvider — мы обходимся одним
OpenAI-compat провайдером с переключением `api_base`. Этот файл
закрепляет ожидаемое поведение для api_base=https://api.x.ai:

- URL'ы строятся как /v1/chat/completions и /v1/models (наш конвенция —
  base_url БЕЗ /v1).
- seed/top_p приходят в payload (Grok их поддерживает в отличие от Gemini).
- Vision payload корректно формируется для grok-2-vision-1212.

Если xAI добавит host-specific quirk (например seed unsupported), эти
тесты сразу покажут где править.
"""

from __future__ import annotations

import pytest

from app.config import settings
from app.providers.openai_vision import OpenAIVisionProvider


def test_xai_chat_and_models_urls():
    """LLMProfile.base_url=https://api.x.ai должен дать корректные URL-ы.

    BRIEF/ТЗ упоминают «https://api.x.ai/v1» — это URL OpenAI-compat базы
    в смысле xAI docs. Но в LLMProfile.base_url мы храним bare host без /v1
    (как у OpenAI / DeepSeek), а recognition сам добавляет /v1 в _chat_url.
    Если кто-то в БД заведёт base_url с /v1 в конце — получится
    /v1/v1/chat/completions и сломается; этот тест фиксирует конвенцию.
    """
    p = OpenAIVisionProvider(api_key="xai-test", api_base="https://api.x.ai")
    assert p._chat_url() == "https://api.x.ai/v1/chat/completions"
    assert p._models_url() == "https://api.x.ai/v1/models"


def test_xai_supports_seed():
    """xAI Grok принимает OpenAI-compat `seed` (по docs).

    Detection идёт через `googleapis.com not in api_base` — для api.x.ai
    seed должен включаться, как для OpenAI/DeepSeek.
    """
    p = OpenAIVisionProvider(api_key="xai-test", api_base="https://api.x.ai")
    assert p._supports_seed is True


def test_gemini_still_skips_seed():
    """Регрессия TD-08: для Gemini seed по-прежнему отключён, добавление
    Grok не сломало detection."""
    p = OpenAIVisionProvider(
        api_key="gem-test",
        api_base="https://generativelanguage.googleapis.com/v1beta/openai",
    )
    assert p._supports_seed is False


@pytest.mark.asyncio
async def test_xai_text_complete_payload(monkeypatch: pytest.MonkeyPatch):
    """grok-4 text completion: seed + top_p + max_tokens (не _completion_)
    + json_object response_format.

    grok-4 НЕ начинается на gpt-5/o1/o3/o4 — `_apply_max_tokens` должен
    положить именно `max_tokens` (не `max_completion_tokens`). xAI принимает
    оба, но `max_tokens` — это что мы ожидаем для Grok (legacy-имя).
    """
    captured: dict = {}

    async def fake_unguarded(self: OpenAIVisionProvider, payload: dict) -> dict:
        captured.update(payload)
        return {"choices": [{"message": {"content": "{}"}}], "usage": {}}

    monkeypatch.setattr(
        OpenAIVisionProvider, "_post_with_retry_unguarded", fake_unguarded
    )
    p = OpenAIVisionProvider(
        api_key="xai-test",
        api_base="https://api.x.ai",
        extract_model="grok-4",
        multimodal_model="grok-2-vision-1212",
    )
    try:
        await p.text_complete("ответь JSON {}")
    finally:
        await p.aclose()

    assert captured["model"] == "grok-4"
    assert captured["seed"] == settings.llm_seed
    assert captured["top_p"] == settings.llm_top_p
    assert captured["temperature"] == 0.0
    assert captured["response_format"] == {"type": "json_object"}
    assert "max_tokens" in captured, "Grok не reasoning-модель → max_tokens"
    assert "max_completion_tokens" not in captured


@pytest.mark.asyncio
async def test_xai_multimodal_payload(monkeypatch: pytest.MonkeyPatch):
    """grok-2-vision-1212 принимает OpenAI-compat image_url content block.

    Проверяем что multimodal_complete формирует правильную структуру:
    role=user → content list с text + image_url (data: URI с PNG base64).
    """
    captured: dict = {}

    async def fake_unguarded(self: OpenAIVisionProvider, payload: dict) -> dict:
        captured.update(payload)
        return {"choices": [{"message": {"content": "{}"}}], "usage": {}}

    monkeypatch.setattr(
        OpenAIVisionProvider, "_post_with_retry_unguarded", fake_unguarded
    )
    p = OpenAIVisionProvider(
        api_key="xai-test",
        api_base="https://api.x.ai",
        extract_model="grok-4",
        multimodal_model="grok-2-vision-1212",
    )
    try:
        await p.multimodal_complete("describe", image_b64="ZmFrZQ==")
    finally:
        await p.aclose()

    assert captured["model"] == "grok-2-vision-1212"
    msg = captured["messages"][-1]
    assert msg["role"] == "user"
    blocks = msg["content"]
    assert any(b["type"] == "text" for b in blocks)
    img = next(b for b in blocks if b["type"] == "image_url")
    assert img["image_url"]["url"].startswith("data:image/png;base64,")
    # detail=high — OpenAI-specific hint, xAI игнорирует но не падает.
    assert img["image_url"]["detail"] == "high"


def test_xai_pricing_known():
    """Grok модели должны быть в pricing.json — иначе UI рисует «—»."""
    from app.services.pricing import calc_cost, reset_cache

    reset_cache()
    assert calc_cost("grok-4", 1000, 200) is not None
    assert calc_cost("grok-2-vision-1212", 1000, 200) is not None
    assert calc_cost("grok-2-1212", 1000, 200) is not None

    # grok-4: input $3/1M, output $15/1M, cached $0.
    # 1000 * 3/1M + 200 * 15/1M = 0.003 + 0.003 = 0.006
    cost = calc_cost("grok-4", 1000, 200)
    assert cost is not None
    assert abs(cost - 0.006) < 1e-9


def test_xai_cached_does_not_fallback_to_half_input():
    """Защитный тест на _comment в pricing.json: cached=0.0 явно прописан
    чтобы fallback `input × 0.5` НЕ применился к Grok (xAI не публикует
    cached-ставку).
    """
    from app.services.pricing import calc_cost, reset_cache

    reset_cache()
    # 100 prompt токенов, из них 100 cached — должны стоить 0
    # (100 * 0 / 1M), а не 100 * 1.5 / 1M = 0.00015.
    cost = calc_cost("grok-4", 100, 0, cached_tokens=100)
    assert cost is not None
    assert cost == 0.0
