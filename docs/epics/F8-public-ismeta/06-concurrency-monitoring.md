# F8-06: Concurrency limit + monitoring + логирование

**Команда:** IS-Петя
**Effort:** 1 день
**Зависимости:** 05 (frontend) — для testing concurrency UX.

---

## Цель

Реализовать защиту от злоупотреблений в backend: ограничение
«1 PDF одновременно с одной сессии» через cookie + IP fallback,
configurable через `HvacIsmetaSettings.concurrency_limit_enabled`.
Плюс мониторинг (Grafana / простые dashboards) и подробное
логирование для анализа использования.

## Текущее состояние

- F8-03 уже реализовал базовую concurrency check в `IsmetaPublicViewSet.parse`:
  ```python
  if settings_obj.concurrency_limit_enabled:
      active = IsmetaJob.objects.filter(
          Q(session_key=session_key) | Q(ip_address=ip),
          status__in=["queued", "processing"],
      ).exists()
      if active:
          return Response({"error": "..."}, status=429)
  ```
- Logging минимальный (Django default access log).
- Нет dashboards для мониторинга расходов, ошибок, времени отклика.

## Целевое состояние

### Concurrency: cookie + IP двух-уровневая

#### Уровень 1: Session cookie (`hvac_ismeta_session`)

При первом visit hvac-info.com/ismeta — backend выставляет
HTTP-only cookie с UUID. Срок жизни: 30 дней. Cookie identifies
«сессию» — один пользователь одного браузера.

#### Уровень 2: IP fallback

Если cookie новый, но с этого IP уже идёт обработка — тоже
блокируем. Это защищает от обхода через clear cookies.

#### Сообщение пользователю

При 429:
```
{
  "error": "У вас уже идёт обработка.",
  "active_job_id": "<uuid>",
  "estimated_completion": "2026-05-01T15:32:00Z"  // если есть
}
```

Frontend показывает «У вас уже обрабатывается PDF — дождитесь
завершения. Прогресс: страница X/Y».

### Bypass для internal use

Когда тот же recognition сервис используется внутри ISMeta MVP
(порт 3001) — concurrency limit НЕ применяется (`enabled=false` в
настройках). Уже учтено в HvacIsmetaSettings.

### Rate limiting (уровень 3)

В дополнение к concurrency — rate limit на количество PDF в час:

- N PDF в час с одной session_key → 5 (default, configurable)
- N PDF в час с одного IP → 10 (default, configurable)
- N PDF в день с одного IP → 30

Реализация через Redis (`django-ratelimit` или вручную). При
превышении — 429 с сообщением «Превышен лимит. Попробуйте через X
минут».

Все настройки в `HvacIsmetaSettings`:

```python
# F8-02 добавить:
hourly_per_session: int = 5
hourly_per_ip: int = 10
daily_per_ip: int = 30
```

### Monitoring dashboards

#### Метрики для tracking

1. **Throughput:**
   - Requests / hour (стек график)
   - Successful jobs / hour
   - Error jobs / hour
2. **Performance:**
   - Average time per job (median, p95, p99)
   - Average pages per job
   - Pipeline distribution (TD-17g vs main)
3. **Cost:**
   - Total $ per day (LLM cost)
   - $ per pipeline
   - $ per LLM provider
4. **Errors:**
   - Error types (validation, timeout, recognition fail, ...)
   - Top errors
5. **User behavior:**
   - Pipeline default vs user-changed
   - LLM model distribution
   - Files with email feedback (% от total)
   - Feedback ratio (👍 vs 👎)

#### Где dashboards

Опции:
- **Простой:** Django admin custom view (`/hvac/ismeta/stats`) —
  читает IsmetaJob aggregates, показывает простые тарелки.
- **Полный:** Grafana + Prometheus exporter из Django metrics endpoint.

**Рекомендация для v1:** Django admin view (быстро, без новой
инфраструктуры). Grafana — на будущее когда трафик подрастёт.

### Логирование

#### Structured logging

Все ключевые события идут в JSON log:

```json
{
  "level": "INFO",
  "ts": "2026-05-01T15:32:01Z",
  "event": "ismeta_job_started",
  "job_id": "abc-123",
  "session_key": "<short_hash>",
  "ip_hash": "<sha256_truncated>",  // не raw IP — privacy
  "pdf_filename": "spec.pdf",
  "pdf_size_bytes": 1234567,
  "pipeline": "td17g",
  "llm_profile_id": 6
}
```

```json
{
  "level": "INFO",
  "event": "ismeta_job_completed",
  "job_id": "abc-123",
  "duration_seconds": 187,
  "pages_processed": 9,
  "items_count": 153,
  "cost_usd": 0.04
}
```

#### Privacy

- Не логируем raw IP (хеш SHA-256 первых 8 символов).
- Не логируем full filename (только extension и size).
- Не логируем content PDF.
- Email — отдельный лог-channel «contacts» (если был задан).

## Файлы которые меняем

### Backend

#### `backend/hvac_ismeta/middleware.py` (новый)

Set HTTP-only cookie `hvac_ismeta_session` если отсутствует:

```python
class IsmetaSessionMiddleware:
    def __call__(self, request):
        if "hvac_ismeta_session" not in request.COOKIES:
            session_key = uuid.uuid4().hex
            request._new_ismeta_session = session_key
        response = self.get_response(request)
        if hasattr(request, "_new_ismeta_session"):
            response.set_cookie(
                "hvac_ismeta_session",
                request._new_ismeta_session,
                max_age=30 * 86400,
                httponly=True,
                samesite="Lax",
                secure=True,  # production только
            )
        return response
```

Подключить в `MIDDLEWARE` в `backend/finans_assistant/settings.py`.

#### `backend/hvac_ismeta/ratelimit.py` (новый)

Redis-based rate limit (если ratelimit еще не используется):

```python
from django.core.cache import cache
from django.utils import timezone

def check_hourly_session(session_key: str, limit: int) -> bool:
    """Returns True if под лимитом, False если exceeded."""
    bucket_key = f"ismeta:rate:session:{session_key}:{timezone.now().strftime('%Y%m%d%H')}"
    count = cache.get(bucket_key, 0)
    if count >= limit:
        return False
    cache.set(bucket_key, count + 1, 3600)
    return True

def check_hourly_ip(ip: str, limit: int) -> bool:
    """Same для IP per hour."""
    ...

def check_daily_ip(ip: str, limit: int) -> bool:
    """IP per day (24h window)."""
    ...
```

#### `backend/hvac_ismeta/views.py` (расширить F8-03)

В `IsmetaPublicViewSet.parse`:

```python
def parse(self, request):
    settings_obj = HvacIsmetaSettings.get_settings()
    if not settings_obj.enabled:
        return Response({"error": "..."}, status=503)

    session_key = request.COOKIES.get("hvac_ismeta_session", "anonymous")
    ip = self._get_client_ip(request)

    # Concurrency
    if settings_obj.concurrency_limit_enabled:
        active_query = IsmetaJob.objects.filter(
            Q(session_key=session_key) | Q(ip_address=ip),
            status__in=["queued", "processing"],
        )
        active = active_query.first()
        if active:
            return Response({
                "error": "У вас уже идёт обработка.",
                "active_job_id": str(active.id),
            }, status=429)

    # Rate limit
    from .ratelimit import check_hourly_session, check_hourly_ip, check_daily_ip
    if not check_hourly_session(session_key, settings_obj.hourly_per_session):
        return Response({"error": "Превышен лимит на сессию (час)."}, status=429)
    if not check_hourly_ip(ip, settings_obj.hourly_per_ip):
        return Response({"error": "Превышен лимит на IP (час)."}, status=429)
    if not check_daily_ip(ip, settings_obj.daily_per_ip):
        return Response({"error": "Превышен лимит на IP (день)."}, status=429)

    # ... rest as F8-03
```

#### `backend/hvac_ismeta/admin.py` (расширить)

Добавить custom admin view `/admin/hvac_ismeta/stats/`:

```python
class IsmetaStatsAdmin(admin.AdminSite):
    def stats_view(self, request):
        # Aggregations
        today = timezone.now().date()
        last_7d = today - timedelta(days=7)
        ...
        return TemplateResponse(request, "admin/ismeta_stats.html", context)
```

Template `admin/ismeta_stats.html`:
- Cards: total today, last 7d, last 30d
- Pipeline distribution chart (TD-17g vs main)
- Avg duration / median / p95
- Cost total per period
- Error distribution

Использовать Django admin built-in style (consistency).

### Frontend (минимальные изменения)

В `frontend/app/(hvac-info)/ismeta/page.tsx` обработка 429:

```typescript
if (resp.status === 429) {
  if (resp.data.active_job_id) {
    // Показать сообщение «У вас уже идёт обработка» + кнопку
    // «Перейти к активной обработке» (load progress по active_job_id)
  } else {
    // Rate limit: «Превышен лимит. Попробуйте через час.»
  }
}
```

## Acceptance criteria

### Concurrency
- [ ] Session cookie `hvac_ismeta_session` устанавливается при первом
      visit, срок 30 дней, HttpOnly, SameSite=Lax.
- [ ] При active job с того же session_key → 429 с `active_job_id`.
- [ ] При active job с того же IP (даже с новым cookie) → 429.
- [ ] Если `concurrency_limit_enabled=False` в HvacIsmetaSettings →
      не блокирует.

### Rate limit
- [ ] При превышении hourly_per_session → 429 с сообщением.
- [ ] При превышении hourly_per_ip → 429.
- [ ] При превышении daily_per_ip → 429.
- [ ] Limit reset после end of hour/day.

### Logging
- [ ] Каждый job старт/конец логирован в JSON.
- [ ] Не логируются raw IP, full filename, content.
- [ ] Логи доступны через `docker logs ismeta-backend`.

### Stats dashboard
- [ ] `/admin/hvac_ismeta/stats/` доступен superuser'у.
- [ ] Показывает throughput, duration, cost, errors за периоды.
- [ ] Pipeline distribution chart.

### Error handling
- [ ] Frontend корректно обрабатывает 429.
- [ ] При active_job — кнопка «Перейти к активной обработке» работает.

## Тест-план

1. **Cookie set:** очистить cookies → visit `/ismeta` → cookie появилась.
2. **Concurrency same session:** запустить parse, в той же вкладке
   запустить 2-й → 429.
3. **Concurrency same IP, new cookie:** очистить cookies в новой
   вкладке → 2-й parse → 429 (IP match).
4. **Disabled:** в HvacIsmetaSettings выключить
   `concurrency_limit_enabled` → 2-й parse работает.
5. **Hourly limit:** загрузить 5 PDF подряд (быстрых, мелких) с
   одной сессии → 6-й = 429 «Превышен лимит на сессию».
6. **Daily limit:** mock cache → загрузить 30 → 31-й = 429.
7. **Logs:** проверить `docker logs ismeta-backend` → JSON-events
   `ismeta_job_started`, `ismeta_job_completed`.
8. **Stats:** open `/admin/hvac_ismeta/stats/` → таблицы корректные.

## Риски

- **Cookie can be cleared:** пользователь может очистить cookies
  → IP fallback это покрывает (но не полностью — VPN обходит).
- **Rate limit impact на legit пользователей:** office wifi с 30
  сметчиками — общий IP. Default daily_per_ip=30 — узковато.
  Mitigation: default 30 hardcoded, легко увеличить через settings
  при росте использования.
- **Cache invalidation:** rate limit зависит от Redis. Если Redis
  упадёт — fallback на «не блокировать» (fail-open). Liberal default,
  но не блокирует normal users.

## Definition of Done

- Concurrency 2-уровневая (session + IP) работает.
- Rate limit реализован, configurable.
- Logging structured + privacy-respecting.
- Stats dashboard работает в Django admin.
- Frontend handles 429 gracefully.
- Все settings в HvacIsmetaSettings (singleton, через UI editable).
