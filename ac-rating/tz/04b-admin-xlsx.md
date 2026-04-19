# ТЗ Фазы 4B — Django admin + XLSX импорт

**Фаза:** 4B из 10 (Ф4 разбита; Ф4A смержена)
**Ветка:** `ac-rating/04b-admin-xlsx` (от `main`)
**Зависит от:** Фаза 4A (public API + сериализаторы уже есть)
**Оценка:** 1 день

## Контекст

Публичный API готов (Ф4A). Сейчас — Django admin для всех 14 моделей ac_* + management command `import_ac_rating_xlsx`. Это UI для Андрея, чтобы управлять моделями/методиками/отзывами/заявками до того, как в Ф8A-C мы перепишем админку на shadcn.

По плану «Админка UI на MVP — Django admin as-is».

Исходник: `ac-rating/review/backend/{catalog,methodology,reviews,submissions,brands,scoring}/admin*/` + `services/` + `management/commands/import_v2.py`.

## Исходные данные

### Что переносим с переписыванием импортов на `ac_*`

**Admin (5 apps — catalog и methodology как пакет, остальные одним файлом):**

| Источник | Назначение | Строк |
|---|---|---|
| `catalog/admin/__init__.py` | `ac_catalog/admin/__init__.py` | 10 |
| `catalog/admin/ac_model_admin.py` | `ac_catalog/admin/ac_model_admin.py` | 292 |
| `catalog/admin/constants.py` | `ac_catalog/admin/constants.py` | 10 |
| `catalog/admin/datalist.py` | `ac_catalog/admin/datalist.py` | 150 |
| `catalog/admin/equipment_admin.py` | `ac_catalog/admin/equipment_admin.py` | 11 |
| `catalog/admin/forms.py` | `ac_catalog/admin/forms.py` | 133 |
| `catalog/admin/inlines.py` | `ac_catalog/admin/inlines.py` | 42 |
| `methodology/admin/__init__.py` | `ac_methodology/admin/__init__.py` | 8 |
| `methodology/admin/criterion_admin.py` | `ac_methodology/admin/criterion_admin.py` | 30 |
| `methodology/admin/inlines.py` | `ac_methodology/admin/inlines.py` | 46 |
| `methodology/admin/methodology_version.py` | `ac_methodology/admin/methodology_version.py` | 240 |
| `methodology/forms.py` | `ac_methodology/forms.py` | 22 |
| `reviews/admin.py` | `ac_reviews/admin.py` | 54 |
| `submissions/admin.py` | `ac_submissions/admin.py` | 119 |
| `submissions/services.py` | `ac_submissions/services.py` | 138 |
| `brands/admin.py` | `ac_brands/admin.py` | 34 |
| `scoring/admin.py` | `ac_scoring/admin.py` | 54 |

**Services (только нужные для admin + импорт):**

| Источник | Назначение | Строк |
|---|---|---|
| `catalog/services/__init__.py` | `ac_catalog/services/__init__.py` | 11 |
| `catalog/services/criteria_rows.py` | `ac_catalog/services/criteria_rows.py` | 28 |
| `catalog/services/import_template.py` | `ac_catalog/services/import_template.py` | 148 |
| `catalog/services/model_import.py` | `ac_catalog/services/model_import.py` | 251 |
| `methodology/services.py` | `ac_methodology/services.py` | 155 |

**Management command (XLSX импорт):**

| Источник | Назначение | Строк |
|---|---|---|
| `catalog/management/commands/import_v2.py` | `ac_catalog/management/commands/import_ac_rating_xlsx.py` | 41 |

**Templates (переносим путь в `ac_catalog/templates/admin/ac_catalog/...`):**

| Источник | Назначение |
|---|---|
| `catalog/templates/admin/catalog/acmodel/change_list.html` | `ac_catalog/templates/admin/ac_catalog/acmodel/change_list.html` |
| `catalog/templates/admin/catalog/acmodel/import_models.html` | `ac_catalog/templates/admin/ac_catalog/acmodel/import_models.html` |
| `methodology/templates/admin/methodology/filters/methodology_multiselect_filter.html` | `ac_methodology/templates/admin/ac_methodology/filters/methodology_multiselect_filter.html` |
| `methodology/templates/admin/methodology/methodologyversion/duplicate_form.html` | `ac_methodology/templates/admin/ac_methodology/methodologyversion/duplicate_form.html` |
| `methodology/templates/admin/methodology/methodologyversion/change_form.html` | `ac_methodology/templates/admin/ac_methodology/methodologyversion/change_form.html` |

В `ac_model_admin.py` поменяй `change_list_template = "admin/catalog/acmodel/change_list.html"` на `"admin/ac_catalog/acmodel/change_list.html"`. Внутри самого HTML-шаблона замени любые Django-url reverse-ссылки, которые ведут на старый namespace (например, `catalog_acmodel_import` → `ac_catalog_acmodel_import`).

### Что НЕ переносим

- `catalog/management/commands/fill_pros_cons.py` (392 строки) — OpenAI-генерация pros/cons, НЕ в MVP. **Action `generate_pros_cons` в `ACModelAdmin.actions` тоже удалить** или оставить stub с сообщением «Feature coming in Ф8B».
- `catalog/management/commands/migrate_v1_to_v2.py` (112) — legacy ratings→v2, нам legacy `ratings/` не нужен.
- `catalog/management/commands/sync_brand_age_raw_values.py` (21) — функция `sync_brand_age_for_brand` уже есть в `ac_catalog/sync_brand_age.py` (Ф3), эту команду пропускаем (вызывается напрямую при необходимости).
- `catalog/services/raw_values_migration.py` (16) — связано с `migrate_v1_to_v2`, не нужно.

### Маппинг импортов

| Было | Стало |
|---|---|
| `from catalog.models import ...` | `from ac_catalog.models import ...` |
| `from catalog.services import ...` | `from ac_catalog.services import ...` |
| `from catalog.services.model_import import ...` | `from ac_catalog.services.model_import import ...` |
| `from catalog.sync_brand_age import ...` | `from ac_catalog.sync_brand_age import ...` |
| `from methodology.models import ...` | `from ac_methodology.models import ...` |
| `from methodology.services import ...` | `from ac_methodology.services import ...` |
| `from methodology.forms import ...` | `from ac_methodology.forms import ...` |
| `from scoring.engine import ...` | `from ac_scoring.engine import ...` |
| `from scoring.models import ...` | `from ac_scoring.models import ...` |
| `from brands.models import ...` | `from ac_brands.models import ...` |
| `from reviews.models import ...` | `from ac_reviews.models import ...` |
| `from submissions.models import ...` | `from ac_submissions.models import ...` |
| `from submissions.services import ...` | `from ac_submissions.services import ...` |

Контрольный grep после переноса:
```
grep -rE "from (catalog|methodology|scoring|brands|reviews|submissions)\." backend/ac_*/
```
Должно быть пусто.

## Задачи

### 1. Admin регистрация (14 моделей)

Перенести файлы из таблицы выше, переписать импорты. `ACModelAdmin` — самая сложная: custom form, 4 inlines (фото, raw_values, suppliers, regions), custom change_list template с кнопкой «Импорт XLSX», custom view `/import/` через `get_urls()`, actions (`recalculate_selected`; `generate_pros_cons` — **удалить**).

**`ACModelForm`** (в `ac_catalog/admin/forms.py`):
- Перенеси как есть.
- `ACModelImportForm` — форма для страницы импорта (файл + опции).

**`datalist.py`** — виджет/константа для выпадающих списков брендов; перенеси 1-в-1.

**`constants.py`** — маленький файл констант (вероятно список регионов или statuses); перенеси.

**Inlines (`catalog/admin/inlines.py`, `methodology/admin/inlines.py`):**
- `ACModelPhotoInline`, `ACModelSupplierInline`, `ModelRawValueInline`, `ModelRegionInline` — уже видел в исходнике, TabularInline обычный.
- `MethodologyCriterionInline` — ключевой для редактирования методики.

**`MethodologyVersionAdmin`** (`methodology/admin/methodology_version.py`, 240 строк) — самая сложная методологическая админка: кнопка «Клонировать» + `duplicate_form.html`, backfill из `backfill_criterion_extras_from_methodology` (оно в `ac_methodology/services.py`), кастомный change_form.html.

### 2. Services (импорт)

- `ac_catalog/services/import_template.py` — генерация XLSX-шаблона для импорта (колонки из методики).
- `ac_catalog/services/model_import.py` — парсинг XLSX, создание/обновление `ACModel` + `ModelRawValue` + `ACModelPhoto` + `ACModelSupplier` + `ModelRegion`. Функции `find_existing_models_in_file`, `import_models_from_file`, `ensure_all_criteria_rows`, `generate_import_template_xlsx`.
- `ac_catalog/services/criteria_rows.py` — утилита для создания строк raw_values по активной методике.
- `ac_submissions/services.py` — сервис конверсии заявки в `ACModel` (действие в админке submission-а, используется в Ф8C). Может не тестировать детально, но переносим.
- `ac_methodology/services.py` — `backfill_criterion_extras_from_methodology`, `template_criteria_inline_initial`.

Зависимости уже есть в `requirements.txt` (Ф1): `openpyxl>=3.1.0`, `xlrd>=2.0.1`, `Pillow>=10.0.0`.

### 3. Management command

`ac_catalog/management/commands/import_ac_rating_xlsx.py`:
- Переименовать из `import_v2.py`.
- Сигнатура: `manage.py import_ac_rating_xlsx <path> [--dry-run] [--methodology-id M]` (смотри исходник — если там другие флаги, перенеси как есть).
- Логика: вызвать `import_models_from_file(path, **opts)` из `ac_catalog.services.model_import`.

### 4. Тесты

**Admin smoke-тесты (`ac_catalog/tests/test_admin.py`):**
- login как superuser через `client.force_login`
- `client.get('/admin/ac_catalog/acmodel/')` → 200
- `client.get('/admin/ac_catalog/acmodel/add/')` → 200 (форма рендерится)
- `client.get('/admin/ac_catalog/acmodel/<pk>/change/')` → 200 (для существующего pk)
- Аналогично для `ac_brands/brand/`, `ac_methodology/methodologyversion/`, `ac_methodology/criterion/`, `ac_reviews/review/`, `ac_submissions/acsubmission/`, `ac_scoring/calculationrun/`

Достаточно по 1-2 GET-теста на admin (проверить что страницы рендерятся — основная причина падений: неправильный импорт или опечатка в `readonly_fields`). Отдельные тесты actions — не обязательны (можно добавить smoke на `recalculate_selected` — selected pks → post на changelist action endpoint).

**Import service (`ac_catalog/tests/test_import.py`):**
- 1 тест: генерация XLSX-template из активной методики → файл создаётся, содержит правильные колонки.
- 1 тест happy path импорта: подготовить XLSX с 1 моделью (через openpyxl.Workbook() в памяти), загрузить через `import_models_from_file(file, methodology)`, проверить что `ACModel` создан с правильным brand/inner_unit + `ModelRawValue` по критериям.
- 1 тест: повторный импорт того же XLSX — `find_existing_models_in_file` возвращает найденные модели (не дубликаты).

**Management command (`ac_catalog/tests/test_commands.py`):**
- 1 smoke-тест: создать XLSX в tmpfile, запустить `call_command('import_ac_rating_xlsx', path)`, проверить что модели появились в БД.

### 5. Подключение signals (проверка)

В Ф3 `ac_catalog/apps.py` уже подключает `signals` в `ready()`. Admin `ACModelAdmin.save_model` НЕ должен дублировать это. Если Максимовский `save_model` вызывает `sync_brand_age_for_model`, перенеси как есть.

## Приёмочные критерии

- [ ] `./venv/bin/python manage.py check` — 0 issues
- [ ] `./venv/bin/python manage.py makemigrations --dry-run` — No changes detected (моделей не добавлял)
- [ ] `./venv/bin/python -m pytest ac_*/tests/ --no-cov` — всё зелёное (Ф2-Ф4A = 148 + новые admin/import тесты)
- [ ] Grep: `from (catalog|methodology|scoring|brands|reviews|submissions)\.` в `backend/ac_*/` — пусто
- [ ] `./venv/bin/python manage.py import_ac_rating_xlsx --help` — показывает аргументы
- [ ] Smoke-заход в `/admin/` (runserver): все 14 моделей ac_* видны в sidebar. Login как admin/admin (у тебя уже должен быть superuser на dev-БД или создать через `createsuperuser`).
- [ ] Change_list для `ac_catalog/acmodel/` рендерится, кнопка «Импорт XLSX» видна.
- [ ] Переходить в `ac_methodology/methodologyversion/` → change_form открывается, кнопка «Клонировать» видна.

## Ограничения

- **НЕ трогать** `backend/catalog/`, `backend/methodology/`, `backend/scoring/`, `backend/brands/`, `backend/reviews/`, `backend/submissions/`, `backend/core/` — существующие apps ERP.
- **НЕ менять** settings.py.
- **НЕ переносить** `fill_pros_cons.py`, `migrate_v1_to_v2.py`, `sync_brand_age_raw_values.py`, `raw_values_migration.py` (см. «Что НЕ переносим»).
- **Action `generate_pros_cons` — удалить** из ACModelAdmin.actions (или stub с сообщением). Не оставлять рабочий вызов без `fill_pros_cons.py`.
- **НЕ коммитить** секреты/`.env`.
- Conventional Commits. Логические коммиты: (1) services + форм + inlines, (2) admin регистрации + templates, (3) management command, (4) tests.

## Формат отчёта

Положить в `ac-rating/reports/04b-admin-xlsx.md`:
1. Ветка + коммиты
2. Что сделано — перечислить все admin регистрации + services + command
3. Что НЕ сделано (из «Что НЕ переносим» — ОК; если что-то дополнительно вылезло за scope — описать)
4. Результаты: pytest, check, dry-run, smoke-admin (какие URL проверял)
5. Известные риски
6. Ключевые файлы для ревью (особенно `ac_catalog/admin/ac_model_admin.py`, `ac_methodology/admin/methodology_version.py`)

## Подсказки от техлида

- **Template paths:** Django ищет `admin/<app_label>/<model_name>/change_list.html` автоматически. После переноса в `ac_catalog/templates/admin/ac_catalog/acmodel/...` можно даже убрать явный `change_list_template = "..."` — пусть Django сам найдёт. Но если шаблон extends другой шаблон по старому пути (`{% extends "admin/catalog/..." %}`) — починить path там.
- **Reverse в шаблонах:** внутри `import_models.html` может быть `{% url 'admin:catalog_acmodel_changelist' %}` — поменять на `ac_catalog_acmodel_changelist`.
- **Actions с post-redirect:** `recalculate_selected` actions — перенеси как есть, но проверь что он вызывает `ac_scoring.engine.update_model_total_index` (не максимовский `scoring.engine`).
- **`save_model` в `ACModelAdmin`:** если вызывает `sync_brand_age_for_model(obj)` — теперь эта функция в `ac_catalog.sync_brand_age`. Правильный импорт.
- **ERP admin.site customization:** проверь `backend/finans_assistant/urls.py` — если там `admin.site.site_header = "..."` или кастомный `AdminSite`, регистрации через `@admin.register(Model)` всё равно встанут на default `admin.site`. Никаких изменений не требуется, но знать полезно.
- **Fixtures для admin тестов:** для `test_admin.py` нужен superuser. Либо через `User.objects.create_superuser(...)` в фабрике, либо `@pytest.fixture` с `client.force_login(user)`. Смотри как устроено в других ERP admin-тестах (`backend/<какая-то app>/tests/test_admin.py`).
- **XLSX-тесты в памяти:** openpyxl поддерживает `Workbook().save(BytesIO())`. Не нужно класть файлы в tmpdir — `InMemoryUploadedFile` из `django.core.files.uploadedfile`.
- **`generate_pros_cons` action — варианты:**
  1. Удалить из `actions = [...]` полностью — чище.
  2. Оставить как stub: `def generate_pros_cons(self, request, queryset): self.message_user(request, "Feature coming in Ф8B", level=messages.WARNING)`.
  Выбор за тобой — я бы делал вариант 1 (меньше мусора).
