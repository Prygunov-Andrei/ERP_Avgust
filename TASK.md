# TASK — Ф8C frontend — UI модерации submissions заявок

## Цель

Финальная страница раздела `HVAC-Рейтинг`:
- `/hvac-rating/submissions/` — модерация заявок (фильтры по статусу, photo gallery preview, inline approve/reject + convert-to-acmodel + bulk-actions).

После этой фазы остаётся только Ф8D (cleanup Django-admin) — backend-only.

---

## ⚠️ Урок Ф8A

Перед типами/формами — открой реальные сериализаторы:
- `backend/ac_submissions/admin_serializers.py` — `AdminSubmissionListSerializer`, `AdminSubmissionDetailSerializer`, `AdminSubmissionPhotoSerializer`.
- `backend/ac_submissions/admin_views.py` — фильтры (status, brand, has_brand, search) + endpoints.

---

## 1. Sidebar — добавить 1 child в HVAC-Рейтинг

Файл: `frontend/components/erp/components/Layout.tsx`.

В существующий блок `id: 'hvac-rating'` добавь child в конец:

```tsx
{ id: 'hvac-rating-submissions', label: 'Заявки', icon: <Inbox className="w-4 h-4" />, path: '/hvac-rating/submissions', section: 'dashboard' },
```

В `pageTitles`:
```ts
'hvac-rating/submissions': 'Заявки (модерация)',
```

В `pathToParent`:
```ts
pathToParent['hvac-rating/submissions'] = { label: 'HVAC-Рейтинг', path: '/hvac-rating/submissions' };
```

---

## 2. Routes

```
frontend/app/erp/hvac-rating/submissions/
  page.tsx                  → ACSubmissionsPage   (без edit/create — только list + Dialog для деталей)
```

6-строчный thin-wrapper.

---

## 3. Service — расширить `acRatingService.ts`

```ts
// submissions
getSubmissions: (params?: SubmissionsListParams) => /* GET /submissions/ */,
getSubmission: (id: number) => /* GET /submissions/{id}/ */,
updateSubmission: (id: number, payload: { status?: SubmissionStatus; admin_notes?: string; brand?: number | null }) =>
  /* PATCH /submissions/{id}/ */,
deleteSubmission: (id: number) => /* DELETE /submissions/{id}/ */,
bulkUpdateSubmissions: (submission_ids: number[], status: SubmissionStatus) =>
  /* POST /submissions/bulk-update/ */,
convertSubmission: (id: number) => /* POST /submissions/{id}/convert-to-acmodel/ */,
```

---

## 4. Типы — расширить `acRatingTypes.ts`

```ts
export type SubmissionStatus = 'pending' | 'approved' | 'rejected';

// AdminSubmissionListSerializer
export interface ACSubmissionListItem {
  id: number;
  status: SubmissionStatus;
  brand_name: string;             // FK→name или custom_brand_name или «—»
  series: string;
  inner_unit: string;
  outer_unit: string;
  nominal_capacity_watt: number;
  price: string | null;
  submitter_email: string;
  photos_count: number;
  primary_photo_url: string;
  converted_model_id: number | null;
  created_at: string;
  updated_at: string;
}

// AdminSubmissionDetailSerializer (полный)
export interface ACSubmissionDetail {
  id: number;
  status: SubmissionStatus;
  brand: number | null;
  brand_name: string;
  custom_brand_name: string;
  series: string;
  inner_unit: string;
  outer_unit: string;
  compressor_model: string;
  nominal_capacity_watt: number;
  price: string | null;
  
  // характеристики (read-only)
  drain_pan_heater: string;
  erv: boolean;
  fan_speed_outdoor: boolean;
  remote_backlight: boolean;
  fan_speeds_indoor: number;
  fine_filters: number;
  ionizer_type: string;
  russian_remote: string;
  uv_lamp: string;
  
  // теплообменники
  inner_he_length_mm: number;
  inner_he_tube_count: number;
  inner_he_tube_diameter_mm: number;
  inner_he_surface_area: number;
  outer_he_length_mm: number;
  outer_he_tube_count: number;
  outer_he_tube_diameter_mm: number;
  outer_he_thickness_mm: number;
  outer_he_surface_area: number;
  
  // ссылки
  video_url: string;
  buy_url: string;
  supplier_url: string;
  
  // автор + модерация
  submitter_email: string;
  ip_address: string | null;
  admin_notes: string;             // writable
  
  // фото
  photos: ACSubmissionPhoto[];
  
  // конверсия
  converted_model: number | null;
  converted_model_id: number | null;
  
  created_at: string;
  updated_at: string;
}

export interface ACSubmissionPhoto {
  id: number;
  image_url: string;
  order: number;
}

export interface SubmissionsListParams {
  status?: SubmissionStatus;
  brand?: number;
  has_brand?: 'true' | 'false';
  search?: string;
  ordering?: string;
  page?: number;
}

export interface ConvertSubmissionResponse {
  submission_id: number;
  created_model_id: number;
  created_model_slug: string;
  created_brand: boolean;
  redirect_to: string;             // например '/hvac-rating/models/edit/42/'
}
```

Точные значения — сверяй с backend admin_serializers.

---

## 5. ACSubmissionsPage (`frontend/components/hvac/pages/ACSubmissionsPage.tsx`)

Главная страница. Reference: `ACReviewsPage.tsx` — почти всё то же.

**Шапка:**
- Title «Заявки на добавление кондиционеров»
- Счётчик «Ожидают модерации: <pending_count>».

**Фильтры:**
- `Tabs` или Toggle Group: «Все / На модерации / Одобренные / Отклонённые». Default — pending.
- `Select` has_brand: «Все / С брендом / Без бренда (custom_brand_name)» — для воркфлоу модератора привязывать «бренд не из списка».
- `Input search` — debounce 300ms по inner_unit/outer_unit/series/email/custom_brand_name.

**Таблица:**
- Колонки: Checkbox (bulk) / Photo thumb (40×40 first photo) / Бренд (brand_name) / Inner Unit / Series / Мощность (W) / Email отправителя / Status (Badge) / Конвертирована? (если converted_model_id — Link на `/hvac-rating/models/edit/{converted_model_id}/`) / Created / Действия.

**Inline actions per row:**
- «Просмотр» (Eye icon) — открывает Dialog с полным телом заявки (см. ниже).
- «Одобрить» — confirm → `updateSubmission(id, { status: 'approved' })`. **Не запускает конверсию** (это отдельная кнопка).
- «Отклонить» — confirm → `updateSubmission(id, { status: 'rejected' })`.
- «Конвертировать» (Wand icon) — confirm dialog «Создать ACModel из этой заявки?»:
  - Если `converted_model_id` уже есть → кнопка disabled, tooltip «Уже сконвертирована».
  - Если `brand === null && custom_brand_name === ''` → disabled, tooltip «Сначала привяжите бренд (открой Просмотр)».
  - На клик → `convertSubmission(id)` → toast.success «Создана модель «<inner_unit>»» → redirect через `useNavigate()` на `response.redirect_to` (`/hvac-rating/models/edit/{id}/`).
- «Удалить» — AlertDialog confirm.

**Bulk-actions** (когда selectedIds.length > 0):
- «Одобрить выбранные» / «Отклонить выбранные» / «Удалить выбранные» — как в ACReviewsPage.
- **НЕ делаем bulk-конвертацию** — конверсия сложная, может упасть на одной из заявок и оставить остальные в неопределённом состоянии.

**Empty / loading / error** — стандарт.

---

## 6. Dialog с деталями заявки

Открывается по «Просмотр» или click по строке. Read-only большая часть, writable — только status, admin_notes, brand.

**Секции:**

1. **Тех.характеристики** (read-only, grid):
   - Бренд (если brand_name пустое и есть custom_brand_name → выделить yellow/warning, показать «Бренд не привязан, custom: <custom_brand_name>»).
   - Series, Inner Unit, Outer Unit, Compressor Model, Nominal Capacity (W), Price.
   - drain_pan_heater, erv (Yes/No), fan_speed_outdoor, remote_backlight, fan_speeds_indoor, fine_filters, ionizer_type, russian_remote, uv_lamp.
   - Inner / Outer теплообменники (length, tube_count, diameter, surface_area, thickness).
   - URLs: video_url, buy_url, supplier_url (как clickable Link).

2. **Фото галерея:**
   - Grid превью (5-15 фото обычно).
   - Click по фото → fullscreen Dialog с навигацией стрелками (можно использовать существующие UI primitives или простой `<img>` в Dialog).

3. **Автор + модерация:**
   - submitter_email (mailto:).
   - ip_address (read-only, для борьбы со спамом).
   - **Brand (writable Select)** — список брендов через `getBrands()`. Можно установить или сменить. После save submission.brand обновится.
   - **admin_notes (Textarea, writable)** — заметки модератора.
   - status (read-only в Dialog — меняется через inline actions в таблице).

4. **Конверсия:**
   - Если `converted_model_id` есть → Card с `Link` на `/hvac-rating/models/edit/{id}/` + label «Уже сконвертирована».
   - Если нет — кнопка «Создать ACModel из этой заявки» (та же что в таблице, дублируется для удобства).

**Кнопки внизу Dialog:**
- «Сохранить заметки/бренд» — PATCH с admin_notes/brand.
- «Закрыть».

---

## 7. Тесты

Минимум:
- `ACSubmissionsPage.test.tsx` — рендерится, фильтр по status шлёт `?status=`, inline approve вызывает PATCH, convert вызывает POST + navigate, bulk approve вызывает POST bulk-update.

3-4 теста, как в ACReviewsPage.test.tsx.

---

## 8. Прогон

```bash
cd frontend
npx tsc --noEmit              # чисто
npm test -- --run AC          # все AC* зелёные
```

---

## Что НЕ делаем

- ❌ Edit submission body (характеристики) — read-only по решению backend.
- ❌ POST submission через admin — публичный endpoint уже есть.
- ❌ Bulk-конвертация — слишком сложно для MVP.
- ❌ Не трогать публичный портал.

---

## Известные нюансы

1. **`apiClient` через BFF proxy** `/api/ac-rating-admin/...` — переиспользуй.
2. **Convert response → redirect** через `useNavigate` (или `Link` если хочется). После успешной конверсии модератор должен сразу попасть в редактор созданной модели — там обычно нужно докрутить editorial-поля, photo upload и пр.
3. **Photo gallery** — список SubmissionPhoto обычно 5-15. Простой Grid + click для fullscreen Dialog. Не нужно react-image-gallery — встроенный shadcn Dialog хватит.
4. **Brand reassignment перед конверсией** — критичный workflow. Заявка часто приходит с custom_brand_name, модератор смотрит, ищет совпадение в существующих брендах, привязывает FK, ТОЛЬКО ПОТОМ конвертирует. Делай этот flow удобным.
5. **`useHvacAuth`** — checkь `user?.is_staff === true`.

---

## Формат отчёта

```
Отчёт — Ф8C frontend (AC-Федя)

Ветка: ac-rating/f8c-frontend (rebased на origin/main)
Коммиты:
  <git log --oneline main..HEAD>

Что сделано:
- ✅ Sidebar entry «Заявки» + breadcrumbs (Layout.tsx)
- ✅ Route /hvac-rating/submissions/
- ✅ acRatingService + Types расширены (6 методов)
- ✅ ACSubmissionsPage — таблица + filters + inline actions + bulk + Dialog
- ✅ <N> тестов

Что НЕ сделано:
- (если есть)

Прогон:
- npx tsc --noEmit: ok
- npm test: <X> passed
- (smoke в браузере: ok / не делал)

Скриншоты: [submissions-list-pending.png, submission-detail-dialog.png]

Известные риски:
- ...

Ключевые файлы для ревью:
- frontend/components/hvac/pages/ACSubmissionsPage.tsx
- frontend/components/hvac/services/acRatingService.ts
- frontend/components/hvac/services/acRatingTypes.ts
- frontend/components/erp/components/Layout.tsx
- frontend/app/erp/hvac-rating/submissions/page.tsx
```
