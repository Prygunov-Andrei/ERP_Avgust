# Recognition Service — Архитектура (TD-17g, 2026-05-01)

Распознавание ОВиК спецификаций PDF → структурированные SpecItems
для импорта в смету. Standalone FastAPI на порту 8003.

**Branch:** `recognition/td-17g-llm-targeted` (commit `d8bce21`).
**Финальный результат:** TOTAL **99.7%** (3434/3444 на 10 spec), **5/10 на 100%**.

---

## Pipeline (универсальный для любых ОВиК PDF)

```
PDF bytes (input)
  │
  ▼
┌─────────────────────────────────────────────────────────┐
│ 1. extract_via_docling                                  │
│    IBM Docling (TableFormer ACCURATE + DocLayNet)       │
│    + page-by-page split (для multi-page tables)         │
│    + force_full_page_ocr если scanned (RapidOcr ru)     │
│    + synthetic header injection (continuation pages)    │
│    + col-numbers row filter                             │
│    → docling_rows_by_page: dict[page, list[TableRow]]  │
└─────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────┐
│ 2. Routing decision                                     │
│    no_qty_ratio = pages_without_parseable_qty / total   │
│                                                         │
│    IF no_qty_ratio ≥ 0.5:                               │
│      → PURE CAMELOT (multi-page без header, Spec-9)    │
│         camelot.read_pdf(pages=all, flavor=lattice)    │
│         замещает Docling rows для всех pages            │
│                                                         │
│    ELSE:                                                │
│      → CAMELOT SUBSET (per-page fallback)               │
│         pages_without_qty → camelot.read_pdf(pages=…)   │
│         замещает Docling rows только на этих pages      │
└─────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────┐
│ 3. Hybrid fallback loop (для остаточных pages)          │
│    Step 0: Camelot subset rows (если получены)          │
│    Step 1: extract_with_explicit_columns                │
│             (Docling page 1 column ranges)              │
│    Step 2: PyMuPDF page.find_tables(strategy=lines)     │
│    Step 3: extract_structured_rows (legacy span-based)  │
└─────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────┐
│ 4. _td17g_vision_intervene (LLM Vision targeted)        │
│    Universal triggers (page-level, не spec-id):         │
│                                                         │
│    A. PDF scanned (avg_chars/page < 200)                │
│       → Vision extract на ВСЕ pages (Spec-7)            │
│                                                         │
│    B. Broken encoding (cyrillic_ratio < 30%             │
│       или (cid:N) markers)                              │
│       → Vision extract per page                         │
│                                                         │
│    C. Vision Counter mismatch                           │
│       parsed_count < vision_count - tolerance(=2)       │
│       → Vision retry per page                           │
│                                                         │
│    Guard: replace только если Vision ≥ existing rows    │
│    (защита от downcount, Spec-11 type — count правильный│
│     у Camelot но text broken).                          │
└─────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────┐
│ 5. _build_items_from_docling_rows                       │
│    Rule-based:                                          │
│    - section heading rows → state.current_section       │
│    - col-numbers row filter (text cells = digits 1-9)   │
│    - data rows (cells.qty primary signal) → SpecItem    │
│    - sticky parent name (cross-page)                    │
│    - cross-page continuation merge                      │
└─────────────────────────────────────────────────────────┘
  │
  ▼
SpecParseResponse (items, pages_stats, llm_costs)
```

---

## Архитектурные решения

### 1. Why Docling primary
- IBM Docling (TableFormer): 97.9% cell accuracy на academic benchmark.
- ML-based binding (pos+name+model+qty одной row через bbox attention)
  устраняет shift bug нашего legacy bbox-extract.
- Apache 2.0, локальный inference, $0 API costs.
- TableFormerMode.ACCURATE для ЕСКД-таблиц с многоуровневой нумерацией.
- Page-by-page split — Docling видит multi-page tables только если
  на каждой странице есть header. Workaround: split → каждая single
  page parsed standalone.

### 2. Why Camelot fallback
- IBM Docling fails на multi-page без header на continuation pages
  (issue #1376) — даже при page-by-page split mapping `qty col`
  ломается.
- Camelot lattice flavor использует **grid-line detection** (PDF cv2)
  вместо ML — для PDF с рамками (ОВиК ЕСКД standard) grid-lines
  есть на continuation pages даже без header.
- Spec-9 (20 pages multi-page без header) Docling: **41% baseline**,
  Camelot: **100%**.

### 3. Why routing decision
- Camelot хуже Docling на single-page tables (Spec-1 100% Docling →
  79.7% Camelot pure).
- Auto-routing: если ≥50% pages без parseable qty (multi-page
  без header pattern) — switch на pure Camelot. Иначе оставить
  Docling primary + Camelot per-page fallback.
- Это PDF-property based, не spec-id based.

### 4. Why synthetic header injection
- Для PDFs где Docling видит structure но cells qty mismapped
  на continuation pages, копируем top of page 0 (с header row +
  col-numbers row) на каждую continuation page.
- Conditional: skip injection если page УЖЕ имеет header keywords
  («Поз», «Наименование», «Кол» — стандарт ГОСТ 21.110).
- Skip всё PDF если scanned (avg < 200 chars/page) — RapidOcr
  garbage не помогает.

### 5. Why col-numbers row filter
- ГОСТ 21.110: row[1] таблицы содержит цифры столбцов «1, 2, ..., 9».
- Иногда Docling cell-binding читает её как data row с qty.
- Detection: text cells (name/model/brand/manufacturer/unit/comments)
  все равны single digit 1-9 → skip. Universal pattern для ВСЕХ
  ОВиК спец.

### 6. Why targeted Vision LLM
- На scanned PDFs (Spec-7) RapidOcr возвращает Latin garbage:
  `'IKQMeIeKOMMYHUKQLUOHHbIU'` вместо `'Шкаф телекоммуникационный'`.
- Vision GPT-4o правильно читает кириллицу с image.
- Triggers universal (PDF properties, не spec-id):
  - scanned PDF → all pages Vision
  - broken encoding → per page Vision
  - count mismatch → per page Vision retry
- Guard: replace только если Vision ≥ existing (Camelot count часто
  правильный даже при broken text — Spec-11 case).

### 7. Why parse_quantity validation
- Docling cells qty может содержать garbage (col-numbers digit '7',
  random text). `_has_real_qty` валидирует через `parse_quantity` —
  page без parseable qty → fallback triggered.

---

## ENV flags (production-ready defaults)

```bash
# Core path
PDF_EXTRACT_VIA_DOCLING=true
PDF_DOCLING_BYPASS_LLM=true       # без legacy LLM normalize

# Synthetic header injection
PDF_DOCLING_INJECT_HEADER=true
PDF_DOCLING_HEADER_HEIGHT_PT=110.0

# Camelot routing + fallback
PDF_EXTRACT_VIA_CAMELOT=true

# Targeted Vision LLM (опционально)
PDF_LLM_VISION_FALLBACK=true
PDF_LLM_SCANNED_THRESHOLD=200
PDF_LLM_CYRILLIC_RATIO_THRESHOLD=0.3
PDF_LLM_VISION_COUNT_TOLERANCE=2

# LLM provider (для Vision intervention)
LLM_API_KEY=<openai key из LLMProfile в ismeta-postgres>
OPENAI_API_BASE=https://api.openai.com
LLM_MULTIMODAL_MODEL=gpt-4o
LLM_EXTRACT_MODEL=gpt-4o

# Container
PARSE_TIMEOUT_SECONDS=3600
LOG_LEVEL=INFO
# Memory: 14GB minimum (Docling+Camelot+Vision modeлей одновременно)
```

---

## Dependencies

```
docling>=2.92         # IBM TableFormer + DocLayNet
docling-core>=2.74
camelot-py>=1.0       # Lattice flavor
opencv-python-headless>=4.13
ghostscript>=0.8      # Camelot dep
onnxruntime>=1.17     # RapidOcr (force_full_page_ocr)
PyMuPDF>=1.27         # text layer + page rendering
transformers>=4.x     # для Vision providers (опционально)
```

System deps (Dockerfile):
```
libxcb1 libxext6 libsm6 libgl1 libglib2.0-0  # cv2 в Docling
```

---

## API Endpoint

`POST /v1/parse/spec`
- Header: `X-API-Key: <RECOGNITION_API_KEY>`
- Body: `multipart/form-data` с `file=<pdf>`
- Returns: `SpecParseResponse(status, items, pages_stats, llm_costs)`

См. `recognition/openapi.yaml` для полной спецификации.

---

## Связанные документы

- [REGRESSION-RESULTS.md](REGRESSION-RESULTS.md) — таблицы по 10 spec
- [EVOLUTION-TD.md](EVOLUTION-TD.md) — история TD-04 → TD-17g
- [REGRESSION-SUITE.md](REGRESSION-SUITE.md) — test PDFs + ground truth
- [FUTURE-WORK.md](FUTURE-WORK.md) — пути доведения до 9/10 на 100%
