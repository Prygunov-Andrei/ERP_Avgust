# ТЗ: E20-2 — Recognition pipeline quality fixes (P0 bbox + P0 Class L + P1 M/K/C/H + P2) (IS-Петя)

**Команда:** IS-Петя.
**Ветка:** `recognition/e20-2-quality-fixes`.
**Worktree:** `ERP_Avgust_is_petya_e20_2` (создан от `origin/main` @ `c9debf5`).
**Приоритет:** 🟡 quality + остаточный count fix. Spec-4 после E20-1 в partial-done bracket (Σ Δ +8 vs 1250 PO).
**Срок:** ~3-4 дня (большой scope, разбей на 5-6 коммитов в той же ветке по группам).

---

## Контекст

E20-1 замержен (PR #2, commit `c9debf5`):
- Class E (MULTI_LINE_MODEL_SPLIT, стр 83) → 0
- Class B+F (КЛОП-2 phantom rows, 8 worst pages) → 0
- Σ Δ +67 → +8 (88% closure)

**Остатки** на стр Spec-4 (см. `ismeta/docs/spec4-audit/post-e20-1-retrofit-compare-report.md`):
1. **23 ОБМ-Вент** items с разрушенным name из-за **bbox y-bucketing** (`_ROW_Y_TOLERANCE = 5.5pt` склеивает spans двух физических PDF-строк).
2. **Class L (BBOX_BLEED)** на ~10 страницах — pre-LLM rows корректные, LLM путает qty/unit при normalization.
3. **Class M (SECTION_PREFACE_LOST)** — cross-page split «Комплексное огнезащ воздуховодов ОБМ-» → «Вент EI60 в составе:».
4. **Class K (MEGA L+K)** на каждой ВД/ПД/В установке (~30 items) — pos `B<NN>`/`ВД<NN>`/`ПД<NN>` приклеивается к чужому name, реальное «Вытяжная установка L=…» исчезает.
5. **Class C (DUP_CONTINUATION)** в name — `«одной стороны … одной стороны»`, `«ОБМ-Вент … ОБМ-Вент»`, `«в комплекте. в комплекте.»`.
6. **Class H/H1/H2** — хвост модели КЛОП'а `-МВ/S(220)-К` теряется или уезжает в name/mfr.
7. **P2 мелочи**: Class J (PUNCTUATION_DRIFT), G (TRAILING_HYPHEN), I (MODEL_INJECTED_INTO_NAME), N (DIGIT_DUPLICATION), O (MODEL_TRAILING_DASH_NO_DIGITS).

Полная карта в `ismeta/docs/spec4-audit/AUDIT-TRACKER.md`.

---

## Структура работы

5 групп задач, каждая отдельным коммитом в ветке `recognition/e20-2-quality-fixes`. После каждой группы — прогон goldens.

| # | Группа | Файлы | Приоритет |
|---|---|---|---|
| 1 | bbox y-bucketing fix | `pdf_text.py` | P0 (count) |
| 2 | post-LLM Class L realignment | `spec_postprocess.py` | P0 (count) |
| 3 | Class M cross-page section preface stitch | `pdf_text.py` или `spec_parser.py` | P1 |
| 4 | Class K pos-prefix filter + Class H model tail | `spec_postprocess.py` | P1 |
| 5 | Class C dedup_repeated_phrase | `spec_postprocess.py` | P1 |
| 6 | P2 cosmetics: J/G/I/N/O | `spec_postprocess.py` | P2 (опционально) |

Сначала P0, потом P1. P2 — на усмотрение, можно отложить в E20-3.

---

## Задача 1 — bbox y-bucketing fix (P0, 23 ОБМ-Вент остатка)

### Симптом

Pre-LLM row на странице 2 содержит:
```
ОБМ-5Ф прошивной базальтовый материал из базальтового ванный обкладочным материалом из алюминиевой фольги с одной стороны (коэффициент расхода 1,2 на 1 м2 …
```

То есть spans двух физических PDF-строк (одна — `ОБМ-5Ф … базальтового`, вторая — `ванный обкладочным …`) попали в один bbox row на этапе извлечения. Cluster-merge в E20-1 получает уже сломанный input и не может его восстановить.

### Регресс-query

```sql
-- На live job после E20-2 должно быть 0 строк
SELECT (i->>'page_number')::int AS pg, (i->>'sort_order')::int AS pos,
       substr(i->>'name', 1, 100) AS head
FROM recognition_jobs_recognitionjob, jsonb_array_elements(items) i
WHERE id='<NEW_JOB_ID>'
  AND (i->>'name' LIKE '%ванный обкладочным%'
    OR i->>'name' LIKE '%кашироОБМ-5Ф%'
    OR i->>'name' LIKE '%щего компонента в системах%Огнезащитное%'
    OR (i->>'name') ~ 'базальтового\s+ванный')
ORDER BY pg, pos;
```

Сейчас (после E20-1 retrofit, job `7c39df61-2361-4985-abd8-ca5d477777da`) — 23 строки.

### Что нужно сделать

В `recognition/app/services/pdf_text.py` функция `extract_structured_rows` (или вспомогательная):

1. Найти где `_ROW_Y_TOLERANCE = 5.5pt` (или подобная константа) используется для группировки spans в rows.
2. Проблема: spans на разных физических строках попадают в одну bbox row. Возможные причины:
   - Tolerance слишком большой для плотных PDF (line-height ~6pt в специфике ОВиК)
   - Группировка идёт по `min(y)` вместо `median(y)` — длинная строка с overlapping bboxes ловит соседнюю.
3. Решение (на выбор Пети):
   - **Опция A:** уменьшить `_ROW_Y_TOLERANCE` до 3pt и добавить **проверку non-overlap по x** (если bbox двух spans на одинаковом y, но overlapping по x — это разные строки, сначала по y приоритет).
   - **Опция B:** при формировании row использовать `median(y_top)` всех spans вместо `min`. Если новый span имеет y_top > median + 3pt — это новая row.
   - **Опция C (более глубокая):** перейти на двухпроходный bucketing — сначала estimate line_height по странице (mode of y-gaps), потом группировать по 0.5×line_height tolerance.

### Защита от регрессии

Goldens (`tests/golden/test_spec_ov2.py`, `test_spec_aov.py`, `test_spec_tabs.py`, `test_invoice_*.py`) должны остаться зелёными. Особенно — `spec_ov2`, потому что там тоже плотные ОБМ-Вент огнезащитные строки.

Unit test:
```python
def test_obm_vent_two_physical_lines_not_merged_in_bucket():
    """ОБМ-5Ф row и ванный обкладочным row — две физические строки PDF
    с близкими bbox-y. Должны быть в разных bbox rows."""
    # synthetic spans с y=100 (ОБМ-5Ф …) и y=104 (ванный обкладочным …)
    # _ROW_Y_TOLERANCE > 4pt → склеит. < 4pt → разделит.
    rows = extract_structured_rows(synthetic_page)
    assert len(rows) == 2
    assert "ОБМ-5Ф" in rows[0].name
    assert "ОБМ-5Ф" not in rows[1].name  # должно быть отдельно
```

---

## Задача 2 — post-LLM Class L realignment (P0)

### Симптом

На стр 7 (audit-tracker), 19, 28, 32, 37, 40, 50: pre-LLM rows корректные (qty=60 на «Фасонные», qty=13 на «То же 1200х800»). LLM при normalization путает qty/unit/model между соседними items — qty уезжает на 1 row выше или ниже.

### Что нужно сделать

В `recognition/app/services/spec_postprocess.py` (или новый модуль `spec_postprocess_realign.py`):

1. После LLM normalization, перед финальным merge: для каждого item проверить **consistency name × qty/unit/model**.
2. Эвристики:
   - Если name содержит `Фасонные изделия (XX%)` → unit должен быть `м²`. Если LLM вернул `п.м.` — поискать в соседних items 1 row выше/ниже rows с `name=«Воздуховоды/То же …»` и unit=`п.м.` — это «забрало» наш qty. Если у соседа qty match — swap.
   - Если name содержит `Метал для крепление` → unit должен быть `кг`. То же swap.
   - Если name содержит `Самоклеющая лента` → unit `п.м.`.
   - Если name содержит `Теплозащ … покрытие …` → unit `м²`.
3. Использовать **post-LLM consistency table** для типовых ОВиК-items.

### Регресс-query

```sql
-- Items с неконсистентным name × unit
SELECT (i->>'page_number')::int AS pg, (i->>'sort_order')::int AS pos,
       i->>'name' AS name, i->>'unit' AS unit, (i->>'quantity')::float AS qty
FROM recognition_jobs_recognitionjob, jsonb_array_elements(items) i
WHERE id='<NEW_JOB_ID>'
  AND (
    (i->>'name' ~ 'Фасонные изделия' AND i->>'unit' != 'м²')
    OR (i->>'name' ~ '^Метал для крепл' AND i->>'unit' != 'кг')
    OR (i->>'name' ~ '^Самоклеющая лента' AND i->>'unit' NOT IN ('п.м.', 'м'))
  )
ORDER BY pg, pos;
```

Сейчас (post-E20-1) — 5-8 строк. Должно стать 0.

---

## Задача 3 — Class M cross-page section preface stitch (P1)

### Симптом

Когда «Комплексное огнезащитное покрытие воздуховодов ОБМ-Вент EI60 в составе: ОБМ-5Ф …» переходит со страницы N на страницу N+1, заголовок секции теряется:

- На стр N последний row: `Комплексное огнезащитное покрытие воздуховодов ОБМ-` (обрыв на дефисе, qty=1, unit=шт)
- На стр N+1 первый row: `Вент EI60 в составе: ОБМ-5Ф прошивной …` (обрыв уехал в начало name)

В DB получается 2 phantom row (на стр N трейлер «ОБМ-» и на стр N+1 продолжение «Вент EI60»).

### Где встречается

Стр 26→27 (item #459 → item #460), 8→9 (item #134 → item #135), 19→20, 26→27, 35→36, 39→40, 44→45, 48→49, 50→51, 65→66.

### Что нужно сделать

В `recognition/app/services/spec_parser.py` Phase 5 (cross-page merge) или в `spec_postprocess.py`:

1. После обработки всех страниц, перед финальным aggregation: пройти по items в порядке `(page_number, sort_order)`.
2. Если item N имеет name заканчивающийся на `ОБМ-` (или `ОБМ`, `воздуховодов ОБМ-`) И item N+1 начинается с `Вент EI` (или `Вент`) — склеить в один item:
   - name = item[N].name.rstrip('- ') + ' ' + item[N+1].name (или нормализованное «Комплексное огнезащитное покрытие воздуховодов ОБМ-Вент EI60 в составе: ОБМ-5Ф …»)
   - qty/unit/mfr берём с item[N+1] (там значащие данные)
   - удалить item[N] (phantom).

### Регресс-query

```sql
-- Phantom items с обрывом «ОБМ-» в конце name
SELECT (i->>'page_number')::int AS pg, (i->>'sort_order')::int AS pos, i->>'name' AS name
FROM recognition_jobs_recognitionjob, jsonb_array_elements(items) i
WHERE id='<NEW_JOB_ID>'
  AND (
    (i->>'name') ~ 'ОБМ-\s*$'
    OR (i->>'name') ~ '^\s*Вент EI'
  )
ORDER BY pg, pos;
```

Сейчас — ~10 строк. Должно стать 0.

---

## Задача 4 — Class K pos-prefix filter + Class H model tail recovery (P1)

### Симптом A: Class K MEGA L+K

Каждая Вытяжная/Дымоудаления установка (В6, В8-В32, ВД1-ВД11, ПД1-ПД22) имеет в DB разрушенный name типа:
```
В8-Метал для крепление воздуховодов в комплекте.
```
Реально PDF: `В8 — Вытяжная крышная установка L=1120м³/ч Pc=250 Па в комплекте.`

Pos-префикс `В8` приклеился к name соседнего item (Метал) + хвост `в комплекте.` от настоящего В8 — это mash-up.

### Симптом B: Class H/H1/H2 model tail

КЛОП'ы где cluster-merge не сработал — model обрезан на `КЛОП-2(90)-НО-300х300` без хвоста `-МВ/S(220)-К`. На некоторых страницах хвост утечет в mfr (Class H1) или в name (Class H2).

### Где встречается

Class K MEGA: ~30 items на стр 29, 30, 31, 34, 35, 36, 38, 40, 41, 42, 44, 45, 46, 49, 50, 51, 53, 54, 56, 57, 59, 60, 61, 63, 64, 65, 67, 68, 69, 70, 71, 72, 74, 76, 77, 79, 81, 82.

Class H остатки: стр 1, 11 (item 167-171), 13 (201-204), 17 (286-287), 23 (398), 24 (416-417), 31 (523), 33 (556-557), 38 (632-633), 42 (680), 44 (718), 47 (760-763), 49 (793), 54 (869), 79.

### Что нужно сделать

В `recognition/app/services/spec_postprocess.py`:

1. **Class K filter**: при формировании items, если name начинается с pos-prefix (`B-?\d+`, `ВД-?\d+`, `ПД-?\d+`, `В\d+В\d+`, `П\d+`) И content после префикса не выглядит как Вытяжная/Приточная/Установка — это mash-up. Возможные действия:
   - Если в кластере есть ОТДЕЛЬНЫЙ item начинающийся с `Вытяжная установка L=…` — назначить ему этот pos-prefix, удалить prefix из чужого name.
   - Если такого item нет — оставить prefix внутри name и пометить flag `position_unstable=true` для PO внимания.

2. **Class H model tail recovery**: после bbox extraction в pre-LLM, если у row есть `model = КЛОП-X(YY)-…` БЕЗ хвоста `-МВ/S(...)` И в соседних rows (next 1-2) есть строка содержащая `МВ/S(220)-К` (или `-СН-К`, `-ВН`) — приклеить через `-`.

### Регресс-query

```sql
-- Class K MEGA: pos-prefix к чужому name
SELECT (i->>'page_number')::int AS pg, (i->>'sort_order')::int AS pos, i->>'name' AS name
FROM recognition_jobs_recognitionjob, jsonb_array_elements(items) i
WHERE id='<NEW_JOB_ID>'
  AND (i->>'name') ~ '^(В\d+|ВД\d+|ПД\d+|В\d+В\d+|П\d+)-(Метал|Опора|Установка совместно|Комплект автоматики)'
ORDER BY pg, pos;

-- Class H: КЛОП model без хвоста МВ/S
SELECT (i->>'page_number')::int AS pg, (i->>'sort_order')::int AS pos, i->>'model_name' AS model
FROM recognition_jobs_recognitionjob, jsonb_array_elements(items) i
WHERE id='<NEW_JOB_ID>'
  AND (i->>'model_name') ~ 'КЛОП-\d+\([^)]+\)-(НО|НЗ)-[^-]*[^К]$'
  AND (i->>'model_name') !~ 'МВ/S'
ORDER BY pg, pos;
```

Сейчас — Class K MEGA ~30 items, Class H ~50 items. Должно стать ≤ 5 каждый.

---

## Задача 5 — Class C dedup_repeated_phrase (P1)

### Симптом

Длинные continuation в name содержат **точную повторку фразы**:

```
Огнезащитное покрытие Expert Standart … (0,6кг мастики на 1м2 изолируемой поверхности, потери при механическом нанесении 20%) ховодов ОБМ-Вент (0,6кг мастики на 1м2 изолируемой поверхности, потери при механическом нанесении 20%).
```

Часть `(0,6кг мастики на 1м2 …)` повторяется. То же — `«в комплекте. в комплекте.»`, `«одной стороны … одной стороны»`.

### Что нужно сделать

В `recognition/app/services/spec_postprocess.py` функция `_dedup_repeated_phrases(name)`:

1. Найти повторы фрагментов длиной от 15 chars в name (regex `(.{15,})\s+\1` flags=I).
2. Удалить вторую копию фрагмента.
3. Если после удаления остаётся «висячий хвост» (типа `ховодов ОБМ-Вент`) после первой копии — удалить и его.

### Tests

```python
def test_dedup_expert_standart():
    name = "Огнезащитное покрытие Expert Standart … (0,6кг мастики на 1м2 изолируемой поверхности, потери при механическом нанесении 20%). ховодов ОБМ-Вент (0,6кг мастики на 1м2 изолируемой поверхности, потери при механическом нанесении 20%)."
    out = _dedup_repeated_phrases(name)
    assert "0,6кг мастики на 1м2" in out
    assert out.count("0,6кг мастики на 1м2") == 1

def test_dedup_v_komplekte():
    name = "ПР1-Приточно-рециркуляцион. установка L=750м3/ч Pc=300Па в комплекте. в комплекте."
    out = _dedup_repeated_phrases(name)
    assert out.endswith("в комплекте.")
    assert out.count("в комплекте.") == 1
```

### Регресс-query

```sql
-- DUP в name (повторы 15+ chars)
SELECT (i->>'page_number')::int AS pg, (i->>'sort_order')::int AS pos, substr(i->>'name', 1, 200) AS head
FROM recognition_jobs_recognitionjob, jsonb_array_elements(items) i
WHERE id='<NEW_JOB_ID>'
  AND (
    (i->>'name') ~ '(в комплекте\.)\s*\1'
    OR (i->>'name') ~ '(0,[68]кг мастики на 1м2)[^(]+\1'
    OR (i->>'name') ~ '(одной стороны)\s+[^(]*\1'
  )
ORDER BY pg, pos;
```

Сейчас — ~50 items. Должно стать 0.

---

## Задача 6 (опционально, P2) — мелочи

### Class J PUNCTUATION_DRIFT

`КЛОП-2(90)-НО-700х500, МВ/S(220)-К` → `КЛОП-2(90)-НО-700х500-МВ/S(220)-К`. Замена `, ` на `-` между размером и `МВ/S`.

### Class G TRAILING_HYPHEN

Word-break не закрыт continuation: `каширо-` и оставшийся `ванный` после dedup → склеить в `кашированный`.

### Class I MODEL_INJECTED_INTO_NAME

LLM дописывает `(модель: …)` в name (стр 3 item #31). Удалить regex-ом из name если содержимое скобок дублируется в `model_name`.

### Class N DIGIT_DUPLICATION

`6400/6400` → `6400/64000` (стр 23). Если в name `\d+/\d{4}\d` — попробовать обрезать последнюю цифру если первая часть == вторая часть без неё.

### Class O MODEL_TRAILING_DASH_NO_DIGITS

`КЛОП-2(90)-НО-1700х` (без числа после `х`). Стр 28 item #476. Если model заканчивается на `х` или `Ø` без числа — попытаться найти число в pre-LLM bbox row на следующей строке.

P2 группа — на усмотрение Пети. Можно пропустить и оставить в E20-3.

---

## Регрессионные тесты (после каждой группы)

### Unit tests

Для каждой задачи минимум 1 dedicated test. Целевая структура `tests/test_pdf_text.py` и `tests/test_spec_postprocess.py`.

### Goldens (после ВСЕХ групп)

```bash
cd recognition && env RECOGNITION_API_KEY=test-key python -m pytest tests/ -v
```

Ожидание: **265+ unit tests passed**, все 5 goldens (`spec_ov2`, `spec_aov`, `spec_tabs` aka spec-3, 2 invoice) — зелёные. Ни один **не должен сломаться**. Допустимо обновлять snapshots если они исправляют известный баг (но согласовать в PR description).

### Live прогон Spec-4

После всех групп — live-прогон через UI или curl на ismeta-backend `/api/v1/estimates/{id}/import_pdf?async=true`.

PDF: `/Users/andrei_prygunov/Downloads/Спорт-школа КЛИН/Проекты/Альбом СК-269-7-22-ОВ2 (ВЕНТ) ИЗМ3.1_СПЕЦИФИКАЦИЯ.pdf`

Целевые метрики после E20-2:

| Метрика | Pre-E20-2 | Цель E20-2 |
|---|---|---|
| Σ Δ (vs 1250 PO) | +8 | **≤ 5** |
| ОБМ-Вент broken-name regression | 23 | **0** |
| Class L (qty/unit mismatch) | 5-8 | **0** |
| Class M (cross-page «ОБМ-» обрыв) | ~10 | **0** |
| Class K MEGA (pos-prefix к чужому name) | ~30 | **≤ 5** |
| Class H (КЛОП model без хвоста МВ/S) | ~50 | **≤ 10** |
| Class C DUP в name | ~50 | **0** |

---

## DoD (Definition of Done)

- [ ] Все 5-6 групп реализованы в отдельных коммитах ветки `recognition/e20-2-quality-fixes`.
- [ ] Каждая группа имеет dedicated unit-test.
- [ ] Все goldens (`tests/`) зелёные.
- [ ] Live прогон Spec-4: метрики удовлетворяют целевым (см. таблицу выше).
- [ ] PR в main с rebase на свежий origin/main.
- [ ] PR description содержит таблицу «Pre-E20-2 vs Post-E20-2» по всем 7 классам с цифрами.
- [ ] Compare-report сгенерирован и приложен в `ismeta/docs/spec4-audit/post-e20-2-compare-report.md`.

### Threshold для merge

- Если Σ Δ ≤ 5 И все P0 (bbox + Class L) regression queries = 0 → **merge**.
- Если Σ Δ 6-10 (partial done): обсудить с PO до merge — какие classes остались, переносим ли в E20-3.
- Если Σ Δ > 10 (regression): не мержить, разбираемся.

---

## Подсказки

### Текущее состояние live job (post-E20-1 retrofit)

**Job ID:** `7c39df61-2361-4985-abd8-ca5d477777da` (1258 items, 2026-04-26 21:08).

Используй для baseline regression-queries. Новый job для финального прогона создашь сам.

### Ключевые файлы

- `recognition/app/services/pdf_text.py` (567 LOC после E20-1) — bbox extraction + cluster-merge + КЛОП split. Здесь bbox y-bucketing (Задача 1) + Class M stitch (Задача 3).
- `recognition/app/services/spec_postprocess.py` — post-LLM normalization. Здесь Class L realignment (Задача 2) + Class K filter + Class H tail recovery (Задача 4) + Class C dedup (Задача 5) + P2 cosmetics (Задача 6).
- `recognition/app/services/spec_parser.py` — pipeline orchestration. Возможно потребуется hook для Class M в Phase 5 (cross-page merge).

### Рекомендуемый порядок коммитов

1. `feat(recognition): E20-2 — bbox y-bucketing fix (P0, 23 ОБМ-Вент)`
2. `feat(recognition): E20-2 — post-LLM Class L realignment qty/unit`
3. `feat(recognition): E20-2 — Class M cross-page section preface stitch`
4. `feat(recognition): E20-2 — Class K pos-prefix filter + Class H model tail recovery`
5. `feat(recognition): E20-2 — Class C dedup_repeated_phrases`
6. `feat(recognition): E20-2 — P2 cosmetics J/G/I/N/O` (опционально)

После каждого коммита — прогон unit-tests. После 1 и 2 (P0) — отдельный live-прогон чтобы померить Σ Δ. После 4-5 (P1) — финальный live-прогон.

### Worktree setup

Уже создан Tech Lead'ом:
```
/Users/andrei_prygunov/obsidian/avgust/ERP_Avgust_is_petya_e20_2
```
Ветка `recognition/e20-2-quality-fixes` от `origin/main` @ `c9debf5`.

### Перед PR

```bash
cd /Users/andrei_prygunov/obsidian/avgust/ERP_Avgust_is_petya_e20_2
git fetch origin
git rebase origin/main
git log main..HEAD  # должны быть только твои коммиты
```

### После мержа

Tech Lead удалит worktree.

---

## Вопросы — обращайся

Если упрёшься в:
- Конфликт между группами (например, Class L realignment ломает goldens) — отчитайся, согласуем scope cut.
- Цели Σ Δ ≤ 5 не достичь без regression — отчёт + предложение partial done с конкретным остатком.
- Неожиданная регрессия в goldens после fix'а — НЕ обновляй snapshot без согласования. Сначала отчёт.

🚀 Удачи, Петя! Это финальный sprint для Spec-4 — после E20-2 ОВиК-парсер должен быть production-ready на сложных альбомах.
