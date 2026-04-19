# ТЗ Фазы 4A — Public API

**Фаза:** 4A из 10 (Ф4 разбита на 4A + 4B)
**Ветка:** `ac-rating/04a-public-api` (от `main`)
**Зависит от:** Фаза 3 (смержена — scoring engine есть в main)
**Оценка:** 1 день

## Контекст

Ф1-3 уже в main: скелет, модели, scoring engine. Сейчас открываем публичный API, чтобы наш будущий frontend (Ф6A-C) мог с ним работать. **Django admin и XLSX-импорт НЕ трогаем** — это отдельная Ф4B.

Префикс `/api/public/v1/rating/` уже зарегистрирован в `backend/finans_assistant/urls.py` с Ф1 (указывает на `ac_catalog.public_urls`, сейчас там пустой `urlpatterns = []`). Наша задача — наполнить.

Исходник: `ac-rating/review/backend/{catalog,reviews,submissions}/` (ветка Максима `2026-03-25-xuef`).

## Исходные данные

### Что переносим (с переписыванием импортов на `ac_*`)

| Источник | Назначение | Строк | Примечания |
|---|---|---|---|
| `catalog/serializers.py` | `ac_catalog/serializers.py` | 350 | BrandSerializer, RegionSerializer, ACModelListSerializer, ACModelDetailSerializer, MethodologySerializer и др. |
| `catalog/views/__init__.py` | `ac_catalog/views/__init__.py` | — | re-export |
| `catalog/views/base.py` | `ac_catalog/views/base.py` | 24 | `LangMixin`, `parse_float_param` |
| `catalog/views/ac_models.py` | `ac_catalog/views/ac_models.py` | 106 | List/Detail/Archive/BySlug + MethodologyView |
| `catalog/views/methodology_export.py` | `ac_catalog/views/methodology_export.py` | 44 | `ExportCSVView` |
| `catalog/urls.py` | **слить в** `ac_catalog/public_urls.py` | 14 | роуты models/*, methodology/, export/csv/ |
| `reviews/serializers.py` | `ac_reviews/serializers.py` | 35 | ReviewSerializer, ReviewCreateSerializer |
| `reviews/views.py` | `ac_reviews/views.py` | 42 | ReviewListView, ReviewCreateView (ratelimit 5/h) |
| `reviews/urls.py` | `ac_reviews/urls.py` | 14 | `models/<id>/reviews/` и `reviews/` |
| `submissions/serializers.py` | `ac_submissions/serializers.py` | 80 | ACSubmissionCreateSerializer, BrandListSerializer |
| `submissions/views.py` | `ac_submissions/views.py` | 63 | BrandListView, ACSubmissionCreateView (ratelimit 3/h, photos) |
| `submissions/urls.py` | `ac_submissions/urls.py` | 8 | `brands/` и `submissions/` |

### i18n-утилита (новый файл, не из Максимовского `core/`)

У Максима есть `backend/core/i18n.py` с `get_localized_field`, `DEFAULT_LANGUAGE`, `SUPPORTED_LANGUAGES`, `FIELD_SUFFIX_MAP`, `UI_STRINGS`. В ERP `backend/core/` — общий модуль ERP, **не трогаем**. Создай:

**`backend/ac_catalog/i18n.py`** — перенеси содержимое `ac-rating/review/backend/core/i18n.py` 1-в-1 (импорты у Максима нейтральные — никаких `from catalog` и т.п.). Это утилита для рейтинга, живёт в `ac_catalog`, потому что `ac_catalog` — агрегатор домена.

### Маппинг импортов (во всех перенесённых файлах)

| Было | Стало |
|---|---|
| `from catalog.models import ...` | `from ac_catalog.models import ...` |
| `from catalog.serializers import ...` | `from ac_catalog.serializers import ...` |
| `from methodology.models import ...` | `from ac_methodology.models import ...` |
| `from scoring.engine import ...` | `from ac_scoring.engine import ...` |
| `from scoring.engine.computation import _build_model_context, _get_scorer` | `from ac_scoring.engine.computation import ...` |
| `from scoring.models import CalculationResult` | `from ac_scoring.models import ...` |
| `from brands.models import Brand` | `from ac_brands.models import Brand` |
| `from reviews.models import Review` | `from ac_reviews.models import Review` |
| `from submissions.models import ...` | `from ac_submissions.models import ...` |
| `from core.i18n import DEFAULT_LANGUAGE, get_localized_field` | `from ac_catalog.i18n import DEFAULT_LANGUAGE, get_localized_field` |

Проверочный grep после переноса:
```
grep -rE "from (catalog|methodology|scoring|brands|reviews|submissions)\." backend/ac_*/
grep -rE "from core\.i18n" backend/ac_*/
```
Оба должны быть пусты.

## Задачи

### 1. i18n-утилита

Создать `backend/ac_catalog/i18n.py` (копия из `ac-rating/review/backend/core/i18n.py`). Ничего не менять.

### 2. Сериализаторы

Перенести 3 файла (catalog/reviews/submissions), переписать импорты. **Не менять логику.** Особое внимание на абсолютные URL-ы фото/лого (используют `request.build_absolute_uri` — это работает в DRF из коробки, переносим 1-в-1).

### 3. Views

Перенести в соответствующие app: `ac_catalog/views/`, `ac_reviews/views.py`, `ac_submissions/views.py`. Переписать импорты. Логику не менять.

Функции `_client_ip` продублированы в `reviews/views.py` и `submissions/views.py` (у Максима). Перенеси как есть — не рефакторь, не DRY. (Это исходный код, если начнём чистить — плодим риски.)

### 4. URLs — ключевой момент интеграции

**`backend/ac_catalog/public_urls.py`** (был stub из Ф1 с `app_name="ac_rating_public"` и пустым `urlpatterns=[]`) — наполнить так:

```python
from django.urls import include, path

from . import views

app_name = "ac_rating_public"

urlpatterns = [
    # ac_catalog — модели + методика + экспорт
    path("models/", views.ACModelListView.as_view(), name="model-list"),
    path("models/archive/", views.ACModelArchiveListView.as_view(), name="model-archive"),
    path("models/<int:pk>/", views.ACModelDetailView.as_view(), name="model-detail"),
    path("models/by-slug/<slug:slug>/", views.ACModelDetailBySlugView.as_view(), name="model-detail-slug"),
    path("methodology/", views.MethodologyView.as_view(), name="methodology"),
    path("export/csv/", views.ExportCSVView.as_view(), name="export-csv"),

    # ac_reviews — отзывы (list по модели + create)
    path("", include("ac_reviews.urls")),

    # ac_submissions — бренды (для формы) + приём заявок
    path("", include("ac_submissions.urls")),
]
```

`ac_reviews/urls.py` и `ac_submissions/urls.py` — **без** `app_name` (они подключаются через include к `ac_catalog.public_urls`, который уже задаёт namespace `ac_rating_public`). Если Django начнёт требовать app_name — добавить с префиксом, но сначала попробуй без.

Конечные URL после подключения:
- `GET  /api/public/v1/rating/models/`
- `GET  /api/public/v1/rating/models/archive/`
- `GET  /api/public/v1/rating/models/<pk>/`
- `GET  /api/public/v1/rating/models/by-slug/<slug>/`
- `GET  /api/public/v1/rating/methodology/`
- `GET  /api/public/v1/rating/export/csv/`
- `GET  /api/public/v1/rating/models/<model_id>/reviews/`
- `POST /api/public/v1/rating/reviews/`
- `GET  /api/public/v1/rating/brands/`
- `POST /api/public/v1/rating/submissions/`

**Не добавлять** `/pages/<slug>/` (в исходнике Максима нет, план разрешил пропустить).

### 5. Permissions и throttling

- Все GET: `AllowAny` — по умолчанию DRF, если в REST_FRAMEWORK.DEFAULT_PERMISSION_CLASSES что-то другое, явно указать `permission_classes = [AllowAny]` во views. **Проверь** `backend/finans_assistant/settings.py REST_FRAMEWORK` — если там по умолчанию `IsAuthenticated`, придётся явно ставить AllowAny во всех GET-views, чтобы публичный API работал без логина.
- POST reviews: ratelimit 5/h по IP — уже в `reviews/views.py` у Максима, переносим как есть.
- POST submissions: ratelimit 3/h по IP — уже в `submissions/views.py`.

`django-ratelimit` уже в `requirements.txt` с Ф1.

### 6. Тесты API

Создать `tests/test_api.py` в каждой затронутой app (или общий в `ac_catalog`, как удобнее). Покрытие:

**ac_catalog/tests/test_api.py:**
- `GET /api/public/v1/rating/models/` — 200, возвращает список, пагинация работает (если есть)
- `GET /api/public/v1/rating/models/<pk>/` — 200 для существующей, 404 для несуществующей
- `GET /api/public/v1/rating/models/by-slug/<slug>/` — 200
- `GET /api/public/v1/rating/models/archive/` — 200, только archived
- Фильтры: `?brand=...`, `?region=...`, `?capacity_min=...`, `?capacity_max=...`, `?price_min=...`, `?price_max=...` — по одному happy-тесту на каждый
- `GET /api/public/v1/rating/methodology/` — 200 при активной методике, пустой/структурный ответ при её отсутствии (как у Максима)
- `GET /api/public/v1/rating/export/csv/` — 200, правильный Content-Type (text/csv)
- Опубликованная vs черновик: list не показывает DRAFT/REVIEW

**ac_reviews/tests/test_api.py:**
- `GET /api/public/v1/rating/models/<id>/reviews/` — 200, только `is_approved=True`
- `POST /api/public/v1/rating/reviews/` — 201, созданный отзыв `is_approved=False`, `ip_address` записан
- Ratelimit: 6-й POST в час — 429 (через `override_settings` или прямой вызов с `@override_ratelimit`)

**ac_submissions/tests/test_api.py:**
- `GET /api/public/v1/rating/brands/` — 200, только `is_active=True`, отсортировано по `name`
- `POST /api/public/v1/rating/submissions/` без фото — 400 с сообщением «Загрузите хотя бы одно фото измерений.»
- `POST /api/public/v1/rating/submissions/` с 21 фото — 400 «Максимум 20 фото.»
- `POST /api/public/v1/rating/submissions/` с файлом >10MB — 400
- `POST /api/public/v1/rating/submissions/` happy path (1-3 фото, minimal form) — 201, создана `ACSubmission` + `SubmissionPhoto` записи
- Ratelimit 3/h

Для теста ratelimit: `@override_settings(RATELIMIT_ENABLE=True)` или прямой вызов `ratelimit` API — смотри документацию django-ratelimit. Если в ERP глобально RATELIMIT_ENABLE=False для тестов — может придётся явно enable. Если сложно — оставь xfail с комментарием, не блокер.

### 7. Фабрики

Если в факториях Ф2 нет нужных пресетов (например, `ACModelFactory` с `publish_status=PUBLISHED`), **расширь** в том же `tests/factories.py` через `class Meta` params или новые sub-classes (`PublishedACModelFactory`). **Не дублируй** factory-модуль.

## Приёмочные критерии

- [ ] `./venv/bin/python manage.py check` — 0 issues
- [ ] `./venv/bin/python manage.py makemigrations --dry-run` — No changes detected
- [ ] `./venv/bin/python -m pytest ac_*/tests/ --no-cov` — всё зелёное (Ф2 models 45 + Ф3 scoring 78 + новые API-тесты)
- [ ] `grep -rE "from (catalog|methodology|scoring|brands|reviews|submissions)\." backend/ac_*/` — пусто
- [ ] `grep -rE "from core\.i18n" backend/ac_*/` — пусто (i18n перенесено в `ac_catalog/i18n.py`)
- [ ] Smoke-прогон (shell или curl):
  - `curl http://localhost:8000/api/public/v1/rating/models/` → 200 (или 404 если в БД ERP нет данных — это нормально, главное что не 500)
  - `curl http://localhost:8000/api/public/v1/rating/brands/` → 200 (`[]` если нет данных)
  - `curl http://localhost:8000/api/public/v1/rating/methodology/` → 200 (структурный ответ)
- [ ] Django admin **не тронут** — grep `admin.register` в `ac_*/admin.py` должен давать пусто (регистрация в Ф4B)

## Ограничения

- **НЕ трогать** `backend/catalog/`, `backend/methodology/`, `backend/scoring/`, `backend/brands/`, `backend/reviews/`, `backend/submissions/`, `backend/core/` — все существующие apps ERP остаются как есть.
- **НЕ менять** settings.py (REST_FRAMEWORK, INSTALLED_APPS уже настроены).
- **НЕ регистрировать** модели в Django admin — это Ф4B.
- **НЕ переносить** `catalog/admin/`, `methodology/admin/`, `reviews/admin.py`, `submissions/admin.py`, `brands/admin.py` — это Ф4B.
- **НЕ переносить** `catalog/management/commands/import_v2.py`, `catalog/services/model_import.py`, `catalog/services/import_template.py` — это Ф4B.
- **НЕ переносить** `methodology/services.py` — это для Django admin (клонирование версий), Ф4B.
- **НЕ коммитить** секреты/`.env`.
- Conventional Commits. Логические коммиты: (1) i18n-утилита + serializers, (2) views + urls, (3) tests.

## Формат отчёта

Положить в `ac-rating/reports/04a-public-api.md`:
1. Имя ветки и список коммитов
2. Что сделано — список перенесённых файлов + новых (i18n, тесты, URL-конфигурация)
3. Что НЕ сделано (из ТЗ — ничего, если всё сделано; если что-то вылезло из scope — описать)
4. Результаты прогонов: `pytest ac_*/`, `manage.py check`, `makemigrations --dry-run`, smoke-curl на каждый endpoint
5. Известные риски / сюрпризы (если permissions в settings были IsAuthenticated, если ratelimit тест-мок не сработал, и т.п.)
6. Ключевые файлы для ревью (с путями и строками)

## Подсказки от техлида

- **REST_FRAMEWORK default permissions в ERP:** ERP — большой ERP-комбайн с дефолтным `IsAuthenticated` во многих контурах. Сначала попробуй без явных `permission_classes`; если GET даёт 401/403 — явно ставь `permission_classes = [AllowAny]` в каждом публичном view. Не меняй глобальный `DEFAULT_PERMISSION_CLASSES`.
- **`include("ac_reviews.urls")` без app_name:** если Django ругается «Specifying a namespace in include() without providing an app_name», два варианта: (1) добавить `app_name = "ac_reviews_public"` в `ac_reviews/urls.py` + `namespace` в include; (2) передать как кортеж `include(("ac_reviews.urls", "ac_reviews"))`. Первый чище — делай первый.
- **`catalog/services/criteria_rows.py` и `catalog/services/raw_values_migration.py`** — мелкие утилиты; если используются в сериализаторе, перенеси в `ac_catalog/services/`. Если нет — **не перенося**.
- **`ExportCSVView`** скорее всего собирает CSV через `csv.writer` + `HttpResponse` с `content_type='text/csv'`. Переноси 1-в-1, проверь что не ломается на пустой БД (если ломается — в тесте проверь только content-type, не содержимое).
- **`_get_scorer`, `_build_model_context`** импортируются из `ac_scoring.engine.computation` (private API). Максим так делает — мы сохраняем совместимость. В Ф8 может быть стоит вытащить в публичный API, сейчас не трогаем.
- **Чистота Ф4B:** когда ты сдашь Ф4A, следующий агент (или ты на Ф4B) будет знать, что все публичные views/serializers/urls уже есть, и Ф4B — только про Django admin + XLSX импорт. Не пересекайтесь.
