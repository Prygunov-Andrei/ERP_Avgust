# ТЗ: UI-07 — Поиск по items сметы (IS-Федя)

**Команда:** IS-Федя.
**Ветка:** `ismeta/ui-07-items-search`.
**Worktree:** `ERP_Avgust_is_fedya_ui07_search`.
**Приоритет:** 🟠 major (базовая UX-фича, в смете может быть 200+ строк).
**Срок:** 0.5–1 день.

---

## Контекст

QA-сессия 4 (см. `ismeta/docs/QA-FINDINGS-2026-04-22.md` #42):

> **Андрей:** «Я только что заметил что у нас в смете вообще нет никакого поиска? У нас однозначно должен быть поиск по строкам сметы (по всем текстам во всех столбцах, по всем вхождениям разумеется!).»

После E15.05 it2 сметы будут содержать 150-200 items (spec-tabs, spec-ov2). Без поиска пользователь не сможет быстро найти конкретную позицию.

Стартует **параллельно** с Петиной E15.05 it2 и Фединой UI-06. Не зависит от backend-изменений (client-side filter).

---

## Задача

### 1. Поле поиска в верхней панели таблицы

**Файл:** `ismeta/frontend/components/estimate/items-table.tsx` (или родительский компонент).

Добавить `<input type="search">` **в верхней строке** над таблицей (рядом с tabs «Все / Стандарт / Основное оборудование»):

```
┌─────────────────────────────────────────────────────┐
│ [🔍 Поиск по строкам сметы...]          [x]         │
└─────────────────────────────────────────────────────┘
```

- Placeholder: «Поиск по строкам сметы…».
- Debounce 200ms (useDeferredValue / useDebounce).
- Кнопка clear (x) при непустом query.
- Ctrl/Cmd+F (hotkey) — focus на поле (если feasible без конфликта с browser-search).

### 2. Фильтрация items

Фильтр применяется к **видимой list'у** после выбора секции / трека. Оперирует на client-side массиве items.

**Проверяемые поля (по всем одновременно, OR-combination):**
- `item.name`
- `item.tech_specs.model_name`
- `item.tech_specs.brand`
- `item.tech_specs.manufacturer` (после E15.05 it2)
- `item.tech_specs.comments`
- `item.tech_specs.system` (префикс ПВ-ИТП)
- `item.unit`
- `item.section.name` (имя раздела, к которому принадлежит item)

**Алгоритм:**
```ts
function matchesQuery(item: EstimateItem, section: Section | null, query: string): boolean {
  const normalized = query.toLowerCase().trim();
  if (!normalized) return true;
  
  const haystack = [
    item.name,
    item.unit,
    item.tech_specs?.model_name,
    item.tech_specs?.brand,
    item.tech_specs?.manufacturer,
    item.tech_specs?.comments,
    item.tech_specs?.system,
    section?.name,
  ].filter(Boolean).join(" ").toLowerCase();
  
  return haystack.includes(normalized);
}
```

### 3. Highlight matches

В отфильтрованном списке **подсветить** найденный подстрока в ячейках:

```tsx
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase().trim();
  const idx = lowerText.indexOf(lowerQuery);
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 dark:bg-yellow-700">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}
```

Применять в cell render для `name`, `model_name`, `comments`, `brand`, `manufacturer`.

### 4. Empty state

Если query + filter даёт 0 результатов:

```
┌─────────────────────────────────────────────────────┐
│  Ничего не найдено по запросу «{query}»             │
│                                                     │
│                 [Очистить поиск]                    │
└─────────────────────────────────────────────────────┘
```

### 5. Counter

Рядом с query полем показать счётчик найденных: `Найдено: 5 из 147`.

### 6. Совместимость с секциями

- Если выбрана конкретная секция и query совпадает с items **других** секций — показать subtle hint: «+12 совпадений в других разделах» с клик-по-hint → переключить на «Все разделы».

### 7. Совместимость с треком оборудования

Search работает поверх активного фильтра «Все / Стандарт / Основное оборудование».

### 8. Совместимость с UI-06 (Merge Rows)

- Selection сохраняется при изменении query (если item всё ещё в visible list).
- Если selected item стал hidden по фильтру — исключить из selection.

### 9. Тесты

**Файл:** `ismeta/frontend/__tests__/items-search.test.tsx` (новый).

- `test_search_filters_by_name` — query «Воздуховод» → только items с этим словом.
- `test_search_filters_by_model` — query «WNK 100/1» → item с tech_specs.model_name.
- `test_search_filters_by_manufacturer` — query «КОРФ» → items с manufacturer.
- `test_search_case_insensitive` — query «КоРф» → finds «ООО "КОРФ"».
- `test_search_trim_whitespace` — query «  Воз  » → работает.
- `test_search_empty_state` — query «xyz123» → empty state visible.
- `test_search_counter` — query → «Найдено: N из M».
- `test_search_highlight_marks` — `<mark>` элементы в ячейках.
- `test_search_other_sections_hint` — query совпадает в других секциях → hint visible.
- `test_search_clear_button_resets` — click clear → query пуст, все items visible.

---

## Приёмочные критерии

1. ✅ Search input в панели над таблицей, debounce 200ms, clear button.
2. ✅ Фильтрация по всем ключевым полям (name/model/brand/manufacturer/comments/system/unit/section.name).
3. ✅ Highlight matches через `<mark>` в ячейках.
4. ✅ Empty state с «Очистить поиск».
5. ✅ Counter «Найдено: N из M».
6. ✅ «+X совпадений в других разделах» hint при активной секции.
7. ✅ vitest зелёные (+ новый файл, ≥10 тестов).
8. ✅ tsc/lint clean.
9. ✅ Ручная: на ≥100 items сметы — поиск не тормозит, debounce работает.

---

## Ограничения

- **НЕ trigger** backend-запрос при поиске — чистый client-side filter.
- **НЕ использовать** fuzzy-search (Fuse.js и т.п.) в MVP — простой `includes()`. Fuzzy — отдельно (UI-07b tech debt, если пользователь пожалуется).
- **НЕ трогать** URL — query не в URL state (мощнее, если понадобится — отдельный PR).

---

## Формат отчёта

1. Ветка и hash.
2. Скриншоты: search input, highlight результат, empty state, hint про другие секции.
3. vitest + tsc + lint.
4. Performance: как быстро фильтруется 200+ items (subjective ok или numeric).
