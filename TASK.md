# TASK — Ф8B-2 frontend — UI пресетов «Свой рейтинг» + модерация отзывов

## Цель

Финальные две страницы раздела `HVAC-Рейтинг`:
1. `/hvac-rating/presets/` — CRUD пресетов «Свой рейтинг» (для публичной части портала).
2. `/hvac-rating/reviews/` — модерация отзывов (фильтр по статусу, PATCH status, bulk approve/reject).

Backend Ф8B-2 уже в main: endpoints под `/api/hvac/rating/presets/` и `/reviews/` (включая `POST /reviews/bulk-update/`).

После этой фазы — Ф8C (модерация submissions заявок), потом Ф8D (cleanup Django-admin), потом — батч-деплой.

---

## ⚠️ Урок Ф8A

Перед типами/формами — открой реальные сериализаторы:
- `backend/ac_methodology/admin_serializers.py:AdminRatingPresetSerializer`
- `backend/ac_reviews/admin_serializers.py:AdminReviewSerializer`
- `backend/ac_methodology/admin_views.py:RatingPresetAdminViewSet` — фильтры
- `backend/ac_reviews/admin_views.py:ReviewAdminViewSet, ReviewBulkUpdateView` — поведение

---

## 1. Sidebar — расширить блок «HVAC-Рейтинг»

Файл: `frontend/components/erp/components/Layout.tsx`.

В существующий блок `id: 'hvac-rating'` (твой из Ф8A+B-1) добавить 2 новых children в конец:

```tsx
{ id: 'hvac-rating-presets', label: 'Пресеты «Свой рейтинг»', icon: <Layers className="w-4 h-4" />, path: '/hvac-rating/presets', section: 'dashboard' },
{ id: 'hvac-rating-reviews', label: 'Отзывы (модерация)', icon: <MessageSquare className="w-4 h-4" />, path: '/hvac-rating/reviews', section: 'dashboard' },
```

В `pageTitles`:
```ts
'hvac-rating/presets': 'Пресеты «Свой рейтинг»',
'hvac-rating/presets/create': 'Новый пресет',
'hvac-rating/reviews': 'Отзывы (модерация)',
```

В `pathToParent`:
```ts
pathToParent['hvac-rating/presets'] = { label: 'HVAC-Рейтинг', path: '/hvac-rating/presets' };
pathToParent['hvac-rating/presets/create'] = { label: 'Пресеты', path: '/hvac-rating/presets' };
pathToParent['hvac-rating/presets/edit'] = { label: 'Пресеты', path: '/hvac-rating/presets' };
pathToParent['hvac-rating/reviews'] = { label: 'HVAC-Рейтинг', path: '/hvac-rating/reviews' };
```

`Layout.tsx` — shared с ISMeta, отметь в commit message.

---

## 2. Routes (Next.js App Router)

```
frontend/app/erp/hvac-rating/
  presets/
    page.tsx                  → ACPresetsPage
    create/page.tsx           → ACPresetEditor (mode="create")
    edit/[id]/page.tsx        → ACPresetEditor (mode="edit")
  reviews/
    page.tsx                  → ACReviewsPage   (без create/edit — только list + модерация inline)
```

Каждый — 6 строк thin-wrapper.

---

## 3. Service-слой — расширить `acRatingService.ts`

Добавь методы:

```ts
// presets
getPresets: (params?: { is_active?: 'true'|'false'; is_all_selected?: 'true'|'false'; search?: string; ordering?: string }) => /* GET /presets/ */,
getPreset: (id: number) => /* GET /presets/{id}/ */,
createPreset: (payload: ACPresetWritable) => /* POST /presets/ */,
updatePreset: (id: number, payload: Partial<ACPresetWritable>) => /* PATCH /presets/{id}/ */,
deletePreset: (id: number) => /* DELETE /presets/{id}/ */,

// reviews
getReviews: (params?: ReviewsListParams) => /* GET /reviews/ */,
getReview: (id: number) => /* GET /reviews/{id}/ */,
updateReviewStatus: (id: number, status: ReviewStatus) => /* PATCH /reviews/{id}/ */,
deleteReview: (id: number) => /* DELETE /reviews/{id}/ */,
bulkUpdateReviews: (review_ids: number[], status: ReviewStatus) => /* POST /reviews/bulk-update/ */,
```

---

## 4. Типы — расширить `acRatingTypes.ts`

```ts
// AdminRatingPresetSerializer
export interface ACPreset {
  id: number;
  slug: string;
  label: string;
  order: number;
  is_active: boolean;
  description: string;
  is_all_selected: boolean;
  criteria_count: number;     // -1 = «ВСЕ» (если is_all_selected)
  created_at: string;
  updated_at: string;
}

export interface ACPresetWritable {
  slug?: string;
  label: string;
  order?: number;
  is_active?: boolean;
  description?: string;
  is_all_selected?: boolean;
  criteria_ids?: number[];    // write-only массив ID критериев
}

// AdminReviewSerializer
export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export interface ACReview {
  id: number;
  model: number;
  model_brand: string;
  model_inner_unit: string;
  model_slug: string;
  author_name: string;
  rating: number;             // 1-5
  pros: string;
  cons: string;
  comment: string;
  status: ReviewStatus;
  ip_address: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReviewsListParams {
  status?: ReviewStatus;
  model?: number;
  rating?: number;
  search?: string;
  ordering?: string;
  page?: number;
}
```

Точные значения — сверяй с backend admin_serializers.

---

## 5. ACPresetsPage (`frontend/components/hvac/pages/ACPresetsPage.tsx`)

Простая таблица CRUD по образцу `ACBrandsPage.tsx`.

**Шапка:**
- Title «Пресеты «Свой рейтинг»»
- Кнопка «Добавить пресет» → `/hvac-rating/presets/create/`
- Информационный баннер: _«Пресеты определяют табы во вкладке "Свой рейтинг" на публичной странице (/rating-split-system/). is_all_selected=ВСЕ означает, что пресет автоматически включает все активные критерии активной методики.»_

**Фильтры:**
- `Select` is_active (Все / Активные / Архивные).
- `Switch` is_all_selected (Только «выбирает все»).
- `Input` search (по slug, label, debounce 300ms).
- Sort: order (default), created_at.

**Таблица:**
- Колонки: order / Label / Slug (моноширин) / Active (Switch read-only) / is_all_selected (Badge «ВСЕ» если true) / Кол-во критериев (criteria_count если ≥0, иначе «ВСЕ») / Действия (Edit, Delete с AlertDialog).

---

## 6. ACPresetEditor (`frontend/components/hvac/pages/ACPresetEditor.tsx`)

Простая форма по образцу `ACBrandEditor.tsx`.

**Поля:**
- slug (Input, required, unique). В edit-режиме оставь редактируемым (slug — публичный URL key, может потребоваться сменить).
- label (Input, required).
- order (Input type=number, default 0).
- is_active (Switch).
- description (Textarea).
- is_all_selected (Switch, при включении — секция criteria_ids скрывается / показывается с подписью «Игнорируется при is_all_selected=true»).
- criteria (Multi-select из списка критериев) — `acRatingService.getCriteria()`. Загрузи список один раз при mount.
  - В UI: список с чекбоксами, search filter по criterion.code/name_ru.
  - Группировка по `criterion.group` (climate, compressor, ...) — collapsible Card-секции.
  - `criteria_ids` отправляется в `createPreset/updatePreset` (write_only поле бэкенда).

**Сабмит:** PATCH в edit, POST в create. После create → `/hvac-rating/presets/edit/{newId}/`.

---

## 7. ACReviewsPage (`frontend/components/hvac/pages/ACReviewsPage.tsx`)

Главная страница модерации. Reference: `ACModelsPage.tsx` (фильтры + bulk-actions).

**Шапка:**
- Title «Отзывы (модерация)»
- Счётчик «Ожидают модерации: <pending_count>» (можно отдельным mini-fetch на `?status=pending&page_size=1` для count, или просто отображать count после загрузки текущей страницы).

**Фильтры:**
- `Tabs` или Toggle Group: «Все / На модерации / Одобрены / Отклонены» — главный фильтр (default «На модерации» — pending — это то что нужно модератору в первую очередь).
- `Select model` — список моделей через `acRatingService.getModels()` (опционально, для углублённой фильтрации).
- `Input search` — debounce 300ms.

**Таблица:**
- Колонки: Checkbox (для bulk) / Model (model_brand + model_inner_unit как ссылка на `/hvac-rating/models/edit/{model}/`) / Author / Rating (★★★☆☆) / Pros (truncate 100 chars) / Cons (truncate) / Status (Badge: pending=orange, approved=green, rejected=red) / Дата / Actions (View, Approve / Reject — disabled при текущем статусе, Delete).
- Click по строке → expand/dialog с полным текстом отзыва (pros, cons, comment, ip_address).

**Inline actions per row:**
- «Одобрить» (✓ green) → confirm → `updateReviewStatus(id, 'approved')` → toast + reload.
- «Отклонить» (✗ red) → confirm → `updateReviewStatus(id, 'rejected')`.
- «Удалить» (Trash) → AlertDialog confirm → `deleteReview(id)`.

**Bulk-actions** (когда selectedIds.length > 0):
- «Одобрить выбранные» → `bulkUpdateReviews(ids, 'approved')`.
- «Отклонить выбранные» → `bulkUpdateReviews(ids, 'rejected')`.
- «На модерацию» (вернуть в pending) → `bulkUpdateReviews(ids, 'pending')`.
- «Удалить выбранные» → AlertDialog → Promise.all delete.

**Empty / loading / error** — стандартные паттерны.

---

## 8. Тесты

- `ACPresetsPage.test.tsx` — рендерится, delete вызывает API.
- `ACPresetEditor.test.tsx` — create/edit, валидация label обязателен, criteria_ids синхронизируется в payload.
- `ACReviewsPage.test.tsx` — рендерится, фильтр по статусу шлёт `?status=`, inline approve вызывает PATCH, bulk approve вызывает POST bulk-update.

Минимум 3-4 теста на страницу.

---

## 9. Прогон

```bash
cd frontend
npx tsc --noEmit              # чисто
npm test -- --run AC          # все AC* зелёные (включая Ф8A+Ф8B-1)
```

Скриншоты через Playwright MCP — по возможности (presets-list, reviews-list с filter pending).

---

## Что НЕ делаем

- ❌ Submissions — Ф8C.
- ❌ Edit тела отзыва (pros/cons/comment) — backend сделал read-only намеренно.
- ❌ POST на /admin/reviews/ — отзывы создаются только публично через `/api/public/v1/rating/reviews/`.
- ❌ Не трогать публичный портал.

---

## Известные нюансы

1. **`acRatingApiClient`** через BFF proxy — переиспользуй (твой из Ф8A).
2. **`criteria_count = -1`** в API → отображай как «ВСЕ» в UI (если is_all_selected=true).
3. **Public links** к моделям из ACReviewsPage — используй `model_slug` для перехода в админский ACModelEditor (`/hvac-rating/models/edit/{model_id}/`), не на публичный портал.
4. **Bulk-update endpoint** — `POST /api/hvac/rating/reviews/bulk-update/` (не trailing slash после bulk-update, проверь в backend admin_urls.py).
5. **Default tab отзывов** = «pending» — модератор первым делом видит то что требует внимания.

---

## Формат отчёта

```
Отчёт — Ф8B-2 frontend (AC-Федя)

Ветка: ac-rating/f8b2-frontend (rebased на origin/main)
Коммиты:
  <git log --oneline main..HEAD>

Что сделано:
- ✅ Sidebar entries + breadcrumbs (Layout.tsx)
- ✅ Routes /hvac-rating/{presets,reviews}/...
- ✅ acRatingService + Types расширены (5 preset методов + 5 review методов)
- ✅ ACPresetsPage + ACPresetEditor (с criteria multi-select)
- ✅ ACReviewsPage (фильтры + inline actions + bulk-actions)
- ✅ <N> тестов

Что НЕ сделано:
- (если есть)

Прогон:
- npx tsc --noEmit: ok
- npm test: <X> passed
- (smoke в браузере: ok / не делал)

Скриншоты: [presets-list.png, reviews-list-pending.png]

Известные риски:
- ...

Ключевые файлы для ревью:
- frontend/components/hvac/services/acRatingService.ts
- frontend/components/hvac/services/acRatingTypes.ts
- frontend/components/hvac/pages/ACPresetsPage.tsx
- frontend/components/hvac/pages/ACPresetEditor.tsx
- frontend/components/hvac/pages/ACReviewsPage.tsx
- frontend/components/erp/components/Layout.tsx
- frontend/app/erp/hvac-rating/{presets,reviews}/... — wrappers
```
