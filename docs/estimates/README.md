# Модуль Сметы (Estimates) — Документация разработчика

## Модели данных

```
Estimate (Смета)
├── EstimateSection (Раздел)  — FK estimate, sort_order, name
│   ├── EstimateSubsection    — FK section, суммы продаж/закупок
│   └── EstimateItem (Строка) — FK estimate + FK section, позиция с ценами
├── EstimateCharacteristic    — FK estimate, авто/ручные характеристики
└── MountingEstimate          — FK source_estimate, монтажная смета
```

### Ключевые модели

| Модель | Файл | Описание |
|--------|------|----------|
| `Estimate` | `models.py:~200` | Смета с версионированием, статусами, НДС |
| `EstimateSection` | `models.py:~594` | Раздел сметы (sort_order для порядка) |
| `EstimateItem` | `models.py:~712` | Строка сметы — товар/работа с количеством и ценами |
| `EstimateSubsection` | `models.py` | Подраздел (для ручных смет со сводной стоимостью) |
| `EstimateCharacteristic` | `models.py` | Характеристика (Материалы, Работы, Доставка и т.д.) |
| `MountingEstimate` | `models.py` | Монтажная смета (создаётся из обычной) |

### EstimateItem: ordering

```python
class Meta:
    ordering = ['section__sort_order', 'sort_order', 'item_number']
```

---

## API эндпоинты

### Сметы

| Метод | URL | Описание |
|-------|-----|----------|
| GET/POST | `/api/v1/estimates/` | Список / создание смет |
| GET/PATCH/DELETE | `/api/v1/estimates/{id}/` | Детали / обновление / удаление |
| POST | `/api/v1/estimates/{id}/create-version/` | Создать новую версию |
| POST | `/api/v1/estimates/{id}/create-mounting-estimate/` | Создать монтажную смету |
| GET | `/api/v1/estimates/{id}/versions/` | История версий |

### Разделы

| Метод | URL | Описание |
|-------|-----|----------|
| GET/POST | `/api/v1/estimate-sections/` | Список / создание разделов |
| GET/PATCH/DELETE | `/api/v1/estimate-sections/{id}/` | CRUD раздела |
| POST | `/api/v1/estimate-sections/{id}/demote-to-item/` | Снять раздел — превратить в строку |

### Строки сметы (Items)

| Метод | URL | Описание |
|-------|-----|----------|
| GET/POST | `/api/v1/estimate-items/` | Список / создание строк |
| GET/PATCH/DELETE | `/api/v1/estimate-items/{id}/` | CRUD строки |
| POST | `/api/v1/estimate-items/{id}/promote-to-section/` | Назначить строку заголовком раздела |
| POST | `/api/v1/estimate-items/import-rows/` | Импорт строк из Excel/PDF |
| POST | `/api/v1/estimate-items/auto-match/` | Автоподбор цен из каталога |
| POST | `/api/v1/estimate-items/auto-match-works/` | Автоподбор работ |

**Важно:** `pagination_class = None` — все строки возвращаются одним запросом.

---

## Сервисы

### `EstimateImportService` (`services/estimate_import_service.py`)

| Метод | Описание |
|-------|----------|
| `parse_file(file, filename)` | Парсинг Excel/PDF → preview JSON |
| `save_rows_from_preview(estimate_id, sections_data)` | Сохранение строк из превью импорта |
| `promote_item_to_section(item_id)` | Превращает строку в раздел |
| `demote_section_to_item(section_id)` | Превращает раздел обратно в строку |

---

## Promote / Demote — как работает

### Promote (строка → раздел)

1. Находит строку и её текущий раздел
2. Сдвигает sort_order всех последующих секций на +1
3. Создаёт новую секцию с `name = item.name`
4. Все строки той же секции с `sort_order > item.sort_order` переезжают в новую секцию
5. Исходная строка удаляется

### Demote (раздел → строка)

1. Находит предыдущую секцию (по sort_order)
2. Если предыдущей нет — создаёт «Основной раздел»
3. Создаёт новую строку с `name = section.name`, нулевыми ценами
4. Все строки удаляемой секции переезжают в предыдущую
5. Секция удаляется

Оба метода обёрнуты в `@transaction.atomic` и используют bulk `.update()`.

---

## Импорт смет

Pipeline: `Excel/PDF → parse_file() → preview JSON → save_rows_from_preview()`

1. Файл загружается через `EstimateImportDialog` (фронтенд)
2. Бэкенд парсит файл (`openpyxl` для Excel)
3. Фронтенд показывает превью с возможностью назначить разделы
4. Пользователь сохраняет — создаются секции и строки

---

## Фронтенд

### `EstimateItemsEditor.tsx`

Основной редактор строк сметы. Использует:

- **TanStack Table** — виртуализация, column resizing, row selection
- **TanStack Query** — кэширование, invalidation, optimistic updates
- **Смешанный список** — секции отображаются как виртуальные строки-заголовки (id = `-section.id`)

```
TableRow = EstimateItem & { _isSection?: boolean; _sectionId?: number }
```

Порядок строк: секции по `sort_order`, внутри каждой — items по `sort_order → item_number`.

### Кнопка FolderOpen

- На обычной строке: назначить разделом (promote)
- На заголовке раздела: снять раздел (demote)
- Видна только при `!readOnly`

---

## Тестирование

```bash
# Все тесты модуля
cd backend && .venv/bin/python manage.py test estimates

# Только promote/demote
cd backend && .venv/bin/python manage.py test estimates.tests.test_api.EstimateItemSectionPromotionTests estimates.tests.test_models.EstimateItemPromotionServiceTests
```

*Последнее обновление: Март 2026*
