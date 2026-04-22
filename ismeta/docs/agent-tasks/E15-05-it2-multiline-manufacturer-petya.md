# ТЗ: E15.05 итерация 2 — multi-line unequal length + manufacturer поле (IS-Петя)

**Команда:** IS-Петя.
**Ветка:** `recognition/08-e15.05-it2-multiline-manufacturer` (создаётся ПОСЛЕ мержа it1).
**Приоритет:** 🟠 major + фича.
**Срок:** 1 день.

**Зависимость:** это итерация 2, стартует **ПОСЛЕ** мержа E15.05-it1 (чтобы не переносить prompt-конфликты).

---

## Контекст

QA-сессия 3 (2026-04-22, см. `QA-FINDINGS-2026-04-22.md` #30, #32) выявила две оставшиеся проблемы, которые it1 не закрыл (по решению «лучшее враг хорошего»):

- **R18**: multi-line cells с неравными длинами (name 3 строки, model 2 строки). LLM берёт только первую строку. Items 12-16 в spec-aov: name оборван на «Кабель с медными жилами, с изоляцией и оболочкой и…».
- **R22**: «Завод-изготовитель» — отдельная колонка ЕСКД, семантически отличается от `brand`. Нужно новое поле `manufacturer`.

---

## Задачи

### 1. R18 — Multi-line unequal lengths

**Проблема:** в spec-aov row 14 (item 12, «Кабель 3х1,5») в PDF:
- Колонка Наименование: 3 строки («Кабель с медными жилами…», «с изоляцией и оболочкой из полимерной композиции», «КГППнг(A)-HF 3х1,5»).
- Колонка Модель: 2 строки («КАБЕЛЬ»», «…»).
- Колонка Завод: 1 строка.
- Unit и qty: по 1 строке.

**Ожидание:** `extract_structured_rows` должен склеить все 3 name-строки в одну `cells.name`. Сейчас берётся только первая.

**Файл:** `recognition/app/services/pdf_text.py:extract_structured_rows` и/или Y-bucketing логика.

**Подход:**
1. Y-bucketing сейчас группирует спаны по y ± 5.5pt tolerance. Это не справляется когда в одной колонке 3 строки, а в соседней 1 — они попадают в **разные** y-buckets, и row определяется по первой.
2. **Новая логика:** row-границы определяются **по якорю** — строкам где присутствует `cells.unit` или `cells.qty` (не null). Между двумя якорями — всё это одна row. В name/model склеить все спаны через пробел.

Псевдокод:
```python
def extract_structured_rows(page):
    y_buckets = group_by_y(spans)  # как сейчас
    # Найти anchor-buckets: те где есть text в unit или qty колонке
    anchors = [b for b in y_buckets if has_cell(b, "unit") or has_cell(b, "qty")]
    # Для каждого пары (anchor_i, anchor_{i+1}) все buckets между ними — это одна row
    rows = []
    for i, anchor in enumerate(anchors):
        start = y_buckets.index(anchor)
        end = y_buckets.index(anchors[i+1]) if i+1 < len(anchors) else len(y_buckets)
        merged_cells = merge_cells([y_buckets[j].cells for j in range(start, end)])
        rows.append(TableRow(cells=merged_cells, ...))
    return rows
```

Проблема подхода: может сломать spec-ov2 если там текст между якорями — это другое.

**Альтернатива:** оставить y-bucketing как есть, но в LLM-промпте добавить правило:
```
11. Multi-line склейка: если в rows подряд идут row-ы где у row N есть
    cells.unit/cells.qty, а у row N-1 или N+1 нет (только cells.name/model
    непусты) — это ПРОДОЛЖЕНИЕ имени row N. Склей текст в соответствующее
    поле row N через пробел, саму «orphan» row не включай в items.
```

Выбор: **сначала пробуй LLM-промпт вариант** (меньше риска сломать spec-ov2). Если recall на spec-aov не поднимется (name items 12-16 всё ещё обрываются) — делаем bbox-фикс анкер-row в extract_structured_rows.

### 2. R22 — Новое поле `manufacturer`

**Файл:** `recognition/app/schemas/spec.py`.

```python
class SpecItem(BaseModel):
    name: str
    model_name: str = ""
    brand: str = ""
    # E15.05 it2: "Завод-изготовитель" — отдельная колонка ЕСКД, семантически
    # отличается от brand (brand — бренд оборудования типа Daikin/Корф;
    # manufacturer — конкретный завод-поставщик типа ООО "КОРФ", АО "ДКС").
    manufacturer: str = ""
    unit: str = "шт"
    quantity: float = 1.0
    tech_specs: str = ""
    comments: str = ""
    section_name: str = ""
    page_number: int = 0
    sort_order: int = 0
```

**Файл:** `recognition/app/services/spec_normalizer.py:NormalizedItem`.

Добавить поле `manufacturer: str = ""`.

**Промпт:** добавить правило:
```
12. Завод-изготовитель (cells.manufacturer): 
    - brand — бренд оборудования / торговая марка (IEK, Корф, Fujitsu).
    - manufacturer — конкретный завод-поставщик (ООО "КОРФ", АО "ДКС").
    - Если в PDF есть обе колонки — оба заполняются независимо.
    - Если есть только одна «Завод-изготовитель» — клади в manufacturer, brand=""
      (НЕ в brand, как делал раньше).
```

**Важно:** обновить `extract_structured_rows` — сейчас cells имеет `brand` как ключ. Проверить: в spec-aov какая колонка маппится в `cells.brand`? Возможно нужно переименовать / добавить `cells.manufacturer` отдельным ключом.

**Файл:** `recognition/app/services/pdf_text.py` — в column mapping добавить header-маркер «Завод-изготовитель» → cells.manufacturer; «Поставщик» → cells.brand (или оставить как есть).

### 3. ISMeta apply_parsed_items — пробросить manufacturer

**Файл:** `ismeta/backend/apps/estimate/services/pdf_import_service.py`.

```python
if item.get("manufacturer"):
    tech_specs["manufacturer"] = item["manufacturer"]
```

### 4. openapi.yaml обновить

Добавить `manufacturer: string` в SpecItem schema.

### 5. Golden тесты обновить

**`test_spec_aov.py`** — добавить assertions:
- Для items 1-10 (Комплекты автоматизации): `manufacturer` содержит «КОРФ», `brand=""`.
- Для item 11 (Корпус TITAN): `manufacturer` содержит «IEK», `brand` может быть либо IEK (если совпадает) либо пусто.
- Multi-line name для items 12-15 (Кабели): `name` должен содержать ВСЕ строки из PDF (проверить длину name ≥ 100 символов).

**`test_spec_ov2.py`** — не должно сломаться. `manufacturer` для spec-ov2 может быть пусто (в первом golden колонки не было — будет default "").

### 6. Docs

**`recognition/README.md`**: обновить SpecItem schema — добавить `manufacturer`.
**`ismeta/docs/DEV-BACKLOG.md`**: закрыть #18 (prompt recall 99%) — частично, зависит от it1+it2 вместе.

---

## Приёмочные критерии

1. ✅ `pytest -q` recognition: все зелёные, +тесты на multi-line и manufacturer.
2. ✅ `pytest -m golden_llm` spec-ov2: items ≥ 142 (не упало от it1 baseline).
3. ✅ `pytest -m golden_llm` spec-aov:
   - items ≥ 29.
   - items 12-15 (Кабели): name длиной ≥ 100 символов (полный склеенный).
   - items 1-10 (Комплекты): `manufacturer` непусто, `brand=""`.
4. ✅ `ruff` + `mypy` clean.
5. ✅ `ismeta/backend pytest`: все зелёные; новый `tech_specs.manufacturer` проброшен.

---

## Ограничения

- **НЕ менять** модель `EstimateItem` (миграции — нельзя). `manufacturer` в `tech_specs` JSON.
- **НЕ ломать** spec-ov2 baseline от it1.
- Обратная совместимость `SpecParseResponse`: `manufacturer: str = ""` с default — старые клиенты не затронуты.

---

## Зависимости от UI-05 (Федя)

Frontend-часть идёт **параллельно** в отдельном ТЗ `UI-05-manufacturer-column-fedya.md` (создам после мержа it1 / старта it2). Федя добавит столбец «Завод» в items-table между «Модель» и «Ед.изм.», читая `tech_specs.manufacturer`. Старт Феди — **как только это ТЗ будет в работе**, т.к. его часть не блокирует backend.

---

## Формат отчёта

1. Ветка и hash.
2. Подход к R18 (LLM-промпт или bbox-anchor-row) — какой сработал.
3. Live-прогон метрики на обоих golden'ах.
4. Все 18 приёмочных критериев (it2 specific).
5. Известные остатки (pre-prompt tuning итерация 3, если понадобится).
