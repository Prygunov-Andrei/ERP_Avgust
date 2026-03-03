# Локальная разработка (без пересборки Docker)

Гибридная схема: инфраструктура (PostgreSQL, Redis, MinIO) в Docker, приложения (Django, Vite, Celery) — нативно на хосте с hot-reload.

## Пререквизиты

| Компонент | Версия | Проверка |
|-----------|--------|----------|
| Docker Desktop | любая | `docker --version` |
| Python | 3.12 | `python3.12 --version` |
| Node.js | 22+ | `node --version` (через nvm) |
| pip | актуальная | `pip3 --version` |

## Быстрый старт

```bash
# 1. Клонировать репо (если ещё нет)
git clone <repo-url> && cd finans_assistant

# 2. Настроить окружение
cp backend/.env.example backend/.env    # или отредактировать backend/.env

# 3. Установить зависимости
pip3 install -r backend/requirements.txt
cd frontend && npm install && cd ..

# 4. Запустить всё
./dev-local.sh
```

После запуска:
- **Frontend (Vite HMR):** http://localhost:3000
- **ERP API:** http://localhost:8000/api/v1/
- **Kanban API:** http://localhost:8010/kanban-api/v1/
- **MinIO Console:** http://localhost:9001 (minioadmin / minioadmin)

Остановка: `Ctrl+C` в терминале или `./dev-stop.sh` из другого.

## Архитектура окружений

```
┌─────────────────────────────────────────────────────┐
│  Docker (docker-compose.dev.yml)                    │
│  ┌──────────┐  ┌───────┐  ┌───────────────────┐    │
│  │PostgreSQL │  │ Redis │  │ MinIO             │    │
│  │  :5432    │  │ :6379 │  │ :9000 API         │    │
│  │           │  │       │  │ :9001 Console     │    │
│  │  DB 0:    │  │ DB 0: │  │                   │    │
│  │  finans_  │  │  ERP  │  │ Бакеты:           │    │
│  │  assistant│  │ Celery│  │  worklog-media     │    │
│  │           │  │       │  │  files             │    │
│  │  DB:      │  │ DB 1: │  │                   │    │
│  │  kanban   │  │ Kanban│  │                   │    │
│  │           │  │ Celery│  │                   │    │
│  └──────────┘  └───────┘  └───────────────────┘    │
└────────┬──────────┬──────────────┬──────────────────┘
         │          │              │
┌────────┴──────────┴──────────────┴──────────────────┐
│  Нативно на хосте (hot-reload)                      │
│                                                      │
│  Django ERP        :8000   ← python3.12 runserver   │
│  Kanban API        :8010   ← python3.12 runserver   │
│  Vite (frontend)   :3000   ← npm run dev (HMR)     │
│  Celery ERP worker          ← celery -A finans_...  │
│  Celery Kanban worker       ← celery -A kanban_...  │
└──────────────────────────────────────────────────────┘
```

## Переменные окружения (backend/.env)

### Основные (ERP)

| Переменная | Значение для локалки | Описание |
|------------|---------------------|----------|
| `DB_HOST` | `localhost` | PostgreSQL хост |
| `DB_PORT` | `5432` | PostgreSQL порт |
| `DB_NAME` | `finans_assistant` | Основная БД |
| `DB_USER` | `postgres` | Пользователь БД |
| `DB_PASSWORD` | `postgres` | Пароль БД |
| `CELERY_BROKER_URL` | `redis://localhost:6379/0` | Redis для ERP Celery |
| `AWS_S3_ENDPOINT_URL` | `http://localhost:9000` | MinIO endpoint |
| `TELEGRAM_BOT_TOKEN` | из .env | Токен бота |
| `ELEVENLABS_API_KEY` | из .env | API ключ транскрибации |

### Kanban Service

| Переменная | Значение для локалки | Зачем нужна |
|------------|---------------------|-------------|
| `KANBAN_CELERY_BROKER_URL` | `redis://localhost:6379/1` | Без неё fallback на DB 0 (конфликт с ERP) |
| `KANBAN_CELERY_RESULT_BACKEND` | `redis://localhost:6379/1` | Без неё fallback на Docker hostname `redis` |
| `KANBAN_S3_ENDPOINT_URL` | `http://localhost:9000` | Без неё fallback на Docker hostname `minio` |
| `ERP_API_BASE_URL` | `http://localhost:8000/api/v1` | Без неё fallback на Docker hostname `backend` |

> **Примечание:** `KANBAN_DB_HOST` НЕ нужно задавать отдельно — он наследует `DB_HOST=localhost` из `.env` (см. `kanban_service/settings.py:89`).

### Не обязательные для локалки

| Переменная | Описание |
|------------|----------|
| `SENTRY_DSN` | Мониторинг ошибок (можно пустым) |
| `FNS_API_KEY` | API налоговой (нужен для распознавания счетов) |
| `BANK_ENCRYPTION_KEY` | Шифрование банковских данных |
| `OPENAI_API_KEY` / `GEMINI_API_KEY` | AI-функции |
| `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` | RS256 авторизация (для HS256 не нужны) |
| `BITRIX_WEBHOOK_ENABLED` | Интеграция с Bitrix24 |

## Скрипты

| Скрипт | Описание |
|--------|----------|
| `./dev-local.sh` | Запуск всего (Docker инфра + приложения нативно) |
| `./dev-stop.sh` | Остановка из другого терминала |
| `./dev.sh` | Запуск через Docker (полная пересборка — медленнее) |

## Частые проблемы

### Порт 5432 занят (PostgreSQL)

Если на хосте установлен PostgreSQL через Homebrew и он запущен:
```bash
# Остановить локальный PostgreSQL
brew services stop postgresql@14

# Или проверить, кто занимает порт
lsof -i :5432
```

Docker PostgreSQL и локальный не могут работать одновременно на одном порту.

### Порт 6379 занят (Redis)

```bash
# Проверить
lsof -i :6379

# Остановить локальный Redis
brew services stop redis
```

### Порт 8000/8010/3000 занят

```bash
# Найти процесс
lsof -i :8000

# Убить
kill <PID>
```

### Redis connection refused

Убедитесь, что Docker инфраструктура запущена:
```bash
docker compose -f docker-compose.dev.yml ps
```

Если Redis не стартовал:
```bash
docker compose -f docker-compose.dev.yml up -d redis
```

### MinIO bucket not found

Если бакеты не создались автоматически:
```bash
# Пересоздать вручную
docker compose -f docker-compose.dev.yml up createbuckets
```

### Kanban API не видит ERP

Проверьте `ERP_API_BASE_URL` в `backend/.env`:
```
ERP_API_BASE_URL=http://localhost:8000/api/v1
```

Если стоит `http://backend:8000/...` — это Docker hostname, не работает на хосте.

### Миграции не применяются

```bash
cd backend

# ERP
python3.12 manage.py migrate

# Kanban
DJANGO_SETTINGS_MODULE=kanban_service.settings python3.12 manage.py migrate
```

## Ручное управление

### Только инфраструктура (без приложений)
```bash
docker compose -f docker-compose.dev.yml up -d
```

### Только один сервис
```bash
# Django ERP
cd backend && python3.12 manage.py runserver 0.0.0.0:8000

# Kanban API
cd backend && DJANGO_SETTINGS_MODULE=kanban_service.settings python3.12 manage.py runserver 0.0.0.0:8010

# Vite
cd frontend && npm run dev

# Celery ERP
cd backend && celery -A finans_assistant worker --concurrency=1 -l info

# Celery Kanban
cd backend && celery -A kanban_service worker --concurrency=1 -l info
```

### Сброс БД
```bash
# Удалить Docker volume с данными PostgreSQL
docker compose -f docker-compose.dev.yml down -v
docker compose -f docker-compose.dev.yml up -d

# Накатить миграции заново
cd backend
python3.12 manage.py migrate
DJANGO_SETTINGS_MODULE=kanban_service.settings python3.12 manage.py migrate
```

### Пересоздать бакеты MinIO
```bash
docker compose -f docker-compose.dev.yml up createbuckets
```

## Деплой (продакшн)

Для деплоя на сервер используется `docker-compose.prod.yml` — там все сервисы в Docker:
- Все порты привязаны к `127.0.0.1` (за nginx)
- `DEBUG=False`
- Лимиты CPU/RAM на каждый контейнер
- Логирование через json-file driver

Подробнее: [docs/deploy/](deploy/)
