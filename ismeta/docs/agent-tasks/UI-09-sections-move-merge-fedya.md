# ТЗ: UI-09 — Операции с разделами (перенос items + объединение разделов) (IS-Федя)

**Команда:** IS-Федя.
**Ветка:** `ismeta/ui-09-sections-operations` (создаётся **ПОСЛЕ** мержа UI-08).
**Worktree:** `ERP_Avgust_is_fedya_ui09_sections`.
**Приоритет:** 🟡 UX major (finding из цикла 10-заходов).
**Срок:** 1 день.

---

## Контекст

QA-цикл 10-заходов, заход 1/10 (2026-04-23). PO обозначил 4 связанных запроса про разделы:

### #46 — Перенос items между разделами
> **PO:** «Если материалы неправильно отнесены к разделам, то как перенести их из раздела в раздел? Считаю что точно тем-же механизмом как мы сделали объединение. Если выделить какие-то материалы (или даже один!) галочкой слева — то кроме кнопки "Объединить" должна быть кнопка с выпадающим списком разделов для переноса в другой раздел.»

### #47 — Счётчик items в каждом разделе (сайдбар)
> **PO:** «В списке разделов слева хорошо бы иметь около каждого раздела счётчик строк раздела.»

### #48 — Объединение разделов (sidebar bulk)
> **PO:** «Возможность как добавить раздел так и объединить разделы. У разделов должны быть такие-же чекбоксы слева от названия разделов, при нажатии на которые (выделение раздела) его можно было бы объединить с другим (сохраняя название первого и сливая вместе все строки, так что в первом было 5 а во втором 6 и тогда в объединенном разделе будет 11).»

### #49 — Добавить раздел (уже есть)
Кнопка «+ Добавить раздел» в сайдбаре уже присутствует (см. UI-layout). Проверить что работает, если нет — починить.

**Зависимость:** стартует **ПОСЛЕ** мержа UI-08 (column widths resize+persist) чтобы избежать конфликтов в `items-table.tsx`.

---

## Задачи

### 1. Счётчик items per section в sidebar (#47)

**Файл:** `ismeta/frontend/components/estimate/sections-sidebar.tsx` (или как называется компонент левого меню разделов).

В sidebar каждый раздел сейчас имеет:
- Название раздела (`section.name`)
- Сумма (`section.total` / денежное значение `0,00 ₽`)

Добавить **счётчик items** рядом с названием:
```tsx
<div className="section-row">
  <span className="section-name">{section.name}</span>
  <span className="section-item-count text-xs text-muted-foreground">
    ({sectionItemCount[section.id] ?? 0})
  </span>
  <span className="section-total">{formatCurrency(section.total)}</span>
</div>
```

**sectionItemCount** считается по items:
```tsx
const sectionItemCount = React.useMemo(() => {
  const counts: Record<UUID, number> = {};
  for (const item of items) {
    if (item.is_deleted) continue;
    counts[item.section] = (counts[item.section] ?? 0) + 1;
  }
  return counts;
}, [items]);
```

Для «Все разделы» — `items.length` (не delete'd).

### 2. Перенос items между разделами (#46)

**Файл:** `ismeta/frontend/components/estimate/items-table.tsx`.

В уже существующем **bulk toolbar** (появляется при selection ≥ 1 item из UI-06) — добавить **третью кнопку** рядом с [Объединить] [Отмена]:

```
┌──────────────────────────────────────────────────────────────────────┐
│ Выделено: 3 строки   [Объединить]  [Перенести в раздел ▾]  [Отмена]  │
└──────────────────────────────────────────────────────────────────────┘
```

Кнопка **«Перенести в раздел ▾»** — dropdown:
- Список всех разделов сметы (кроме текущего у selected items, если все в одном).
- Опция «+ Новый раздел…» внизу — открывает inline-prompt для названия.
- При клике на раздел → `itemApi.update(id, { section: newSectionId, version }, workspace_id)` для каждого selected item.

**Отличие от Merge:** для Move достаточно **≥ 1 item** selected (не ≥ 2 как для Merge). Merge остаётся требование ≥ 2.

**Cross-section selection при Move:** разрешено (move из разных секций в одну).

**API calls:** N PATCH (по одному на item). Последовательно, с optimistic locking (version).

**UX:**
- Toast success: «Перенесено N {строка/строки/строк} в раздел "{name}"» (plural из TD-01 helper).
- Toast error: «Не удалось перенести: {error}» — selection сохранён.
- После success — selection сбрасывается, table refresh (invalidate query).

Cross-section merge **всё ещё блокирован** (UI-06 правило сохраняется). Только Move cross-section.

### 3. Объединение разделов (#48) — checkbox в sidebar

**Файл:** `ismeta/frontend/components/estimate/sections-sidebar.tsx`.

**Добавить checkbox слева** от каждого раздела (ниже «Все разделы», который остаётся без checkbox):

```tsx
<div className="section-row flex items-center gap-2">
  <input
    type="checkbox"
    checked={selectedSectionIds.has(section.id)}
    onChange={() => toggleSelectSection(section.id)}
    className="h-4 w-4"
    onClick={(e) => e.stopPropagation()}
  />
  <span onClick={() => setActiveSection(section.id)}>{section.name}</span>
  <span>({sectionItemCount[section.id] ?? 0})</span>
  <span>{formatCurrency(section.total)}</span>
</div>
```

**State:** `useState<Set<UUID>>(selectedSectionIds)` — local state sidebar-компонента.

**Sticky bulk toolbar разделов** (появляется при selection ≥ 2 разделов), **над списком разделов**:

```
┌─────────────────────────────────────────┐
│ Выделено: 2 раздела   [Объединить]  [×]  │
└─────────────────────────────────────────┘
```

Кнопка **«Объединить»** → confirm dialog:
```
Объединить 2 раздела?

"Вентиляция" (5 строк, 12 500 ₽)
+ "Кондиционирование" (6 строк, 8 200 ₽)

→ "Вентиляция" (11 строк, 20 700 ₽)

Название сохранится от первого выделенного раздела.
Все строки объединятся. Остальные разделы (кроме первого) будут удалены.

[Отмена]  [Объединить]
```

**Порядок sections** — по `sort_order`. «Первый» = с минимальным sort_order из selected.

**Backend-операции:** 
- Для каждого item из второго/третьего раздела → `PATCH item.section = firstSectionId`.
- После всех PATCH → для второго+ разделов → `DELETE /sections/:id`.
- Возможный dedicated endpoint `POST /sections/merge` — **не делаем в MVP** (как в UI-06 — client-side, tech debt).

**Атомарность — MVP нестрого.** Если PATCH/DELETE упадёт частично — toast error + invalidate queries (user видит актуальное состояние и решает).

**Toast:** «Объединено N разделов в "{name}"» (plural helper).

### 4. «+ Добавить раздел» (#49)

**Проверить** что кнопка уже работает: клик → inline form для названия → POST `/sections` → новый раздел в list.

Если что-то сломано в current code — починить. Если работает — оставить.

### 5. Pluralize helper

Переиспользовать helper из **TD-01** (Петя выносит его в `lib/i18n.ts`). Импортировать:
```tsx
import { pluralizeRows, pluralizeSections } from "@/lib/i18n";
```

Предупреждение Пете если helper ещё не на main — пометить **зависимость от TD-01**. Если не готово — hardcode локально, убрать в follow-up PR.

### 6. Совместимость с UI-04/06/07/08

- **UI-06 Merge:** остаётся, Move **не заменяет** его. Оба варианта в bulk toolbar.
- **UI-07 Search:** selection с UI-06 корректно отрабатывает при filter — same логика.
- **UI-08 Column widths:** sidebar не трогает таблицу. Ничего не ломается.
- **UI-06 selection effect:** при переносе items в другой раздел / удалении разделов — selection должен cleanup'иться (items могли исчезнуть из visibleItems).

### 7. Тесты

**Новый файл:** `ismeta/frontend/__tests__/sections-operations.test.tsx`.

- `test_section_item_count_displayed` — sidebar показывает (N) рядом с названием.
- `test_move_dropdown_shows_in_toolbar_when_selection` — появляется после selection ≥ 1.
- `test_move_items_sends_patch_per_item` — выбрать 3 items, выбрать раздел в dropdown → 3 PATCH с правильными ids.
- `test_move_from_multiple_sections_allowed` — selection cross-section → move работает.
- `test_move_success_toast_plural` — toast plural correctness для 1/2/5/11.
- `test_section_checkbox_selects` — click на checkbox → в selectedSectionIds.
- `test_section_merge_toolbar_visible_when_2plus` — 2+ sections → toolbar visible.
- `test_section_merge_dialog_preview` — confirm dialog с preview (count items + totals).
- `test_section_merge_api_calls` — N PATCH + M DELETE в правильном порядке.
- `test_section_merge_preserves_first_name` — объединение Вент + Конд → название "Вент".

### 8. Ручная проверка

Через dev-server:
1. Загрузить спеку (spec-tabs или любую).
2. Выделить 2-3 items из раздела A → кликнуть «Перенести в раздел» → выбрать раздел B. Items в B.
3. Выделить 2 раздела в sidebar чекбоксами → «Объединить» → confirm. Разделы слились, items перенесены.
4. Счётчики items в sidebar обновились.

Скриншоты всех 3 операций в PR.

---

## Приёмочные критерии

1. ✅ Sidebar показывает `(N)` счётчик items в каждом разделе.
2. ✅ Bulk toolbar items имеет кнопку «Перенести в раздел ▾» рядом с «Объединить».
3. ✅ Move работает для selection ≥ 1 (не требует ≥ 2 как Merge).
4. ✅ Move cross-section разрешён (items из разных разделов → в один).
5. ✅ Sidebar: checkbox слева от каждого раздела (кроме «Все разделы»).
6. ✅ Bulk toolbar sections при selection ≥ 2 — «Объединить» + «×» cancel.
7. ✅ Confirm dialog объединения разделов показывает preview (counts + totals + названия).
8. ✅ Merge sections: все items из объединяемых → в первый, лишние разделы удаляются.
9. ✅ Plural русский в toast'ах (использует TD-01 helper).
10. ✅ vitest зелёные (+ новый файл, ≥10 тестов).
11. ✅ tsc + lint clean.

---

## Ограничения

- **НЕ делать** backend-endpoint `/sections/merge` в MVP — client-side N PATCH + M DELETE достаточно.
- **НЕ делать** undo (стандартная логика: user case-by-case может вручную пересоздать).
- **НЕ добавлять** Ctrl/Cmd+клик shortcut для множественного выбора разделов — только checkbox.
- **НЕ трогать** backend/модели sections.
- **НЕ трогать** shared файлы AC Rating.

---

## Формат отчёта

1. Ветка и hash.
2. 3 скриншота: (а) sidebar с counter и checkboxes, (б) Move-dropdown в items toolbar, (в) Merge sections confirm dialog + result.
3. vitest + tsc + lint статусы.
4. Ограничения (например если что-то отложено на будущий PR).
