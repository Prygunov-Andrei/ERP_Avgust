# ТЗ: UI-06 — Merge Rows (объединение строк сметы) (IS-Федя)

**Команда:** IS-Федя.
**Ветка:** `ismeta/ui-06-merge-rows`.
**Worktree:** `ERP_Avgust_is_fedya_ui06_merge_rows`.
**Приоритет:** 🟠 major (escape hatch для кейсов когда парсер ошибся).
**Срок:** 1 день.

---

## Контекст

QA-сессия 4 (см. `ismeta/docs/QA-FINDINGS-2026-04-22.md` #41):

> **Андрей:** «В старой версии ERP при работе со строками мы решили эту проблему: информацию из строк можно было объединить. Мы выделяли строки которые надо объединить, нажимали одну кнопку — информация из них склеивалась (как из наименования, так и из модели), а во всех остальных столбцах брались значения из первой строки а остальные отбрасывались.»

Это страховочный механизм на случай когда PDF-парсер (даже с multimodal fallback E15.05 it2) ошибся — пользователь вручную объединяет 2-3 рядом стоящие строки в одну.

Стартует **параллельно** с Петиной E15.05 it2 — UI-фича не зависит от backend-изменений (работает на существующих fields `name`, `tech_specs.model_name`, `tech_specs.comments`).

---

## Задача

### 1. Checkbox-selection в таблице сметы

**Файл:** `ismeta/frontend/components/estimate/items-table.tsx`.

1. Добавить столбец-checkbox **в начало таблицы** (перед «№»).
2. Внутри секции (или в рамках «Все разделы» view) — клик по checkbox выделяет row.
3. Shift-click — range selection (строки от последнего clicked до текущего).
4. Ctrl/Cmd-click — toggle single row.
5. Header checkbox — «выделить все» внутри видимой секции.

**State:** `useState<Set<UUID>>(selectedItemIds)` — local state компонента.

### 2. Bulk toolbar с кнопкой «Объединить»

Когда `selectedItemIds.size >= 2` — появляется **bulk toolbar** сверху таблицы (sticky bar):

```
┌─────────────────────────────────────────────────────┐
│ Выделено: 3 строки    [Объединить]   [Отмена]       │
└─────────────────────────────────────────────────────┘
```

Кнопка **«Объединить»** → открывает confirm-dialog с превью результата:

```
┌─ Объединить 3 строки? ─────────────────────────────┐
│                                                    │
│ Наименование (склеено через пробел):               │
│   «Приточно-вытяжная установка L=755/655м³/ч      │
│    Pc=300 Па LM DUCT Q 40-20 комплектно со см.    │
│    узлом, пластинчатым рекуператором комплектом   │
│    автоматики»                                     │
│                                                    │
│ Модель (склеено):                                  │
│   «LM DUCT Q 40-20»                                │
│                                                    │
│ Примечание (склеено):                              │
│   «подвесная»                                      │
│                                                    │
│ Ед.изм.: «шт»    Кол-во: 1.00                     │
│ (взято из первой строки)                           │
│                                                    │
│ Удаляемые строки: 2-я и 3-я                        │
│                                                    │
│              [Отмена]  [Объединить]                │
└────────────────────────────────────────────────────┘
```

**Правила склейки:**
- `name`: `first.name + " " + second.name + " " + third.name` через пробел, схлопнуть множественные пробелы.
- `tech_specs.model_name`: аналогично склеить (если в последующих строках `model_name` пусто — не добавлять).
- `tech_specs.comments`: склейка через `" "`.
- `tech_specs.brand`, `tech_specs.manufacturer`, `tech_specs.system`: из **первой** строки (не склеиваем).
- `unit`, `quantity`, `equipment_price`, `material_price`, `work_price`, `material_markup`, `work_markup`: из **первой** строки.
- `is_key_equipment`, `procurement_status`: из **первой** строки.
- `custom_data`: из **первой** строки.

### 3. Backend-действие (без нового endpoint)

**Файл:** `ismeta/frontend/components/estimate/items-table.tsx` (логика mergeRows).

Использовать **существующие** API методы (без backend-изменений):
1. `itemApi.update(firstItemId, patch)` с merged payload (новое name, tech_specs).
2. Для каждой последующей row: `itemApi.delete(rowId)`.

Операции последовательные, в `useMutation` с optimistic update:
```ts
const mergeRows = useMutation({
  mutationFn: async ({ firstId, otherIds, merged }: MergeInput) => {
    await itemApi.update(firstId, merged);
    for (const id of otherIds) {
      await itemApi.delete(id);
    }
  },
  onSuccess: () => { /* invalidate queries */ setSelectedItemIds(new Set()); },
});
```

**Атомарность** — для MVP нестрого (если delete упадёт частично — пользователь увидит и починит). В будущем — backend `/api/v1/estimates/{id}/items/bulk-merge/` (отдельный пункт для DEV-BACKLOG).

### 4. UX-details

- Чекбоксы не мешают click'у на row (event.stopPropagation на checkbox).
- Dialog кнопка «Объединить» — `<Button variant="default">`, primary.
- Кнопка «Отмена» — `<Button variant="outline">`.
- Toast success: «Объединено N строк в одну».
- Toast error: «Не удалось объединить: {error}» — в случае fail API.
- Ограничение: merge только **в пределах одной секции** (строки из разных section — disable кнопку + tooltip «Строки должны быть в одной секции»).
- Минимум 2 строки — иначе кнопка disabled.

### 5. Тесты

**Файл:** `ismeta/frontend/__tests__/merge-rows.test.tsx` (новый).

- `test_checkbox_selection_single` — клик по checkbox → в selection.
- `test_shift_click_range` — shift+click → range выделение.
- `test_toolbar_shows_when_2plus_selected` — выделяем 2 → toolbar виден, с 0/1 — скрыт.
- `test_merge_dialog_preview` — click «Объединить» → dialog с корректным merged name/model/comments.
- `test_merge_api_calls` — confirm → 1 PATCH + N-1 DELETE в правильном порядке.
- `test_merge_cross_section_disabled` — выделяем items из двух разных секций → кнопка disabled.
- `test_merge_toast_success` — успешный merge → toast «Объединено N строк».
- `test_merge_api_error` — PATCH возвращает 500 → toast error, selection сохранён (позволить retry).

### 6. Backend тест (на сохранность tech_specs)

**Файл:** `ismeta/backend/apps/estimate/tests/test_item_merge_behavior.py` (новый, опционально).

- Простой test: PATCH item + DELETE — проверить что `tech_specs` merged корректно (client-side merge из UI-04 не ломается).

### 7. DEV-BACKLOG

Добавить запись «#24 — bulk-merge endpoint как улучшение UX-06 (atomic)» — tech debt, делать когда будет прямой запрос от пользователя.

---

## Приёмочные критерии

1. ✅ Чекбокс-колонка в таблице items.
2. ✅ Shift-click / ctrl-click / header checkbox работают.
3. ✅ Bulk toolbar появляется при selection ≥ 2, скрыт иначе.
4. ✅ Confirm dialog показывает превью merged name/model/comments.
5. ✅ Merge вызывает 1 PATCH + N-1 DELETE, selection сбрасывается.
6. ✅ Cross-section merge заблокирован (tooltip).
7. ✅ vitest: все зелёные (+ новый файл ~8 тестов).
8. ✅ `npx tsc --noEmit` + `npm run lint` clean.
9. ✅ Ручная проверка: загрузить spec-tabs через UI (после мержа E15.05 it2) → выделить 3 строки «П1/В 1 Приточно-вытяжная» → merge → получить 1 строку с полным именем.

---

## Ограничения

- **НЕ трогать** backend-модели / миграции.
- **НЕ трогать** shared файлы AC Rating.
- **НЕ использовать** DnD / sortable libs — простые checkbox + shift-click достаточно.
- Зависимость от E15.05 it2 **только для ручной валидации на spec-tabs** — unit-тесты и функционал работают независимо.

---

## Формат отчёта

1. Ветка и hash.
2. Скриншоты: (1) bulk toolbar с selection, (2) confirm dialog с preview, (3) результат после merge.
3. vitest результат + lint/tsc clean.
4. Известные ограничения (atomic merge — DEV-BACKLOG).
