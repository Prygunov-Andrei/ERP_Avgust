# ТЗ: E15.05 итерация 2 — bbox-hardening + multimodal fallback + manufacturer (IS-Петя)

**Команда:** IS-Петя.
**Ветка:** `recognition/08-e15.05-it2-bbox-multimodal`.
**Worktree:** `ERP_Avgust_is_petya_e15_05_it2`.
**Приоритет:** 🔴 blocker (ТАБС-116 показал что current парсер не работает на variant ЕСКД-форматах).
**Срок:** 1.5–2 дня.

---

## Контекст

QA-сессия 4 (2026-04-22 после мержа it1, см. `ismeta/docs/QA-FINDINGS-2026-04-22.md` #35-#44) на третьем golden `spec-tabs-116-ov.pdf`:
- Recognition вернул 185 items, но **ВСЕ с `model_name=""`** (R23 — multi-row header не детектируется, колонка model узкая).
- **Ни один раздел** не распознан корректно (R26 — section_name с trailing `:`).
- **Multi-line орфан-name** rows стали отдельными items (R18 мягкое правило не срабатывает).
- **Штампы `"Дата и подпись"`, `"Инв.№ подп."`** попали в items (R25 — фильтр только по `cells.name`, не по остальным ключам).
- **Лишние пробелы** «Pc=3 0 0 Па» (R24 — span-join через пробел без x-gap проверки).

**Решение PO:** гибридный подход — bbox-hardening (R18/R22/R23/R24/R25/R26) **плюс** conditional multimodal Vision fallback (R27). Переход extract на gpt-4o full (скорость/цена не критичны, важно качество ≥ 95% на всех 3 goldens).

**Дополнительно — PO ожидает:** модуль будет использоваться также для Счетов и КП. Invoice/Quote парсеры — **отдельный эпик E16**, но архитектурные решения it2 должны быть переносимы (модульность, чистый provider interface).

---

## Задачи

### 1. R23 — Multi-row header склейка в `extract_structured_rows`

**Файл:** `recognition/app/services/pdf_text.py`.

**Проблема:** ЕСКД таблицы часто имеют шапку в 3-6 строк с переносами слов через дефис:
```
"оборудо-" / "вания, Завод-" / "изготови- ница" / "изделия," / "тель" / "материала"
```
Наш `_find_header_row` ищет ОДНУ строку с ≥3 header-keywords. Не находит → `_DEFAULT_COLUMN_BOUNDS` как fallback.

**Решение:**
1. Добавить `_merge_multi_row_header(spans_in_bucket_range)`:
   - Собирать все spans в первых N строках страницы (N=10, зона шапки — top 20% листа).
   - Группировать spans по **x-координате** (кластеризация по центру или левому краю).
   - Внутри каждого x-кластера — склеить text через concatenation с правилами:
     - Если предыдущий фрагмент заканчивается на `-` — склеить без пробела («оборудо-» + «вания» → «оборудования»).
     - Иначе — склеить через пробел («Тип, марка,» + «обозначение документа» → «Тип, марка, обозначение документа»).
2. Проверить склеенные тексты против `_HEADER_MARKERS`:
   ```python
   _HEADER_MARKERS = {
       "name": ["наименование", "характеристика"],
       "model": ["тип, марка", "обозначение документа", "тип, марка, обозначение"],
       "brand": ["код оборудования", "поставщик", "завод-изготовитель", "производитель"],
       "unit": ["ед. изм", "единица"],
       "qty": ["кол", "количество"],
       "mass": ["масса"],
       "comments": ["примечание"],
       "pos": ["поз.", "позиция"],
   }
   ```
3. Каждый x-кластер с matched-marker → становится **column boundary** для этой страницы.
4. Возвращать `ColumnBounds` per-page (не константа `_DEFAULT_COLUMN_BOUNDS`).

**Тесты:**
- `test_multi_row_header_spec_tabs` — fixture 6-row header из ТАБС → correctly склеено в 6 колонок.
- `test_multi_row_header_spec_ov2` — fixture 1-row header из spec-ov2 → **не регрессировать**, такой же результат как сейчас.
- `test_word_concat_with_dash` — unit test на `"оборудо-" + "вания"` → `"оборудования"`.

### 2. R24 — Span-join без лишних пробелов

**Файл:** `recognition/app/services/pdf_text.py:extract_lines` (или `_merge_spans_in_bucket`).

**Проблема:** PDF выводит «Pc=300 Па» как 4 spans: `Pc=`, `3`, `0`, `0` (kerning + font-style). `extract_lines` склеивает через `" ".join(spans)` → «Pc=3 0 0 Па».

**Решение:** при склейке spans в одной y-bucket, проверять x-gap:
```python
def join_spans(spans: list[Span], font_size: float) -> str:
    spans.sort(key=lambda s: s.x0)
    parts: list[str] = []
    for i, s in enumerate(spans):
        if i == 0:
            parts.append(s.text)
            continue
        prev = spans[i-1]
        gap = s.x0 - prev.x1
        threshold = font_size * 0.3  # 30% font_size = типичная ширина пробела
        if gap < threshold:
            parts.append(s.text)             # внутри слова/числа — без пробела
        else:
            parts.append(" " + s.text)       # между словами — с пробелом
    return "".join(parts)
```

**Тесты:**
- `test_span_join_close_spans_no_space` — два span «3» и «0» с gap=1pt, font_size=10 → «30».
- `test_span_join_far_spans_with_space` — два span «Pc=300» и «Па» с gap=4pt, font_size=10 → «Pc=300 Па».
- Проверить что regressions на spec-ov2/aov нет (имена не склеились друг с другом).

### 3. R25 — Stamp filter на все cell keys

**Файл:** `recognition/app/services/pdf_text.py:is_stamp_line` / `is_stamp_text`.

**Проблема:** R20 в it1 фильтрует штампы **только** в `cells.name`. В ТАБС штамп попадает в `cells.pos` («Дата и подпись», «Инв.№ подп.») и `cells.model` («Код уч № док Подпись»).

**Решение:**
1. После column mapping для каждой row — проверить **все** ячейки через `is_stamp_text`.
2. Если stamp найден в `cells.pos` — удалить из cells.pos (чтобы не делать артефактный system_prefix).
3. Если stamp = весь текст row (все cells — штампы / пусты) → **пометить row `is_stamp=True`** и исключить из `extract_structured_rows` output.
4. Расширить `_STAMP_REGEX`:
   ```python
   _STAMP_REGEX = re.compile(
       r"^(?:Взаим\.?\s*инв\.?|Вз\.?\s*инв\.?|Взам\.?\s*инв\.?"
       r"|Инв\.?\s*№\s*подл\.?|Инв\.?\s*№\s*подп\.?"
       r"|Согласовано\s*:?"
       r"|Код\s+уч\s+№\s+док"
       r"|Дата\s+и\s+подпись"
       r"|Расчет\s+фасонных\s+деталей"
       r"|Н\.?\s*контр\.?)",
       re.IGNORECASE,
   )
   ```

**Тесты:**
- `test_stamp_in_cells_pos` — row с `cells={"pos": "Дата и подпись"}` → row filtered out.
- `test_stamp_in_cells_model` — row с `cells.model = "Код уч № док Подпись"` → row filtered out.
- `test_stamp_partial_cleared` — row с `cells={"pos": "Инв.№ подп.", "name": "Расчет..."}` → row filtered out полностью (name тоже штамп).

### 4. R26 — Section name normalization

**Файл:** `recognition/app/services/spec_normalizer.py:NORMALIZE_PROMPT_TEMPLATE` + post-processing.

**Проблема:** Section заголовки дубли «Вентиляция» vs «Вентиляция :», «Кондиционирование» vs «Кондиционирование :».

**Решение:**
1. В промпте правило 1 добавить:
```
1d. Normalize section_name: ВСЕГДА удаляй trailing пробелы, двоеточия (`:`),
    тире (`—`), дефисы (`-`). Если две подряд секции дают normalized-form
    одинаковые — это ТА ЖЕ секция, не создавай дубль.
    
    Примеры:
      "Вентиляция :"  → new_section = "Вентиляция"
      "Кондиционирование : " → new_section = "Кондиционирование"
      "Отопление: "    → new_section = "Отопление"
```

2. Дополнительно **post-processing** в `normalize_via_llm` — нормализовать `new_section` и `items[].section_name` после ответа LLM:
```python
def _normalize_section(s: str) -> str:
    return re.sub(r"[\s:—\-]+$", "", s.strip())
```

**Тесты:**
- `test_section_dedupe_colon_vs_no_colon` — LLM вернул 2 items с section="Вентиляция" и 3 с section="Вентиляция :" → после нормализации все 5 в одной секции "Вентиляция".

### 5. R18 усиление — Orphan-name ВСЕГДА continuation

**Файл:** `recognition/app/services/spec_normalizer.py:NORMALIZE_PROMPT_TEMPLATE`.

**Проблема:** Правило 3 в it1 говорит «склей name через пробел», но **не категорично**. LLM иногда создаёт отдельный item из orphan-name row.

**Решение:** заменить правило 3 на жёстко-категоричное:

```
3. КРИТИЧЕСКИ-ВАЖНОЕ ПРАВИЛО: orphan-name rows.

   Если в row ЗАПОЛНЕН ТОЛЬКО `cells.name` (cells.pos, cells.model,
   cells.brand, cells.unit, cells.qty, cells.mass, cells.comments — ВСЕ
   пусты или отсутствуют) — это ВСЕГДА continuation предыдущего item.

   Никогда не создавай из такой row отдельный item. Склей `cells.name`
   с name предыдущего item через пробел.

   Если перед такой orphan-row нет предыдущего item (например в начале
   страницы без sticky) — это либо продолжение name со ВЧЕРАШНЕЙ страницы
   (использовать sticky_parent_name из входа), либо заголовок раздела
   (если текст соответствует правилу 1) — если не удаётся решить, пропусти
   row.

   Это правило САМОЕ ВАЖНОЕ из всех 11 правил после Правила 0. Обязательно
   проверяй его перед созданием каждого item.
   
   Пример (spec-tabs-116-ov.pdf page 1):
     r7: {pos: "П1/В 1", name: "Приточно-вытяжная установка...",
          model: "", brand: "LUFT MEER", unit: "", qty: "1", mass: "",
          comments: "подвесная"}
     r8: {pos: "", name: "комплектно со см. узлом, пластинчатым рекуператором",
          model: "", brand: "", unit: "", qty: "", mass: "", comments: ""}
     r9: {pos: "", name: "комплектом автоматики",
          model: "", brand: "", unit: "", qty: "", mass: "", comments: ""}

     ПРАВИЛЬНО: ОДИН item с name =
       "Приточно-вытяжная установка... комплектно со см. узлом, пластинчатым
        рекуператором комплектом автоматики"
     НЕПРАВИЛЬНО: 3 отдельных items.
```

**Тесты:** unit-тест `test_orphan_name_rows_are_continuation` в `test_normalize_llm.py` с mock LLM (проверяет что промпт содержит это правило).

### 6. R22 — Новое поле `manufacturer`

**Файл:** `recognition/app/schemas/spec.py`.

```python
class SpecItem(BaseModel):
    name: str
    model_name: str = ""
    brand: str = ""
    # E15.05 it2: brand = бренд оборудования (торговая марка: Корф, IEK, Fujitsu).
    # manufacturer = конкретный завод-поставщик (ООО "КОРФ", АО "ДКС").
    manufacturer: str = ""
    unit: str = "шт"
    quantity: float = 1.0
    tech_specs: str = ""
    comments: str = ""
    section_name: str = ""
    page_number: int = 0
    sort_order: int = 0
```

**NormalizedItem** — аналогично добавить `manufacturer: str = ""`.

**Промпт** — расширить правило 0:
```
  cells.manufacturer → items[].manufacturer
```

И в секции column headers расширить `_HEADER_MARKERS["brand"]` разделяя на:
```python
_HEADER_MARKERS = {
    ...
    "brand": ["поставщик"],   # код/бренд поставщика
    "manufacturer": ["завод-изготовитель", "производитель", "изготовитель"],
}
```

**`pdf_text.extract_structured_rows`** — добавить cell key `manufacturer`.

**ISMeta:** `pdf_import_service.apply_parsed_items` — если `item.get("manufacturer")` непуст → `tech_specs["manufacturer"] = item["manufacturer"]`.

### 7. R27 — Гибрид: multimodal Vision fallback с conditional retry

**Файл:** `recognition/app/services/spec_parser.py` + `recognition/app/providers/openai_vision.py`.

**Архитектура:**

```
Для каждой страницы в batch:
  Phase 1 (text-only, gpt-4o full):
    rows = extract_structured_rows(page)
    norm_p1 = await normalize_via_llm(rows, model="gpt-4o")  # НЕ mini
    
    confidence = compute_confidence(norm_p1, rows)
  
  Phase 2 (multimodal retry, conditional):
    if confidence < CONFIDENCE_THRESHOLD (settings.llm_multimodal_retry_threshold, default 0.7):
      page_image_b64 = render_page_to_b64(page)
      norm_p2 = await normalize_via_llm_multimodal(
          rows=rows,
          image_b64=page_image_b64,
          model="gpt-4o",
      )
      # Brooker-selection: берём p2 если он лучше p1 по confidence.
      norm_final = norm_p2 if compute_confidence(norm_p2, rows) > confidence else norm_p1
    else:
      norm_final = norm_p1
```

**`compute_confidence(normalized_page, rows)`** — эвристика качества:
```python
def compute_confidence(norm: NormalizedPage, rows: list[TableRow]) -> float:
    if not norm.items:
        return 0.0
    
    # 1. Доля items с заполненным model_name.
    items_with_model = sum(1 for it in norm.items if it.model_name)
    model_ratio = items_with_model / len(norm.items)
    
    # 2. Доля items с заполненным brand или manufacturer.
    items_with_brand = sum(1 for it in norm.items if it.brand or it.manufacturer)
    brand_ratio = items_with_brand / len(norm.items)
    
    # 3. Секции найдены.
    sections = {it.section_name for it in norm.items if it.section_name}
    section_score = min(len(sections) / 2.0, 1.0)  # 2+ секции = 1.0
    
    # 4. Items.count ≈ rows.count (с учётом multi-line склеек).
    row_count_ratio = len(norm.items) / max(len(rows), 1)
    count_score = 1.0 if 0.3 <= row_count_ratio <= 0.9 else 0.5
    
    return (model_ratio * 0.4 + brand_ratio * 0.2 + 
            section_score * 0.2 + count_score * 0.2)
```

**Новый метод в `BaseLLMProvider`:**
```python
async def multimodal_complete(
    self,
    prompt: str,
    image_b64: str,
    *,
    max_tokens: int | None = None,
    temperature: float = 0.0,
) -> TextCompletion:
    raise NotImplementedError
```

**OpenAI реализация** в `openai_vision.py`:
- Используем `gpt-4o` (не mini) для vision.
- `messages=[{"role": "user", "content": [{"type": "text", "text": prompt}, {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{image_b64}", "detail": "high"}}]}]`.
- `response_format={"type": "json_object"}`.

**`normalize_via_llm_multimodal`** в `spec_normalizer.py`:
- Аналогично `normalize_via_llm`, но **prompt** явно указывает:
  ```
  У тебя есть ДВА источника данных:
  1. JSON rows с bbox-cells — АВТОРИТЕТНЫЙ источник ТЕКСТА.
  2. PNG-изображение страницы — для ВИЗУАЛЬНОЙ structure (колонки, секции, bold).
  
  ПРАВИЛО: текст бери из JSON (там точный text layer). Картинку используй для:
  - правильного разделения name и model (если в JSON они в одной cell);
  - детекции секционных заголовков (bold font / центрированный);
  - понимания границ row (visual row boundaries при переносах).
  
  НИКОГДА не бери цифры/слова из картинки — только из JSON. OCR может
  ошибаться в русском тексте.
  ```

**Settings:**
```python
# recognition/app/config.py
llm_multimodal_retry_enabled: bool = True
llm_multimodal_retry_threshold: float = 0.7
llm_extract_model: str = "gpt-4o"           # было gpt-4o-mini — переходим на full
llm_classify_model: str = "gpt-4o-mini"     # классификация страниц — остаётся mini
```

**Тесты:**
- `test_confidence_score_all_models_filled` → 1.0.
- `test_confidence_score_no_models` → <0.5.
- `test_multimodal_fallback_triggered` — mock Phase 1 с confidence 0.3 → multimodal вызвался.
- `test_multimodal_not_triggered_high_confidence` — mock Phase 1 с confidence 0.9 → multimodal не вызывался.

### 8. Переход на gpt-4o full (extract)

**Изменения:**
- `settings.llm_extract_model = "gpt-4o"` (default). kill-switch: `RECOGNITION_LLM_EXTRACT_MODEL=gpt-4o-mini`.
- В `OpenAIVisionProvider` — унифицировать `text_complete(model=settings.llm_extract_model)` и `vision_complete(model=settings.llm_classify_model)`.
- Обновить cost estimates в `compute_cost` / logging.

### 9. Dual → Triple golden тесты

**Файл:** `recognition/tests/golden/test_spec_tabs.py` (новый).

```python
"""Третий golden — ТАБС-116-25-ОВ (9 стр, ~150 позиций, Вентиляция/Кондиционирование/БТП).

После E15.05 it2 (hybrid) должен давать:
- items >= 120 (80% от ожидаемых ~150)
- sections >= 4 (Вентиляция, Кондиционирование, Отопление и теплоснабжение, 
  Блочный тепловой пункт, Шкаф узла учета — минимум 4 из 5)
- все items с непустым model_name ИЛИ manufacturer (column detection работает)
- 0 items с "Дата и подпись", "Инв.№ подп.", "Код уч № док" в любом поле
- numeric prefix (1.1, 2.3) НЕ в начале name
- 0 лишних пробелов в числах ("Pc=3 0 0 Па" → "Pc=300 Па")
"""
```

Обновить **`test_spec_ov2.py`** — `LLM_MIN_ITEMS` 140 → 145 (после it2 ожидаем прирост).  
Обновить **`test_spec_aov.py`** — добавить проверки на `manufacturer` поле.

### 10. Docs

- **`recognition/README.md`** — секция «Pipeline», описать 3-уровневую архитектуру (bbox → text-LLM → multimodal-fallback). Обновить cost/latency numbers.
- **ADR 0025:** `ismeta/docs/adr/0025-multimodal-fallback-gpt4o.md` — почему переходим на full + multimodal.
- **`ismeta/docs/DEV-BACKLOG.md`** — закрыть #18 (recall 99%), #22 (time 34→30s — now обсервным), #21 (cost — acceptance прекращается: cost не блокер по решению PO).

---

## Приёмочные критерии

### Функциональные (3 goldens)

1. ✅ **spec-ov2** (9 стр, 152 items): recall ≥ 145 (~ 95%), sections ≥ 7 (включая МОП split), не регрессировать от it1 147-149 baseline.
2. ✅ **spec-aov** (2 стр, 29 items): 29/29, 5/5 sections, `manufacturer` непуст для «Комплектов автоматизации» (ООО «КОРФ»).
3. ✅ **spec-tabs** (9 стр, ~150 items): 
   - items ≥ 120 (≥80% от ожидаемых).
   - sections ≥ 4 (из 5: Вентиляция, Кондиционирование, Отопление и теплоснабжение, БТП, Шкаф узла учета).
   - `model_name` непуст у ≥ 80% items (R23 работает).
   - 0 штампов («Дата и подпись», «Инв.№ подп.», «Код уч № док») в name/pos/model.
   - 0 лишних пробелов в числах — assert на regex `r"=\d\s+\d"` в items[].name — **нет совпадений**.
   - multi-line установки («П1/В 1 Приточно-вытяжная…») в **одном** item, name содержит «комплектно со см. узлом» и «комплектом автоматики».

### Multimodal fallback

4. ✅ Confidence score < 0.7 на любой странице → Phase 2 multimodal call.
5. ✅ Phase 2 НЕ вызывается для страниц с confidence ≥ 0.7 (проверить метриками).
6. ✅ `spec-tabs` страницы с сломанным column detection → multimodal активирован → recall восстановлен.

### Нефункциональные

7. ✅ pytest recognition: все зелёные.
8. ✅ `pytest -m golden_llm`: **3 теста** passed.
9. ✅ ruff + mypy clean.
10. ✅ ismeta/backend pytest: не сломано (apply_parsed_items с `manufacturer` — +1 тест).
11. ✅ Время на spec-tabs (9 стр с multimodal retry ≤3 страниц): ≤ 120 с (раньше 30с приемлемо было; теперь допускается до 2 минут).

### Документация

12. ✅ ADR 0025 описывает: почему гибрид, когда multimodal, compute_confidence формула, cost/speed trade-offs.
13. ✅ README секция «Pipeline».

---

## Ограничения

- **НЕ ломать** spec-ov2 baseline (recall ≥ 145). Dual-regression обязательна.
- **НЕ трогать** Invoice/Quote парсеры — отдельный эпик E16.
- **НЕ менять** модель `EstimateItem` / миграции.
- **НЕ делать**:
  - UI изменения (UI-06 Merge Rows и UI-07 Search — отдельные ТЗ Феде).
  - Async workflow «колокольчик» — UI-08, отдельно.
- Новые env vars (`RECOGNITION_LLM_EXTRACT_MODEL`, `RECOGNITION_LLM_MULTIMODAL_RETRY_ENABLED`, `RECOGNITION_LLM_MULTIMODAL_RETRY_THRESHOLD`) — добавить в `docker-compose.yml` (**shared файл — пинг AC Rating перед коммитом**).

---

## Формат отчёта

1. Ветка и hash.
2. Архитектура: коротко (bbox + text-LLM gpt-4o + conditional multimodal).
3. Метрики на 3 goldens (items, sections, time, tokens, cost). **Обязательно**: сколько страниц потребовали multimodal retry на каждом golden.
4. Confidence scores для каждой страницы каждого golden (таблица).
5. Все 13 приёмочных критериев ✅/❌ с пояснениями.
6. ADR 0025 ссылка.
7. Известные ограничения → E15.06 (если понадобится).
