# Загрузка данных рейтинга (ac-rating SQL-дамп)

Эта инструкция — для **локальной** разворачивалки данных Максима в свежей dev-БД ERP. Прод-загрузку делает Андрей через deploy-скрипт (Ф10).

## Что мы делаем

1. Создаём отдельную dev-базу (НЕ трогая `finans_assistant` от прод-туннеля).
2. Прогоняем все миграции ERP.
3. Грузим SQL-дамп Максима через `manage.py load_ac_rating_dump`.
4. Вытаскиваем медиа-файлы из Docker volume Максимовского стенда.
5. Smoke-проверка.

⚠️ **Никогда** не запускай `load_ac_rating_dump` с `DB_PORT=15432` или подобным — это SSH-туннель в прод-БД ERP. Команда печатает `Target DB: HOST=...:PORT, NAME=...` в первой строке вывода — **читай и проверяй**.

---

## 1. Подготовка

```bash
# Скачать дамп от Максима (если ещё нет)
ls ~/Downloads/ac_rating_2026-04-18.sql

# Создать локальную dev-БД (postgres на :5432, не туннель)
createdb -h localhost -p 5432 -U postgres finans_assistant_dev
```

## 2. Миграции ERP в dev-БД

```bash
cd backend
DB_HOST=localhost DB_PORT=5432 DB_USER=postgres DB_PASSWORD=postgres \
  DB_NAME=finans_assistant_dev \
  ./venv/bin/python manage.py migrate
```

Это создаст все таблицы ERP (включая 16 ac_*). Займёт пару минут на чистой БД.

## 3. Загрузка дампа

```bash
DB_HOST=localhost DB_PORT=5432 DB_USER=postgres DB_PASSWORD=postgres \
  DB_NAME=finans_assistant_dev \
  ./venv/bin/python manage.py load_ac_rating_dump \
    ~/Downloads/ac_rating_2026-04-18.sql \
    --truncate --recalculate --yes-i-am-sure
```

Что произойдёт:
- Прочтёт 647KB plain SQL.
- Найдёт 16 наших таблиц (плюс выведет список 15 «пропущено»: auth, django_, core_, ratings_, methodology_criteriongroup).
- `TRUNCATE ac_* RESTART IDENTITY CASCADE`, потом `COPY` каждой таблицы в нужную ac_*-цель.
- Обнулит `triggered_by_id` / `entered_by_id` / `approved_by_id` (FK на пользователей Максима, которых у нас нет).
- Обновит `pg_get_serial_sequence` для каждой таблицы с id.
- Запустит `recalculate_all` → пересчитает `total_index` по активной методике.

Финальная строка должна быть вида:
```
Загрузка завершена: 1303 строк в 16 таблиц.
Пересчитано 27 моделей, total_index в диапазоне [20.39, 78.85].
```

Если `--truncate` не передал и БД не пустая — команда упадёт с `CommandError: Целевые таблицы уже содержат данные`. Это защита от случайной перезаписи.

Без `--yes-i-am-sure` и без `--dry-run` команда печатает Target DB и просит подтверждения — данные не пишутся.

## 4. Медиа-файлы (фото моделей и заявок)

Записи в БД ссылаются на `ac_rating/photos/<file>.jpg`, `ac_rating/brands/<file>.png`, `ac_rating/submissions/<file>.jpg`. Сами файлы лежат в Docker-volume Максимовского стенда `maksim_rating_review_backend_media`.

Достаём через `docker run`:

```bash
docker run --rm \
  -v maksim_rating_review_backend_media:/src \
  -v /Users/andrei_prygunov/obsidian/avgust/ERP_Avgust/backend/media:/dst \
  alpine cp -a /src/ac_rating/. /dst/ac_rating/
```

Структура у Максима совпадает с нашими `upload_to`-путями — копируем 1-в-1.

Если volume называется иначе — найди:
```bash
docker volume ls | grep -i media
```

## 5. Smoke-проверка

```bash
# Стартуй runserver на dev-БД
DB_HOST=localhost DB_PORT=5432 DB_USER=postgres DB_PASSWORD=postgres \
  DB_NAME=finans_assistant_dev \
  ./venv/bin/python manage.py runserver 0.0.0.0:8000
```

Открой:
- `http://localhost:8000/admin/ac_catalog/acmodel/` — должен показать ~27 моделей.
- `http://localhost:8000/admin/ac_methodology/methodologyversion/` — 3 версии, одна активная.
- `http://localhost:8000/api/public/v1/rating/models/` — публичный JSON.
- `http://localhost:8000/api/public/v1/rating/methodology/` — методика с критериями.

Если фотки в админке отображаются (карточка модели → инлайн «Фото модели») — значит media раскатилось.

## 6. Сверка с продом Максима

Открой `https://hvac-info.com/v2/` (его прод). Возьми 3-5 моделей, сверь `total_index`. Расхождение < 0.1 ожидаемое. Если больше — что-то не так с активной методикой.

---

## Откат

```bash
# Сбросить ac_*-данные, сохранив миграции
DB_HOST=localhost DB_PORT=5432 DB_USER=postgres DB_PASSWORD=postgres \
  DB_NAME=finans_assistant_dev \
  ./venv/bin/python manage.py shell -c "
from django.db import connection
tables = ['ac_brands_brand', 'ac_brands_brandoriginclass', 'ac_catalog_acmodel',
          'ac_catalog_acmodelphoto', 'ac_catalog_acmodelsupplier', 'ac_catalog_equipmenttype',
          'ac_catalog_modelrawvalue', 'ac_catalog_modelregion',
          'ac_methodology_criterion', 'ac_methodology_methodologycriterion',
          'ac_methodology_methodologyversion', 'ac_reviews_review',
          'ac_scoring_calculationresult', 'ac_scoring_calculationrun',
          'ac_submissions_acsubmission', 'ac_submissions_submissionphoto']
with connection.cursor() as c:
    c.execute(f'TRUNCATE {\",\".join(tables)} RESTART IDENTITY CASCADE')
print('cleared')
"
```

Или просто `dropdb finans_assistant_dev && createdb ... && migrate`.

---

## Аргументы команды (справочник)

| Флаг | Назначение |
|---|---|
| `<path-to-sql>` (обяз.) | путь к pg_dump-файлу |
| `--dry-run` | парсинг + статистика, без записи |
| `--truncate` | TRUNCATE ac_* RESTART IDENTITY CASCADE перед загрузкой |
| `--recalculate` | после загрузки → `recalculate_all` (нужна активная методика) |
| `--yes-i-am-sure` | обязателен в non-dry-run; защита от прод-инцидента |

## Что команда НЕ делает

- Не грузит `auth_user` Максима — наши пользователи остаются нетронуты.
- Не грузит `core_auditlog`, `core_page` — у ERP свои.
- Не грузит legacy `ratings_*` — выкинули в Ф0.
- Не грузит `methodology_criteriongroup` — deprecated в Ф2.
- Не копирует медиа-файлы — это шаг 4 выше, делается отдельно.
