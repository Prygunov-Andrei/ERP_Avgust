# Recognition — Evolution log (TD-04 → TD-17g)

История tech-debt batches, начиная с production main и до текущего
TD-17g (commit `d8bce21`).

## Summary

| TD | Дата | Основное | TOTAL | Branch |
|---|------|----------|------:|--------|
| Production main | 2026-04-28 | DeepSeek pure-LLM, Spec-4 99.92% | ~85% | `main @ 1cb8932` |
| TD-04 | 2026-04-29 | LLM_API_KEY rename, seed=42, top_p=1.0 | ~85% | merged |
| TD-06..09 | 2026-04-29 | DeepSeek/Gemini compat batch | ~85% | merged |
| TD-11 | 2026-04-29 | 2nd iteration plateau (+10 Gemini, +9 DS) | ~85% | several archived |
| TD-11B | 2026-04-29 | Markdown-table prompt | ~85% | `7d2e504` (production baseline) |
| **TD-17** | 2026-04-29 | IBM Docling без LLM, $0 cost | 76% | `recognition/td-17-docling-integration` |
| **TD-17a** | 2026-04-30 | Synthetic header injection + col-numbers filter | 90.5% | `recognition/td-17a-synthetic-header` |
| **TD-17e** | 2026-04-30 | Camelot lattice hybrid + auto-routing | 99.6% | `recognition/td-17e-camelot` |
| **TD-17g** | 2026-05-01 | Targeted LLM Vision intervention | **99.7%** | `recognition/td-17g-llm-targeted` ⭐ |

## TD-04: env rename + determinism

- `OPENAI_API_KEY` → `LLM_API_KEY` (provider-agnostic).
- `seed=42` фиксирует sampling.
- `top_p=1.0` (DeepSeek валидирует диапазон (0, 1.0]).
- DeepSeek thinking enabled high → max качество, max time/cost.

## TD-11 series: prompt engineering plateau

9 variants (различные prompt structures) — plateau ±10 items
на Spec-5. Cell extract-level fix нужен для 100% (не prompt fix).

TD-11B markdown-table prompt — самый стабильный.

## TD-17: IBM Docling переход

**Решение:** заменить text-layer bbox extract + LLM normalize на
ML-based table extraction (TableFormer + DocLayNet).

**Achievements:**
- Spec-1, 2, 3: 100% (header normalization для «Коли-чест-во» → «количество»)
- Spec-7: 0% → 91% (force_full_page_ocr + RapidOcr ru)
- Spec-8: 14% → 92.2% (page-by-page split)
- $0 LLM costs, deterministic.

**Limitations:**
- Spec-9 (multi-page без header): 41% (Docling issue #1376)
- Spec-10 (boxed-cells layout): 8% — исключён из mandate

## TD-17a: Synthetic header injection

**Идея:** копировать header rect page 0 на каждую continuation
page → Docling видит structure.

**Версии:**
- v1 (всегда инжект) — Spec-9 41%→55.8%, но Spec-2 -1, Spec-3 -37
  (dual-header сломал Docling).
- v2 (conditional skip если уже есть header keywords) — fix Spec-2/3.
- v3 (+ skip scanned PDFs avg<200) — fix Spec-7 (avoid OCR sabotage).
- v4-v5 (header_height_pt 130, crop top) — overshoot/regression.
- **v7** (+ col-numbers row filter) — Spec-6 +1 phantom → 100%.
  Финальный TD-17a baseline: **90.5%, 4/10 на 100%**.

## TD-17e: Camelot lattice hybrid ⭐

**Прорыв:** Camelot lattice flavor использует grid-line detection
(не ML), работает на multi-page без header через рамки.

**Spec-9 quick test:** 622/622 = **100%** за 16s.

**Hybrid реализация:**
1. Docling primary (Spec-1, 2, 3, 6 — 100% Docling)
2. Camelot subset для pages_without_qty (Spec-4, 5 +items)
3. **Auto-routing на pure Camelot** если ≥50% pages без qty
   (Spec-9 multi-page без header pattern)

**Финальный TD-17e: 99.6%, 5/10 на 100%** (+ Spec-9 → 100%).

## TD-17g: Targeted LLM Vision intervention

**Идея:** поверх Docling+Camelot добавить LLM Vision для PDFs где
нужна real text understanding.

**Universal triggers (НЕ spec-id):**
- PDF scanned (avg < 200 chars/page) → Vision на ВСЕ pages
- Broken encoding (cyrillic_ratio < 30% или `(cid:N)`) → Vision per page
- Vision Counter mismatch → Vision retry

**Guard:** replace только если Vision count ≥ existing (защита от
downcount на CID-font PDFs где Camelot count правильный).

**Achievement:** Spec-7 90.9% → 98.5%. Главное — **качественный
прорыв**: вместо `'IKQMeIeKOMMYHUKQLUOHHbIU'` (Latin OCR garbage)
теперь `'Шкаф телекоммуникационный'` (правильный русский).

**Финальный TD-17g: 99.7%, 5/10 на 100%, 1 outlier (Spec-7 -1)**.

## Подходы попробованные но отвергнутые

| Approach | Что | Почему отвергнут |
|---|---|---|
| Approach B (pymupdf-pro) | IBM рекомендация | Package not on PyPI (commercial) |
| Approach C (Granite-Docling VLM) | End-to-end vision-language | Spec-9 page 1 → Table 0×0, не работает на русских ОВиК-таблицах (training data — English scientific) |
| Approach D (Microsoft TATR) | DETR-based, обучен на PubTables-1M | Detects rows/cols но **не extracts text** — без LLM или OCR не закрывает Spec-7/Spec-11 |
| Approach F (super-page concat) | Все pages в одну виртуальную | Сложная реализация, OOM risk на длинных PDFs |
| TD-17a v9 phantom dedup | Skip rows где «N N-name» | Too aggressive — false positives на legit повторяющихся rows |
| TD-17g (B) cross-page dedup | Skip first row page N matching previous | Phantom Spec-8 не «adjacent» в state.items |
| TD-17g (C) combining diacritics trigger | Vision retry на Spec-11 type | Vision LLM на CID font возвращает FEWER rows чем Camelot — guard prevents replace, no improvement, +$0.30/run cost |

## Branches архив

```
recognition/td-17g-llm-targeted     d8bce21  ⭐ ТЕКУЩИЙ best
recognition/td-17e-camelot          392e095  без LLM, 99.6%
recognition/td-17a-synthetic-header d52f558  90.5%
recognition/td-17-docling-integration 3d7b9aa  76% baseline
recognition/td-11e-strict-d-split   …        TD-11 night experiments
recognition/td-11j-smart-dedup-v2   …
recognition/td-12-extract-overhaul  …
…etc
```

## main НЕ ТРОНУТ

`main @ 1cb8932` (DeepSeek pure-LLM, Spec-4 99.92%) остаётся production
baseline. Вся TD-17 серия — на feature branches. Merge в main —
отдельное решение PO.
