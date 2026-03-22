# Документация проекта ERP Avgust

## Структура документации

### 📚 Reference (справочные документы)

| Документ | Описание |
|----------|----------|
| [reference/PROJECT.md](./reference/PROJECT.md) | Полное описание проекта: модели, бизнес-логика, архитектура |
| [reference/MENU_STRUCTURE.md](./reference/MENU_STRUCTURE.md) | Структура меню ERP |
| [reference/COLUMN_CONFIG.md](./reference/COLUMN_CONFIG.md) | Конфигурация колонок |
| [reference/USER_GUIDE_COLUMNS.md](./reference/USER_GUIDE_COLUMNS.md) | Руководство по колонкам |
| [reference/USER_GUIDE_SUPPLIER_CATALOGS.md](./reference/USER_GUIDE_SUPPLIER_CATALOGS.md) | Руководство по каталогам поставщиков |
| [reference/MIGRATION_AUDIT.md](./reference/MIGRATION_AUDIT.md) | Аудит data-миграций (RunPython) |
| [reference/FRONTEND_ARCHITECTURE.md](./reference/FRONTEND_ARCHITECTURE.md) | Архитектура фронтенда: зоны, API-клиенты, маршруты |

### 📖 Runbooks (инструкции)

| Документ | Описание |
|----------|----------|
| [runbooks/LOCAL_DEV.md](./runbooks/LOCAL_DEV.md) | Настройка локальной разработки |
| [runbooks/QA_CHECKLIST.md](./runbooks/QA_CHECKLIST.md) | Чек-лист QA |

### 🚚 Снабжение (Supply Module)

| Документ | Описание |
|----------|----------|
| [supply/BITRIX_SETUP.md](./supply/BITRIX_SETUP.md) | Инструкция по подключению и настройке Bitrix24 |
| [supply/WORKFLOW.md](./supply/WORKFLOW.md) | Workflow: от запроса до оплаты |

### 🏦 Банковская интеграция (Banking)

| Документ | Описание |
|----------|----------|
| [banking/statements.md](./banking/statements.md) | Синхронизация выписок |
| [banking/tochka-client.md](./banking/tochka-client.md) | Клиент банка Точка |
| [banking/permissions.md](./banking/permissions.md) | Права доступа |
| [banking/admin-setup.md](./banking/admin-setup.md) | Настройка через админку |
| [banking/security.md](./banking/security.md) | Безопасность |
| [banking/user-guide-controller.md](./banking/user-guide-controller.md) | Руководство Директора-контролёра |
| [banking/user-guide-operator.md](./banking/user-guide-operator.md) | Руководство Оператора |
| [banking/api-reference.md](./banking/api-reference.md) | Справочник API |
| [banking/architecture.md](./banking/architecture.md) | Архитектура модуля |

### 🔧 Сервис фиксации работ (Work Logging)

**Индекс**: [work_logging/README.md](./work_logging/README.md)

| Документ | Описание |
|----------|----------|
| [work_logging/CONCEPT.md](./work_logging/CONCEPT.md) | Концепция сервиса v5.2 — бизнес-логика, роли, сценарии |
| [work_logging/PRESENTATION.md](./work_logging/PRESENTATION.md) | Презентация сервиса |
| [work_logging/ARCHITECTURE.md](./work_logging/ARCHITECTURE.md) | Архитектура — компоненты, потоки данных |
| [work_logging/MODELS.md](./work_logging/MODELS.md) | Модели данных — 10 моделей, поля, связи |
| [work_logging/API.md](./work_logging/API.md) | REST API — эндпоинты, форматы |
| [work_logging/BOT.md](./work_logging/BOT.md) | Telegram Bot — aiogram 3.x |
| [work_logging/MINI_APP.md](./work_logging/MINI_APP.md) | Mini App — React, экраны, i18n |
| [work_logging/DEPLOYMENT.md](./work_logging/DEPLOYMENT.md) | Развёртывание и настройка |
| [work_logging/IMPLEMENTATION_PLAN.md](./work_logging/IMPLEMENTATION_PLAN.md) | План реализации с прогрессом |

### 📋 Сметы (Estimates)

| Документ | Описание |
|----------|----------|
| [estimates/README.md](./estimates/README.md) | Архитектура модуля, модели, API, сервисы |
| [estimates/USER_GUIDE.md](./estimates/USER_GUIDE.md) | Руководство пользователя: импорт, разделы, редактирование |

### 📄 [schema.yaml](./schema.yaml)
OpenAPI схема API в формате YAML для интеграции и документации эндпоинтов.

---

### 📦 Архив

| Документ | Описание |
|----------|----------|
| [archive/kanban_service/](./archive/kanban_service/) | Архитектура канбан-сервиса (V1, до слияния с backend) |
| [archive/MIGRATION_UNIFIED_SERVER.md](./archive/MIGRATION_UNIFIED_SERVER.md) | Миграция на единый сервер |
| [archive/COMMERCIAL_PIPELINE.md](./archive/COMMERCIAL_PIPELINE.md) | Коммерческий пайплайн |
| [archive/BULK_IMPORT.md](./archive/BULK_IMPORT.md) | Массовый импорт данных |
| [archive/PUBLIC_ESTIMATE_PORTAL.md](./archive/PUBLIC_ESTIMATE_PORTAL.md) | Портал публичных смет |
| [archive/IMPLEMENTATION_INVOICE_PARSING_BACKEND.md](./archive/IMPLEMENTATION_INVOICE_PARSING_BACKEND.md) | Парсинг счетов (backend) |
| [archive/IMPLEMENTATION_INVOICE_PARSING_FRONTEND.md](./archive/IMPLEMENTATION_INVOICE_PARSING_FRONTEND.md) | Парсинг счетов (frontend) |
| [archive/DEV_SUPPLIER_CATALOG_PARSING.md](./archive/DEV_SUPPLIER_CATALOG_PARSING.md) | Парсинг каталогов поставщиков |
| [archive/TASK_HVAC_INFO_PORTAL.md](./archive/TASK_HVAC_INFO_PORTAL.md) | Портал HVAC |

---

## Команды для разработки

```bash
# Полный стек через Docker
./dev-local.sh    # запуск
./dev-stop.sh     # остановка

# Backend
cd backend && python manage.py runserver
cd backend && pytest

# Frontend
cd frontend && npm run dev
cd frontend && npx tsc --noEmit && npm run build

# Celery
cd backend && celery -A finans_assistant worker -l info
cd backend && celery -A finans_assistant beat -l info
```

---

## Деплой (production)

Индекс: [deploy/README.md](../deploy/README.md)

*Последнее обновление: Март 2026*
