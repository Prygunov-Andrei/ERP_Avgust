# F8-05: Публичная страница `hvac-info.com/ismeta`

**Команда:** IS-Федя (frontend)
**Effort:** 3-4 дня
**Зависимости:** 03 (backend API endpoints)

---

## Цель

Создать публичную страницу распознавания спецификаций на
`hvac-info.com/ismeta` (заглушка в верхнем меню уже существует).
В стиле существующих публичных страниц `news`, `rating-split-system`,
`quiet`. Использовать общие layout компоненты из `(hvac-info)/_components/`.

## Текущее состояние

- Public hvac-info.com routing в `frontend/app/(hvac-info)/`.
- Существующие страницы:
  - `(hvac-info)/news` — HVAC новости
  - `(hvac-info)/rating-split-system` — главная рейтинга
  - `(hvac-info)/quiet`, `(hvac-info)/price` — sub-rating страницы
- Layout группа `(hvac-info)` имеет общий header / footer
  через `_components/`.
- В верхнем меню — заглушка «ISMeta», ведёт никуда (404).

## Целевое состояние

### URL и navigation

- `/ismeta` — главная страница продукта (внутри Next.js route group `(hvac-info)`).
- Заглушка в верхнем меню активируется (заменяет 404 на реальную страницу).
- Breadcrumbs: `Главная > ISMeta`.

### UI макет (общий стиль с news/ratings)

```
┌──────────────────────────────────────────────────┐
│ [Header сайта hvac-info.com — общий]              │
├──────────────────────────────────────────────────┤
│                                                    │
│   ISMeta — распознавание спецификаций              │
│   Загрузите PDF спецификации ОВиК → получите      │
│   готовую таблицу позиций в Excel за 5 минут       │
│                                                    │
│   ┌────────────────────────────────────────────┐  │
│   │  Перетащите PDF сюда                       │  │
│   │  или нажмите для выбора                    │  │
│   │                                            │  │
│   │  Макс размер: 50 MB                        │  │
│   └────────────────────────────────────────────┘  │
│                                                    │
│   ▾ Дополнительные настройки                       │
│       Движок: [Быстрый (TD-17g) ▾]                 │
│       ИИ-модель: [OpenAI GPT-4o ▾]                 │
│       Email (опционально): [.................]    │
│                                                    │
│   [ Распознать → ]                                 │
│                                                    │
├── (после старта обработки) ─────────────────────┤
│                                                    │
│   ⏳ Обработка: страница 12 из 87 (≈18 мин)        │
│   [████████░░░░░░░░░░] 14%                         │
│                                                    │
├── (после завершения) ────────────────────────────┤
│                                                    │
│   ✅ Готово! Найдено 153 позиции на 9 страницах.   │
│   [ Скачать Excel ]   [ Загрузить новый PDF ]      │
│                                                    │
│   ┌─────────────────────────────────────────┐    │
│   │ Поз │ Наименование    │ Тип/Марка │ Кол-во │  │
│   │ 1   │ Сплит-система   │ AS-12HU   │ 1     │   │
│   │ 2   │ ...             │ ...       │ ...   │   │
│   └─────────────────────────────────────────┘    │
│   (preview первых 50 строк)                        │
│                                                    │
├── (форма обратной связи) ─────────────────────────┤
│                                                    │
│   Помог инструмент?  [👍 Да] [👎 Нет]              │
│   Что улучшить? [.....................]            │
│                                                    │
├──────────────────────────────────────────────────┤
│ [Footer + privacy disclaimer]                      │
└──────────────────────────────────────────────────┘
```

## Файлы которые создаём/меняем

### Создаём

#### `frontend/app/(hvac-info)/ismeta/page.tsx`
Главная страница ISMeta. Server component для SEO-friendly markup
(заголовки, описание). Внутри — client component с интерактивом.

#### `frontend/app/(hvac-info)/ismeta/_components/UploadZone.tsx`
Drag & drop зона. Использовать `react-dropzone` (если уже есть в
проекте) или native HTML5 drag events.

#### `frontend/app/(hvac-info)/ismeta/_components/SettingsPanel.tsx`
Collapsible панель «Дополнительные настройки»:
- Pipeline selector (`<select>` с 2 опциями)
- LLM profile selector (`<select>` динамически из API)
- Email input (опциональный)

#### `frontend/app/(hvac-info)/ismeta/_components/ProgressView.tsx`
Прогресс обработки. Polling через `setInterval` 2-3 сек.
- Прогресс-бар с процентом
- Текст «страница X из Y»
- ETA (на основе average time per page)

#### `frontend/app/(hvac-info)/ismeta/_components/ResultView.tsx`
Финальный результат:
- Сообщение «Найдено N позиций на M страницах»
- Кнопка «Скачать Excel» → GET `/api/hvac/ismeta/jobs/<id>/excel`
- Кнопка «Загрузить новый PDF» → reset state
- Превью первых 50 строк (table)

#### `frontend/app/(hvac-info)/ismeta/_components/FeedbackForm.tsx`
- 2 кнопки 👍/👎
- Comment text area (опционально)
- Email field (опционально, если хочет ответа)
- POST `/api/hvac/ismeta/feedback`

#### `frontend/app/(hvac-info)/ismeta/_components/FAQ.tsx` (опционально)
Раздел внизу: «Что мы делаем», «Какие PDF поддерживаются»,
«Где мои данные» (privacy reassurance).

### Меняем

#### `frontend/app/(hvac-info)/_components/Header.tsx` (или аналог)
Активировать ссылку «ISMeta» в верхнем меню — пока заглушка → ведёт
на `/ismeta`.

**Shared файл** — пинг команде AC Rating перед commit.

#### `frontend/app/(hvac-info)/layout.tsx`
Если требуется — добавить metadata для `/ismeta` route (title, description).

## State management

Используем простой React state (`useState` + `useReducer`) в главном
компоненте `page.tsx` (или отдельный hook `useIsmetaJob`):

```typescript
type JobState =
  | { status: "idle" }
  | { status: "uploading" }
  | { status: "processing"; jobId: string; pagesProcessed: number; pagesTotal: number }
  | { status: "done"; jobId: string; items: Item[]; itemsCount: number }
  | { status: "error"; message: string };
```

Polling `progress` endpoint через `useEffect` + `setInterval`.

## API integration

Создать TS-types и services:

#### `frontend/lib/api/types/hvac-ismeta.ts`
```typescript
export interface IsmetaOptions {
  pipelines: { id: string; label: string; default?: boolean }[];
  llm_profiles: { id: number; name: string; vision: boolean; default?: boolean }[];
}

export interface IsmetaJobProgress {
  status: "queued" | "processing" | "done" | "error" | "cancelled";
  pages_total: number;
  pages_processed: number;
  items_count: number;
  error_message: string;
}

export interface IsmetaJobResult {
  items: Item[];
  pages_stats: { total: number; processed: number; skipped: number };
  cost_usd: number;
}
```

#### `frontend/lib/api/services/hvac-ismeta.ts`
```typescript
export const hvacIsmetaService = {
  getOptions: () => apiGet<IsmetaOptions>("/api/hvac/ismeta/options"),
  parsePdf: (file: File, options: { pipeline?: string; llm_profile_id?: number; email?: string }) => {
    const fd = new FormData();
    fd.append("file", file);
    if (options.pipeline) fd.append("pipeline", options.pipeline);
    if (options.llm_profile_id) fd.append("llm_profile_id", options.llm_profile_id.toString());
    if (options.email) fd.append("email", options.email);
    return apiPost<{ job_id: string }>("/api/hvac/ismeta/parse", fd);
  },
  getProgress: (jobId: string) => apiGet<IsmetaJobProgress>(`/api/hvac/ismeta/jobs/${jobId}/progress`),
  getResult: (jobId: string) => apiGet<IsmetaJobResult>(`/api/hvac/ismeta/jobs/${jobId}/result`),
  downloadExcel: (jobId: string) => `/api/hvac/ismeta/jobs/${jobId}/excel`,  // direct link
  sendFeedback: (jobId: string, helpful: boolean, comment?: string, email?: string) =>
    apiPost("/api/hvac/ismeta/feedback", { job_id: jobId, helpful, comment, contact_email: email }),
};
```

## Acceptance criteria

### UI / UX
- [ ] Страница `/ismeta` загружается, в стиле news/ratings.
- [ ] Заглушка «ISMeta» в верхнем меню активирована (ведёт на /ismeta).
- [ ] Drag & drop: PDF файл можно перетащить или выбрать через клик.
- [ ] Validation на frontend: PDF only, ≤ 50 MB.
- [ ] Settings panel collapsible, default values корректные.
- [ ] Pipeline dropdown показывает 2 опции с tooltip-описанием
      («Быстрый — 5 мин, $0.36», «Точный — 1 час, $1-3»).
- [ ] LLM dropdown динамически загружается из `/api/hvac/ismeta/options`.
      Показывает 4-5 моделей.
- [ ] Email field опциональный, валидация format.
- [ ] Кнопка «Распознать» отправляет файл, показывает прогресс.

### Прогресс
- [ ] Прогресс-бар обновляется каждые 2-3 сек.
- [ ] «Страница X из Y» отображается как только pages_total известно.
- [ ] ETA рассчитывается (на основе average 5 sec/page для TD-17g
      или 30 sec/page для main).
- [ ] При ошибке (status=error) — показывается сообщение, кнопка
      «Попробовать снова».

### Результат
- [ ] При status=done — переход на ResultView.
- [ ] Текст «Найдено N позиций на M страницах».
- [ ] Кнопка «Скачать Excel» работает, даёт .xlsx файл.
- [ ] Превью первых 50 строк в HTML table.
- [ ] Кнопка «Загрузить новый PDF» → reset state, форма обновляется.

### Feedback
- [ ] Форма обратной связи показывается под результатом.
- [ ] 👍/👎 кнопки работают.
- [ ] Submit → POST в backend, toast «Спасибо за отзыв!».

### Concurrency error
- [ ] Если backend возвращает 429 («У вас уже идёт обработка») —
      показывается toast, кнопка disabled.
- [ ] Если статус «Сервис временно недоступен» (503) — показывается
      сообщение «Сервис на обслуживании, попробуйте позже».

### Mobile / responsive
- [ ] На mobile (< 768px) — UI usable, drag & drop fallback на file
      input click.
- [ ] Settings panel collapsible на mobile.

### SEO
- [ ] `<title>` = "ISMeta — распознавание спецификаций ОВиК | hvac-info.com".
- [ ] `<meta description>` = краткое описание сервиса.
- [ ] `<h1>` = "ISMeta — распознавание спецификаций".
- [ ] Open Graph tags для соц. шеринга.

### Privacy
- [ ] Внизу страницы — короткий disclaimer:
      «Загруженные PDF используются только для распознавания.
      Мы не передаём данные третьим лицам.»

## Тест-план

1. **Загрузка:** drag & drop PDF Spec-1 → видим прогресс.
2. **Прогресс update:** дождаться завершения (3-5 мин на TD-17g) →
   видим «Готово, 153 позиции».
3. **Excel download:** клик «Скачать Excel» → получили .xlsx с 153 строками.
4. **Превью table:** первые 50 строк показаны корректно (имя, модель, qty).
5. **New PDF:** клик «Загрузить новый PDF» → форма resetся.
6. **Concurrency:** запустить 2-й parse в новой вкладке (тот же
   browser/IP) → получаем сообщение об ошибке.
7. **Pipeline switch:** выбрать «Точный» (main) → процесс длится дольше,
   но результат корректный.
8. **LLM switch:** выбрать DeepSeek → recognition работает.
9. **Email опция:** заполнить email + загрузить → получаем
   подтверждение «Email сохранён, пришлём ссылку».
10. **Feedback:** клик 👍 → toast «Спасибо», запись в БД.
11. **Mobile:** открыть на телефоне (Chrome DevTools mobile emulation)
    → UI usable.
12. **SEO:** view-source → title, meta, og: tags корректные.

## Риски

- **Long polling load:** при 100+ одновременных пользователях —
  100+ polling раз в 2 сек = 50 RPS. Mitigation: использовать
  `If-Modified-Since` или Server-Sent Events (SSE).
- **PDF preview size:** превью 50 строк в HTML — может быть много
  данных при больших spec (1500 items × ~200 bytes = 300 KB). OK.
- **Excel generation:** xlsx может быть большой для Spec-4 (1250
  rows × 9 cols). Backend Этап 03 это учитывает.
- **Browser refresh во время обработки:** cookie сохраняет
  jobId — на refresh показывать last-active job. Опционально для
  v1, можно отложить.

## Definition of Done

- Страница `/ismeta` живёт в публичной части hvac-info.com.
- UI compatible со стилем news/ratings.
- Все 4 этапа жизненного цикла (idle → uploading → processing → done/error)
  работают.
- Excel download работает.
- Feedback форма работает.
- Mobile responsive.
- All acceptance criteria passing.
- Пинг команде AC Rating отправлен ДО merge (header.tsx shared).
