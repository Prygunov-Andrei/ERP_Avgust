"""
Smoke-check доступности LLM.

Проверяет:
  1. Default LLM provider в БД существует и активен.
  2. У него задана env-переменная, и она присутствует в окружении процесса.
  3. (--ping) Провайдер отвечает на короткий chat_completion.

Exit code:
  0  — всё ок
  1  — проверка не прошла

Использование в деплое:
    docker compose exec -T backend python manage.py check_llm --ping
"""
from __future__ import annotations

import os
import sys

from django.core.management.base import BaseCommand

from llm_services.models import LLMProvider


class Command(BaseCommand):
    help = 'Проверяет работоспособность default LLM-провайдера'

    def add_arguments(self, parser):
        parser.add_argument(
            '--ping',
            action='store_true',
            help='Отправить тестовый запрос к провайдеру (дополнительная плата за токены)',
        )
        parser.add_argument(
            '--quiet',
            action='store_true',
            help='Минимальный вывод — только финальный статус',
        )

    def _fail(self, msg: str) -> None:
        self.stderr.write(self.style.ERROR(f'[check_llm] FAIL: {msg}'))
        sys.exit(1)

    def _ok(self, msg: str, quiet: bool = False) -> None:
        if not quiet:
            self.stdout.write(self.style.SUCCESS(f'[check_llm] OK: {msg}'))

    def handle(self, *args, **options):
        quiet = options['quiet']

        try:
            provider = LLMProvider.get_default()
        except LLMProvider.DoesNotExist as e:
            self._fail(f'Нет активного LLM-провайдера в БД ({e}). Запустите: manage.py setup_providers')

        if not provider.is_active:
            self._fail(f'Default провайдер {provider} помечен is_active=False')

        self._ok(f'Default провайдер: {provider} (env={provider.env_key_name})', quiet)

        if not provider.env_key_name:
            self._fail(f'У провайдера {provider} пустое поле env_key_name')

        api_key = os.environ.get(provider.env_key_name)
        if not api_key:
            self._fail(
                f'В окружении процесса нет переменной {provider.env_key_name}. '
                f'Проверьте .env и перезапустите celery-worker + backend.'
            )

        masked = f'{api_key[:4]}…{api_key[-4:]}' if len(api_key) >= 8 else '***'
        self._ok(f'{provider.env_key_name} присутствует ({masked})', quiet)

        if not options['ping']:
            self.stdout.write(self.style.SUCCESS('[check_llm] PASS (без ping). Для полной проверки: --ping'))
            return

        try:
            from llm_services.providers import get_provider
            client = get_provider(provider)
            response = client.chat_completion(
                system_prompt='Отвечай одним словом.',
                user_prompt='Напиши слово: ok',
                response_format='text',
            )
        except Exception as e:
            self._fail(f'Ping упал: {type(e).__name__}: {e}')

        if not response:
            self._fail('Ping вернул пустой ответ')

        self._ok(f'Ping успешен (ответ: {str(response)[:100]})', quiet)
        self.stdout.write(self.style.SUCCESS('[check_llm] PASS'))
