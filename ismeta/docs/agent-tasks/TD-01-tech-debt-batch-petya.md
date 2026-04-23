# ТЗ: TD-01 — Tech Debt batch (DEV-BACKLOG #18-22 + полировка) (IS-Петя)

**Команда:** IS-Петя.
**Ветка:** `recognition/10-td-01-tech-debt-batch`.
**Worktree:** `ERP_Avgust_is_petya_td01`.
**Приоритет:** 🟢 tech debt (нет блокеров, улучшения стабильности/стоимости/точности).
**Срок:** 0.5–1 день.

---

## Контекст

После E16 it1 Invoice (мерж вчера) и стартовавшего цикла 10-заходов PO — Петя свободен. PO дал go на tech debt batch из `DEV-BACKLOG.md` пункты #18-22 + pre-existing mypy-ошибки, которые Петя сам отметил в отчёте.

**НЕ запускаем E17** (Quote xlsx) — draft, ждёт продуктового решения по workflow КП (см. `OPEN-QUESTIONS-procurement-ux.md`).

---

## Задачи (по приоритетам)

### 1. Pre-existing mypy errors (15 мин)

Петя отметил в E16 it1 отчёте: «2 pre-existing mypy-ошибки (не регрессия — проверено на stash)».

**Файлы** (найти точные места через `mypy app/ --disallow-untyped-defs`):
- `recognition/app/services/pdf_text.py` — `_derotate_span missing matrix type`.
- `recognition/app/services/spec_parser.py:~178` — nested `run_one` без return type annotation.

**Решение:** добавить type annotations, mypy clean.

**Тест:** `mypy app/ --disallow-untyped-defs` — 0 errors.

### 2. «Объединено N строк в одну» русская плюрализация (10 мин)

**Файл:** `ismeta/frontend/components/estimate/items-table.tsx` (UI-06 Merge Rows, `mergeRows.onSuccess`).

Сейчас:
```tsx
toast.success(`Объединено ${data.count} строк в одну`);
```

Это фиксированная форма — «Объединено 2 строк в одну» звучит некорректно.

**Правильная плюрализация по русскому mod-10/mod-100:**
```tsx
function pluralizeRows(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 19) return "строк";
  if (mod10 === 1) return "строка";
  if (mod10 >= 2 && mod10 <= 4) return "строки";
  return "строк";
}

toast.success(`Объединено ${data.count} ${pluralizeRows(data.count)} в одну`);
```

Аналогично — если в UI-06 toolbar показывает «Выделено: N строк/строки/строка», применить тот же helper. Уже была реализация `size < 5 ? "строки" : "строк"` — но не учитывает 11-19.

**Вынеси pluralize в `ismeta/frontend/lib/i18n.ts`** (новый файл) — пригодится ещё. Unit-тест с ключевыми точками: 0, 1, 2, 5, 11, 21, 22, 100, 101, 111.

### 3. R26 section normalization — расширить на `.` и `,` (15 мин)

**Файл:** `recognition/app/services/spec_normalizer.py:_normalize_section_name`.

Сейчас strip: `:`, `—`, `-`, whitespace. На spec-ov2 остался дубль «Жилая часть» vs «Жилая часть.» — точки в конце не стрипаются.

**Решение:**
```python
def _normalize_section_name(s: str) -> str:
    if not s:
        return s
    # Strip trailing punctuation (: — - . ,) + whitespace. Multiple chars OK.
    return re.sub(r"[\s:\—\-\.\,]+$", "", s.strip())
```

**Тест:** unit — `_normalize_section_name("Жилая часть.") == "Жилая часть"`, `"Foo:"` → `"Foo"`, `"Bar,."` → `"Bar"`, `"Baz"` → `"Baz"` (no-op).

Плюс regression: golden_llm spec-ov2 — число секций должно **уменьшиться** на 1 (слияние дубля). Поднять `MIN_SECTIONS` если нужно (но sections не проверяется assertивно по max).

### 4. LLM_MIN_ITEMS 135 → 142 (5 мин)

**Файл:** `recognition/tests/golden/test_spec_ov2.py`.

E15.05 it2 фактический recall на spec-ov2 — 149-152 items. Порог 135 — regression-escape зона (LLM может упасть до 90% качества и тест не поймает).

Поднять `LLM_MIN_ITEMS = 142`. После нескольких прогонов если стабильно ≥147 — поднять до 145 в следующей итерации.

### 5. OpenAI prompt caching (0.5 дня) — закрывает #21 cost $0.011 → $0.005

**Файл:** `recognition/app/services/spec_normalizer.py`, `recognition/app/services/invoice_normalizer.py`, `recognition/app/services/invoice_title_block.py`.

OpenAI prompt caching v1 (automatic for gpt-4o family, **ephemeral 5 min**): если префикс промпта ≥1024 tokens идентичен между вызовами — кэшируется, cost × 0.5 на cached-input tokens.

**Наш промпт:** NORMALIZE_PROMPT_TEMPLATE ~3500 tokens instructions, rows-JSON ~5000 tokens per page. Инструкции стабильны, меняются только rows-JSON.

**Реализация:**
- Переделать промпт: `INSTRUCTIONS_BLOCK + SEPARATOR + PAGE_DATA`. 
- INSTRUCTIONS_BLOCK (правила 0-11 + формат output) — **идентичен** между всеми вызовами.
- PAGE_DATA — rows JSON per-page.
- OpenAI автоматически cache'ирует INSTRUCTIONS_BLOCK.

**Нужно проверить:** структура messages — одно content или разделить на две message (system + user)? Читать docs OpenAI prompt caching: <https://platform.openai.com/docs/guides/prompt-caching>. Обычно cache triggers на system-сообщениях.

**Решение для нашего:**
```python
messages=[
    {"role": "system", "content": INSTRUCTIONS_BLOCK},  # кэшируется
    {"role": "user", "content": f"rows: {rows_json}"},  # per-call
]
```

**Измерение:** проверить `usage.prompt_tokens_details.cached_tokens` в response — сколько закэшировано.

**Тест:** live-прогон spec-ov2 (9 страниц, 9 LLM calls) — второй-девятый calls должны иметь `cached_tokens > 1000`.

**Cost update:** обновить ADR-0024 / ADR-0025 / ADR-0026 — актуальные cost after caching.

### 6. httpx Connection pooling (0.5 дня) — закрывает #22 time 34с cold → ≤30с

**Файл:** `recognition/app/providers/openai_vision.py`.

Сейчас: `self._client = httpx.AsyncClient(timeout=120.0)` — создаётся один раз на Provider, но TCP-соединения могут закрываться после idle.

**Решение:** настроить HTTP/2 + persistent connections:
```python
self._client = httpx.AsyncClient(
    timeout=120.0,
    http2=True,
    limits=httpx.Limits(
        max_connections=10,
        max_keepalive_connections=5,
        keepalive_expiry=300,  # 5 min
    ),
)
```

**Warm-up:** в FastAPI lifespan (`main.py`) сделать 1 `GET /v1/models` при startup — прогреет соединение для первого реального запроса.

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    provider = OpenAIVisionProvider()
    app.state.provider = provider
    # Warm-up connection pool
    try:
        await provider._client.get(
            "https://api.openai.com/v1/models",
            headers={"Authorization": f"Bearer {provider.api_key}"},
            timeout=10.0,
        )
        logger.info("OpenAI connection pool warmed up")
    except Exception as e:
        logger.warning("OpenAI warm-up failed (non-fatal): %s", e)
    yield
    await provider.aclose()
```

**Тест:** замерить время первого и второго прогона spec-tabs. После warm-up — 1st = 2nd время (раньше cold-start давал +5-10с).

### 7. DEV-BACKLOG обновление

После фиксов:
- #18 prompt-тюнинг — частично закрыт (recall 98% стабильно).
- #19 section split МОП — закрыт (R26 уже в E15.05 it2 + расширение точкой в этом TD).
- #20 LLM_MIN_ITEMS — закрыт (поднят до 142).
- #21 cost — закрыт (prompt caching).
- #22 time cold-start — закрыт (warm-up).
- #23 CI golden_llm через secrets — **не трогаем** (требует координации с PO + GitHub Actions access).

Помечаем [x] Done с коммит-хешем в DEV-BACKLOG.

---

## Приёмочные критерии

1. ✅ `mypy app/ --disallow-untyped-defs` — 0 errors (было 2).
2. ✅ `pytest recognition` — все зелёные.
3. ✅ `pytest -m golden_llm` — 7 passed (3 spec + 2 invoice + 2 golden_llm time budget).
4. ✅ Spec dual-regression — без регрессий.
5. ✅ vitest ismeta/frontend — все зелёные + новый pluralize helper тест.
6. ✅ Prompt caching — `cached_tokens > 1000` в usage на 2-м и последующих вызовах в одном прогоне.
7. ✅ Warm-up logged в recognition startup.
8. ✅ DEV-BACKLOG обновлён (#18-22 помечены как done / partial).
9. ✅ ruff + mypy clean.

### Нефункциональные

10. ✅ spec-ov2 live curl после TD-01: time от первого запроса (cold) примерно равен warm (warm-up работает).
11. ✅ spec-ov2 cost после TD-01: `cached_tokens > 0`, эффективная стоимость снизилась.

---

## Ограничения

- **НЕ менять** архитектуру парсеров (пайплайн Phase 0/1/2 остаётся).
- **НЕ трогать** модели ERP payments / proposals.
- **НЕ трогать** shared файлы без крайней необходимости (если потребуется — пинг PO).
- **НЕ запускать** E17 Quote xlsx в этом PR — отдельная задача по явному go PO.
- HTTP/2 в httpx — проверить совместимость с настройками OpenAI (обычно ок, но если падает — оставить HTTP/1.1 + keepalive).
- Plural russian — вынести в `lib/i18n.ts` чтобы пригодилось в других UI-местах.

---

## Формат отчёта

1. Ветка и hash.
2. Список закрытых пунктов (mypy / plural / section / threshold / cache / warm-up).
3. Метрики cost: `cached_tokens` на spec-ov2 до/после (должно появиться > 0 в кешированных call'ах).
4. Метрики time: первый запрос после restart recognition — сколько секунд на spec-ov2.
5. DEV-BACKLOG diff.
6. pytest + vitest + mypy + ruff статусы.
