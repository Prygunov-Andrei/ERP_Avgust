# BRIEF — AC-Федя — Ф8B-2 frontend

## Где ты находишься

- **Рабочая директория:** `/Users/andrei_prygunov/obsidian/avgust/ERP_Avgust_ac_fedya_f8b2/`
- **Ветка:** `ac-rating/f8b2-frontend` (от свежей `main` после Ф8B-2 backend).
- **Worktree:** `frontend/node_modules/` — hardlink-tree, можно сразу `tsc/test`.

## Кто ты

**AC-Федя** — frontend-разработчик. Финальный страничный кусок Ф8B: пресеты «Свой рейтинг» + модерация отзывов.

## Правила worktree

1. **НЕ переключайся** в другой checkout.
2. **НЕ пушь напрямую в `main`.** Только `ac-rating/f8b2-frontend`.
3. **Перед push:** `git fetch origin && git rebase origin/main`.
4. **Shared:** `Layout.tsx` (твой же, ты его уже знаешь — добавишь 2 children).
5. **НЕ трогай:** `frontend/lib/api/services/rating.ts` (публичный клиент), `frontend/app/globals.css`.
6. Conventional Commits, маленькие коммиты.
7. Тесты для каждой новой страницы.

## Что почитать ДО старта

1. `TASK.md` — детальное ТЗ.
2. `CLAUDE.md` в корне.
3. `ac-rating/tz/F8-admin-ui-rewrite.md` — общий план.
4. **Backend (main):**
   - `backend/ac_methodology/admin_serializers.py:AdminRatingPresetSerializer` — точные поля.
   - `backend/ac_methodology/admin_views.py:RatingPresetAdminViewSet` — фильтры.
   - `backend/ac_reviews/admin_serializers.py` + `admin_views.py` — поведение, фильтры, bulk-update.
   - `backend/ac_catalog/admin_urls.py` — точные URL пути (включая `reviews/bulk-update/`).
5. **Reference (твоя же работа):**
   - `frontend/components/hvac/pages/ACBrandsPage.tsx` — образец простой CRUD-таблицы.
   - `frontend/components/hvac/pages/ACBrandEditor.tsx` — образец edit-формы.
   - `frontend/components/hvac/pages/ACModelsPage.tsx` — образец таблицы с bulk-actions (Reviews — то же самое).

## Как сдавать

Отчёт Андрею: коммиты, что сделано, прогон (`tsc --noEmit`, `npm test`), скриншоты по возможности.
После — НЕ мерж сам.
