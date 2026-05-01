# Backlog: pre-existing failing tests в backend pytest

**Тип:** tech debt / split-эпик
**Приоритет:** medium — main CI зелёный кроме backend pytest. Не блокирует разработку, но «красная» backend job путает review.
**Effort:** 2-3 дня (распределено между несколькими агентами)
**Источник:** выявлено после фикса timeout в `infra/fix-main-ci` (PR #12 от 2026-05-01).

---

## Контекст

После фикса timeout (xdist `-n auto` + bump до 15m) backend pytest стал
укладываться в ~5 минут. Список failing tests наконец виден полностью —
~80+ тестов в 7 категориях. Все failures **pre-existing** на момент
F8 финиша, накопились через несколько эпиков (F8, M-серия, F7, AC Rating).

Этот документ — **бэклог категорий**, не план фикса. Каждая категория
может быть взята отдельным агентом без cross-contamination.

CI run для воспроизведения: `25216412325`
(`gh run view 25216412325 --log | grep "Run pytest" | grep FAILED`).

---

## Категории

### 1. `connection already closed` (~25 тестов с xdist, сотни без xdist) — pre-existing

**Локация:** `contracts/test_phase4_purchase_links.py`,
`contracts/test_phase5_accumulative.py`, `ac_submissions/tests/test_admin_views.py`,
много других.

**Симптом:**
```
django.db.utils.InterfaceError: connection already closed
psycopg2.InterfaceError: connection already closed
```

**Подтверждено pre-existing** диагностическим run'ом `25216793376`
(без `-n auto`): 533 failed + 409 errors. С xdist картина мягче
(~80 fails видимых) — изолированные workers не дают broken state
накапливаться, но проблема всё равно проявляется в `contracts/test_phase4_*`
и `test_phase5_*`.

**Гипотеза:** где-то вызывается `connection.close()` в fixture teardown
или middleware, ломая connection для следующего теста. Возможные места:
- кастомные `db` fixture в conftest
- middleware, закрывающее connection в request lifecycle
- factory-boy post_generation hooks

**Фикс:** искать `connection.close()` в кодовой базе, особенно в
`*/conftest.py`, `core/middleware.py`, `*/services/*.py`. После фикса
проверить с `-n auto` и без — должны давать одинаковый pass rate.

---

### 2. Schema drift — `LegalEntity` (1 тест)

**Локация:** `supplier_integrations/tests/test_cleanup.py::test_cleanup_preserves_products_with_estimates`

**Симптом:**
```
TypeError: LegalEntity() got unexpected keyword arguments: 'full_name', 'legal_form'
```

**Гипотеза:** модель `LegalEntity` была переименована (поля или сама модель), тест не обновили.

**Фикс:** обновить тест под текущую schema (см. `accounting/models.py`).

---

### 3. Удалённая management command — `cleanup_breez_products` (4 теста)

**Локация:** `supplier_integrations/tests/test_cleanup.py`

**Симптом:**
```
django.core.management.base.CommandError: Unknown command: 'cleanup_breez_products'
```

**Гипотеза:** management command удалена (или переименована), тесты остались.

**Фикс:** либо восстановить command, либо удалить устаревшие тесты с подтверждением что функционал заменён.

---

### 4. URL pattern сломан — `catalog/test_product_filters` (6 тестов)

**Локация:** `catalog/tests/test_product_filters.py::ProductSupplierFilterTestCase::*`

**Симптом:**
```
AssertionError: 404 != 200
```

**Гипотеза:** URL для `ProductSupplierFilter` был изменён в `catalog/urls.py`, тест продолжает дёргать старый.

**Фикс:** обновить `reverse()` или hardcoded URL в тесте.

---

### 5. API shape drift — paginated DRF response (~5 тестов)

**Локация:** `objects/tests/test_objects_api.py`, `pricelists/tests/test_api.py`,
`core/tests/test_hvac_bridge.py`.

**Симптом:**
```
TypeError: list indices must be integers or slices, not str
```

**Гипотеза:** ViewSets были переключены на DRF pagination — `response.data` теперь dict со структурой `{'count', 'next', 'previous', 'results'}`, а тесты обращаются как `response.data[0]['field']`.

**Фикс:** обновить тесты на `response.data['results'][0]['field']`.

---

### 6. Breez sync API drift (5 тестов)

**Локация:** `supplier_integrations/tests/test_sync_service.py::TestBreezSyncService`

**Симптом:**
```
ValueError: Неожиданный формат leftovers: <class 'list'>
```

**Гипотеза:** клиент Breez API теперь возвращает list вместо dict (или наоборот), тесты с фиктивным response не обновлены.

**Фикс:** обновить fixtures в тесте + согласовать с реальным форматом ответа Breez API.

---

### 7. Одиночные тесты — разные причины

| Тест | Симптом | Гипотеза |
|------|---------|----------|
| `core/tests/test_hvac_bridge.py::test_hvac_public_route_serves_news_from_backend` | `TypeError: list indices must be integers or slices, not str` | API shape drift (см. категорию 5) |
| `catalog/tests/test_services.py::CompareProductsWithLLMTest::*` (3 теста) | `AssertionError`, `RuntimeError not raised` | LLM provider mock устарел после рефакторинга |
| `catalog/tests/test_api.py::CategoryAPITest::test_get_category_tree` | `KeyError: 0` | Изменилась структура tree response |
| `estimates/tests/test_api.py::AutoMatchAPITests::test_auto_match_nonexistent_estimate` | `NameError: name 'subsection' is not defined` | Сломанный код теста |
| `estimates/tests/test_models.py::EstimateSubsectionTests::*` (2 теста) | `Decimal('100000.00') != Decimal('120000.00')` | Изменилась логика recalc characteristics после E18 markup |
| `contracts/test_api.py::*::test_search_contracts/framework_contracts` (2) | `AssertionError: 2 != 1` | Search фильтр изменился |
| `llm_services/tests/test_api.py::LLMProviderAPITest::test_set_default_provider` | `NoReverseMatch: 'llm-provider-set-default'` | URL pattern удалён/переименован |
| `llm_services/tests/test_providers.py::GeminiProviderTest::test_parse_invoice_success` | `AttributeError: 'genai'` | Gemini provider рефакторили (вероятно убрали `import genai`) |
| `supplier_integrations/tests/test_import_service.py::*` (~6 тестов) | `DoesNotExist`, `assert 0 == X` | Связано с категорией 6 (Breez import broken после API drift) |
| `LearningLoopTestCase::*` (4) + `TestTier6Batch::*` (3) + `TestCommercialCaseAPI::*` (4) | `ERROR at setup` | Фикстура `db` или setUp ломается — **читать трассу** |

---

## Workflow

1. **Диагностика категории 1** (xdist regression) — после `infra/fix-main-ci` PR с закомментированным `-n auto` будет ясно. Это первое, что взять.
2. **Категории 2-3-4** — мелкие, по 1-3 тестов, независимы. Каждая ~30 минут.
3. **Категория 5-6** — батчем (паттерн «paginated response»).
4. **Категория 7** — по одному тесту, в очерёдности по приоритету apps.

Каждая категория — отдельная ветка `infra/fix-backend-tests-cat-N`, отдельный PR.

## Не делать

- ❌ НЕ skip'ать тесты массово через `@pytest.mark.skip` — теряем coverage сигнал.
- ❌ НЕ удалять testpaths из `backend/pytest.ini` — coverage упадёт.
- ❌ НЕ пытаться починить всё одним PR — слишком разные домены.

## Acceptance

Каждая категория закрывается своим PR с зелёным CI. После всех категорий — обновить `feedback_main_ci_debt.md` (memory) с текущим статусом.
