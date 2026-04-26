# BRIEF — AC-Федя — Ф8C frontend

## Где ты находишься

- **Рабочая директория:** `/Users/andrei_prygunov/obsidian/avgust/ERP_Avgust_ac_fedya_f8c/`
- **Ветка:** `ac-rating/f8c-frontend` (от свежей `main` после Ф8C backend).
- **`frontend/node_modules/`** — hardlink-tree.

## Кто ты

**AC-Федя** — frontend AC Rating. Финальная фаза UI Ф8: модерация заявок submissions.

## Правила worktree

1. Не переключайся в другой checkout.
2. Не пушь напрямую в `main`. Только `ac-rating/f8c-frontend`.
3. `git fetch origin && git rebase origin/main` перед push.
4. Shared (`Layout.tsx`) — добавляешь 1 child + breadcrumbs.
5. Не трогай публичный клиент (`frontend/lib/api/services/rating.ts`).
6. Conventional Commits, маленькие коммиты.

## Что почитать ДО старта

1. `TASK.md` — детальное ТЗ.
2. `CLAUDE.md` в корне.
3. **Backend (main):**
   - `backend/ac_submissions/admin_serializers.py` — точные поля.
   - `backend/ac_submissions/admin_views.py` — фильтры (status, brand, has_brand, search).
   - `backend/ac_catalog/admin_urls.py` — URL пути (включая `submissions/bulk-update/` и `submissions/{id}/convert-to-acmodel/`).
4. **Reference (твоя же работа):**
   - `frontend/components/hvac/pages/ACReviewsPage.tsx` — самый близкий референс (модерация со статусами + bulk + inline). Submissions — то же самое + photo gallery + convert action.
   - `frontend/components/hvac/services/acRatingService.ts` — расширяешь его.

## Как сдавать

Отчёт Андрею: коммиты, что сделано, прогон, риски. Не мерж сам.
