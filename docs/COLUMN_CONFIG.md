# Настраиваемые столбцы сметы (Column Config)

## Архитектура

### Хранение данных

| Модель | Поле | Тип | Назначение |
|--------|------|-----|-----------|
| `Estimate` | `column_config` | `JSONField(default=list)` | Конфигурация столбцов per-estimate |
| `EstimateItem` | `custom_data` | `JSONField(default=dict)` | Данные кастомных столбцов |
| `ColumnConfigTemplate` | `column_config` | `JSONField(default=list)` | Сохранённые шаблоны |

Когда `column_config` пуст — используется `DEFAULT_COLUMN_CONFIG` из `estimates/column_defaults.py` (10 стандартных столбцов).

### Типы столбцов

| Тип | Описание | Хранение | Редактируемый |
|-----|----------|----------|---------------|
| `builtin` | Маппинг на поле модели EstimateItem | Модель | Да (кроме итогов) |
| `custom_number` | Число | `custom_data[key]` | Да |
| `custom_text` | Текст | `custom_data[key]` | Да |
| `custom_date` | Дата (ISO string) | `custom_data[key]` | Да |
| `custom_select` | Выбор из списка | `custom_data[key]` | Да |
| `custom_checkbox` | Булево ("true"/"false") | `custom_data[key]` | Да |
| `formula` | Вычисляемый по формуле | Не хранится | Нет |

### Схема столбца (ColumnDef)

```json
{
  "key": "markup_total",
  "label": "Итого с наценкой",
  "type": "formula",
  "builtin_field": null,
  "width": 120,
  "editable": false,
  "visible": true,
  "formula": "line_total * 1.2",
  "decimal_places": 2,
  "aggregatable": true,
  "options": null
}
```

- `key` — уникальный идентификатор, `[a-z][a-z0-9_]{0,49}`
- `builtin_field` — для типа `builtin`, одно из: `item_number`, `name`, `model_name`, `unit`, `quantity`, `material_unit_price`, `work_unit_price`, `material_total`, `work_total`, `line_total`
- `options` — только для `custom_select`, массив строк

### Formula Engine

Безопасный вычислитель формул без `eval`/`exec`. Реализован на Python (`estimates/formula_engine.py`) и TypeScript (`lib/formula-engine.ts`).

**Поддерживаемые операции:** `+`, `-`, `*`, `/`, `()`, числовые литералы, ссылки на столбцы по `key`.

**Функции:** `round(x)`, `round(x, places)`, `max(a, b, ...)`, `min(a, b, ...)`, `abs(x)`.

**Примеры формул:**
```
quantity * material_unit_price
line_total * (1 + markup_pct / 100)
round(quantity * price, 2)
max(material_total, work_total)
```

**Зависимости:** Формулы могут ссылаться на другие формулы. Порядок вычисления определяется через topological sort (алгоритм Кана). Циклические зависимости детектируются и отклоняются при валидации.

**Python vs TypeScript:** TS-движок — только preview в UI. Авторитетный источник — бэкенд (`computed_values` в ответе сериализатора). При сохранении ячейки фронт берёт результат из ответа сервера.

### Сигнальная цепочка (ВАЖНО)

Builtin поля `material_total`, `work_total`, `line_total` — это `@property` модели `EstimateItem`. На них завязан `post_save` сигнал `update_subsection_from_items()`, который обновляет `subsection → section → estimate → characteristics`.

**Formula engine НЕ заменяет эти поля.** Он работает параллельно — только для кастомных формул. Если пользователь хочет другую формулу итога — он создаёт НОВЫЙ formula-столбец и скрывает builtin через `visible=false`.

## API

### Estimate

`PATCH /api/v1/estimates/{id}/` — обновить `column_config`:
```json
{
  "column_config": [
    {"key": "name", "type": "builtin", "builtin_field": "name", ...},
    {"key": "markup", "type": "custom_number", ...},
    {"key": "total_markup", "type": "formula", "formula": "line_total * (1 + markup / 100)", ...}
  ]
}
```

Валидация: уникальные ключи, валидные формулы, нет циклов, custom_select имеет options, builtin_field допустим.

### EstimateItem

`GET /api/v1/estimate-items/?estimate=N&page_size=all`

Ответ включает:
- `custom_data` — данные кастомных столбцов
- `computed_values` — вычисленные значения формул (из бэкенда)

`PATCH /api/v1/estimate-items/{id}/` — обновить custom_data:
```json
{"custom_data": {"markup": "20", "note": "Проверить"}}
```

### Column Config Templates

- `GET /api/v1/column-config-templates/` — список шаблонов
- `POST /api/v1/column-config-templates/` — создать шаблон
- `DELETE /api/v1/column-config-templates/{id}/` — удалить
- `POST /api/v1/column-config-templates/{id}/apply/` — применить к смете

### Excel Export

`GET /api/v1/estimates/{id}/export/` — скачать xlsx

Экспортируются только `visible=true` столбцы. Формулы вычисляются на бэкенде. Секции — merged rows. Итоги — строка с суммами по `aggregatable` столбцам.

## Как добавить новый тип столбца

1. Добавить в `ALLOWED_COLUMN_TYPES` (`column_defaults.py`)
2. Добавить обработку в `compute_all_formulas` если нужно (`formula_engine.py`)
3. Добавить рендеринг в `EstimateItemsEditor.tsx` (блок `for (const colDef of effectiveConfig)`)
4. Добавить редактор свойств в `ColumnConfigDialog.tsx`
5. Добавить обработку в Excel export (`views.py`, метод `export`)
6. Добавить тесты

## Как добавить новую функцию в formula engine

1. Python: добавить имя в `_FUNCTIONS` и обработку в `_call_function` (`formula_engine.py`)
2. TypeScript: добавить имя в `FUNCTIONS` и case в `callFunction` (`formula-engine.ts`)
3. Добавить тесты в обоих движках

## Тесты

```bash
# Backend
python manage.py test estimates.tests.test_formula_engine -v2
python manage.py test estimates.tests.test_column_config -v2
python manage.py test estimates.tests.test_column_templates -v2
python manage.py test estimates.tests.test_export -v2

# Frontend
cd frontend && npx vitest run src/lib/__tests__/formula-engine.test.ts
```
