# ТЗ: UI-08 — ширина столбцов таблицы сметы (перенос + resize + persist) (IS-Федя)

**Команда:** IS-Федя.
**Ветка:** `ismeta/ui-08-column-widths`.
**Worktree:** `ERP_Avgust_is_fedya_ui08_columns`.
**Приоритет:** 🟡 UX major (PO раздражается при QA 10-заходов).
**Срок:** 0.5–1 день.

---

## Контекст

QA-цикл 10-заходов (2026-04-23, заход 1/10), finding #45 (см. `ismeta/docs/QA-CYCLE-10-ROUNDS.md`):

> **PO:** «Если длинное наименование (и я его еще удлинняю), то столбец становится все шире, а остальные сужаются. Выглядит ужасно. В какой то момент должен произойти перенос текста, или скрытие части. Насколько сложно регулировать ширину столбцов перетягиванием? И фиксировать эту ширину между сессиями работы со сметой?»

Симптом (скрин): в spec-tabs строка 1 с 180+ символьным name («П1/В 1-Приточно-вытяжная установка... комплектно со см. узлом, пластинчатым рекуператором и стандартным комплектом автоматики») растягивает колонку «Наименование» далеко за viewport, численные столбцы сжимаются до нечитаемых.

**PO выбрал вариант C:** перенос + resize перетаскиванием + persistence между сессиями.

---

## Задача

### 1. CSS-перенос (base fix)

**Файл:** `ismeta/frontend/components/estimate/items-table.tsx`.

Колонка «Наименование» (id=`name`) и «Примечание» (id=`comments`) — добавить:
```tsx
{
  accessorKey: "name",
  header: "Наименование",
  size: 500,      // default (px)
  minSize: 200,   // не даём сжать ниже
  maxSize: 900,   // разумный потолок
  cell: ({ row }) => (
    <EditableCell
      value={row.original.name}
      onCommit={...}
      className="whitespace-normal break-words"  // NEW
    />
  ),
}
```

В `EditableCell` (если props.className поддерживается — ок; если нет — добавить optional `className?: string` prop и пробрасывать на wrapper). Display-mode должен рендерить многострочный текст, edit-mode — оставаться inline input.

Аналогично для name в cell и для `comments` в cell (уже имеет `whitespace-pre-wrap break-words` — проверить что работает).

**Для всех остальных колонок** — задать разумные `size` + `minSize` / `maxSize`:
- №, select, sort/actions: size 48, фиксированы (`enableResizing: false`).
- Основное оборудование: 32, фикс.
- Модель: 160, min 100, max 400.
- Ед.изм.: 80, min 60, max 150.
- Кол-во: 90, min 70, max 150. `text-align: right` оставить.
- Цена обор / мат / работ: 110 каждая, min 90, max 180.
- Итого: 120, min 100, max 200.
- Подбор: 130, min 100, max 200.
- Примечание: 200, min 120, max 500.

### 2. Resize by drag — TanStack Table native

TanStack Table v8 (используется в проекте): включить `columnResizing` feature.

```tsx
const table = useReactTable({
  data: visibleItems,
  columns,
  columnResizeMode: "onEnd",   // финальный commit при отпускании мыши
  enableColumnResizing: true,
  // ... existing getCoreRowModel и т.п.
  state: {
    ...existing,
    columnSizing,
  },
  onColumnSizingChange: setColumnSizing,
});
```

**Resize-handle** между колонками в TableHeader:

```tsx
<TableHead
  key={header.id}
  style={{ width: header.getSize() }}
  className="relative"
>
  {flexRender(header.column.columnDef.header, header.getContext())}
  {header.column.getCanResize() && (
    <div
      onMouseDown={header.getResizeHandler()}
      onTouchStart={header.getResizeHandler()}
      className={cn(
        "absolute right-0 top-0 h-full w-1 cursor-col-resize select-none",
        "hover:bg-primary/40",
        header.column.getIsResizing() && "bg-primary"
      )}
    />
  )}
</TableHead>
```

Визуальный handle — тонкая полоска справа от заголовка, hover-подсветка, drag-подсветка. Без библиотек, чистый TanStack.

### 3. Persistence через localStorage

**Ключ:** `ismeta.estimate-table.column-widths.v1` (глобально, не per-смета — настройка пользователя персистится во всех сметах).

**Загрузка при mount:**
```tsx
const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>(() => {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem("ismeta.estimate-table.column-widths.v1");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
});
```

**Сохранение при изменении** (debounced 300ms чтобы не писать на каждый pixel):
```tsx
const saveTimer = React.useRef<number | null>(null);
React.useEffect(() => {
  if (saveTimer.current) window.clearTimeout(saveTimer.current);
  saveTimer.current = window.setTimeout(() => {
    try {
      localStorage.setItem(
        "ismeta.estimate-table.column-widths.v1",
        JSON.stringify(columnSizing),
      );
    } catch {
      // quota exceeded / disabled — тихо пропускаем
    }
  }, 300);
  return () => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
  };
}, [columnSizing]);
```

**Версионирование ключа (`v1`):** если в будущем изменим state-shape — поднимем до v2, старые значения не поломают parse.

### 4. Reset ширины (опционально)

В header-row (или через context menu на заголовке) — кнопка «Сбросить ширину столбцов»:
```tsx
const resetColumnWidths = () => {
  setColumnSizing({});
  localStorage.removeItem("ismeta.estimate-table.column-widths.v1");
};
```

Где расположить? **Предлагаю:** не добавлять UI для reset в этом PR, достаточно **clear-via-localStorage-console** если кому понадобится. Добавим reset-кнопку если PO попросит.

### 5. Тесты

**Файл:** `ismeta/frontend/__tests__/column-widths.test.tsx` (новый).

- `test_column_default_widths` — render → таблица имеет ширины из `size` property.
- `test_long_name_wraps_does_not_overflow_column` — render с 200-символьным name → row.height > 1 line, но column.width <= maxSize (500).
- `test_resize_handle_renders` — handle visible для resizable columns (не для №, actions).
- `test_resize_updates_sizing_state` — `fireEvent.mouseDown` + `mouseMove` + `mouseUp` на handle → columnSizing обновилось.
- `test_resize_persists_to_localstorage` — после resize ждём 300ms debounce → localStorage содержит новое значение.
- `test_load_from_localstorage_on_mount` — pre-set localStorage → render → columns используют saved widths.
- `test_minSize_respected` — попытка drag до 50px на колонке minSize=100 → фиксируется на 100.
- `test_maxSize_respected` — аналогично для maxSize.

Mock localStorage через `vi.stubGlobal` или `jsdom` native support.

### 6. Визуальная проверка

Локально через dev-server + spec-tabs sample:
1. Загрузить сметы с длинным name — text **переносится** (не растягивает колонку).
2. Наведи курсор между заголовками — появляется resize-handle (col-resize cursor).
3. Drag — ширина меняется realtime.
4. Отпустить → сохранилось в localStorage.
5. F5 / новая вкладка смет → ширины восстановлены.

Скриншоты до/после в PR.

### 7. Совместимость с UI-04/06/07

- **UI-04 Модель/Примечание:** после resize ничего не ломается, просто ширины колонок управляемые.
- **UI-06 Merge Rows:** checkbox колонка `enableResizing: false` (фикс ширина 36).
- **UI-07 Search:** highlight в ячейке name работает в wrap-режиме (каждая строка текста с `<mark>`).

### 8. Гранди / защиты

- `columnSizing` state сохраняется **глобально** (не per-смета). Пользователь настроил таблицу — так она будет на всех сметах.
- `localStorage` ёмкость безопасная (несколько КБ), quota exceeded почти невозможен.
- SSR-safe: initializer проверяет `typeof window === "undefined"`.

---

## Приёмочные критерии

1. ✅ Длинное name **переносится** (не растягивает колонку), `max-width ~500-600px`.
2. ✅ Drag resize handles отображаются между заголовками, `col-resize` cursor, visible при hover, подсветка при drag.
3. ✅ `minSize` / `maxSize` соблюдаются.
4. ✅ `columnSizing` **persist'ится в localStorage** (debounced 300ms).
5. ✅ При mount ширины **загружаются из localStorage**.
6. ✅ Fixed-width колонки (№, select, actions, Основное оборудование) **не resizable**.
7. ✅ vitest зелёные (+ новый файл, ≥7 тестов).
8. ✅ `npx tsc --noEmit` + `npm run lint` clean.
9. ✅ Ручная проверка на spec-tabs через UI — текст не выходит за viewport, цифровые столбцы читаемы.

---

## Ограничения

- **НЕ трогать** backend.
- **НЕ трогать** shared CSS (`frontend/app/globals.css`, `frontend/app/layout.tsx`).
- **НЕ добавлять** reset-кнопку без запроса PO.
- **НЕ per-смета** persist — глобально по пользователю/браузеру.
- Backend-persist (user_preferences.column_widths) — отдельное обсуждение, в этом PR **не делаем**.

---

## Формат отчёта

1. Ветка и hash.
2. Скриншоты: до (длинный name растягивает) / после hotfix (переносится) / resize в процессе / после F5 с восстановленными ширинами.
3. vitest + tsc + lint.
4. Известные ограничения (reset UI, backend-persist) → в DEV-BACKLOG.
