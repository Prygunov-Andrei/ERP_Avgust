# Frontend Architecture

## Product Zones

```
frontend/
├── app/                          # Next.js App Router
│   ├── erp/                      # ERP SPA (authenticated)
│   ├── login/                    # Login page
│   ├── (public routes)/          # HVAC portal, public estimate portal
│   └── layout.tsx                # Root layout
├── components/
│   ├── ui/                       # shadcn/ui primitives (single source of truth)
│   ├── erp/components/           # ERP domain components (136 files)
│   ├── hvac/                     # HVAC portal components (34 files)
│   └── public/                   # Public site components (6 files)
├── lib/
│   ├── api/                      # ERP API client + types
│   │   ├── client.ts             # ApiClient class (singleton, token refresh)
│   │   ├── extensions.ts         # Supply/portal methods (prototype augmentation)
│   │   ├── kanban-extensions.ts  # Kanban/warehouse/files methods
│   │   ├── types/                # Domain type definitions (12 files)
│   │   └── index.ts              # Barrel export
│   ├── hvac-api.ts               # HVAC API (server-side only, SSR)
│   ├── api.ts                    # Re-export shim for legacy imports
│   ├── erp-utils.ts              # ERP utility functions
│   └── utils.ts                  # General utilities
├── constants/
│   └── index.ts                  # Shared constants (single source of truth)
└── hooks/                        # Shared React hooks
```

## Import Rules

| What | Import from | NOT from |
|------|-------------|----------|
| UI primitives | `@/components/ui/` | Never duplicate into zone dirs |
| ERP API | `@/lib/api` | — |
| HVAC API (SSR) | `@/lib/hvac-api` | — |
| Types | `@/lib/api` | — |
| Constants | `@/constants` | Never duplicate into zone dirs |

## API Client Pattern

- **Main client** (`ApiClient`): singleton with JWT token refresh, base URL `/api/v1`
- **Extensions**: prototype augmentation pattern — domain methods added in separate files (`extensions.ts`, `kanban-extensions.ts`)
- **HVAC public client**: standalone functions in `@/lib/hvac-api`, server-side only with ISR caching
- **HVAC admin client**: browser requests идут только через внутренний BFF `/api/hvac-admin/...`, который проксирует их в unified backend namespace `/api/v1/hvac/admin/...`; сервисный токен хранится только на backend и не попадает в клиентский bundle

## ERP Component Structure

```
erp/components/
├── Layout.tsx              # Main layout with sidebar navigation
├── StubPage.tsx            # Placeholder for planned sections
├── catalog/                # Product catalog management
├── contracts/              # Contract details, estimates, acts
├── estimates/              # Estimate management and projects
├── finance/                # Financial dashboards
├── kanban/                 # Kanban boards (commercial, supply)
├── objects/                # Construction object views
├── payments/               # Payment forms
├── pricelists/             # Price list CRUD
├── proposals/              # TKP and mounting proposals
├── references/             # Reference data pages
├── supply/                 # Supply chain integration
└── warehouse/              # Inventory views
```

## Routes

- **ERP**: `/erp/*` — 103 pages, SPA with client-side routing
- **Public**: `/`, `/news/*`, `/manufacturers`, `/brands`, `/resources`, `/smeta` — SSR/SSG
- **Auth**: `/login` — standalone page

11 ERP pages are stubs (StubPage) for planned features: PTO (4), finance (4), contracts/household, supply/drivers, marketing/executors.
