# Recognition — Regression suite

10 ОВиК спецификаций PDF в `/Users/andrei_prygunov/Downloads/ТЕСТЫ РАСПОЗНАВАНИЯ/`.

GT берётся из имени файла как canonical truth.

## Suite

| # | File | GT pos | Pages | Тип |
|---|------|-------:|------:|------|
| 1 | Спецификация 1 (9 листов 153 поз).pdf | 153 | 9 | Standard ОВиК (header per page) |
| 2 | Спецификация 2 (2 листа 29 поз).pdf | 29 | 2 | Маленький |
| 3 | Спецификация 3 (9 листов 199 поз).pdf | 199 | 9 | Standard ОВиК |
| 4 | Спецификация 4 (87 листов 1250 поз).pdf | 1250 | 87 | Большой (~24 мин parsing) |
| 5 | Спецификация 5 (20 листов 395 поз).pdf | 395 | 20 | Multi-page partial header |
| 6 | Спецификация 6 (4 листа 56 поз).pdf | 56 | 4 | Маленький multi-section |
| 7 | Спецификация 7 (5 листов 66 поз).pdf | 66 | 5 | **Scanned** (text layer пустой) |
| 8 | Спецификация 8 (14 листов 387 поз).pdf | 387 | 14 | Multi-page без header partial |
| 9 | Спецификация 9 (20 листов 622 поз).pdf | 622 | 20 | **Multi-page без header** (continuation pages) |
| 11 | Спецификация 11 (12 листов 287 поз).pdf | 287 | 12 | **Broken encoding** (CID font) |

**Всего:** 3444 позиции на 202 листах.

**Spec-10 исключён** (PO mandate 2026-04-30): boxed-cells layout
(каждая ячейка в отдельной рамке) — special case требующий
custom handler. Не входит в текущий regression.

## Тип каждой спецификации (PDF properties)

### Spec-1, 2, 3, 6: Standard ОВиК
- Header «Поз / Наименование / Кол-во ...» на каждой page.
- Grid-line bordered.
- Cyrillic text layer corretto.
- Detection: Docling видит правильно через page-by-page split.

### Spec-4: Большой multi-section (87 листов)
- Header per page (как 1, 2, 3).
- Многие секции (ОТОПЛЕНИЕ, ВЕНТИЛЯЦИЯ, …).
- Hybrid path: Docling primary + Camelot subset для pages где
  Docling не нашёл qty.

### Spec-5: Multi-page partial header
- 20 страниц, header на каждой.
- Camelot subset помог +22 items (94.2% → 99.7%).

### Spec-7: True scanned PDF
- Text layer ≈205 chars/page (только footer + header текст).
- Таблицы — bitmap.
- RapidOcr fails: возвращает Latin garbage
  (`'IKQMeIeKOMMYHUKQLUOHHbIU'`).
- Решение: Vision LLM (gpt-4o multimodal_complete) extract.

### Spec-8: Multi-page partial без header
- 14 страниц. На некоторых header есть, на некоторых нет.
- Inject + Docling page-by-page → 100.3% (+1 phantom inevitable).

### Spec-9: Multi-page без header on continuation pages ⭐
- 20 страниц. Header только на page 1.
- Continuation pages (2-20) не имеют header keywords.
- Docling page-by-page видит таблицы на 8 из 20 pages
  (header anchor pages).
- **Camelot lattice работает идеально**: grid-lines есть на всех
  continuation pages, mapping столбцов by position. **622/622 = 100%**.
- Auto-routing срабатывает: pages_without_qty/total = 12/20 ≥ 50%
  → switch на pure Camelot.

### Spec-11: Broken CID font encoding
- Text layer **есть** (3500 chars/page) но кириллица corrupted:
  `ʶабел̽` (Latin lookalike + combining diacritics U+0300-036F).
- Camelot правильно считает rows (286/287, -1).
- Vision LLM на этом PDF возвращает FEWER rows чем Camelot
  (guard prevents downcount).
- Без LLM-text-correction → -1 acceptable.

## Test runner

```bash
# /tmp/td17/regression_10spec.sh

#!/bin/bash
# TD-17 regression — 10 spec через указанный port.
# Usage: ./regression_10spec.sh [port] [tag]
PORT="${1:-8030}"
TAG="${2:-default}"

declare -a SPECS=(
    "1|Спецификация 1 (9 листов 153 поз).pdf|153"
    "2|Спецификация 2 (2 листа 29 поз).pdf|29"
    "3|Спецификация 3 (9 листов 199 поз).pdf|199"
    "4|Спецификация 4 (87 листов 1250 поз).pdf|1250"
    "5|Спецификация 5 (20 листов 395 поз).pdf|395"
    "6|Спецификация 6 (4 листа 56 поз).pdf|56"
    "7|Спецификация 7 (5 листов 66 поз).pdf|66"
    "8|Спецификация 8 (14 листов 387 поз ).pdf|387"
    "9|Спецификация 9 (20 листов 622 поз).pdf|622"
    "11|Спецификация 11 (12 листов 287 поз).pdf|287"
)

# POST каждый spec → /v1/parse/spec, count items, compute %
```

См. полный скрипт в `/tmp/td17/regression_10spec.sh`.

## Запуск testing containers

Для всех TD experiments я держу несколько контейнеров на разных портах:

| Container | Port | Branch | ENV |
|-----------|------|--------|-----|
| ismeta-recognition | 8003 | main | DeepSeek (production) |
| rec-td17 | 8030 | td-17 baseline | Docling без LLM |
| rec-td17a | 8031 | td-17a v7 | + synthetic header + col-numbers filter |
| rec-td17e | 8032 | td-17e | + Camelot hybrid |
| rec-td17g | 8033 | td-17g | + Vision LLM targeted |

Memory: 14GB minimum для td-17g (Docling+Camelot+Vision одновременно).

## Mandate

PO mandate (overnight 2026-04-29 → 2026-04-30 → 2026-05-01):
- 10 спецификаций на 100% распознавание
- Одна может **немного** выбиваться (PO clarification 2026-04-30:
  «не на 90%, а 100%, и одна с маленьким Δ»)
- Без LLM на главном path (LLM targeted, опционально, для
  scanned/broken PDFs)
- Все methods universal (НЕ подгонка под конкретный spec)
- «Перепробуй все комбинации существующих перед добавлением новых»

Достигнуто: **5/10 на 100%, TOTAL 99.7%**.
