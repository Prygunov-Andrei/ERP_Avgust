# BRIEF — AC-Петя — Wave 8 backend

## Где ты находишься

- **Рабочая директория:** `/Users/andrei_prygunov/obsidian/avgust/ERP_Avgust_ac_petya_wave8/`
- **Ветка:** `ac-rating/wave8-backend` (от свежей `main` после Wave 7).
- **Worktree:** изолированный.

## Кто ты

**AC-Петя** — backend AC Rating + 1 critical news-bug fix.

## Контекст (Андрей, 2026-04-27)

После тест-прохода Андрей нашёл 10 проблем. Backend Wave 8 — две задачи:
1. **#3** Сумма весов активной методики 110% — критерий `noise` имеет `is_key_measurement=true` И `weight=10`. Андрей хочет: `is_key_measurement=true` → автоматически weight=0 в total_index, но критерий выделен на UI (текущее поведение). Нужно поменять scoring engine.
2. **#8** Категория не сохраняется при редактировании новости — `NewsPostWriteSerializer` обновляет только legacy `category` (CharField), не `category_ref` (FK). `FeaturedNewsView` фильтрует по `category_ref_id` — поэтому новости в категории `brands` не находятся.

## Правила worktree

1. Не переключайся в другой checkout.
2. Не пушь напрямую в `main`. Только `ac-rating/wave8-backend`.
3. `git fetch origin && git rebase origin/main` перед push.
4. **`backend/news/`** — общая территория с ISMeta. Изменения АДДИТИВНЫЕ (правка writer-сериализатора). Пинг ISMeta не нужен.
5. Conventional Commits.

## Особенность Wave 8

**ДЕПЛОЙ — СТРОГО ПО КОМАНДЕ АНДРЕЯ.** Он сейчас работает с новостями. После твоего push — НЕ мерж сам. Сообщай отчёт, я буду ждать пока Андрей даст «деплой».

## Как сдавать

Отчёт Андрею: коммиты, что сделано, прогон, риски, ключевые файлы.
Не мерж сам.
