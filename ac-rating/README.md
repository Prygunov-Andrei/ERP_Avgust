# AC Rating Integration — workspace

Рабочая папка проекта интеграции «Рейтинг кондиционеров» (от Максима) в ERP Avgust.

## Содержимое

| Путь | Что | В git |
|------|-----|-------|
| [`plan.md`](plan.md) | Большой план на 10 фаз, модель команды, шаблоны ТЗ | ✅ |
| [`brief-designer.md`](brief-designer.md) | Brief для Claude Design (публичная часть сайта) | ✅ |
| `reports/` | Отчёты агентов по завершённым фазам | ✅ |
| `review/` | Локальный git-репо Максима (`max7242110/ac-rating`, ветка `2026-03-25-xuef`) — не трогаем, нужен как источник | ❌ |
| `screenshots/` | Скрины для brief (AC Rating Максима + HVAC prod) | ❌ |
| `notes/` | Личные заметки Андрея | ❌ |

## Локальный стенд (Docker)

Контейнеры называются по имени этой папки (`ac-rating-*`), чтобы не конфликтовать с проектом Максима.

```bash
cd ac-rating/review

# Первый запуск
docker compose up -d db
docker compose exec -T db psql -U postgres -d ac_rating < ~/Downloads/ac_rating_2026-04-18.sql
docker compose up -d backend
docker compose exec -T backend python manage.py shell -c "from django.contrib.auth import get_user_model; U=get_user_model(); u=U.objects.get(username='admin'); u.set_password('admin'); u.is_superuser=True; u.is_staff=True; u.save()"

# Frontend локально (не в Docker — быстрее и без ловушки NEXT_PUBLIC_API_URL)
cd ../review/frontend
NEXT_PUBLIC_API_URL=http://localhost:8002/api NEXT_PUBLIC_SITE_URL=http://localhost:3002 PORT=3002 npm run dev

# Остановить
cd ac-rating/review && docker compose down
```

### Порты (нестандартные, чтобы не конфликтовать с ERP)
- PostgreSQL: `5434`
- Django backend: `http://localhost:8002`
- Django admin: `http://localhost:8002/admin/` (логин `admin`, пароль `admin`)
- Next.js frontend: `http://localhost:3002`

Данные и media хранятся в named volumes (`pgdata`, `backend_media`) — переживают `docker compose down`.

## Текущий статус

См. секцию «Журнал прогресса» в [`plan.md`](plan.md#6-журнал-прогресса).

## Для агента-программиста

Когда получишь ТЗ на фазу:
1. Работай в ветке `ac-rating/NN-short-name` (от `main`)
2. Следуй шаблону отчёта в [`plan.md`](plan.md#3-шаблон-тз-агенту) → секция 3
3. Итоговый отчёт клади в `ac-rating/reports/NN-short-name.md`
