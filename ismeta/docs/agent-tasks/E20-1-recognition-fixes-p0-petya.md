# ТЗ: E20-1 — Recognition pipeline fixes P0 (Class E + Class B+F + Class L) (IS-Петя)

**Команда:** IS-Петя.
**Ветка:** `recognition/e20-1-fixes-p0`.
**Worktree:** `ERP_Avgust_is_petya_e20_1` (создать от `origin/main` @ `f7cc47b`).
**Приоритет:** 🔴 P0 — главный вклад в Δ +67 на Spec-4 (87 листов Спорт-школы КЛИН).
**Срок:** ~2 дня.

---

## Контекст

Полная карта ошибок (15 классов A-O) собрана в `ismeta/docs/spec4-audit/AUDIT-TRACKER.md` после ручного обхода всех 87 листов Spec-4.

**Σ Δ = +67** (1317 DB items vs 1250 PO ручной count).

В E20-1 фиксим **3 P0 класса**, дающих **~64 из 67** count-расхождений:

| Class | Что | Вклад |
|---|---|---|
| **E** | MULTI_LINE_MODEL_SPLIT (стр 83) | +20 |
| **B+F** | КЛОП-2 phantom rows (стр 7, 8, 15, 19, 20, 26, 28, 32, 40, 45, 50, 62, 76, 87) | ~+44 |
| **L** | BBOX_COLUMN_BLEED — мелкий bleed повсеместно | ~+5-8 phantom-bleed |

**Главный insight:** все три класса — bug в **`recognition/app/services/pdf_text.py`** на стадии bbox extraction (до LLM). LLM получает уже разбитые row'ы и пытается их выправить, но не может, потому что входные данные сломаны.

После E20-1 ожидаем **Δ → 1250 ± 5** на Spec-4.

---

## Задача 1 — Class E: MULTI_LINE_MODEL_SPLIT

### Симптом

На странице 83 PDF: 11 «Смесительных узлов для П<X>» имеют модель в виде:
```
MUB.L.04.04.B.CP.TM.NS.
159485.1
```
(две физические строки в bbox для одного PDF item).

В DB после извлечения каждый «Смесительный узел» становится **3 row'а**:
- row 1: name=«Смесительный узел для П2В2», model=пусто
- row 2: name=«Смесительный узел для П2В2», model=`159485.1`
- row 3: name=«Смесительный узел для П2В2», model=`MUB.L.04.04.B.CP.TM.NS.`

PO ожидал 1 row с model=`MUB.L.04.04.B.CP.TM.NS. 159485.1`. **+2 phantom × 11 = +22 phantom (но фактически +20).**

### Конкретные DB items для воспроизведения

```bash
docker compose -f ismeta/docker-compose.yml exec -T postgres psql -U ismeta -d ismeta -c "
SELECT (i->>'sort_order')::int AS pos, i->>'name' AS name, i->>'model_name' AS model
FROM recognition_jobs_recognitionjob, jsonb_array_elements(items) i
WHERE id='0f82c23d-7817-4fdd-b85c-4a5020d54b31' AND (i->>'page_number')::int = 83
ORDER BY (i->>'sort_order')::int;"
```

PNG для визуального сравнения: `/tmp/spec4-pages/page_083.png` (если нет — генерировать командой из `AUDIT-TRACKER.md`).

### Что нужно сделать

В `recognition/app/services/pdf_text.py` (или вспомогательном модуле):

1. Добавить функцию `_merge_multiline_model_codes(rows)` — выполняется ПОСЛЕ `_merge_multiline_section_headings` и `_merge_continuation_rows`.

2. Эвристика «модель — продолжение модели соседнего row»:
   - row N имеет model column non-empty + name column same as row N-1 (или name пустой/«То же»)
   - **И** model row N выглядит как «частичная маркировка»: `^[A-Z]+\.[A-Z0-9.]+\.?$` (типа `MUB.L.04.04.B.CP.TM.NS.`) или `^\d+\.\d+$` (типа `159485.1`)
   - **И** model row N-1 заканчивается на `.` (точка не закрывает скобку/число)
   → склеить модель: `model[N-1] = model[N-1] + " " + model[N]`, удалить row N.

3. Альтернатива: использовать **vertical bbox proximity** — если bbox row N и row N-1 почти не имеют вертикального gap (Δy < threshold) и name same — это одна visual row с многострочной моделью.

### Проверка

После fix на стр 83 ожидается:
- 14 row'ов вместо 34
- 11 «Смесительных узлов» — каждый с одной моделью `MUB.L.XX.XX.B.CP.TM.NS. 159485.1`

---

## Задача 2 — Class B+F: КЛОП-2 phantom rows

### Симптом

Каждый «Клапан противопожарный» в PDF на ОВиК-чертежах имеет:
- name на 2 строки: «Клапан противопожарный канальный, нормально открытый» + «(НО), привод клапана снаружи»
- model на 2 строки: `КЛОП-2(90)-НО-300х300-` + `МВ/S(220)-К`

При extraction'е bbox получается 2 row, и каждая выглядит как самостоятельный item.

В DB:
- row N: name=«Клапан … нормально открытый», model=`КЛОП-2(90)-НО-300х300`, qty=N (правильное), mfr=ВИНГС-М ✓
- row N+1: name=«Клапан … нормально открытый» **(DUP)**, model=`МВ/S(220)-К`, qty=1, mfr=пусто 🔴 **PHANTOM**

ИЛИ (нестабильно — встречается на тех же страницах):
- row N: name=«Клапан … (НО), привод клапана снаружи МВ/S(220)-К», model=`КЛОП-2(90)-НО-300х300` 🔴 **Class H2** (хвост модели в name)

### Worst pages

Стр 7 (+2), 8 (+4), 15 (+8), 19 (+2), 20 (+6), 26 (+5), 28 (+3), 32 (+1), 40 (+1), 45 (+1), 50 (+2), 62 (+2), 76 (+6), 87 (+1) = **+44 phantom**.

### Конкретные DB items

```bash
# Страница 15 (+8 phantom от 8 КЛОП'ов)
docker compose -f ismeta/docker-compose.yml exec -T postgres psql -U ismeta -d ismeta -c "
SELECT (i->>'sort_order')::int AS pos, i->>'name' AS name, i->>'model_name' AS model, i->>'quantity' AS qty
FROM recognition_jobs_recognitionjob, jsonb_array_elements(items) i
WHERE id='0f82c23d-7817-4fdd-b85c-4a5020d54b31' AND (i->>'page_number')::int = 15
ORDER BY (i->>'sort_order')::int;"
```

PNG: `/tmp/spec4-pages/page_015.png`.

### Что нужно сделать

В `recognition/app/services/pdf_text.py`:

1. Добавить функцию `_merge_klop_two_row_pattern(rows)` — выполняется ПОСЛЕ `_merge_multiline_model_codes`.

2. Эвристика «КЛОП split на 2 row»:
   - row N+1 либо
     - имеет name = `(НО), привод клапана снаружи` (или начинается с `(НО),`)
     - либо name DUP с row N (одинаковая строка) И model row N+1 — это `МВ/S(220)-К` (или `МВ/S(220)-СН-К`)
   - **И** row N имеет name `Клапан противопожарный канальный, нормально открытый` (или начинается с `Клапан противопожарный`) И model row N начинается с `КЛОП-`
   → склеить:
     - name[N] = «Клапан противопожарный канальный, нормально открытый (НО), привод клапана снаружи»
     - model[N] = `model[N].rstrip("-") + "-" + model[N+1]` (например `КЛОП-2(90)-НО-300х300-МВ/S(220)-К`)
     - qty[N] остаётся (правильное), удалить row N+1.

3. Эвристика на основе bbox proximity тоже работает (как в Class E).

### Проверка

После fix на стр 15 ожидается:
- 23 row'а вместо 31
- 8 КЛОП'ов с полной моделью `КЛОП-X(90)-НО-XxX-МВ/S(220)-К`, без phantom row'ов.

---

## Задача 3 — Class L: BBOX_COLUMN_BLEED

### Симптом

На некоторых row'ах qty/unit/model/mfr систематически принадлежат **соседнему row N+1**, а name остаётся на row N.

Пример стр 7 (item #103): name=«Фасонные изделия (30%)», qty=`13 п.м.` (но Фасонные имеют unit `м²`, qty=60 в PDF). qty `13 п.м.` принадлежит соседнему «То же 1200х800 δ=0,9мм».

### Worst pages

Стр 7 (items 103, 105, 108, 110), 19 (318, 320), 28 (484-490), 32 (544), 37 (607, 618), 40 (659, 661), 50 (812).

### Что нужно сделать

В `recognition/app/services/pdf_text.py`:

1. После `_merge_klop_two_row_pattern` добавить **проверку column alignment**: для каждого row сверять, что bbox-y столбцов (qty, unit, model, mfr) совпадает с bbox-y столбца name в пределах ±50% line height.

2. Если qty/unit row N имеет bbox-y, лежащий между row N и row N+1 (т.е. ближе к row N+1) — переместить qty/unit на row N+1.

3. Альтернатива: использовать **median row vertical position** для определения «настоящего» row.

### Проверка

После fix на стр 7:
- item #103 «Фасонные изделия (30%)» имеет qty=60, unit=м² (а не 13 п.м.)
- item #105 «Самоклеющая лента» имеет qty=130, unit=п.м. (а не 60 м²)

---

## Регрессионные тесты

После реализации **всех трёх задач**:

### 1. Unit tests

Добавить в `recognition/tests/test_pdf_text.py`:
- `test_merge_multiline_model_codes_smesitelnyj_uzel()` — на synthetic input воспроизвести стр 83.
- `test_merge_klop_two_row_pattern()` — на synthetic input воспроизвести стр 15.
- `test_bbox_column_bleed_alignment()` — на synthetic input воспроизвести стр 7 (item 103).

### 2. Goldens — ВСЕ должны остаться зелёными

```bash
cd recognition && env RECOGNITION_API_KEY=test-key python -m pytest tests/golden/ -v
```

Goldens в `recognition/tests/golden/`:
- `test_spec_ov2.py` — 153 items
- `test_spec_aov.py` — 29 items
- `test_spec_tabs.py` — 199 items (spec-3)
- `test_invoice_01.py`, `test_invoice_02.py` — invoices

**Критично: ни один не должен сломаться.**

### 3. Live прогон Spec-4

После fix запустить через UI на Спорт-школе КЛИН (87 страниц):
```bash
# Готовый файл
"/Users/andrei_prygunov/Downloads/Спорт-школа КЛИН/Проекты/Альбом СК-269-7-22-ОВ2 (ВЕНТ) ИЗМ3.1_СПЕЦИФИКАЦИЯ.pdf"
```

**Ожидание:** items count = 1250 ± 5 (вместо 1317).

После прогона запустить `compare-script.py`:
```bash
docker exec -e JOB_ID=<new-job-id> ismeta-backend python /app/compare.py
```
(или скопировать `ismeta/docs/spec4-audit/compare-script.py` локально и запустить против localhost:5433)

**Ожидание:**
- Δ на странице 83 = 0 (вместо +20)
- Δ на странице 15 = 0 (вместо +8)
- Δ на странице 20 = 0 (вместо +6)
- Δ на странице 76 = 0 (вместо +6)
- Σ Δ ≤ 5

---

## DoD (Definition of Done)

- [ ] `_merge_multiline_model_codes` реализована, unit-test зелёный.
- [ ] `_merge_klop_two_row_pattern` реализована, unit-test зелёный.
- [ ] `bbox column alignment` реализована, unit-test зелёный.
- [ ] Все goldens (`tests/golden/`) зелёные — count items не изменился.
- [ ] Live прогон Spec-4: Σ Δ ≤ 5 (с 1250 PO).
- [ ] PR в main с rebase на свежий origin/main.
- [ ] Отчёт в комментарии PR: какие конкретно phantom row'ы исчезли (со ссылками на AUDIT-TRACKER.md).

---

## Подсказки

### Где смотреть существующий код

- `recognition/app/services/pdf_text.py:extract_structured_rows` — главная функция
- `recognition/app/services/pdf_text.py:_merge_multiline_section_headings` — пример pre-LLM merge
- `recognition/app/services/pdf_text.py:_merge_continuation_rows` — пример pos-only merge
- `recognition/app/services/pdf_text.py:_merge_series_parent_into_children` — пример pattern-based merge

Все три новых fix-функции **должны идти в Pre-LLM stage**, чтобы LLM получал чистые row'ы.

### Что НЕ менять в этой задаче

- `spec_postprocess.py` — это P1/P2 (Class K, C, H, M). Будет E20-2.
- `spec_parser.py` Phase 3/5 — pipeline orchestration, не нужно.
- LLM prompt — не нужно, fix on bbox extraction уровне.
- Frontend — не нужно вообще.

### Worktree setup

```bash
git fetch origin
git worktree add -b recognition/e20-1-fixes-p0 ../ERP_Avgust_is_petya_e20_1 origin/main
cd ../ERP_Avgust_is_petya_e20_1
```

После мержа задачи:
```bash
git worktree remove ../ERP_Avgust_is_petya_e20_1
```

### Перед PR

```bash
cd ../ERP_Avgust_is_petya_e20_1
git fetch origin
git rebase origin/main
git log main..HEAD  # должны быть только твои коммиты
```

---

## После E20-1 — следующие шаги

E20-2 (P1 quality, отдельная ветка после мержа E20-1):
- Class M: cross-page section preface stitch (ОБМ-Вент → Вент EI60)
- Class K: фильтр для pos-prefix на ВД/ПД/В блоках
- Class C: dedup_repeated_phrase в name (Expert Standart, ОБМ-5Ф DUP)
- Class H/H1/H2: model tail recovery (`-МВ/S(220)-К` если осталось вне Class B+F)

E20-3 (P2 мелочи):
- Class J/G/I/N/O.

Не запускать E20-2 пока E20-1 не замержен — fix'ы могут конфликтовать в `pdf_text.py`.

---

🚀 Удачи, Петя!
