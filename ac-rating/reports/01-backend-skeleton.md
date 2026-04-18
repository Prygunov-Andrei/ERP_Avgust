# Фаза 1: Backend foundation — отчёт

**Ветка:** `ac-rating/01-backend-skeleton` (от `main`)
**Дата:** 2026-04-18

**Коммиты** (`git log --oneline main..HEAD`):

- `4546d4c` chore(ac-rating): add planning artifacts and workspace gitignore
- `4511d73` feat(ac-rating): scaffold 6 ac_* Django apps under /rating/ prefixes
- (+ этот отчёт отдельным docs-коммитом)

## Что сделано

- Создан каркас 6 Django apps через `manage.py startapp`: `ac_brands`, `ac_catalog`, `ac_methodology`, `ac_scoring`, `ac_reviews`, `ac_submissions`. В каждой стандартные `__init__.py / admin.py / apps.py / models.py / views.py / migrations/__init__.py` — моделей/роутов/админок пока нет (это фазы 2-4).
- `tests/` оформлены как пакет (а не файл) с `__init__.py` — соответствует конвенции ERP (см. `backend/catalog/tests/`). Файл `tests.py`, созданный `startapp`, удалён.
- Apps зарегистрированы в `backend/finans_assistant/settings.py:INSTALLED_APPS` отдельным блоком «Рейтинг кондиционеров» в самом конце списка.
- В `backend/finans_assistant/urls.py` подключены две URL-ноды с пустыми `urlpatterns = []`:
  - `/api/public/v1/rating/` → `ac_catalog.public_urls` (namespace `ac_rating_public`)
  - `/api/hvac/rating/` → `ac_catalog.admin_urls` (namespace `ac_rating_admin`)

  Префикс `rating/` размещён **перед** существующим `api/public/v1/` → `api_public.urls`, чтобы гарантированно матчиться первым (проверено через `django.urls.resolve`).
- `backend/requirements.txt`: добавлен `django-ratelimit>=4.1.0`. `openpyxl>=3.1.0`, `xlrd>=2.0.1`, `Pillow>=10.0.0` уже были.
- Создан каркас медиа-каталогов в `backend/media/ac_rating/`: `photos/`, `brands/`, `submissions/` — каждая содержит `.gitkeep`.
- `.gitignore` обновлён:
  - исключения для `ac-rating/` workspace (треится `plan.md`, `brief-designer.md`, `README.md`, `reports/`; игнорятся `review/`, `screenshots/`, `notes/`);
  - негативное правило для `backend/media/ac_rating/*/.gitkeep`, чтобы каркас медиа-каталогов попал в репозиторий несмотря на общий `/backend/media/*`.

### О `TimestampMixin`

В плане и в ТЗ упоминается `TimestampMixin` из ERP, но фактически в `backend/core/` используется абстрактная модель `TimestampedModel` (`backend/core/models.py:14`) — ей и нужно наследовать в фазе 2 (там, где нужны `created_at` / `updated_at`). Есть также пустой `class TimestampMixin: pass` в `backend/core/mixins.py:314` — это, судя по виду, зарезервированное имя-заглушка, **не используйте его**. Для фазы 1 ничего не импортируется — просто фиксирую факт для фазы 2.

## Что НЕ сделано

- Модели, миграции, фабрики, admin-регистрации, сериализаторы, views — **по ТЗ это фазы 2-4**, здесь осознанно не трогалось.
- Полный прогон `pytest` не удалось выполнить: БД ERP подключена через SSH-туннель (localhost:15432), который в момент работы не был поднят (`nc -zv localhost 15432` → refused), а тесты вне пары чисто-утилитных модулей требуют реальный PostgreSQL. Подробности — ниже в «Результатах проверок».

## Результаты проверок

| Проверка | Команда | Результат |
|---|---|---|
| `manage.py check` | `./venv/bin/python manage.py check` | ✅ `System check identified no issues (0 silenced).` |
| `makemigrations --dry-run` | `./venv/bin/python manage.py makemigrations --dry-run` | ✅ `No changes detected` (warning про отсутствие БД-соединения — фоновый, не влияет на dry-run) |
| `pytest --collect-only` | `./venv/bin/python -m pytest --collect-only` | ✅ `1772 tests collected` без ошибок импорта (Django setup чистый) |
| `pytest` (частично, без DB) | `./venv/bin/python -m pytest core/tests/test_text_utils.py --no-cov` | ✅ `13 passed` — smoke-сигнал, что сборка не сломана |
| `pytest` (полный) | — | ⚠️ Не запущен: SSH-туннель `:15432` не активен, а тесты с фикстурой `db` требуют Postgres. **Рекомендация:** запустить `./dev-local.sh` и прогнать `cd backend && pytest` перед мержем. |
| URL-резолвер | `django.urls.resolve('/api/public/v1/rating/')` | ✅ `Resolver404` (prefix зарегистрирован, роутов нет) |
| URL-резолвер | `django.urls.resolve('/api/hvac/rating/')` | ✅ `Resolver404` (prefix зарегистрирован, роутов нет) |
| `curl /api/public/v1/rating/` | — | Не выполнялся живой curl (runserver не поднимался, чтобы не трогать прод-БД через туннель). Резолвер подтверждает корректное поведение. |

## Известные риски / предупреждения

1. **Регрессионный прогон pytest осталось сделать с живой БД.** Изменения чисто аддитивные (ни один существующий файл не ссылается на новые apps, модели/URL пустые), так что регрессии крайне маловероятны. Но формальный зелёный pytest — за Андреем / фазой ревью.
2. **Venv путь.** Обнаружено расхождение между `backend/venv/` (существует) и `backend/.venv/` (ожидает `dev-local.sh`). В рамках фазы 1 не трогал — не относится к ТЗ, но стоит зафиксировать отдельно (возможно, симлинк).
3. **Несоответствие Python/PyPI в venv.** Shebang у `./venv/bin/pip` указывает на старый путь `obsidian/avgust/finans_assistant/backend/venv/...`, поэтому нужно вызывать `./venv/bin/python -m pip`. Не наша задача в фазе 1, но мешает DX — стоит пересоздать venv.
4. **Missing deps при старте.** При первом `manage.py startapp` venv не содержал `django-modeltranslation` и `django-storages` (были в requirements, но не установлены). Установил их (`pip install -r requirements.txt`). Эти изменения произошли в venv, а не в lockfile — коммита тут нет.
5. **`ac_catalog` как аггрегатор URL.** Stub-файлы `public_urls.py` / `admin_urls.py` положены в `ac_catalog/`, потому что это «главный» app рейтинга. В фазе 4 сюда поедут `include(...)` для остальных apps. Альтернатива — отдельный общий app `ac_rating_core/` — **не** делали, согласно плану («каждая app независима»).
6. **Django admin namespace `hvac_admin`.** Префикс `/api/hvac/rating/` сейчас стоит рядом с другими `/api/hvac/` роутами — не конфликтует, потому что `hvac_bridge/public_urls` не использует суффикс `rating/`. При добавлении роутов в фазе 4 проверить ещё раз.
7. **Namespace `ac_rating_public` / `ac_rating_admin`.** Заданы в stub-модулях через `app_name = ...`. Если в фазе 4 решим распределять URL по отдельным модулям в каждой app, namespace придётся пересмотреть (или оставить оболочку).

## Ключевые файлы для ревью

- `backend/finans_assistant/settings.py:142-152` — блок INSTALLED_APPS для ac_*
- `backend/finans_assistant/urls.py:155-158` — регистрация URL-префиксов рейтинга (строго до `api_public.urls`)
- `backend/ac_catalog/public_urls.py` — публичный stub
- `backend/ac_catalog/admin_urls.py` — админский stub
- `backend/requirements.txt:12` — `django-ratelimit`
- `.gitignore:17-26` — правила media + workspace
- `ac-rating/plan.md` — исходный план (не менялся)
