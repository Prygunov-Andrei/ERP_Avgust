# ТЗ: E15-06 it2 — Vision safety-net + bbox-row comparison + gpt-5.2 A/B (IS-Петя)

**Команда:** IS-Петя.
**Ветка:** `recognition/12-e15-06-it2-vision`.
**Worktree:** `ERP_Avgust_is_petya_e15_06_it2`.
**Приоритет:** 🔴 заход 1/10 QA-цикла не закрыт после it1 (хвостовые потери + Решётка-sticky).
**Срок:** 1–1.5 дня.

---

## Контекст

Заход 1/10 повторён PO после merge E15-06 it1 — **те же потери вернулись**:

- Replay #52: 4 Воздуховода в хвосте стр.2 → пропали.
- Replay #55: «Решётка» (122) поглотила строки 123-130 (Воздуховоды).
- Replay #55: строка 135-140 — Воздуховоды снова как «Решётка», последний ещё и потерян.
- Replay #9: Противопожарная изоляция + Огнезащитная смесь — пропали.
- Частичный replay #51: строки 94-105 «прямоугольный, морозостойкий» continuation отброшена вовсе.

**Подтверждено:** LLM variance — мой tech-lead'а live curl на том же PDF дал **136 items** (с Противопожарными на месте), PO upload — **141 items** (без них). `temperature=0` уже везде, variance у OpenAI (batch scheduling gpt-4o).

**Архитектурный root cause it1:**
- `expected_count` LLM возвращает **по тем же bbox rows** что нормализует → `expected == parsed` всегда → safety-net не триггерит.
- `cap_sticky_name` проверяет только remainder text — не видит что original bbox row содержал ДРУГОЕ слово («Воздуховод»), а LLM написала «Решётка».
- `apply_no_qty_merge` требует qty==0 & unit=='' ИЛИ match qty с предком. На стр.7 LLM просто **выбрасывает** continuation rows → пост-процесс не видит что бросать.

PO про **gpt-5.2** (вышла в январе 2026, уже доступна в OpenAI API): «возможно решит много проблем». Попробуем как A/B experiment — не отдельная задача, а часть it2.

---

## Задача 1 — Vision expected_count (smart safety-net)

**Закрывает:** #52 (хвостовые потери), #9 (Противопожарные изоляции).

Идея PO дословно:
> «отправлять в LLM страницу PDF с вопросом — сколько позиций на странице (подсказка — у настоящей позиции всегда есть количество!) и сравнивать».

**Реализация:** отдельный cheap vision-call **с картинкой страницы**, независимый от bbox-rows.

### 1.1 — Новый модуль `vision_counter.py`

**Файл:** `recognition/app/services/vision_counter.py` (новый).

```python
"""Cheap vision counter: LLM смотрит на картинку страницы и возвращает
ТОЛЬКО количество реальных позиций с qty. Используется как safety-net
для детекции потерь bbox-extractor'ом."""

from __future__ import annotations

import logging
import re

from ..providers.base import BaseLLMProvider

logger = logging.getLogger(__name__)

COUNT_PROMPT = """Ты смотришь на страницу Спецификации ОВиК/ЭОМ (форма 1а
ГОСТ 21.110).

Посчитай СТРОГО количество РЕАЛЬНЫХ позиций оборудования / материала на
этой странице.

РЕАЛЬНАЯ позиция — та, у которой в таблице есть значение в столбце
«Количество» (число > 0 или дробное число).

НЕ считай:
- заголовки разделов и подразделов,
- строки-продолжения имени (перенос, содержащий только продолжение
  наименования без количества),
- пустые строки,
- строки штампа ЕСКД внизу страницы,
- многоуровневые заголовки таблицы.

Верни ответ СТРОГО в формате JSON, один объект:
{"count": N}

где N — целое число ≥ 0.
"""


async def count_items_on_page(
    page_image_b64: str,
    provider: BaseLLMProvider,
    model: str,
) -> int:
    """Возвращает самооценку количества реальных позиций по картинке.

    При ошибке/невалидном ответе — возвращает 0 (fallback не
    триггерит safety-net, парсер работает как раньше).
    """
    try:
        resp = await provider.multimodal_complete(
            system=COUNT_PROMPT,
            user_text="Посчитай позиции.",
            image_b64=page_image_b64,
            model=model,
            temperature=0.0,
            max_tokens=20,
        )
    except Exception as e:
        logger.warning("vision_counter failed: %s", e)
        return 0

    raw = (resp.content or "").strip()
    match = re.search(r'"count"\s*:\s*(\d+)', raw)
    if not match:
        match = re.search(r"\b(\d+)\b", raw)
    if not match:
        logger.warning("vision_counter returned no number: %r", raw[:100])
        return 0
    try:
        return int(match.group(1))
    except (ValueError, TypeError):
        return 0
```

### 1.2 — Интеграция в `spec_parser.py`

Запускать параллельно с Phase 2a text-normalize (не блокируя):

```python
# Phase 2a: text-normalize + vision-count параллельно на каждой странице.
text_jobs = []
vision_count_jobs = []
for page_num, rows in pages_rows.items():
    text_jobs.append(self._normalize_text(page_num, rows, ...))
    image_b64 = render_page_to_b64(doc, page_num)
    vision_count_jobs.append(
        count_items_on_page(
            image_b64, self._provider, settings.llm_multimodal_model
        )
    )

text_results = await asyncio.gather(*text_jobs)
vision_counts = await asyncio.gather(*vision_count_jobs)
```

Сохранять `vision_count` в `NormalizedPage.expected_count_vision`.

### 1.3 — Retry trigger

В Phase 2b:
```python
expected_vision = norm.expected_count_vision or 0
parsed = len(norm.items)
if expected_vision > 0 and (expected_vision - parsed) >= tolerance:
    # Реальная хвостовая потеря — triggered retry.
    retry_jobs.append(...)
```

**Tolerance:** вынести в `config.py` как `llm_vision_count_tolerance: int = 2`.

### 1.4 — Schema + pages_summary

```python
class PageSummary(BaseModel):
    page: int
    expected_count: int = 0         # LLM self-check по bbox rows (it1, оставляем для совместимости)
    expected_count_vision: int = 0  # NEW: LLM vision по картинке (it2)
    parsed_count: int = 0
    retried: bool = False
    suspicious: bool = False        # Теперь: True если vision_expected - parsed ≥ tolerance И retry не закрыл
```

---

## Задача 2 — Sticky cap через bbox-row comparison

**Закрывает:** #55 (Решётка → Воздуховоды).

**Root cause it1:** LLM эмитирует `item.name = "Решётка"` для row где `cells.name` содержал «Воздуховод». `cap_sticky_name` смотрит только на item.name, не на source row → не видит подмены.

**Fix:** после LLM normalize **сверить каждый item.name с cells.name оригинальной bbox-row**.

### 2.1 — Новая функция в `spec_postprocess.py`

```python
def restore_from_bbox_rows(
    items: list[NormalizedItem],
    rows: list[Row],
) -> list[NormalizedItem]:
    """QA #55: восстановить item.name из cells.name если LLM подменила.

    LLM иногда применяет sticky-parent-name к row где cells.name уже
    содержит другое слово. Проверяем: если items[i].name отличается
    от rows[i].cells['name'] и cells['name'] не пусто и содержит
    word длиной ≥ 4 символа, начинающееся с буквы — предпочитаем
    cells['name'] как источник истины.

    Sticky-paste восстанавливается в name только для rows где cells
    содержат variant-marker (ПН2, ПД1, В3) — там sticky легитимен.
    """
```

**Mapping rows ↔ items:** через `source_row_index` (добавить в NormalizedItem если ещё нет) или через `sort_order` + page_number.

### 2.2 — Тесты

- `test_restore_from_bbox_prefers_cells_name` — row.cells.name="Воздуховод 250х100", item.name="Решётка" → item.name стал "Воздуховод 250х100".
- `test_restore_skips_variant_marker` — row.cells.name="ПН2-4,5", item.name="Решётка ПН2-4,5" → НЕ трогаем (legit sticky для variant).
- `test_restore_no_op_when_cells_empty` — row.cells.name="" → item.name сохраняется.
- Regression: «Клапан КПУ2» + series — не ломается.

---

## Задача 3 — Continuation strict через bbox-row coverage

**Закрывает:** #51 частичный (strings 94-105 «прямоугольный, морозостойкий»).

**Root cause it1:** `apply_no_qty_merge` работает на items, но LLM **выбросила** continuation rows вообще — они не дошли до post-process.

**Fix:** **coverage check** — для каждой bbox-row убедиться что есть соответствующий item. Если row содержит content но не попала в items — решить что с ней.

### 3.1 — Coverage check

```python
def cover_bbox_rows(
    items: list[NormalizedItem],
    rows: list[Row],
) -> list[NormalizedItem]:
    """QA #51: склеить bbox-rows которые LLM потеряла как continuation.

    Для каждой rows[i] где cells['name'] is non-empty AND нет qty AND
    нет соответствующего item (по sort_order / y-координате) — это
    потерянная continuation-row. Приклеиваем cells['name'] к
    предыдущему items[].name.
    """
```

Требует `NormalizedItem.source_row_index: int | None` (добавить в schema если нет).

### 3.2 — Альтернатива (проще) — strict промпт

Если полный coverage сложно — усилить правило 12 в промпте:

```
КРИТИЧЕСКОЕ ПРАВИЛО 12 (расширенное):
ВСЕ rows имеющие cells['name'] != "" ОБЯЗАНЫ попасть в output. Если ты
не знаешь что с ними делать — ОБЯЗАТЕЛЬНО приклей к предыдущему item.name
через пробел. НЕ выбрасывай rows, это потеря информации.
```

Выбор: **Задача 3.1 если возможно, иначе 3.2**. Петя решает по ходу.

### 3.3 — Тесты

- `test_cover_bbox_orphans_merged` — row «прямоугольный, морозостойкий» без match → слит с предыдущим «Клапан КПУ2».
- `test_cover_bbox_empty_rows_ignored` — пустые rows пропускаются.
- `test_cover_bbox_preserves_explicit_items` — rows с qty и model не затрагиваются.

---

## Задача 4 — gpt-5.2 A/B

**PO:** «возможно замена на gpt-5.2 решит много проблем».

### 4.1 — Поддержка переменной модели

`config.py` уже имеет `llm_extract_model` и `llm_multimodal_model`. Убедиться что они используются **везде** (не hardcode):
- `spec_normalizer.py` — в `chat_complete(model=settings.llm_extract_model)`
- `vision_counter.py` — `settings.llm_multimodal_model`
- `invoice_*` — не трогать (отдельная задача).

Добавить env var:
```python
llm_extract_model: str = Field(default="gpt-4o", env="LLM_EXTRACT_MODEL")
llm_multimodal_model: str = Field(default="gpt-4o", env="LLM_MULTIMODAL_MODEL")
```

### 4.2 — A/B прогон

**Вручную** (не в CI, это эксперимент):
1. Запустить spec-ov2, spec-aov, spec-tabs на `LLM_EXTRACT_MODEL=gpt-4o` → записать метрики.
2. Запустить на `LLM_EXTRACT_MODEL=gpt-5.2` → записать метрики.
3. Сравнить: items, sections, comments%, suspicious_pages, time, cost (`cached_tokens`, `total_tokens`).

### 4.3 — Отчёт

В отчёте это обязательный раздел:

```markdown
## A/B gpt-4o vs gpt-5.2

| Golden | Model | items | sections | comments% | suspicious | time | cost |
|---|---|---|---|---|---|---|---|
| spec-ov2 | gpt-4o | … | … | … | … | … | … |
| spec-ov2 | gpt-5.2 | … | … | … | … | … | … |
| spec-aov | gpt-4o | … | … | … | … | … | … |
| spec-aov | gpt-5.2 | … | … | … | … | … | … |
| spec-tabs | gpt-4o | … | … | … | … | … | … |
| spec-tabs | gpt-5.2 | … | … | … | … | … | … |

**Вывод:** (честный, какая модель стабильнее для Spec-extraction)

**Default в config:** gpt-4o / gpt-5.2 / зависит от task
```

**Если gpt-5.2 стабильно лучше** → менять default.
**Если хуже или сравнимо** → оставить gpt-4o, отметить в DEV-BACKLOG.

### 4.4 — Проверка API

- gpt-5.2 доступна на OpenAI API на 2026-04-23? Проверить через `/v1/models` endpoint.
- Поддерживает ли prompt caching (TD-01 split system/user)?
- Структурированный JSON output как у gpt-4o?
- Image input (vision) поддержка?

Если какого-то features нет — отметить в отчёте, решать через PO.

---

## Приёмочные критерии

1. ✅ Live spec-ov2 через UI после rebuild — `items ≥ 148` стабильно (3 прогона подряд).
2. ✅ `pages_summary[].suspicious == true` для страниц с реальной потерей хвоста (например стр.2 spec-ov2 если реально теряется).
3. ✅ Решётка 122-140 НЕ поглощает Воздуховоды. item.name каждый раз матчит bbox-row cells.name.
4. ✅ Continuation «прямоугольный, морозостойкий» (строки 94-105) — слит с предыдущим «Клапан КПУ2» или подобным.
5. ✅ Противопожарная изоляция + Огнезащитная смесь — **стабильно** в items (не в одном из 3 прогонов).
6. ✅ Regression: spec-aov 29 items, spec-tabs ≥ 180 items, без регрессий.
7. ✅ A/B отчёт gpt-4o vs gpt-5.2 — полностью заполнен, вывод сделан.
8. ✅ `pytest recognition/tests/` — все зелёные + новые unit-тесты.
9. ✅ `mypy app/ --disallow-untyped-defs` — 0 errors.
10. ✅ `ruff check app/ tests/` — 0 errors.

---

## Ограничения

- **НЕ трогать** invoice_parser / quote_* / invoice_title_block / invoice_normalizer.
- **НЕ менять** архитектуру гибрида (bbox → text-LLM → multimodal retry).
- **НЕ удалять** it1 post-process (apply_no_qty_merge, cap_sticky_name) — дополняем, не заменяем.
- **НЕ менять** prompt caching split (TD-01 system/user).
- Vision-counter — это **cheap** call, не путать с full multimodal retry (тот тяжелее и триггерится только при suspicious pages).
- A/B модели — через env var, не два разных codepath'а.
- Если gpt-5.2 не доступна / не поддерживает features — **не падать**, отметить и использовать gpt-4o default.

---

## Формат отчёта

1. Ветка + hash.
2. Метрики spec-ov2 до / после it2 (items, comments%, suspicious_pages, time):
   - gpt-4o × 3 прогона (стабильность)
   - gpt-5.2 × 3 прогона
3. **Конкретные проблемные позиции — stabilized check:**
   - Строки 1-6 (Дефлектор Цаги + узел прохода) — 4 items с правильными name?
   - Строки 94-105 (Клапан + continuation «прямоугольный, морозостойкий») — склеен?
   - Строки 122-140 (Решётка + Воздуховоды) — Воздуховоды не потеряны, не как Решётка?
   - Строки 131-134 (Противопожарная изоляция, Огнезащитная смесь) — на месте?
4. A/B gpt-4o vs gpt-5.2 таблица + вывод.
5. Regression spec-aov и spec-tabs — метрики.
6. `pytest` + `mypy` + `ruff` статусы.
7. Ограничения (если что-то отложено — явно).

---

## Start-prompt для новой Claude-сессии (копируй Пете)

```
Ты IS-Петя, backend AI-программист проекта ISMeta. Тех-лид уже подготовил
ТЗ — читай его и работай в своём worktree.

Рабочая директория:
  /Users/andrei_prygunov/obsidian/avgust/ERP_Avgust_is_petya_e15_06_it2

Ветка: recognition/12-e15-06-it2-vision (создана от origin/main с hotfix
data-loss в whitelist).

ТЗ полностью лежит в:
  ismeta/docs/agent-tasks/E15-06-it2-vision-safety-net-petya.md

Суть: заход 1/10 повторён после it1 — те же потери вернулись. it1
закрыл #54 (comments) и частично #51 (continuation), но:
- expected_count работает на bbox rows (видит только то что парсит),
  поэтому safety-net не триггерит хвостовые потери
- cap_sticky_name не сверяет с cells.name → Решётка поглощает Воздуховоды
- LLM выбрасывает часть continuation rows вообще

it2 — смена стратегии safety-net на **vision-based** + bbox-row comparison
для sticky + coverage check для continuation + A/B gpt-4o vs gpt-5.2.

Работай строго по ТЗ. После реализации — коммит в recognition/12-e15-06-
it2-vision, отчёт по формату из ТЗ, Андрей принесёт отчёт тех-лиду.

Live-QA в контейнере:
  docker compose -f ismeta/docker-compose.yml build recognition
  docker compose -f ismeta/docker-compose.yml up -d --force-recreate recognition

OPENAI_API_KEY — в корневом .env.

Для A/B модели — через env var `LLM_EXTRACT_MODEL=gpt-5.2` при запуске
контейнера или через прямой exec в контейнер.
```
