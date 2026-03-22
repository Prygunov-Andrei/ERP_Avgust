# ERP Avgust — Project Conventions

## Architecture

Monorepo with 5 services:
- `frontend/` — Next.js 16, единая точка входа (ERP + HVAC портал)
- `backend/` — Django 5 + DRF, ERP API (26 Django apps, включая kanban_*)
- `hvac-backend/` — Django, HVAC API (отдельная БД hvac_db)
- `bot/` — Telegram бот (aiogram 3.x)
- `mini-app/` — Vite React, мобильный worklog (независимый API client — intentional, не шарить с frontend)

## Critical Rules

### Database Safety
- **НЕ изменять модели и миграции** без отдельного решения и тестового прогона на копии базы
- Перед любыми изменениями моделей: бэкап → тестовый прогон миграций на копии → smoke-check API → план отката
- НЕ редактировать старые миграции (особенно RunPython data migrations)

### Sensitive Files (handle with care)
- `backend/finans_assistant/settings.py` — secrets, JWT keys, S3 config
- `hvac-backend/config/settings.py` — HVAC secrets
- `bot/services/db.py` — прямой asyncpg доступ к ERP DB (оптимизирован: retry, timeout, cache)
- `backend/api_public/migrations/0001_initial.py` — hardcoded defaults
- `.env`, `.env.example` — credentials

## Development

```bash
# Backend tests
cd backend && pytest

# Frontend type check + tests
cd frontend && npx tsc --noEmit && npm test

# Bot tests
cd bot && pytest

# HVAC tests
cd hvac-backend && pytest

# Full stack
./dev-local.sh    # start
./dev-stop.sh     # stop
```

## Code Patterns

### Backend
- Services pattern: бизнес-логика в `app/services/`, views только для HTTP orchestration
- Apps с services/: accounting, banking, catalog, contracts, estimates, llm_services, objects, payments, personnel, pricelists, proposals, supplier_integrations, supply
- Status transitions: через `core/state_machine.py` (декларативный валидатор)
- Text normalization: через `core/text_utils.py` (единственная копия)
- Kanban permissions: через `core/kanban_permissions.py` (KanbanRolePermissionMixin)
- Views >500 LOC разбиты на packages: payments/views/, estimates/views/, contracts/views/
- URL prefix: `/api/v1/` для ERP, `/api/public/v1/` для портала, `/api/hvac/` для HVAC

### Frontend
- UI primitives: `@/components/ui/` (shadcn/ui) — единственная копия
- API client: `@/lib/api/client.ts` (transport + domain services в `@/lib/api/services/`)
- API types: `@/lib/api/types/` — 12 доменных файлов
- HVAC API: `@/lib/hvac-api.ts`
- Constants: `@/constants/index.ts` — единственная копия
- Кастомные hooks: `@/hooks/` (useAsyncAction, useDialogState, useListFilters, useFormData и др.)
- Компоненты >1000 строк разбиты на подкомпоненты в поддиректориях (settings/, tkp/, estimate-detail/, work-journal/, personnel/, price-list-detail/)
- Path aliases: `@/*` → `./frontend/*`

### Known Tech Debt
- `finans_assistant` — внутреннее имя Django project (переименование нецелесообразно, 200+ миграций)
- `bot/services/db.py` — прямой SQL к ERP DB (изолирован, миграция на API — отдельный проект)
- `hvac-backend` discovery_service.py — threading вместо Celery (планируется миграция на Celery/отдельный worker)

## Deploy
- Production: 216.57.110.41, `/opt/finans_assistant`
- Deploy docs: `deploy/README.md`, `deploy/QUICKSTART.md`
- CI: `.github/workflows/ci.yml` — 4 jobs (frontend, backend, bot, hvac-backend)
