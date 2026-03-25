# ERP Avgust

ERP-система для управления строительной компанией + портал климатической индустрии HVAC-info.com.

## Целевая архитектура

Репозиторий находится в переходе к **единому backend-контуру**:

- `backend/` становится канонической точкой сборки backend-логики.
- HVAC-домен полностью исполняется из `backend/`.
- данные ERP и HVAC работают в единой БД; rollback хранится отдельным архивом вне runtime-контура.
- HVAC admin-трафик со стороны `frontend/` должен идти через серверный BFF в единый backend namespace `/api/v1/hvac/...`; сервисный токен хранится только в backend и не попадает в браузер.

## Компоненты

| Компонент | Технология | Порт |
|-----------|-----------|------|
| ERP API | Django + DRF + Gunicorn | 8000 |
| HVAC API | Django + DRF внутри `backend/` | 8000 |
| ERP Frontend | Next.js 16 App Router | 3000 |
| Telegram Bot | aiogram | 8081 |
| PostgreSQL | postgres:14-alpine | 5432 |
| Redis | redis:7-alpine | 6379 |
| MinIO | S3-совместимое хранилище | 9000/9001 |

## Быстрый старт (Docker)

```bash
cp .env.example .env   # отредактировать значения
./dev-local.sh         # поднять всё
./dev-stop.sh          # остановить
```

После запуска:
- **ERP**: http://localhost:3000/erp
- **HVAC портал**: http://localhost:3000
- **ERP API (Swagger)**: http://localhost:8000/api/docs/
- **MinIO Console**: http://localhost:9001

## Структура репозитория

```
ERP_Avgust/
├── backend/           # Django ERP API (finans_assistant project)
│   ├── core/          # Базовые модели, auth, throttling, validators
│   ├── accounting/    # Юрлица, счета, контрагенты
│   ├── contracts/     # Договоры, акты, сметы по договорам
│   ├── payments/      # Счета на оплату, доходы, периодические платежи
│   ├── estimates/     # Проекты, сметы, спецификации
│   ├── banking/       # Интеграция с банком Точка
│   ├── supply/        # Снабжение (Bitrix24)
│   ├── catalog/       # Каталог товаров
│   ├── kanban_*/      # Канбан-модули (7 приложений, часть backend)
│   └── ...            # + personnel, communications, pricelists, proposals, llm_services, worklog
├── frontend/          # Next.js 16 App Router (единая точка входа)
│   ├── app/erp/       # ERP-раздел
│   ├── components/
│   │   ├── erp/       # ERP-компоненты
│   │   ├── hvac/      # HVAC-компоненты
│   │   └── ui/        # shadcn/ui (общие UI-примитивы)
│   └── lib/api/       # API-клиент (client.ts + types.ts)
├── bot/               # Telegram бот (aiogram 3.x)
├── mini-app/          # Telegram Mini App (Vite + React, worklog)
├── deploy/            # Скрипты деплоя, nginx, backup
├── docs/              # Документация (runbooks, reference, archive)
└── tests/e2e/         # E2E тесты
```

## Деплой

Документация: [deploy/README.md](deploy/README.md)

SSH-туннель к prod БД: `./dev-remote-db.sh` (читает credentials из `.env`)
