# F8-00: Локальный стенд для разработки F8

**Команда:** IS-Петя (инфраструктура)
**Effort:** 0.5-1 день
**Зависимости:** нет (делается параллельно с 01, 02, 04 либо первым шагом)

---

## Цель

Поднять полностью **локальный стенд** для всей разработки F8: локальный
postgres (ERP БД + ismeta-postgres), локальный recognition-public, локальный
hvac-info.com frontend, локальный PDF storage. Никакие F8-миграции и
тестовые данные НЕ должны уходить в прод-БД через SSH-туннель.

## Зачем

Сейчас локальный ERP backend по умолчанию подключён к прод-БД через
SSH-туннель (см. CLAUDE.md, секция «Media-файлы при локальной разработке»).
Это удобно для просмотра существующих данных, но **опасно для F8**:

- F8-02 создаст новый Django app `hvac_ismeta` + миграцию `0001_initial.py`
  → `manage.py migrate` выкатит таблицу в **прод-БД**.
- F8-02 settings page — каждый «Сохранить» меняет prod `HvacIsmetaSettings`.
- F8-04 добавит LLMProfile «Grok 4» → запись попадёт в **прод
  ismeta-postgres**.
- F8-03 + F8-05 — тестовые PDF-загрузки и Celery jobs пишутся в прод.

PO просил активно полировать UI публичной страницы → локальный стенд
обязателен, иначе каждое UI-изменение = деплой-цикл.

## Целевое состояние

```
LOCAL:
  postgres-erp:5432         — локальная копия схемы ERP (без прод-данных)
  postgres-ismeta:5433      — локальная ismeta-postgres (LLMProfile etc)
  redis:6379                — локальный (rate limit, Celery)
  recognition-public:8004   — TD-17g pipeline, локальный
  ismeta-recognition:8003   — старый, для internal MVP (опционально)
  backend:8000              — Django ERP, подключён к локальным postgres
  celery-worker             — обрабатывает ismeta-jobs локально
  frontend:3000             — Next.js (hvac-info.com + ERP)
  ./storage/ismeta-uploads/ — локальная папка для PDF копий
```

Прод остаётся нетронутым. SSH-туннель к прод-БД отключается на время
F8-разработки (или работает через отдельный профиль/флаг).

## Файлы которые меняем

### `docker-compose.local.yml` (новый или дополнить существующий)

Сервис локальных postgres'ов:

```yaml
services:
  postgres-erp-local:
    image: postgres:15
    container_name: postgres-erp-local
    ports: ["5432:5432"]
    environment:
      POSTGRES_DB: erp_avgust
      POSTGRES_USER: erp
      POSTGRES_PASSWORD: erp_local
    volumes:
      - ./local-data/pgdata-erp:/var/lib/postgresql/data

  postgres-ismeta-local:
    image: postgres:15
    container_name: postgres-ismeta-local
    ports: ["5433:5432"]
    environment:
      POSTGRES_DB: ismeta
      POSTGRES_USER: ismeta
      POSTGRES_PASSWORD: ismeta_local
    volumes:
      - ./local-data/pgdata-ismeta:/var/lib/postgresql/data

  redis-local:
    image: redis:7-alpine
    container_name: redis-local
    ports: ["6379:6379"]

  recognition-public:
    extends:
      file: docker-compose.public.yml  # из F8-01
      service: recognition-public

volumes:
  pgdata-erp:
  pgdata-ismeta:
```

### `.env.local.example`

Шаблон с локальными credentials:

```bash
# ERP БД — локальная
DATABASE_URL=postgres://erp:erp_local@localhost:5432/erp_avgust

# ismeta-postgres — локальная
ISMETA_DATABASE_URL=postgres://ismeta:ismeta_local@localhost:5433/ismeta

# Redis — локальный
REDIS_URL=redis://localhost:6379/0

# Recognition — локальный
RECOGNITION_URL=http://localhost:8004
RECOGNITION_API_KEY=dev-recognition-key

# PDF storage — локальная папка
PDF_STORAGE_PATH=./storage/ismeta-uploads/

# LLM keys — на dev стенде можно подсунуть тестовые/cheap-keys
LLM_API_KEY_OPENAI=sk-...
LLM_API_KEY_DEEPSEEK=...
LLM_API_KEY_GEMINI=...
LLM_API_KEY_XAI=xai-...

# Frontend — без PROD_MEDIA_URL (локально не проксируем)
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### `dev-local.sh` (обновить — switch profile)

Добавить флаг `--f8` (или новый `dev-local-f8.sh`):

```bash
# Запуск стенда для F8 разработки
./dev-local.sh --f8
# = поднять локальные postgres'ы + recognition-public + frontend + backend
# = НЕ открывать SSH-туннель к проду
```

### Bootstrap локальной БД

Скрипт `scripts/bootstrap_local_f8.sh`:

```bash
#!/usr/bin/env bash
set -e

# 1. Поднять локальные сервисы
docker compose -f docker-compose.local.yml up -d \
    postgres-erp-local postgres-ismeta-local redis-local

# 2. Дождаться healthy
until docker exec postgres-erp-local pg_isready; do sleep 1; done

# 3. Применить миграции на локальную ERP БД
cd backend && python manage.py migrate

# 4. Заполнить минимальный seed (один admin user, базовые справочники)
python manage.py loaddata fixtures/local-seed.json

# 5. ismeta-postgres — создать таблицу llm_profile
docker exec postgres-ismeta-local psql -U ismeta -d ismeta -c "
  CREATE TABLE IF NOT EXISTS llm_profile (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    base_url VARCHAR(255),
    extract_model VARCHAR(100),
    multimodal_model VARCHAR(100),
    classify_model VARCHAR(100),
    vision_supported BOOLEAN DEFAULT false,
    api_key_encrypted TEXT,
    created_at TIMESTAMP DEFAULT NOW()
  );
"

# 6. Загрузить 4 LLMProfile (DeepSeek, OpenAI, Gemini, Grok)
python manage.py shell < scripts/seed_llm_profiles.py

# 7. Создать /storage/ismeta-uploads/
mkdir -p ./storage/ismeta-uploads

echo "Local F8 stand ready."
echo "  postgres-erp:    localhost:5432"
echo "  postgres-ismeta: localhost:5433"
echo "  redis:           localhost:6379"
echo "  Run: cd backend && python manage.py runserver"
echo "  Run: cd frontend && npm run dev"
echo "  recognition-public: docker compose -f docker-compose.public.yml up"
```

## Migration policy для F8 (ВАЖНО)

**До завершения F8-00:**
- Все агенты (01, 02, 04) работают **БЕЗ запуска migrate** на текущей БД.
- F8-02 создаёт миграцию `0001_initial.py` через `makemigrations`, но
  `migrate` запускает только на локальной БД после F8-00.
- F8-04 НЕ создаёт LLMProfile «Grok 4» в текущей ismeta-postgres
  (она прод). Запись делается на локальном стенде после F8-00.

**После F8-00:**
- Все F8 агенты используют локальный стенд по `.env.local`.
- На прод выкатываем только при F8-07 (Launch).

## Smoke test локального стенда

1. **БД подняты:**
   ```bash
   docker exec postgres-erp-local psql -U erp -c '\dt' | grep -c hvac_ismeta
   # = 1 (после F8-02 migrate)
   ```

2. **Recognition healthy:**
   ```bash
   curl http://localhost:8004/v1/healthz
   # → {"status":"ok"}
   ```

3. **Frontend route /ismeta открывается:**
   ```bash
   curl -s http://localhost:3000/ismeta | grep -c "ISMeta"
   # ≥ 1 после F8-05
   ```

4. **End-to-end PDF upload:**
   - Открыть `localhost:3000/ismeta`.
   - Загрузить Spec-1.
   - Дождаться обработки.
   - Скачать Excel → 153 позиции.
   - Проверить `./storage/ismeta-uploads/` — там копия PDF.
   - Проверить `IsmetaJob` в локальной ERP БД — запись появилась.

5. **Концурренси:** второй upload в новой вкладке → 429.

## Acceptance criteria

- [ ] `docker compose -f docker-compose.local.yml up` поднимает все сервисы.
- [ ] `scripts/bootstrap_local_f8.sh` создаёт схему + seeds без ошибок.
- [ ] ERP backend подключается к локальной БД (не через SSH-туннель к проду).
- [ ] Все 4 LLMProfile созданы локально с тестовыми API keys.
- [ ] Recognition-public:8004 healthy на локальном стенде.
- [ ] Smoke test 1-5 passing.
- [ ] `.env.local.example` documented.
- [ ] Инструкция в `docs/epics/F8-public-ismeta/local-dev.md` (или README дополнить).

## Definition of Done

- Полный F8 стек крутится локально без зависимости от прод-БД.
- Любой UI-эксперимент Феди (F8-05 polish) можно делать в hot-reload Next.js
  с реальным backend + recognition.
- Все F8-агенты переключены на `.env.local`, миграции идут только локально.
- Прод-БД защищена от тестовых данных F8.

## Риски

- **Drift схемы local vs prod:** локальная ERP БД может отстать от прода
  по миграциям → перед F8-07 (launch) обязательно прогнать full migrate
  на свежей выгрузке прод-БД.
- **LLMProfile encryption keys:** Fernet keys в локальной ismeta-postgres
  ДОЛЖНЫ совпадать с прод (иначе encrypted api_keys не расшифруются на
  деплое). Bootstrap скрипт использует тот же `FERNET_KEY` через ENV.
- **Объём данных:** локальная БД пустая (без прод-данных) → некоторые
  ERP-страницы могут не работать (нет projects/contracts/etc). Это OK
  для F8 — нам нужен только новый раздел HVAC-ISMeta.
