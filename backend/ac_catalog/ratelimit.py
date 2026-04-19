"""Кастомные handlers для django-ratelimit: 403 → 429.

Семантически правильный код для rate-limit — 429 Too Many Requests.
django-ratelimit с block=True бросает Ratelimited (subclass
PermissionDenied), и Django default handler возвращает 403, а DRF —
401/403 через свой EXCEPTION_HANDLER.

Подключаем два механизма:
1. RATELIMIT_VIEW в settings — для Django middleware (django_ratelimit
   .middleware.RatelimitMiddleware), ловит Ratelimited из обычных
   Django views.
2. REST_FRAMEWORK.EXCEPTION_HANDLER — для DRF views (большинство
   публичных endpoints рейтинга), потому что DRF перехватывает
   PermissionDenied раньше Django middleware.

В обоих случаях — единый JSON `{"detail": "…"}` со статусом 429
и hint-заголовком `Retry-After: 60`.
"""
from __future__ import annotations

from django.http import JsonResponse
from django_ratelimit.exceptions import Ratelimited
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_default_handler


def _retry_after_60(response):
    """Добавляет Retry-After: 60 — клиент-hint, не строгий контракт."""
    response["Retry-After"] = "60"
    return response


def ratelimited_view(request, exception):
    """Handler для settings.RATELIMIT_VIEW (Django middleware path)."""
    response = JsonResponse(
        {"detail": "Слишком много запросов. Попробуй позже."},
        status=429,
    )
    return _retry_after_60(response)


def exception_handler(exc, context):
    """DRF EXCEPTION_HANDLER, заменяющий 403 на 429 для Ratelimited.

    Любые другие исключения уходят в стандартный DRF-handler без изменений.
    """
    if isinstance(exc, Ratelimited):
        response = Response(
            {"detail": "Слишком много запросов. Попробуй позже."},
            status=429,
        )
        return _retry_after_60(response)
    return drf_default_handler(exc, context)
