# ТЗ: E17 — Quote xlsx parser (unified `/v1/parse/quote`) (IS-Петя)

**Команда:** IS-Петя.
**Ветка:** `recognition/10-e17-quote-xlsx-parser` (создаётся **ПОСЛЕ** мержа E16 it1 Invoice).
**Worktree:** `ERP_Avgust_is_petya_e17_quote_xlsx`.
**Приоритет:** 🔴 blocker (90%+ КП от поставщиков приходят в xlsx, сейчас не парсятся).
**Срок:** 1–1.5 дня.

---

## Контекст

После мержа E16 it1 (Invoice PDF гибрид) — PO прислал образцы КП (Коммерческих Предложений). **Оба в xlsx**, PO подтвердил: «КП очень часто в Экселе».

**Текущий `QuoteParser`** (`recognition/app/services/quote_parser.py`) — Vision-only, принимает только PDF через PyMuPDF. На xlsx не работает в принципе.

**Решение PO:** расширить существующий endpoint `/v1/parse/quote` на unified processor — принимает и PDF, и xlsx через content-type detection. Клиент в ERP (`backend/payments/services/recognition_client.py::parse_quote`) не трогаем — он просто POST'ит файл, сервер разбирается.

---

## Golden fixtures

Сохранены в `ismeta/tests/fixtures/golden/`:

### `quote-xlsx-nkpt.xlsx` — НПТ Климатика (простой)
- Поставщик: **НПТ Климатика** (адрес, телефон, email).
- Объект: «Здание суда», Истра.
- № ТКП: **НПТ_185214** от 05.12.2025.
- Менеджер: Климова Ольга, Инженер: Евсеева Алина.
- **Таблица:** `№ п/п | Обозн. | Наименование оборудования | Ед. изм. | Кол-во | Цена, RUB | Стоимость, RUB | (комментарий)`
- **5 items** в 2 группах:
  - Group-header `К1 К1.1` → 2 items (Внутренний/Наружный блоки KSGA70HFRN1 / KSRA70HFRN1).
  - Group-header `К2 К2.1 К3 К3.1` → 3 items (KSGA21HFRN1 / KSRA21HFRN1/-40 / CCM-33-0.0).
- **Итого:** 234 537,50 RUB.
- **Условия:** НДС 20%, срок 5 р.д., гарантия 3 года, DDP-Москва, самовывоз.

### `quote-xlsx-breez.xlsx` — Бриз / ООО «Компания БИС» (сложный)
- Поставщик: **ООО «Компания БИС»** (Бриз — торговая марка). Инженер: Мочалин Никита.
- Клиент: АВГУСТ.
- № ТКП: **25-7063** от 29.11.2025.
- **16 колонок** (!):
  - Позиция, Тип/Наименование
  - **Цена розница × 3 валюты: EUR / CNY / RUB**
  - Скидка (0.40 / 0.45)
  - **Цена со скидкой × 3 валюты**
  - Кол-во
  - **Итого × 3 валюты**
  - Код товара (`НС-1192817` и т.п.)
- **Group-headers** с системными спеками: `ПВ1 (L=755/655 м3/ч; Pc=300/300 Па)`, `ПВ2 (...)` → под каждым 20+ items (вентилятор, фильтр, заслонка, нагреватель, рекуператор, ПО, обвязка, клапаны...).
- 170 rows, **~30-40 items**.
- Условия: DDP Москва.

---

## Архитектура: Unified `/v1/parse/quote`

### Content-type detection

**Файл:** `recognition/app/api/parse.py` (endpoint `parse_quote`).

```python
@router.post("/v1/parse/quote", response_model=QuoteParseResponse)
async def parse_quote(
    file: UploadFile = File(...),
    _auth: None = Depends(verify_api_key),
    provider: BaseLLMProvider = Depends(get_provider),
) -> QuoteParseResponse:
    content = await file.read()
    filename = file.filename or "document"
    
    # Detect format
    if filename.lower().endswith(".xlsx") or file.content_type in (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
    ):
        parser = XlsxQuoteParser(provider)
    elif filename.lower().endswith(".pdf") or file.content_type == "application/pdf":
        parser = QuoteParser(provider)  # existing Vision-only; оставляем без изменений
    else:
        raise UnsupportedMediaTypeError(
            detail=f"quote parser supports PDF/xlsx; got {file.content_type}"
        )
    
    result = await parser.parse(content, filename=filename)
    return result
```

**НЕ трогаем** `QuoteParser` для PDF в рамках E17 — он остаётся как есть. Отдельный эпик **E17b** (если понадобится) переведёт PDF Quote на гибрид, когда появятся PDF-образцы.

### XlsxQuoteParser

**Новый файл:** `recognition/app/services/quote_xlsx_parser.py`.

**Pipeline:**

```
.xlsx (bytes)
  │
  ├─ Phase 0 — openpyxl load + structural extraction:
  │    - load_workbook(BytesIO(bytes), data_only=True)  # data_only=True → вычисленные значения формул
  │    - Первый лист (или detect по sheetname pattern «ТКП|КП|Коммерческое»)
  │    - matrix = list[list[cell.value]]
  │    - merged_ranges = список merged-cells координат
  │    - max_row, max_column
  │
  ├─ Phase 1 — Header row detection:
  │    - Найти row с ≥3 из _QUOTE_HEADER_MARKERS
  │    - Вернуть индекс row + mapping {col_index → column_key}
  │    - Если не найдено — return status="error"
  │
  ├─ Phase 2 — Row classification:
  │    Для каждой row после header:
  │    - all_empty → пропустить
  │    - totals row (содержит "Итого") → extract total → сохранить → пропустить как item
  │    - group-header (только name-column непустая, остальные пусты) → сохранить текущий group_position
  │    - item row (непустые qty или price_unit) → это item, current group_position применяется
  │    - notes row (начинается с "Примечание:" / "Срок" / "Гарантия") → сохранить в meta.conditions[]
  │
  ├─ Phase 3 — Title block (Phase 0 из Invoice pattern):
  │    - Собрать все cells из rows 1..header_row (область ДО таблицы)
  │    - + первые N символов с конца (notes area)
  │    - 1 LLM call (gpt-4o text_complete):
  │      → supplier (name/inn/kpp/addr/phone/email/bank)
  │      → meta (number/date/object_ref/object_address/manager/engineer/
  │              valid_until/delivery_terms/warranty_months_default/vat_rate)
  │    - Multimodal retry **не нужен** для xlsx.
  │
  ├─ Phase 4 — Item normalization (LLM, batch):
  │    Для items страницы — 1 LLM call на ~20 items:
  │    - Input: item rows (cells extracted by column mapping) + group_positions
  │    - Output: NormalizedQuoteItem[] с:
  │      * name, equipment_code, quantity, unit
  │      * price_unit (в RUB, после скидки если скидка есть)
  │      * price_retail (исходная розница)
  │      * price_total (в RUB)
  │      * currency = "RUB"
  │      * discount (если есть)
  │      * position (group_position из row classification, напр. "ПВ1")
  │      * system_spec (если group-header содержит спеки типа "L=755/655 м3/ч")
  │      * vat_rate, lead_time_days, warranty_months (inherit from meta default)
  │
  └─ Finalize: QuoteParseResponse(status, items, supplier, quote_meta, errors, pages_stats)
```

### Главное — `QuoteParseResponse` identical schema независимо от xlsx или PDF.

---

## Задачи

### 1. Расширить schema QuoteItem / QuoteSupplier / QuoteMeta

**Файл:** `recognition/app/schemas/quote.py`.

```python
class QuoteItem(BaseModel):
    name: str
    model_name: str = ""
    brand: str = ""
    unit: str = "шт"
    quantity: float = 1.0
    price_unit: float = 0.0            # в main currency (обычно RUB), после скидки
    price_total: float = 0.0
    currency: str = "RUB"
    vat_rate: int | None = None
    tech_specs: str = ""
    lead_time_days: int | None = None
    warranty_months: int | None = None
    page_number: int = 0                # для xlsx page_number = 0 или номер листа
    sort_order: int = 0
    # E17 новые (xlsx specifics):
    position: str = ""                  # группа-header "ПВ1" / "К1 К1.1" — кода системы
    system_spec: str = ""               # "L=755/655 м3/ч; Pc=300/300 Па"
    equipment_code: str = ""            # артикул поставщика "НС-1192817"
    discount: float | None = None       # 0.45 = 45% скидка
    price_retail: float = 0.0           # розничная цена до скидки


class QuoteSupplier(BaseModel):
    name: str = ""
    inn: str = ""
    kpp: str = ""
    # E17 новые (опционально):
    address: str = ""
    phone: str = ""
    email: str = ""
    website: str = ""
    bank_account: str = ""
    bik: str = ""
    correspondent_account: str = ""


class QuoteMeta(BaseModel):
    number: str = ""
    date: str = ""
    valid_until: str = ""
    total_amount: float = 0.0
    currency: str = "RUB"
    # E17 новые:
    object_ref: str = ""                       # "Здание суда"
    object_address: str = ""                   # "Истра, ЭХ Большевик"
    manager: str = ""                          # менеджер поставщика
    engineer: str = ""                         # инженер подбора
    delivery_terms: str = ""                   # "DDP-Москва"
    warranty_months_default: int | None = None # 36 (из "3 года") — применяется к items
    vat_rate: int | None = None                # 20 / 22 / 0 (УСН)
```

**openapi.yaml** — обновить все новые поля.

**Backward compat:** все новые поля с default → старые клиенты не ломаются.

### 2. XlsxQuoteParser — новый файл

**Файл:** `recognition/app/services/quote_xlsx_parser.py`.

Реализуй как класс с методом `async def parse(xlsx_bytes, filename) -> QuoteParseResponse`. Dependencies:
- `openpyxl` (добавить в `recognition/requirements.txt` если нет).
- `BaseLLMProvider` (переиспользуем).

Структура:
```python
class XlsxQuoteParser:
    def __init__(self, provider: BaseLLMProvider) -> None: ...
    async def parse(self, xlsx_bytes: bytes, filename: str) -> QuoteParseResponse: ...
    def _load_matrix(self, xlsx_bytes: bytes) -> XlsxMatrix: ...  # sync, run_in_threadpool
    def _detect_header_row(self, matrix: XlsxMatrix) -> HeaderInfo | None: ...
    def _classify_rows(self, matrix, header_info) -> list[ClassifiedRow]: ...
    async def _extract_title_block(self, matrix, header_row_idx) -> tuple[QuoteSupplier, QuoteMeta]: ...
    async def _normalize_items(self, classified_rows, group_positions) -> list[QuoteItem]: ...
```

**Ключевое — row classification** использует структурные правила (без LLM):

```python
def classify_row(cells_by_col_key: dict[str, Any]) -> RowType:
    non_empty = {k: v for k, v in cells_by_col_key.items() if v not in (None, "", " ")}
    if not non_empty:
        return "empty"
    
    if "Итого" in str(cells_by_col_key.get("name", "")).lower():
        return "totals"
    
    # Item row: есть price_unit или quantity И name.
    if non_empty.get("name") and (non_empty.get("qty") or non_empty.get("price_unit")):
        return "item"
    
    # Group-header: только name непустая.
    if set(non_empty.keys()) == {"name"}:
        return "group_header"
    
    # Notes row: start с "Примечание" / "Срок" / "Гарантия".
    name_text = str(non_empty.get("name", "")).strip().lower()
    if any(name_text.startswith(p) for p in ("примечание", "срок", "гарантия", "условия")):
        return "notes"
    
    return "unknown"
```

### 3. _QUOTE_HEADER_MARKERS

**Файл:** `recognition/app/services/quote_xlsx_parser.py` (или shared).

```python
_QUOTE_HEADER_MARKERS = {
    "pos": [r"^№", r"позиция", r"^#$"],
    "name": [r"наименование", r"товар", r"тип"],
    "obozn": [r"обозн"],  # дополнительный код системы
    "unit": [r"ед\.?\s*изм"],
    "qty": [r"кол-?во", r"количество"],
    "price_unit": [
        r"цена",
        r"цена\s*за\s*шт",
        r"цена.*со\s*скидкой",  # Бриз
    ],
    "price_retail": [r"цена.*розница"],
    "discount": [r"скидка"],
    "price_total": [r"сумма", r"стоимость", r"итого\s*со\s*скидкой"],
    "equipment_code": [r"код\s*товара", r"артикул"],
    "currency_hint": [r"eur|cny|rub|€|\$|¥"],  # для multi-currency detection
}
```

**Header match:** row с ≥3 matched markers → это header. Column mapping — `{col_index → column_key}` по первому match для каждого column.

**Multi-currency**: если header содержит несколько «Цена» (разные валюты), выбираем **main price column**:
- Приоритет: RUB → EUR → CNY.
- В Бриз приоритет RUB → всегда выбираем RUB-колонку.
- Предпочтение «Цена со скидкой RUB» > «Цена розница RUB» (если обе, `price_unit = со скидкой`, `price_retail = розница`).

### 4. Title block extraction (LLM)

**Промпт:**

```python
TITLE_BLOCK_XLSX_PROMPT = """Ты получаешь заголовочные ячейки xlsx-файла КП (коммерческого
предложения) — строки ДО таблицы items. Извлеки supplier (поставщика) и quote_meta.

ВНИМАНИЕ: в КП могут быть ДВЕ стороны — «Поставщик» (кто выставляет КП) и «Клиент»
(кому КП — наша компания ГК АВГУСТ). Бери ТОЛЬКО поставщика. Если видишь
«В компанию: АВГУСТ», «Партнёр: АВГУСТ», «Клиент: АВГУСТ» — пропусти эту часть,
это наша сторона.

Поставщик — это кто ОТПРАВИЛ КП (НПТ Климатика, Бриз/БИС, и т.п.), его адрес,
контакты, банк (если указан).

Верни JSON (строго):
{
  "supplier": {
    "name": "...",              // "НПТ Климатика" / "ООО «Компания БИС»"
    "inn": "",                  // если не указан — ""
    "kpp": "",
    "address": "...",           // юр. адрес если указан
    "phone": "...",
    "email": "...",
    "website": "...",
    "bank_account": "",
    "bik": "",
    "correspondent_account": ""
  },
  "meta": {
    "number": "...",            // "НПТ_185214" / "25-7063" / "ТКП № ..."
    "date": "YYYY-MM-DD",       // из "05.12.2025" / "29 ноября 2025"
    "valid_until": "YYYY-MM-DD",// если указан срок действия, иначе ""
    "total_amount": 0.0,        // если есть "Итого" вверху, иначе 0 (возьмётся из items)
    "currency": "RUB",
    "object_ref": "...",        // "Здание суда" / "Шоурум Лето"
    "object_address": "...",    // адрес объекта
    "manager": "...",           // менеджер поставщика
    "engineer": "...",          // инженер подбора
    "delivery_terms": "...",    // "DDP-Москва" / "EXW"
    "warranty_months_default": null,  // 36 из "3 года" если указано, иначе null
    "vat_rate": null            // 20 / 22 / 0 (УСН) из "НДС 20%" или "Без НДС"
  }
}

Не выдумывай значения. Если поле не найдено — оставь "" / 0 / null.

ЯЧЕЙКИ ЗАГОЛОВОЧНОЙ ОБЛАСТИ (A1..K{header_row-1}):
__HEADER_CELLS__

ЯЧЕЙКИ ОБЛАСТИ ПРИМЕЧАНИЙ (ниже таблицы, если есть):
__NOTES_CELLS__
"""
```

### 5. Item normalization (LLM, batched)

**Файл:** `recognition/app/services/quote_xlsx_normalizer.py` (или inline в xlsx_parser).

Для **больших КП** (Бриз — 170 rows, ~35 items) — batched call (1 call на ~30 items). Для **маленьких** (НПТ, 5 items) — 1 call.

**Промпт:**

```python
NORMALIZE_QUOTE_ITEMS_PROMPT = """Ты обрабатываешь items xlsx-КП. Row classification
и column mapping уже сделано. Тебе приходят items с cells по column-key:
{pos, name, unit, qty, price_unit, price_retail, discount, price_total,
 currency, equipment_code, position_group, system_spec, raw_cells}.

ПРАВИЛА:

0. КРИТИЧЕСКОЕ — не переставляй поля. cells.X → items[].X строго 1:1.

1. Multi-currency: если cells содержит price_unit в нескольких валютах,
   default main = RUB. Если RUB пусто, но EUR непусто — conversion не
   делаем, кладём как есть + currency = "EUR".

2. Price после скидки: если cells.price_unit = "Цена со скидкой" column —
   это финальная цена, клади в items[].price_unit.
   cells.price_retail (если есть) → items[].price_retail.
   cells.discount → items[].discount (0.45 → 0.45).

3. Position / group: cells.position_group ("ПВ1 (L=755/655 м3/ч; Pc=300/300 Па)")
   разбей на:
   - items[].position = "ПВ1" (короткий код системы)
   - items[].system_spec = "L=755/655 м3/ч; Pc=300/300 Па" (техн. спеки)
   Если в group-header нет скобок — position = вся строка, system_spec = "".

4. Equipment code: cells.equipment_code → items[].equipment_code
   ("НС-1192817", "НС-0080715" и т.п.). Если "Нет" / пусто → "".

5. Name без обозначения системы: cells.name содержит только имя оборудования
   ("Прямоугольный канальный вентилятор Zilon ZFX 50-30 0,55-2D"). 
   Модель извлекать отдельно НЕ надо (она в name). items[].model_name = "".

6. Unit из qty: как в invoice — если ед.изм. нет отдельной колонки, а qty
   содержит "2 шт." — разделяй.

7. Quantity — float, "2" → 2.0, "1,5" → 1.5.

8. Items без quantity И без price — пропусти (пустые rows).

9. Не выдумывай. Если поле не в cells — оставь default.

ITEMS (каждый — словарь cells):
__ITEMS_JSON__
"""
```

### 6. Backward-compat / requirements

- `openpyxl>=3.1` добавить в `recognition/requirements.txt`.
- Docker rebuild потребуется — предупреди в отчёте.
- **НЕ МЕНЯТЬ** `quote_parser.py` (PDF-version) — оставляем как есть для PDF ветки content-type detection.

### 7. Tests

**`recognition/tests/test_quote_xlsx_parser.py`** — unit:
- `test_header_detection_nkpt` — mock xlsx matrix → header row detected at row 14.
- `test_header_detection_breez` — 16 columns header, multi-currency detection.
- `test_row_classification_empty_group_item_totals_notes` — каждый тип.
- `test_multi_currency_picks_rub` — фикстура с EUR/CNY/RUB → price_unit из RUB.
- `test_discount_apply_parses` — row с discount 0.45, price_retail 68932, price_unit 37912 → item.discount=0.45.
- `test_group_header_parse_split` — "ПВ1 (L=755/655 м3/ч)" → position="ПВ1", system_spec="L=755/655 м3/ч".

**`recognition/tests/golden/test_quote_xlsx_nkpt.py`:**
```python
assert len(result.items) == 5
assert result.supplier.name == "НПТ Климатика" or "НПТ" in result.supplier.name
assert result.quote_meta.number == "НПТ_185214"
assert result.quote_meta.date == "2025-12-05"
assert "Здание суда" in result.quote_meta.object_ref
assert "Истра" in result.quote_meta.object_address
assert result.quote_meta.manager == "Климова Ольга"
assert result.quote_meta.engineer == "Евсеева Алина"
assert result.quote_meta.warranty_months_default == 36
assert result.quote_meta.vat_rate == 20
assert abs(result.quote_meta.total_amount - 234537.50) < 1.0
# groups
assert any(it.position == "К1 К1.1" for it in result.items)
assert any(it.position.startswith("К2") for it in result.items)
# prices
item_inner = next(it for it in result.items if "KSGA70HFRN1" in it.name)
assert item_inner.quantity == 2.0
assert item_inner.price_unit == 15400
assert item_inner.price_total == 30800
assert item_inner.currency == "RUB"
```

**`recognition/tests/golden/test_quote_xlsx_breez.py`:**
```python
assert len(result.items) >= 30  # сложная таблица, ~35 items
assert "БИС" in result.supplier.name
assert result.quote_meta.number == "25-7063"
assert result.quote_meta.date == "2025-11-29"
assert result.quote_meta.engineer == "Мочалин Никита"
assert result.quote_meta.delivery_terms.startswith("DDP")
# multi-currency — main RUB
for it in result.items:
    assert it.currency == "RUB"
    assert it.price_unit > 0
# group-headers ПВ1, ПВ2
groups = {it.position for it in result.items if it.position}
assert any(g.startswith("ПВ1") for g in groups)
assert any(g.startswith("ПВ2") for g in groups)
# system_spec extracted
for it in result.items:
    if it.position.startswith("ПВ"):
        assert "м3/ч" in it.system_spec or "Па" in it.system_spec
# equipment codes
codes = [it.equipment_code for it in result.items if it.equipment_code]
assert len(codes) >= 20  # большинство items имеют НС-коды
# discount
items_with_discount = [it for it in result.items if it.discount is not None]
assert len(items_with_discount) >= 20
for it in items_with_discount:
    assert 0.3 <= it.discount <= 0.5
    assert it.price_retail > it.price_unit  # retail > after-discount
```

### 8. Endpoint integration test

**Файл:** `recognition/tests/test_parse_quote_endpoint.py` (новый).

- `test_parse_quote_pdf_uses_old_parser` — POST .pdf → старый QuoteParser (mock response).
- `test_parse_quote_xlsx_uses_xlsx_parser` — POST .xlsx → XlsxQuoteParser (mock response).
- `test_parse_quote_unsupported_format` — POST .txt → 415 UnsupportedMediaTypeError.
- `test_parse_quote_xlsx_content_type` — POST .xlsx с MIME `application/vnd...` → корректный routing.

### 9. Dual-regression

**НЕ ЛОМАТЬ** 3 Spec golden + 2 Invoice golden. Запусти все 5 после изменений:

```
pytest -m golden_llm -v
```

Все 5 existing должны пройти. Новые 2 quote golden — тоже зелёные.

### 10. Docs

- **`recognition/README.md`** — секция Pipeline: добавить Quote xlsx-pipeline и content-type detection.
- **ADR-0027:** `ismeta/docs/adr/0027-quote-unified-xlsx-pdf.md` — решение, golden fixtures, метрики.
- **`ismeta/docs/DEV-BACKLOG.md`** — добавить #25 «E17b Quote PDF hybrid — когда появятся PDF образцы».

### 11. ISMeta integration

`ismeta/backend/apps/estimate/services/pdf_import_service.py` — **не трогаем**. Клиент `RecognitionClient.parse_quote` в `backend/payments/services/recognition_client.py` — **не трогаем** (он POST'ит bytes, сервер разбирается). Schema расширилась — старые клиенты opt-out на новых полях.

---

## Приёмочные критерии

### Функциональные

1. ✅ **NKPT**: 5 items, supplier НПТ, 2 группы, total ≈234537.50, warranty_months_default=36, vat_rate=20.
2. ✅ **Breez**: ≥30 items, supplier БИС, ≥2 group-headers ПВ1/ПВ2, все в RUB, все имеют discount ~0.40-0.45, ≥20 equipment_code НС-...
3. ✅ Group-header `"ПВ1 (L=755/655 м3/ч)"` корректно разделяется: position + system_spec.
4. ✅ Multi-currency Breez: main = RUB (не EUR, не CNY).
5. ✅ Discount apply: `price_unit = price_retail × (1 - discount)` корректно.
6. ✅ Title block JSON для обоих — supplier + meta поля заполнены.

### Endpoint routing

7. ✅ `/v1/parse/quote` с .pdf → старый QuoteParser (НЕ сломан).
8. ✅ `/v1/parse/quote` с .xlsx → XlsxQuoteParser.
9. ✅ `/v1/parse/quote` с .txt → 415.

### Нефункциональные

10. ✅ pytest recognition: все зелёные.
11. ✅ `pytest -m golden_llm`: 7 tests passed (3 spec + 2 invoice + 2 quote xlsx).
12. ✅ Spec + Invoice dual-regression: **НЕ регрессируем**.
13. ✅ ruff + mypy clean.
14. ✅ openpyxl в requirements.txt; docker rebuild predupredjdayet.
15. ✅ Время на NKPT (5 items): ≤ 15 с. На Breez (35 items): ≤ 30 с.

### Документация

16. ✅ ADR-0027 написан.
17. ✅ README pipeline обновлён (content-type routing, xlsx phase).
18. ✅ openapi.yaml новые поля QuoteItem / QuoteSupplier / QuoteMeta.

---

## Ограничения

- **НЕ ломать** SpecParser / InvoiceParser / existing QuoteParser PDF.
- **НЕ трогать** QuoteParser PDF (старый Vision-only) — отдельный эпик E17b с реальными PDF образцами.
- **НЕ трогать** ERP client / модели payments/proposals.
- **НЕ трогать** shared файлы без пинга.
- openpyxl версия `>=3.1` — проверить совместимость с docker python 3.12.

---

## Формат отчёта

1. Ветка и hash.
2. Архитектура: coдержит ли XlsxQuoteParser переиспользования (или полностью независимый).
3. Title block JSON для обоих xlsx (supplier + meta).
4. Метрики на 7 golden'ах (items, sections/groups, time, tokens, cost).
5. Сравнительная таблица: items NKPT vs Breez — группы, цены, discount, equipment_code.
6. Все 18 приёмочных критериев ✅/❌.
7. ADR-0027 ссылка.
8. Известные ограничения → E17b (Quote PDF).
