"""Создать (или обновить) LLMProfile с произвольными параметрами (F8-04).

Recognition использует один OpenAIVisionProvider для всех OpenAI-compat
endpoints (DeepSeek, OpenAI, Gemini, xAI Grok) — отдельных provider class'ов
нет; провайдер переключается через `base_url` + модели в LLMProfile.
Эта команда добавляет произвольный профиль одним вызовом, без UI.

Чем отличается от `create_initial_llm_profile`:
- `create_initial_llm_profile` — для первого setup'а, читает api_key из
  LLM_API_KEY/OPENAI_API_KEY env, ставит is_default если профилей нет.
  Idempotent: skip если name уже есть.
- `create_llm_profile` (этот) — для добавления НОВОГО провайдера рядом с
  существующими (Grok, новая локальная модель и т.п.). is_default НЕ трогает
  (переключается через UI / set-default action). Принимает api_key из
  аргумента или явного env. Поддерживает `--update` для перезаписи (rotate).

Usage (xAI Grok):
    docker exec ismeta-backend python manage.py create_llm_profile \\
        --name "Grok 4" \\
        --base-url "https://api.x.ai" \\
        --extract-model "grok-4" \\
        --multimodal-model "grok-2-vision-1212" \\
        --classify-model "grok-2-1212" \\
        --vision-supported false \\
        --api-key "$XAI_API_KEY"

Если --api-key не задан, ключ читается из --api-key-env (default: API_KEY).
"""

from __future__ import annotations

import os

from django.core.management.base import BaseCommand, CommandError

from apps.llm_profiles.models import LLMProfile


class Command(BaseCommand):
    help = "Создать (или обновить) LLMProfile в ismeta-postgres."

    def add_arguments(self, parser):
        parser.add_argument(
            "--name",
            required=True,
            help="Имя профиля в UI (уникальное). Например: 'Grok 4'.",
        )
        parser.add_argument(
            "--base-url",
            required=True,
            help=(
                "Базовый URL без /v1 — recognition сам добавляет суффикс. "
                "Примеры: https://api.openai.com, https://api.deepseek.com, "
                "https://api.x.ai."
            ),
        )
        parser.add_argument(
            "--extract-model",
            required=True,
            help="Модель для text-extraction.",
        )
        parser.add_argument(
            "--multimodal-model",
            default="",
            help=(
                "Модель для multimodal/Vision retry. Пусто = fallback на "
                "extract-model в proxy."
            ),
        )
        parser.add_argument(
            "--classify-model",
            default="",
            help=(
                "Модель для legacy Vision-fallback. Пусто = fallback на "
                "extract-model."
            ),
        )
        parser.add_argument(
            "--vision-supported",
            choices=["true", "false"],
            default="false",
            help=(
                "Включить Vision Counter + Multimodal Retry. Default false: "
                "эти пути дороги, нужны не на всех PDF, для нового провайдера "
                "лучше начать с false и включать осознанно после verify "
                "(см. memory feedback_profile_vision_supported)."
            ),
        )
        parser.add_argument(
            "--api-key",
            default=None,
            help=(
                "API key. Если не задан — читаем из env, имя env даёт "
                "--api-key-env (default: API_KEY)."
            ),
        )
        parser.add_argument(
            "--api-key-env",
            default="API_KEY",
            help=(
                "Имя env переменной с API key (если --api-key не задан). "
                "Примеры: XAI_API_KEY, GROK_API_KEY, OPENAI_API_KEY."
            ),
        )
        parser.add_argument(
            "--update",
            action="store_true",
            help="Обновить уже существующий профиль с этим name (иначе skip).",
        )

    def handle(self, *args, **opts):
        name = opts["name"]
        api_key = (opts["api_key"] or os.environ.get(opts["api_key_env"]) or "").strip()
        if not api_key:
            raise CommandError(
                f"API key не задан: передайте --api-key или установите "
                f"env {opts['api_key_env']}."
            )

        existing = LLMProfile.objects.filter(name=name).first()
        if existing and not opts["update"]:
            self.stdout.write(
                self.style.NOTICE(
                    f"Профиль {name!r} уже существует (id={existing.id}). "
                    "Используйте --update для перезаписи."
                )
            )
            return

        vision = opts["vision_supported"] == "true"
        target = existing or LLMProfile(name=name)
        target.base_url = opts["base_url"]
        target.extract_model = opts["extract_model"]
        target.multimodal_model = opts["multimodal_model"]
        target.classify_model = opts["classify_model"]
        target.vision_supported = vision
        target.set_api_key(api_key)
        target.save()

        action = "обновлён" if existing else "создан"
        self.stdout.write(
            self.style.SUCCESS(
                f"LLMProfile {action}: id={target.id} name={target.name!r} "
                f"base_url={target.base_url} extract={target.extract_model} "
                f"multimodal={target.multimodal_model or '(=extract)'} "
                f"classify={target.classify_model or '(=extract)'} "
                f"vision_supported={vision}"
            )
        )
