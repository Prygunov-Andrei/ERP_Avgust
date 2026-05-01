# Recognition — Future work (для доведения до 9/10 на 100%)

Текущий результат **TD-17g**: 5/10 на 100%, TOTAL 99.7%.

PO mandate: 9/10 на 100%, одна выбивается. Чтобы дойти, нужно
довести 4 более spec — Spec-4 (-8), Spec-5 (-1), Spec-8 (+1),
Spec-11 (-1) или Spec-7 (-1). Все требуют расширенного LLM use.

## Варианты (отсортировано по cost/effort)

### (A) `normalize_via_llm_multimodal` для Spec-11 ⭐ recommended

Существующий код в `recognition/app/services/spec_normalizer.py`
принимает `rows: list[TableRow]` + `image_b64` → LLM **исправляет
text** в cells без изменения row count.

**Идеально для Spec-11** (CID font): Camelot правильно считает
rows (286/287), но text corrupted. LLM перечитывает image и
исправляет cells text сохраняя структуру.

- Universal trigger: combining diacritics ratio > 0.02 OR
  cyrillic_ratio < 30% OR `(cid:N)` markers.
- Effort: ~30-60 мин рефакторинга (replace existing rows path).
- Cost: ~$0.30/run (12 pages × $0.025).
- Expected: Spec-11 99.7% → 100%, Spec-7 quality boost.

### (B) Per-row Vision verify для Spec-8 phantom

Для каждой row дать LLM cheap classify «реальная позиция?
Phantom rows получают «no».

- Universal trigger: phantom suspicion (Camelot+Docling overshoot).
- Effort: ~1 час реализации (новый endpoint LLM).
- Cost: высокий — 5000 rows × $0.001 = **$5/run**.
- Expected: Spec-8 +1 → 0.

### (C) Per-page Vision Counter aggressive (tolerance=0)

Сейчас tolerance=2 → не triggers. Lower до 0 → trigger Vision retry
если parsed < vision_count.

- Universal: уже реализовано как ENV `PDF_LLM_VISION_COUNT_TOLERANCE`.
- Risk: Vision Counter overcounts (header rows, blank rows). False
  positives → Vision retry на 100% specs → может **сломать** их.
- Effort: 0 (ENV change).
- Cost: ~$1/run (lots of false-positive retries).
- Expected: Spec-4 (-8) и Spec-5 (-1) могут улучшиться, но Spec-1, 2,
  3, 6, 9 могут регрессировать.

### (D) TATR + Vision LLM per-row OCR

TATR detects rows/cols boxes без text. Vision LLM на каждый row
crop читает text.

- Universal: TATR rows → Vision per row.
- Effort: 1-2 часа integration (TATR pipeline + per-row Vision).
- Cost: ~$0.07/spec × 5 problematic = $0.35/run.
- Expected: Spec-7 (scanned) до 100%, Spec-11 до 100%.
- Risk: TATR обучен на English scientific tables — на русских
  ОВиК может пропускать rows.

### (E) Tesseract OCR alternative (вместо RapidOcr)

Заменить RapidOcr на Tesseract для scanned PDFs (Spec-7 type).

- Tesseract имеет лучший русский language model.
- Effort: 1 час (install tesseract-ocr-rus в Dockerfile + изменить
  Docling OcrOptions).
- Cost: $0 (локальный OCR).
- Expected: Spec-7 +items (vs RapidOcr garbage).
- Risk: новый алгоритм (PO просил без новых алгоритмов).

### (F) Per-spec layout learning (NOT universal)

Hardcode-specific обработка для каждой spec — НЕ recommended.

- Anti-pattern: filename match, exact-word filter, etc.
- Не работает на новых PDFs reaching production.
- ❌ Не делать.

## Roadmap (если PO даёт go)

### Phase 1 (быстрый win, ~2 часа)
- (A) `normalize_via_llm_multimodal` для Spec-11 + improvement Spec-7.
- Expected: Spec-11 → 100% (+1), Spec-7 → 100% (+1).
- New TOTAL: ~99.8%, **7/10 на 100%**.

### Phase 2 (~4 часа)
- (D) TATR + Vision per-row для residual problematic pages.
- Expected: Spec-4 -8 → -2, Spec-5 -1 → 0.
- New TOTAL: ~99.9%, **8/10 на 100%**.

### Phase 3 (~8 часов)
- (B) Per-row Vision verify для phantom dedup.
- Expected: Spec-8 +1 → 0.
- New TOTAL: ~99.95%, **9/10 на 100%** ✅ mandate.

## Cost summary

| Phase | Effort | Cost/run | Specs improved |
|-------|--------|---------:|---------------|
| Current TD-17g | done | $0.36 | 5/10 на 100% |
| Phase 1 | 2 ч | $0.66 | 7/10 на 100% |
| Phase 2 | +4 ч | $1.00 | 8/10 на 100% |
| Phase 3 | +8 ч | $6.00 | 9/10 на 100% |

Phase 3 expensive ($5/run для row verify) — может быть production
prohibitive для больших PDFs. Alternative: row verify только при
отметке user'ом suspicious позиции (interactive workflow).

## Strategic context

Из retro `RETROSPECTIVE-4-INTERVIEWS.md`:
- Распознавание PDF — **Should** priority (для линейных сметчиков
  «самое неприятное», для руководителей нет).
- Главные boли (4/4): цены поставщиков, не распознавание.
- Каскадные правки (2/2 линейных) тоже Must.

**Recommendation:** TD-17g (99.7%) уже **production-ready** для
большинства cases. Phase 1-3 — incremental polish. Stronger ROI
на других эпиках:
- N1: Два трека оборудования (Must, главная боль)
- N2: Каскадное обновление (Must, волшебная палочка Кати)
- N4: Шаблоны/заготовки КП (Should, ICP-2)

Recognition «good enough» — переключиться на остальные эпики.
