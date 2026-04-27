# BRIEF — AC-Федя — Wave 9 frontend

## Где ты находишься

- **Рабочая директория:** `/Users/andrei_prygunov/obsidian/avgust/ERP_Avgust_ac_fedya_wave9/`
- **Ветка:** `ac-rating/wave9-frontend` (от свежей `main` после Wave 9 backend).
- **Worktree:** `frontend/node_modules/` — hardlink-tree.

## Кто ты

**AC-Федя** — frontend AC Rating + критичные news-баги. Wave 9 frontend — 3 задачи:

1. **Динамические категории news** (главное Wave 9): NewsEditor Select из API getNewsCategories(), HvacNewsCategory → `string`.
2. **NewsEditor dark mode**: RichTextEditor текст не читается в темной (нет `dark:prose-invert`).
3. **Дубль hero/body на странице новости**: hero берёт image+lede из body, body рендерит то же.

## Контекст (Андрей, 2026-04-27)

После Wave 9 backend (Петя смержил) `NewsPost.category` принимает любой slug. Теперь UI должен:
- Показывать в Select **динамический** список из NewsCategory (не hardcoded enum).
- Для категорий с длинным/нестандартным slug — корректно отображать через `category_object.name`.

Параллельно — 2 баг-фикса по теме новостей.

## Правила worktree

1. Не переключайся.
2. Не пушь напрямую в `main`. Только `ac-rating/wave9-frontend`.
3. `git fetch origin && git rebase origin/main` перед push.
4. Conventional Commits.

## Особенность Wave 9

**ДЕПЛОЙ — СТРОГО ПО КОМАНДЕ АНДРЕЯ.** Он работает с новостями. После твоего push — НЕ мерж сам.

## Как сдавать

Отчёт Андрею: коммиты, что сделано, прогон, скриншоты.
Не мерж сам.
