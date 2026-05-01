"""F8-04: management command create_llm_profile (generic).

Команда добавляет произвольный LLMProfile (xAI Grok, локальные модели и т.п.)
рядом с уже существующими — в отличие от `create_initial_llm_profile`,
который только для первого setup'а с одним default'ом.

Покрывает:
- Создание нового профиля с обязательными аргументами + API key из --api-key.
- Чтение API key из env (--api-key-env с default API_KEY и кастомным именем).
- Idempotency (skip без --update).
- Перезапись через --update (rotate api_key + смена моделей).
- Падение с CommandError если api_key не задан нигде.
- vision_supported flag.
- is_default НЕ переключается даже если профилей нет.
"""

from __future__ import annotations

import io

import pytest
from cryptography.fernet import Fernet
from django.core.management import call_command
from django.core.management.base import CommandError

from apps.llm_profiles.models import LLMProfile

TEST_FERNET_KEY = Fernet.generate_key().decode()

# Минимальный набор обязательных аргументов для xAI Grok — используем как
# базовый template в тестах.
GROK_ARGS = [
    "--name",
    "Grok 4",
    "--base-url",
    "https://api.x.ai",
    "--extract-model",
    "grok-4",
]


@pytest.fixture(autouse=True)
def _set_fernet_key(settings):
    settings.LLM_PROFILE_ENCRYPTION_KEY = TEST_FERNET_KEY


@pytest.fixture
def _no_api_env(monkeypatch):
    for var in ("API_KEY", "XAI_API_KEY", "GROK_API_KEY", "OPENAI_API_KEY"):
        monkeypatch.delenv(var, raising=False)


@pytest.mark.django_db
def test_create_grok_profile_explicit_key(_no_api_env):
    out = io.StringIO()
    call_command(
        "create_llm_profile",
        *GROK_ARGS,
        "--multimodal-model",
        "grok-2-vision-1212",
        "--classify-model",
        "grok-2-1212",
        "--api-key",
        "xai-secret-1",
        stdout=out,
    )

    p = LLMProfile.objects.get(name="Grok 4")
    assert p.base_url == "https://api.x.ai"
    assert p.extract_model == "grok-4"
    assert p.multimodal_model == "grok-2-vision-1212"
    assert p.classify_model == "grok-2-1212"
    assert p.vision_supported is False
    assert p.get_api_key() == "xai-secret-1"
    assert "создан" in out.getvalue()


@pytest.mark.django_db
def test_reads_api_key_from_default_env(monkeypatch, _no_api_env):
    monkeypatch.setenv("API_KEY", "from-default-env")
    call_command("create_llm_profile", *GROK_ARGS)
    assert LLMProfile.objects.get(name="Grok 4").get_api_key() == "from-default-env"


@pytest.mark.django_db
def test_reads_api_key_from_custom_env(monkeypatch, _no_api_env):
    """--api-key-env XAI_API_KEY → читаем оттуда, а не из API_KEY."""
    monkeypatch.setenv("API_KEY", "wrong")
    monkeypatch.setenv("XAI_API_KEY", "right")
    call_command(
        "create_llm_profile",
        *GROK_ARGS,
        "--api-key-env",
        "XAI_API_KEY",
    )
    assert LLMProfile.objects.get(name="Grok 4").get_api_key() == "right"


@pytest.mark.django_db
def test_idempotent_skip_without_update(_no_api_env):
    call_command("create_llm_profile", *GROK_ARGS, "--api-key", "xai-1")
    out = io.StringIO()
    call_command(
        "create_llm_profile", *GROK_ARGS, "--api-key", "xai-2", stdout=out
    )
    # Без --update второй вызов оставляет старый ключ.
    assert LLMProfile.objects.get(name="Grok 4").get_api_key() == "xai-1"
    assert "уже существует" in out.getvalue()


@pytest.mark.django_db
def test_update_rotates_key_and_models(_no_api_env):
    call_command("create_llm_profile", *GROK_ARGS, "--api-key", "xai-1")
    out = io.StringIO()
    call_command(
        "create_llm_profile",
        "--name",
        "Grok 4",
        "--base-url",
        "https://api.x.ai",
        "--extract-model",
        "grok-2-1212",  # rotate to fast
        "--api-key",
        "xai-2",
        "--update",
        stdout=out,
    )
    p = LLMProfile.objects.get(name="Grok 4")
    assert p.get_api_key() == "xai-2"
    assert p.extract_model == "grok-2-1212"
    assert "обновлён" in out.getvalue()


@pytest.mark.django_db
def test_missing_key_raises(_no_api_env):
    with pytest.raises(CommandError):
        call_command("create_llm_profile", *GROK_ARGS)


@pytest.mark.django_db
def test_missing_required_args_raises(_no_api_env):
    with pytest.raises(CommandError):
        call_command("create_llm_profile", "--api-key", "x")  # нет --name etc.


@pytest.mark.django_db
def test_vision_supported_flag(_no_api_env):
    call_command(
        "create_llm_profile",
        *GROK_ARGS,
        "--api-key",
        "xai-1",
        "--vision-supported",
        "true",
    )
    assert LLMProfile.objects.get(name="Grok 4").vision_supported is True


@pytest.mark.django_db
def test_does_not_set_default_even_when_first(_no_api_env):
    """Команда не трогает is_default — переключаем через UI / set-default
    action. Для нового провайдера (Grok) дефолтным становиться неуместно:
    OpenAI/DeepSeek дают качество выше на ОВиК-таблицах (TD-17g)."""
    assert LLMProfile.objects.count() == 0
    call_command("create_llm_profile", *GROK_ARGS, "--api-key", "xai-1")
    assert LLMProfile.objects.get(name="Grok 4").is_default is False


@pytest.mark.django_db
def test_optional_models_default_to_empty(_no_api_env):
    """Если --multimodal-model / --classify-model не переданы — поля пустые,
    proxy.build_llm_headers сделает fallback на extract_model."""
    call_command("create_llm_profile", *GROK_ARGS, "--api-key", "xai-1")
    p = LLMProfile.objects.get(name="Grok 4")
    assert p.multimodal_model == ""
    assert p.classify_model == ""
