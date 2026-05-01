# F8 Local stand — инструкция

Полный локальный стек для разработки F8 Public ISMeta. БЕЗ SSH-туннеля,
БЕЗ риска тестовыми данными попасть в прод-БД.

Что поднимается:

| Сервис             | Хост                  | Назначение                                |
|--------------------|-----------------------|-------------------------------------------|
| postgres-erp-local | `localhost:5432`      | ERP БД (новый Django app `hvac_ismeta`)   |
| postgres-ismeta-local | `localhost:5433`   | ismeta БД (LLMProfile, recognition_jobs)  |
| redis-local        | `localhost:6379`      | Celery broker, rate-limit                 |
| recognition-public | `localhost:8004`      | TD-17g pipeline (после F8-01)             |
| ERP backend        | `localhost:8000`      | нативно через `dev-local.sh --f8`         |
| frontend (Next.js) | `localhost:3000`      | нативно через `dev-local.sh --f8`         |
| `./storage/ismeta-uploads/` | локальная папка | копии загруженных PDF                  |

> **Прод-БД** не трогается. SSH-туннель не открывается. Все F8-миграции
> и тестовые «Сохранить настройки» уходят в локальные постгресы.

---

## Запуск за 5 минут

```bash
# 1. Конфиг
cp .env.local.example .env.local
$EDITOR .env.local
#   - LLM_API_KEY_OPENAI / DEEPSEEK / GEMINI / XAI
#   - LLM_PROFILE_ENCRYPTION_KEY (см. ниже)

# 2. Поднять стенд (postgres + redis + recognition + миграции + seed)
./scripts/bootstrap_local_f8.sh

# 3. Запустить приложения нативно (hot-reload)
./dev-local.sh --f8

# 4. Готово — http://localhost:3000/ismeta
```

Остановка: `Ctrl+C` или `./dev-stop.sh`. Данные БД сохраняются в docker
volumes (`pgdata-erp-local`, `pgdata-ismeta-local`).

---

## LLM_PROFILE_ENCRYPTION_KEY

Fernet-ключ, шифрующий `api_key_encrypted` в `llm_profile`.

**КРИТИЧНО:** должен совпадать с прод-ключом, иначе:
- ключи, выгруженные с прода (для smoke с реальными API), не расшифруются;
- ключи, добавленные локально, не расшифруются на проде после переноса
  (актуально только если планируется миграция данных).

Для F8-разработки достаточно сгенерировать собственный (прод-данные не
нужны):

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Положить в `.env.local` как `LLM_PROFILE_ENCRYPTION_KEY=...`.

---

## Smoke-тесты после bootstrap

```bash
# postgres-erp
docker exec postgres-erp-local psql -U postgres -d finans_assistant -c '\dt' | head

# postgres-ismeta — должна быть таблица llm_profile с 4 строками
docker exec postgres-ismeta-local psql -U ismeta -d ismeta \
    -c "SELECT name, base_url, vision_supported, is_default FROM llm_profile ORDER BY id;"

# redis
docker exec redis-local redis-cli ping     # → PONG

# recognition (если F8-01 production-Dockerfile уже коммитнут)
curl http://localhost:8004/v1/healthz       # → {"status":"ok"}

# ERP backend (после ./dev-local.sh --f8)
curl http://localhost:8000/api/v1/health/

# Конкурренси — повторный upload в новой вкладке возвращает 429.
# Тест после F8-05 (frontend) + F8-06 (rate limiter).
```

---

## Конфликт с ismeta-backend migrate

Bootstrap создаёт таблицу `llm_profile` через raw SQL (т.к. F8-00 не
поднимает ismeta-backend Django проект — это вне scope IS-Петя
infra-задачи). Когда ismeta-команда поднимает `ismeta/docker-compose.yml`
с локальной ismeta-postgres (`POSTGRES_PORT=5433`), Django увидит таблицу
и при первом `migrate` упадёт «relation already exists».

Решение — пометить миграцию как применённую:

```bash
docker exec ismeta-backend python manage.py migrate llm_profiles --fake-initial
docker exec ismeta-backend python manage.py migrate
```

Альтернативно, если ismeta-backend поднимается раньше bootstrap'а — он
сам применит миграции, тогда bootstrap пропустит CREATE TABLE
(`IF NOT EXISTS`) и сразу пойдёт в seed.

---

## Координация с F8-01 (recognition-public)

F8-01 (другой Петя) делает production Docker image для recognition с
TD-17g pipeline (Docling 2.92, Camelot 1.0, Vision fallback). До тех пор
`docker-compose.local.yml` собирает recognition-public из текущего
`./recognition/Dockerfile` — это даёт рабочий сервис на 8004 без TD-17g
тяжёлых deps.

После того как F8-01 коммитит `docker-compose.public.yml` —
`docker-compose.local.yml` можно сократить через `extends` (вместо явного
build-блока):

```yaml
recognition-public:
  extends:
    file: docker-compose.public.yml
    service: recognition-public
  ports:
    - "8004:8003"
  volumes:
    - ./storage/ismeta-uploads:/uploads:rw
```

---

## Migration policy для F8

**До завершения F8-00:**
- F8-02 / F8-03 / F8-04 НЕ запускают `migrate` на текущей БД (она
  подключена к проду через SSH-туннель!).
- F8-02 создаёт миграцию `0001_initial.py` через `makemigrations`,
  но `migrate` запускает только после F8-00 + переключения на
  `.env.local`.
- F8-04 НЕ создаёт LLMProfile «Grok 4» в текущей ismeta-postgres
  (она прод). Запись делается на локальном стенде через ismeta-backend
  management command (см. F8-04 ТЗ).

**После F8-00 (текущее состояние стенда):**
- Все F8-агенты работают с `.env.local` + `dev-local.sh --f8`.
- `migrate` идёт только в локальные постгресы.
- Прод не трогается до F8-07 (Launch).

---

## Troubleshooting

**`docker compose up` падает на `recognition-public`:**
F8-01 ещё не закоммитил production Dockerfile с Docling/Camelot deps.
Bootstrap печатает warning и продолжает — БД и redis работают, F8-02/F8-04
не блокируются. Recognition можно поднять отдельно после F8-01.

**`backend/.venv/bin/python` не найден:**
Запусти `./dev-local.sh --f8` — он создаст venv.
Альтернативно вручную:
```bash
python3.12 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt
```

**Профили созданы, но без api_key:**
Если `LLM_API_KEY_*` пустые в `.env.local`, seed создаёт профили с
placeholder-ключом. После заполнения `.env.local` — повтори:
```bash
./scripts/bootstrap_local_f8.sh
```
ON CONFLICT обновит `api_key_encrypted` (is_default не сбрасывается).

**Drift локальной схемы vs прод:**
Перед F8-07 (Launch) обязательно прогнать `migrate` на свежей выгрузке
прод-БД, чтобы убедиться что F8-миграции совместимы с реальными данными.

**Сбросить БД:**
```bash
docker compose --env-file .env.local -f docker-compose.local.yml down -v
./scripts/bootstrap_local_f8.sh
```
`-v` удаляет volumes (`pgdata-erp-local`, `pgdata-ismeta-local`,
`redis-local-data`).

---

## Файлы стенда

| Файл                                 | Назначение                              |
|--------------------------------------|-----------------------------------------|
| `docker-compose.local.yml`           | postgres + redis + recognition          |
| `.env.local.example`                 | шаблон env                              |
| `scripts/bootstrap_local_f8.sh`      | bootstrap (миграции + seed)             |
| `scripts/seed_llm_profiles.py`       | seed 4 LLMProfile в ismeta-postgres     |
| `dev-local.sh --f8`                  | запуск приложений нативно без SSH       |
| `docs/epics/F8-public-ismeta/00-local-stand.md` | ТЗ F8-00                     |
