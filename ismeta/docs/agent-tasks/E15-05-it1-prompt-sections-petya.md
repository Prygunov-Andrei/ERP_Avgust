# ТЗ: E15.05 итерация 1 — prompt + sections + stamp + numeric prefix (IS-Петя)

**Команда:** IS-Петя.
**Ветка:** `recognition/07-e15.05-it1-prompt-sections`.
**Worktree:** `ERP_Avgust_is_petya_e15_05_it1`.
**Приоритет:** 🔴 blocker (15 из 29 items в spec-aov.pdf имеют неверные поля).
**Срок:** 1 день.

---

## Контекст

QA-сессия 3 (2026-04-22, см. `ismeta/docs/QA-FINDINGS-2026-04-22.md` #26–#34) на новом golden `spec-aov.pdf` (2 стр, 29 позиций, Автоматика+Кабели+Лотки) выявила, что E15.04 Вариант B на **другой структуре PDF** ломается по 4 корневым причинам. Главное:

- **Bbox-парсер (`extract_structured_rows`) работает корректно** — cells размечены правильно.
- **Баг в LLM нормализации** — промпт недостаточно жёсткий, LLM переставляет поля (shift).

Решение Андрея (PO): две итерации, **каждая — отдельный PR с dual-regression**. Принцип «лучшее враг хорошего» — не объединять риски, проверять оба golden'а после каждой правки.

**Итерация 1** (эта задача) — только промпт + section detection + stamp filter + numeric prefix. Без изменений схемы.

---

## Диагностика для справки

Прогон `extract_structured_rows(spec-aov.pdf[0])` для row 2:
```json
{
  "cells": {
    "name": "1.1 Комплект автоматизации для приточной установки П1 в комплекте с П1",
    "brand": "ООО \"КОРФ\"",
    "unit": "шт.",
    "qty": "1,00",
    "comments": "-учтено разделом ИОС4"
  }
}
```

Правильно. Но LLM вернул:
```json
{"name":"1.1 Комплект…", "model_name":"ООО \"КОРФ\"", "brand":"шт.", "unit":"1,00", "quantity":1.0}
```

То есть LLM сделал циркулярный shift `cells.brand → model_name, cells.unit → brand, cells.qty → unit`. Это и есть главный баг.

---

## Задачи

### 1. R19 — жёсткое правило в NORMALIZE_PROMPT против column shift

**Файл:** `recognition/app/services/spec_normalizer.py:NORMALIZE_PROMPT_TEMPLATE`.

Добавить новое правило **в начало списка правил** (перед текущим #1):

```
КРИТИЧЕСКОЕ ПРАВИЛО 0 — маппинг cells → output (НЕ ПЕРЕСТАВЛЯЙ КОЛОНКИ):

Для каждой row копируй значения строго 1:1 по ключам:
  cells.name     → items[].name (с учётом sticky/multi-line, см. ниже)
  cells.model    → items[].model_name
  cells.brand    → items[].brand
  cells.unit     → items[].unit
  cells.qty      → items[].quantity (распарсенное число)
  cells.comments → items[].comments
  cells.pos      → items[].system_prefix (см. правило 5)

Если в row какое-то поле отсутствует в cells — ставь пустую строку / default:
  - model_name = ""
  - brand = ""
  - unit = "шт" (default)
  - quantity = 1 (default)
  - comments = ""

НИКОГДА не пытайся "догадаться", переставить или заполнить отсутствующее значение
данными из соседних cells той же row. Это ЛОМАЕТ структуру сметы.
```

Также **в правило 7 (фильтр)** добавить:
```
7c. Orphan comments (row где только cells.comments непуст, всё остальное пусто) —
   это продолжение comments предыдущего item. Если у предыдущего item comments пусто —
   приклей к нему через пробел. Если уже есть — проигнорируй (чтобы не дублировать).
```

### 2. R19 (вторая часть) — склейка «Модель» + «Код оборудования»

**Контекст:** в spec-aov колонка «Код оборудования» физически разнесена от «Модели», но Андрей хочет чтобы в SpecItem.model_name оба попадали вместе через `-`.

`extract_structured_rows` **уже** мапит «Код оборудования» в отдельный cell-ключ. Проверь имя ключа (возможно `cells.model` берёт из «Модель» колонки, а Код оборудования — в отдельный key `cells.equipment_code` или в `raw_blocks`).

Обновить promt правило #4 (артикульные варианты) или добавить новое **правило #10**:

```
10. Склейка "Модель" + "Код оборудования":
    Если row содержит и cells.model (наименование модели) И cells.equipment_code
    (цифровой/артикульный код) — склей в одно поле:
      items[].model_name = f"{cells.model} {cells.equipment_code}"  
    Если только один из них — используй что есть:
      items[].model_name = cells.model or cells.equipment_code or ""

    Пример: cells.model="TITAN 5 ЩМП-40.30.20", cells.equipment_code="TI5-10-N-040-030-020-66"
    → items[].model_name = "TITAN 5 ЩМП-40.30.20 TI5-10-N-040-030-020-66"
```

**Проверь в `extract_structured_rows`** — есть ли у нас cell-ключ для «Код оборудования»? Если нет, добавить его в column mapping (`_DEFAULT_COLUMN_BOUNDS` или соседнее). **Делать это только если row dump показывает что код действительно теряется/мёрджится с model** — иначе не трогай extract.

### 3. R17 расширение — section detection + очистка префикса

**Файл:** `recognition/app/services/pdf_text.py`.

**Подзадача 3.1:** расширить `_SECTION_RE`:

```python
_SECTION_RE = re.compile(
    r"^(?:\d+(?:\.\d+)*\.?\s+)?"  # опциональный префикс "1.", "2.1.", "3. "
    r"(?:Система\s|Клапаны\s|Противодымная\b|Противодымной\b|Общеобменн"
    r"|Воздуховоды\s|Воздуховод\s+приточной"
    r"|Слаботочн|Отопление\s|Кондиционирован|Дымоудален|Приточная\s|Вытяжная\s"
    # E15.05 расширения из spec-aov:
    r"|Оборудование\s+автоматизации|Щитовое\s+оборудование|Кабели\s+и\s+провода"
    r"|Электроустановочные\s+изделия|Лотки\b"
    # Общие ОВиК/СС разделы:
    r"|Фасонные\s|Трубопроводы\s|Арматура\s|Холодоснабжение|Водоснабжение"
    r"|Электроснабжение|Силовое|Автоматика\b)",
    re.IGNORECASE,
)
```

**Подзадача 3.2:** добавить эвристику `_looks_like_section_heading(cells)` — row-dump показал что current `is_section_heading` не ставится для «1. Оборудование автоматизации»:

```python
def _looks_like_section_heading(cells: dict, raw_blocks: list) -> bool:
    """Row выглядит как секционный заголовок если:
    - Только cells.name непуст (все остальные пусты / нет).
    - Длина name <= 80 символов.
    - Опционально: содержит ключевое слово из _SECTION_RE (но даже без него — кандидат).
    """
    non_empty = {k: v for k, v in cells.items() if v and v.strip()}
    if set(non_empty.keys()) != {"name"}:
        return False
    name = non_empty["name"]
    if not name or len(name) > 80:
        return False
    return True
```

Использовать в `extract_structured_rows`: если `_looks_like_section_heading(cells, raw_blocks)` True → выставить `row.is_section_heading = True` (даже если regex не поймал — LLM разберётся).

**Подзадача 3.3:** очистка префикса `N. ` в NORMALIZE_PROMPT (правило 1):

```
1. Section heading. … Если текст заголовка начинается с номера раздела
   ("1. Оборудование автоматизации", "3.2 Кабели"), — ОЧИСТИ префикс перед
   записью в new_section:
     "1. Оборудование автоматизации" → new_section = "Оборудование автоматизации"
     "3.2 Кабели и провода" → new_section = "Кабели и провода"
   Цифровой префикс оставь только если без него имя становится бессмысленным.
```

### 4. R20 — расширение фильтра штампов

**Файл:** `recognition/app/services/pdf_text.py:_STAMP_EXACT`.

Добавить:
```python
"Взаим.инв.", "Взаим. инв.", "Взаим. инв. №",
"Вз.инв.", "Вз. инв.", "Вз. инв. №",
```

Плюс **regex-фильтр** (если exact не ловит варианты с точками/без пробелов):

```python
_STAMP_REGEX = re.compile(
    r"^(?:Взаим\.?\s*инв\.?\s*№?|Вз\.?\s*инв\.?\s*№?|Инв\.?\s*№\s*подл\.?)",
    re.IGNORECASE,
)

def is_stamp_line(text: str) -> bool:
    s = text.strip()
    if not s:
        return True
    if s in _STAMP_EXACT:
        return True
    if _STAMP_REGEX.match(s):
        return True
    # ... остальная логика
```

Проверить: name «Взаим.инв. № 5.6 Шпилька М8х1000» **из спецификации идёт вместе с номером строки 5.6** — это значит что bbox-парсер прилепил штамп к name. Возможно проблема в том что штамп physically попадает в row name-колонки (из-за bbox). Нужно либо фильтровать на уровне span в extract_structured_rows (если span попадает в service-zone bbox → выкидывать), либо в LLM promt правило 7:

```
7b. Штамп ЕСКД: если cells.name начинается с "Взаим.инв.", "Вз. инв.", "Инв. № подл.",
    "Изм.", "Подп." — это НЕ item. Удали штамп из начала cells.name (до первого
    различимого имени: "Шпилька М8х1000" после "Взаим.инв. № 5.6 Шпилька…")
    или пропусти row полностью.
```

### 5. R21 — Numeric pos vs system code в промпте

**Файл:** `recognition/app/services/spec_normalizer.py`.

Обновить правило #5 (было про ПВ-ИТП):

```
5. Префикс-колонка (cells.pos):
   a) ЧИСТЫЙ номер: cells.pos = r"\d+(\.\d+)*\.?" (например "1", "1.1", "2.4", "3.1.") —
      это порядковый номер, НЕ склеивай с name. В output items[].system_prefix = "".
      
   b) СИСТЕМНЫЙ КОД: cells.pos содержит буквы (латиницу/кириллицу)
      или символы помимо цифр/точек/дефисов-после-цифр (например "ПВ-ИТП",
      "ВД1", "ВД1,2,3", "П-ИТП") — склей к name через дефис:
        name_final = f"{cells.pos.strip()}-{cells.name.strip()}"
      В output items[].system_prefix = cells.pos (для ISMeta tech_specs.system).
      
   Если name уже начинается с префикса (дублирование) — не добавляй повторно.
```

### 6. Dual golden regression

**Обязательно:** добавить `spec-aov.pdf` как второй golden fixture и acceptance-тест.

**Файл:** `recognition/tests/golden/test_spec_aov.py` (новый).

```python
"""Golden тест для spec-aov.pdf (2 стр, 29 позиций, Автоматика/Кабели/Лотки).

Второй golden после spec-ov2-152items. Проверяет что E15.05 итерация 1 НЕ
ломает spec-ov2 и исправляет критичные баги из QA-сессии 2026-04-22.
"""

import os
import pytest
from pathlib import Path

from app.providers.openai_vision import OpenAIVisionProvider
from app.services.spec_parser import SpecParser

FIXTURE_PDF = (
    Path(__file__).resolve().parent.parent.parent.parent
    / "ismeta" / "tests" / "fixtures" / "golden" / "spec-aov.pdf"
)

AOV_MIN_ITEMS = 29         # все 29 должны быть
AOV_MIN_SECTIONS = 4       # из 5 разделов в PDF — хотя бы 4 (один может склеиться на проме)


@pytest.mark.golden_llm
@pytest.mark.asyncio
@pytest.mark.skipif(not os.environ.get("OPENAI_API_KEY"), reason="no OPENAI_API_KEY")
async def test_aov_spec_llm_normalize():
    provider = OpenAIVisionProvider()
    try:
        parser = SpecParser(provider)
        result = await parser.parse(FIXTURE_PDF.read_bytes(), filename=FIXTURE_PDF.name)

        assert result.status == "done"
        assert result.pages_stats.total == 2
        assert result.pages_stats.processed == 2

        # Все 29 позиций.
        assert len(result.items) >= AOV_MIN_ITEMS, (
            f"items={len(result.items)} < {AOV_MIN_ITEMS}"
        )

        # ≥4 секции (из 5: Оборудование автоматизации, Щитовое, Кабели, Электроустановочные, Лотки).
        sections = {it.section_name for it in result.items if it.section_name}
        assert len(sections) >= AOV_MIN_SECTIONS, f"sections={sections!r}"

        # Префиксы "1.", "2." и т.п. должны быть ОЧИЩЕНЫ из section_name.
        for sec in sections:
            assert not sec.startswith(tuple(f"{n}." for n in range(1, 10))), (
                f"numeric prefix not stripped: {sec!r}"
            )

        # Column shift ДОЛЖЕН быть исправлен: items 1-10 "Комплект автоматизации"
        # unit="шт" или "шт.", quantity=1.
        kits = [it for it in result.items if "Комплект автоматизации" in it.name]
        assert len(kits) == 10, f"kits count wrong: {len(kits)}"
        for kit in kits:
            assert kit.unit in ("шт", "шт."), f"unit wrong: {kit.unit!r} in {kit.name!r}"
            assert kit.quantity == 1.0, f"qty wrong: {kit.quantity} in {kit.name!r}"
            # brand должен содержать КОРФ (был завод-изготовитель).
            assert "КОРФ" in kit.brand.upper() or kit.brand == "", (
                f"brand wrong: {kit.brand!r} in {kit.name!r}"
            )
            # model_name для комплектов в spec-aov пуст в исходнике — значит ""
            # (или при реализации R19 склейки — контент из "Код оборудования", которого нет).
            # Главное — model_name НЕ должно быть "ООО КОРФ" (shift).
            assert "КОРФ" not in kit.model_name.upper(), (
                f"brand leaked to model: {kit.model_name!r} in {kit.name!r}"
            )

        # R20 штамп: "Взаим.инв." НЕ должен быть ни в одном items[].name.
        for it in result.items:
            assert "Взаим" not in it.name, f"stamp leaked: {it.name!r}"

        # R21 numeric prefix: name НЕ должен начинаться с "1.1", "2.1" и т.п.
        import re as _re
        for it in result.items:
            m = _re.match(r"^\d+\.\d+\s", it.name)
            assert m is None, f"numeric prefix leaked to name: {it.name!r}"

    finally:
        await provider.aclose()
```

Плюс **обновить `test_spec_ov2.py`**:
- `LLM_MIN_ITEMS` поднять с 135 до **140** (было 147/152 фактически).
- Проверить что добавленные правила не сломали spec-ov2.

### 7. Обновить документацию

- **`recognition/README.md`** — секция «Pipeline» — добавить упоминание двух golden'ов.
- **`ismeta/docs/DEV-BACKLOG.md`** — закрыть пункты #18 (prompt-тюнинг частично), #20 (LLM_MIN_ITEMS 135→140), #22 (раздел МОП — после E15.05 может закрыться автоматически через расширенный regex).

---

## Приёмочные критерии

1. ✅ `pytest -q` в `recognition/`: все зелёные, +тесты для R17/R19/R20/R21 в `test_normalize_llm.py` и `test_pdf_text.py`.
2. ✅ `pytest -m golden` (legacy, без LLM): не упал.
3. ✅ `pytest -m golden_llm` на **spec-ov2**: items ≥ 140 (или больше если prompt дал прирост).
4. ✅ `pytest -m golden_llm` на **spec-aov** (НОВЫЙ): 
   - items ≥ 29 (все).
   - sections ≥ 4 (из 5).
   - Ни один section_name не начинается с `N.` цифрового префикса.
   - Items 1-10 «Комплект автоматизации»: unit="шт.", qty=1.0, model_name без «КОРФ», brand содержит «КОРФ» или пусто.
   - Ни одно name не содержит «Взаим.» (R20).
   - Ни одно name не начинается с `\d+\.\d+\s` (R21, очищено от цифрового префикса).
5. ✅ `ruff` + `mypy` clean.
6. ✅ `ismeta/backend pytest -q`: все зелёные (не должно меняться, кроме maybe test_pdf_import).
7. ✅ Live-смоук на spec-aov через curl: все 29 items, корректные поля unit/brand/model/quantity.

---

## Ограничения

- **НЕ менять схему** `SpecItem` (это итерация 2).
- **НЕ трогать** модель `EstimateItem` / миграции.
- **НЕ рефакторить** `extract_structured_rows` глобально — только точечные добавления (`_looks_like_section_heading`, `_STAMP_REGEX`, возможно `equipment_code` cell если реально теряется).
- **НЕ уменьшать** `LLM_MIN_ITEMS` для spec-ov2 ниже 140.
- **НЕ трогать** shared файлы AC Rating (settings.py, urls.py, globals.css, layout.tsx, CLAUDE.md).

---

## Формат отчёта

1. Ветка и hash последнего коммита.
2. Что изменилось в промпте — diff критичных правил.
3. Live-прогон метрики:
   - spec-ov2: items, sections, tokens, time.
   - spec-aov: items, sections, tokens, time, проверка корректности items 1-10.
4. Результат обоих golden_llm тестов: `pytest -m golden_llm -v`.
5. ruff + mypy clean.
6. Известные остатки (что НЕ исправили в этой итерации — переносится в it2).
