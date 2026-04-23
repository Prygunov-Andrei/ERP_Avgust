# ТЗ: E15-06 — Spec Parser Robustness (no-qty / sticky cap / safety-net / comments) (IS-Петя)

**Команда:** IS-Петя.
**Ветка:** `recognition/11-e15-06-spec-robustness`.
**Worktree:** `ERP_Avgust_is_petya_e15_06`.
**Приоритет:** 🔴 высокий (заход 1/10 выявил системные проблемы парсинга).
**Срок:** 1.5–2 дня.

---

## Контекст

QA-цикл 10-заходов, заход 1/10 на golden `spec-ov2-152items.pdf` (2026-04-23).

**PO ожидал:** 153 позиции. **Факт:** 141 распознано, **-12 потерь**, плюс системные ошибки склейки и фантомов.

**Детальный отчёт PO** — см. `ismeta/docs/QA-CYCLE-10-ROUNDS.md` заход 1/10, findings #51/#52/#53/#54/#55.

**Ключевое наблюдение PO** (дословно):
> «Ключ к решению как будто лежит все-таки в плоскости понимания того, что у "реальных" товаров Спецификации всегда есть количество. А у "остатков" строки — количества никогда нет.»

Это корневая подсказка для #51 и #53.

**Что задача НЕ трогает:**
- `invoice_parser.py` / `quote_parser.py` — отдельные парсеры, правила там другие.
- `8 разделов vs 3`: PO подтвердил «оставляем как есть, пользователь сам объединяет через UI-09 merge-sections».
- #56 R35 «Защитныйкозырек» (kerning), #57 R36 pos-name разделитель — обе в DEV-BACKLOG (мелкие, не блокеры).

---

## Задача 1 — Multi-line continuation (no-qty rule) → решает #51 + #53

**Проблема:** на одной PDF парсер выдаёт 4 разных поведения для строк «продолжения имени»:
- Строки 1-2, 3-4: склеивает с захватом имени соседа («Дефлектор Цаги» + «на узле прохода УП1» → второй item получил оба имени).
- Строки 58-77: то же для «Клапан…» + «с решёткой».
- Строки 78-85: «с решёткой» остаётся отдельным item (плохо, но лучше чем склейка).
- Строки 86-105: вторая строка полностью отбрасывается.
- Строка 106: подраздел «Фасонные изделия к вентиляторам ПДВ» распознался как товар `qty=1`.

**Решение двухуровневое:**

### 1.1 — Новые правила в промпте

**Файл:** `recognition/app/services/spec_normalizer.py`.

В `NORMALIZE_PROMPT_TEMPLATE` добавить:

```
КРИТИЧЕСКОЕ ПРАВИЛО 12 — продолжение имени по отсутствию qty:

Если у строки отсутствует количество (quantity = 0 или пусто) И
отсутствует единица измерения (unit пусто) И name начинается со
строчной буквы ИЛИ с союза/предлога («с», «на», «в», «под», «для»,
«из», «над», «при», «через») ИЛИ с прилагательного без артикула
(«круглый», «морозостойкий», «оцинкованный», «защитный») — это
ПРОДОЛЖЕНИЕ имени предыдущей позиции. Присоедини name этой строки
к name предыдущего item через пробел. НЕ создавай отдельный item.

КРИТИЧЕСКОЕ ПРАВИЛО 13 — подраздел без qty:

Если строка выглядит как заголовок подраздела (текст без qty, без
unit, без model; часто в центре или жирным; фразы типа «Фасонные
изделия к X», «Комплектующие к Y», «Монтаж Z») — используй её как
section_name для следующих позиций, но НЕ создавай отдельный item
с qty=1. Реальная позиция всегда имеет количество.
```

### 1.2 — Python safety-net после LLM

**Файл:** `recognition/app/services/spec_parser.py` (или новый модуль `spec_postprocess.py`).

После LLM normalize — пройти по items и выполнить merge для пропущенных LLM'ом continuation'ов:

```python
_CONTINUATION_PREFIXES = (
    "с ", "на ", "в ", "под ", "для ", "из ", "над ", "при ", "через ",
)
_CONTINUATION_ADJECTIVES_RE = re.compile(
    r"^(круглый|круглое|круглая|круглые|круглых|"
    r"морозостойкий|морозостойкие|морозостойких|"
    r"оцинкованный|оцинкованные|оцинкованных|"
    r"защитный|защитное|защитная|защитные|защитных|"
    r"прямоугольный|прямоугольные|квадратный|квадратные)\b",
    re.IGNORECASE,
)


def _looks_like_continuation(name: str) -> bool:
    s = name.strip()
    if not s:
        return False
    if s[0].islower():
        return True
    lower = s.lower()
    if any(lower.startswith(p) for p in _CONTINUATION_PREFIXES):
        return True
    if _CONTINUATION_ADJECTIVES_RE.match(s):
        return True
    return False


def apply_no_qty_merge(items: list[SpecItem]) -> list[SpecItem]:
    """QA #51/#53: merge no-qty continuation strings into previous item.

    Rule: if item.quantity == 0 AND item.unit == "" AND name looks like
    a continuation (lowercase / preposition / continuation-adjective),
    drop it as independent item and append name to the previous item.
    """
    if not items:
        return items
    out: list[SpecItem] = [items[0]]
    for item in items[1:]:
        qty = item.quantity or 0
        unit = (item.unit or "").strip()
        if qty == 0 and unit == "" and _looks_like_continuation(item.name):
            prev = out[-1]
            prev.name = f"{prev.name.rstrip()} {item.name.strip()}".strip()
            continue
        out.append(item)
    return out
```

Вызвать `apply_no_qty_merge(items)` в `SpecParser._process_batch_column_aware` **после** LLM normalize, **до** финальной сборки response.

### 1.3 — Тесты

**Unit (`recognition/tests/test_spec_postprocess.py`):**
- `test_merge_continuation_lowercase` — `[{"Дефлектор Цаги", qty=1, unit="шт"}, {"на узле прохода УП1", qty=0, unit=""}]` → 1 item name="Дефлектор Цаги на узле прохода УП1".
- `test_merge_preposition_с` — `[{"Клапан КПУ2", qty=5, unit="шт"}, {"с решёткой", qty=0, unit=""}]` → 1 item «Клапан КПУ2 с решёткой».
- `test_merge_adjective` — `[{"Воздуховод ВД1", qty=3, unit="м"}, {"круглый морозостойкий", qty=0, unit=""}]` → 1 item.
- `test_no_merge_when_qty_positive` — продолжение имеет qty=1 → отдельный item (не мерджим).
- `test_no_merge_when_capital_start` — «Воздуховод 250х100» начинается с заглавной и не попадает в adjective-regex → отдельный item.
- `test_no_merge_first_item_orphan` — первый item сам по себе continuation-looking → оставить как есть (нет предыдущего для merge).

**Регрессия (`tests/golden/test_spec_ov2.py`):**
- `LLM_MIN_ITEMS = 148` (было 140, ожидаем рост после fix #51/#53). Target: 150+ на стабильных прогонах.

---

## Задача 2 — Sticky-name cap → решает #55

**Проблема:** для spec-ov2 позиции 123 «ПН2-4,5-Решётка» парсер запомнил sticky name «Решётка» и применил его к позициям 124-131 — где на самом деле уже пошли Воздуховоды. Аналогично строки 136-140.

**Root cause:** sticky-name применяется **без проверки семантики** — если следующая строка не содержит variant-marker (ПН, ПД, В, П с цифрой), это **не** продолжение серии, а новая позиция.

**Решение:**

### 2.1 — Новое правило в промпте

```
КРИТИЧЕСКОЕ ПРАВИЛО 14 — sticky name только для явных серий:

Sticky parent name (использование name предыдущей строки как name
текущей при отсутствии name в строке) применяется ТОЛЬКО если текущая
строка содержит variant-marker — паттерн из заглавных букв + цифра
(ПН2, ПД1, В1-3, ПК 4,5, КВО-6, АПК-10). Если pos/name текущей строки
явно отличается (например "Воздуховод 250х100" после "ПН2-4,5-
Решётка") — sticky НЕ применяется, это новая позиция.
```

### 2.2 — Post-process cap (опциональная safety-net)

В коде post-process проверить: если predecessor имел одиночное применение sticky (т.е. sticky применился для 1 строки и подряд нет других variant-markers), — cap-лимит 1. Для series с 5+ variant подряд — sticky безлимитен.

Точную реализацию оставить на усмотрение Пети — есть 2 подхода:
1. **По pattern variant-marker**: если текущая строка не matches regex `^[А-Я]{1,4}[- ]?\d` — не применяй sticky.
2. **По счётчику**: sticky применяется максимум N раз подряд, если нет явной series-pattern у predecessor.

**Вариант 1** предпочтителен — чище и соответствует промпту.

### 2.3 — Тесты

**Unit:** на искусственных данных (3 варианта ПН, затем Воздуховод 250х100) → Воздуховод не получает sticky «Решётка».

**Регрессия (spec-aov):** позиции с реальными сериями ПН1/ПН2/ПН3 — sticky применяется корректно, не ломается.

---

## Задача 3 — Page-tail safety-net (LLM count cross-check) → решает #52

**Проблема PO:** «После строки 28 на странице 2 было 4 позиции Воздуховод — все потеряны. Пункт 29 — уже с третьей страницы. Криминал.»

Суммарно потеряно ~13 позиций на хвостах страниц.

**Гипотеза:** bbox-extractor режет низ страницы (зона штампа ЕСКД) ИЛИ LLM теряет хвост при формировании JSON (token budget / truncation).

**Решение PO:** «отправлять в LLM страницу с вопросом — сколько позиций (с количеством)? и сравнивать с распознанным».

### 3.1 — Просим LLM считать самостоятельно

В `NORMALIZE_PROMPT_TEMPLATE` **добавить требование к output**:

```
Дополнительно верни поле:

"expected_count": <int>  # твоя оценка сколько на этой странице
                         # реальных позиций с количеством (не
                         # считая заголовков, подразделов, пустых
                         # строк и строк-продолжений имени)
```

Этот счётчик вычисляется **внутри того же LLM call'а** — не требует доп. запроса.

### 3.2 — Cross-check в Python

**Файл:** `recognition/app/services/spec_parser.py`.

После каждой страницы:
```python
parsed_count = len(items_on_this_page)
expected = llm_response.get("expected_count", 0)
delta = expected - parsed_count
if delta >= 3:  # tolerance
    # Не хватает позиций — retry через multimodal.
    retry_items = await self._multimodal_retry_page(page_index, ...)
    if retry_items:
        items = self._select_better(items, retry_items)
        retried = True
```

### 3.3 — Расширить schema response

**Файл:** `recognition/app/schemas/spec.py`.

```python
class PageSummary(BaseModel):
    page: int
    expected_count: int = 0
    parsed_count: int = 0
    retried: bool = False
    suspicious: bool = False  # True если delta ≥ 3 и retry не помог


class SpecParseResponse(BaseModel):
    status: str = "done"
    items: list[SpecItem] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)
    pages_stats: PagesStats = Field(default_factory=PagesStats)
    pages_summary: list[PageSummary] = Field(default_factory=list)  # NEW
```

### 3.4 — Frontend (опционально в этой задаче)

Если `pages_summary.some(p => p.suspicious)` — в `pdf-import-dialog.tsx` результате показать warning. **Не в этой задаче** — пусть Федя сделает отдельным UI-10 после merge E15-06 (добавь item в `README.md` agent-tasks как follow-up).

### 3.5 — Тесты

- Unit: parsing `expected_count` из LLM response (happy + missing + malformed).
- Integration: mock LLM с `expected_count=5`, `items=[3 items]` → retry triggered.
- `test_spec_ov2.py`: после fix spec-ov2 должен давать ≥ 150 items (на spec-ov2 хвостовые потери закрываются).

---

## Задача 4 — Comments column → решает #54

**Проблема:** PO на spec-ov2 строки 5-12, 29-32 видел «+10%» в Спецификации, в созданной смете — пусто в `tech_specs.comments`.

**Root cause (гипотеза):** 
(а) bbox-extractor может не охватывать правый край страницы (`pdf_text.py::extract_structured_rows` padding),
(б) промпт LLM не упоминает «Примечание» явно → LLM её игнорирует,
(в) mapping в `apply_parsed_items` (в ismeta-backend) падает.

### 4.1 — Диагностика

Сначала **проверить**:
1. Запусти `/v1/probe` на spec-ov2 — покажи bbox-boundaries страницы 1. Правый край ≥ (page_width - 30pt)?
2. Прогони `/v1/parse/spec` с `?debug=true` (если есть) — посмотри какие rows LLM видит для позиций 5-12.

Если bbox обрезает правый столбец — исправить в `pdf_text.py` (параметр `right_margin`).

### 4.2 — Fix в промпте

В `NORMALIZE_PROMPT_TEMPLATE` явно:

```
КРИТИЧЕСКОЕ ПРАВИЛО 15 — колонка «Примечание»:

Крайний правый столбец Спецификации содержит «Примечание». Его
содержимое помещай в поле comments. Распространённые значения:
«+10%», «+5%», «резерв», «запас», «на монтаж», «уточнить у
поставщика». Если в ячейке стоит процент или короткая пометка —
обязательно перенеси в comments, не игнорируй.
```

### 4.3 — Bbox-extractor проверка

**Файл:** `recognition/app/services/pdf_text.py::extract_structured_rows`.

Убедиться что x-range для «последнего столбца» включает правый край:
```python
# Если max_x последнего column <= page_width - margin — добавить padding.
page_right = page.rect.width
last_col_x_max = cols[-1].x_max
if last_col_x_max < page_right - 5:
    cols[-1].x_max = page_right - 5
```

### 4.4 — Тесты

- Golden regression: spec-ov2 items 5-12 должны иметь `tech_specs.comments == "+10%"`.
- Unit: на synthetic page с правой колонкой у самого края → читается.

---

## Задача 5 — 8 разделов vs 3 (оставляем как есть)

**PO подтвердил:** «По разделам оставляем как есть, пользователь сам решит».

**Действие:** ничего не меняем. В промпте / sections-detection — **НЕ** уменьшай гранулярность. Если LLM видит «Клапаны на 1 этаже», «Клапаны на типовых», «Клапаны на кровле» как три подраздела — так и оставляй, user объединит через UI-09 merge-sections.

---

## Приёмочные критерии

1. ✅ `pytest recognition/tests/` — все зелёные (+ новые unit-тесты).
2. ✅ `pytest -m golden_llm` — 7 passed. spec-ov2 `LLM_MIN_ITEMS = 148` (или выше после стабилизации).
3. ✅ Live curl `/v1/parse/spec` на spec-ov2:
   - items ≥ 150 (было 141).
   - Позиции 1-2 «Дефлектор Цаги»: одна объединённая вместо двух.
   - Позиции 123-131: «Решётка» НЕ поглощает Воздуховоды.
   - Позиции 5-12: `tech_specs.comments == "+10%"`.
   - Строка 106 «Фасонные изделия к вентиляторам ПДВ» НЕ создаёт отдельный item (либо используется как section_name, либо дропается).
4. ✅ `mypy app/` — 0 errors.
5. ✅ `ruff check app/` — 0 errors.
6. ✅ Regression на `spec-aov` и `spec-tabs` — без снижения recall (spec-aov = 29, spec-tabs ≥ 180).
7. ✅ `pages_summary` в response заполнен для spec-ov2 — `expected_count` / `parsed_count` / `retried` видны для каждой страницы.

---

## Ограничения

- **НЕ трогать** `invoice_parser.py`, `invoice_normalizer.py`, `invoice_title_block.py`.
- **НЕ трогать** `quote_*` (E17 draft).
- **НЕ менять** архитектуру гибрида (Phase 1 bbox + Phase 2a LLM text + Phase 2b multimodal retry остаётся).
- **НЕ трогать** sections-detection / number of sections detected.
- **НЕ трогать** prompt caching split (TD-01 split system/user сохраняется).
- **НЕ менять** OpenAI model (gpt-4o full остаётся).
- Не добавляй новые LLM calls если можно extend существующий (task 3: `expected_count` возвращается из того же normalize-call, не отдельным запросом).
- **НЕ менять** `_normalize_section_name` (TD-01 уже расширил точками/запятыми).

---

## Формат отчёта

1. Ветка и hash.
2. Метрики spec-ov2 до/после:
   - items count
   - sections count
   - % items с непустым comments (должно вырасти)
   - pages_summary — есть ли suspicious pages
3. Результаты для конкретных проблемных позиций:
   - «Дефлектор Цаги» (1-2)
   - «Клапан + с решёткой» (58-77)
   - Хвост 2-й страницы (позиции 25-28 и что идёт после)
   - «Решётка» series (123-131)
   - Примечания «+10%» (5-12)
4. `pytest` + `mypy` + `ruff` статусы.
5. Регрессия на spec-aov и spec-tabs — метрики.
6. Ограничения (если что-то отложено — явно отметить).

---

## Start-prompt для новой Claude-сессии (копируй Пете)

```
Ты IS-Петя, backend AI-программист проекта ISMeta. Тех-лид уже
подготовил ТЗ — читай его и работай в своём worktree.

Рабочая директория:
  /Users/andrei_prygunov/obsidian/avgust/ERP_Avgust_is_petya_e15_06

Ветка: recognition/11-e15-06-spec-robustness (уже создана от origin/main).

ТЗ полностью лежит в:
  ismeta/docs/agent-tasks/E15-06-spec-robustness-petya.md

Суть: заход 1/10 QA-цикла выявил системные проблемы парсера Спецификаций:
- продолжения имени (no-qty) обрабатываются непоследовательно,
- sticky-name «Решётка» поглощает чужие позиции,
- хвосты страниц теряют ~13 позиций,
- столбец «Примечание» игнорируется.

Работай строго по ТЗ, не расширяй scope. Любые вопросы — пиши в
отчёт, не принимай самостоятельных архитектурных решений сверх
ТЗ. После реализации — коммить в recognition/11-e15-06-spec-
robustness, пиши отчёт по формату из ТЗ, и Андрей принесёт
отчёт тех-лиду на ревью.

Live-QA в боевом контейнере:
  docker compose -f ismeta/docker-compose.yml build recognition
  docker compose -f ismeta/docker-compose.yml up -d --force-recreate recognition

OPENAI_API_KEY — в корневом .env, не клади в код.
```
