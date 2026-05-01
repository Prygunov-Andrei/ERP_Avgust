#!/usr/bin/env bash
# =============================================================================
# F8 Local stand bootstrap — поднимает БД + redis + recognition-public локально,
# применяет ERP миграции, создаёт llm_profile таблицу, сидит 4 LLMProfile.
#
# Запуск:
#   ./scripts/bootstrap_local_f8.sh
#
# Безопасно повторяется (idempotent): docker volumes сохраняются, миграции
# применяются заново, llm_profile сидится через ON CONFLICT DO NOTHING.
#
# Документация: docs/epics/F8-public-ismeta/local-dev.md
# =============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.local.yml"
ENV_FILE="$ROOT_DIR/.env.local"
ENV_EXAMPLE="$ROOT_DIR/.env.local.example"
VENV_PYTHON="$ROOT_DIR/backend/.venv/bin/python"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}$*${NC}"; }
warn() { echo -e "${YELLOW}$*${NC}"; }
err()  { echo -e "${RED}$*${NC}"; }

# -----------------------------------------------------------------------------
# 0. Проверки окружения
# -----------------------------------------------------------------------------
if [ ! -f "$ENV_FILE" ]; then
    err ".env.local не найден."
    echo "  Скопируй: cp $ENV_EXAMPLE $ENV_FILE"
    echo "  Заполни LLM_API_KEY_* и LLM_PROFILE_ENCRYPTION_KEY (см. local-dev.md)."
    exit 1
fi

if ! command -v docker >/dev/null; then
    err "docker не установлен"; exit 1
fi
if ! docker compose version >/dev/null 2>&1; then
    err "docker compose v2 не установлен"; exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if [ -z "${LLM_PROFILE_ENCRYPTION_KEY:-}" ]; then
    err "LLM_PROFILE_ENCRYPTION_KEY пустой в .env.local."
    echo "  Сгенерируй: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
    echo "  ВАЖНО: должен совпадать с прод-ключом (иначе encrypted api_keys c прода не расшифруются локально)."
    exit 1
fi

# -----------------------------------------------------------------------------
# 1. Поднять БД + redis (recognition-public пока не нужен для миграций — отложим)
# -----------------------------------------------------------------------------
log "[1/6] docker compose up -d (postgres-erp-local, postgres-ismeta-local, redis-local)..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d \
    postgres-erp-local postgres-ismeta-local redis-local

# -----------------------------------------------------------------------------
# 2. Ждать healthy
# -----------------------------------------------------------------------------
log "[2/6] Жду healthy..."
for service in postgres-erp-local postgres-ismeta-local redis-local; do
    echo -n "  $service"
    for _ in $(seq 1 60); do
        status=$(docker inspect -f '{{.State.Health.Status}}' "$service" 2>/dev/null || echo "starting")
        if [ "$status" = "healthy" ]; then
            echo " OK"
            break
        fi
        echo -n "."
        sleep 1
    done
    if [ "$status" != "healthy" ]; then
        echo ""
        err "  $service не стал healthy. docker logs $service"
        exit 1
    fi
done

# -----------------------------------------------------------------------------
# 3. ERP миграции
# -----------------------------------------------------------------------------
log "[3/6] ERP миграции (cd backend && manage.py migrate)..."
if [ ! -x "$VENV_PYTHON" ]; then
    warn "  backend venv не найден ($VENV_PYTHON)."
    echo "  Запусти ./dev-local.sh --f8 — он создаст venv. Либо вручную:"
    echo "    python3.12 -m venv backend/.venv && backend/.venv/bin/pip install -r backend/requirements.txt"
    exit 1
fi

(
    cd "$ROOT_DIR/backend"
    DB_HOST="${F8_ERP_DB_HOST:-localhost}" \
    DB_PORT="${F8_ERP_DB_PORT:-5432}" \
    DB_NAME="${F8_ERP_DB_NAME:-finans_assistant}" \
    DB_USER="${F8_ERP_DB_USER:-postgres}" \
    DB_PASSWORD="${F8_ERP_DB_PASSWORD:-postgres}" \
    SECRET_KEY="${SECRET_KEY:-django-insecure-f8-local}" \
    DEBUG="True" \
    "$VENV_PYTHON" manage.py migrate --no-input
)

# -----------------------------------------------------------------------------
# 4. ismeta-postgres: создать таблицу llm_profile (raw SQL).
#    Схема — соответствует ismeta/backend/apps/llm_profiles/models.py.
#    Когда ismeta-backend локально поднимется и применит миграции, таблица уже
#    будет — миграцию помечают через manage.py migrate llm_profiles --fake
#    (см. local-dev.md, секция "Конфликт с ismeta-backend migrate").
# -----------------------------------------------------------------------------
log "[4/6] ismeta-postgres: создаю llm_profile..."
docker exec -i postgres-ismeta-local psql \
    -U "${F8_ISMETA_DB_USER:-ismeta}" \
    -d "${F8_ISMETA_DB_NAME:-ismeta}" <<'SQL'
CREATE TABLE IF NOT EXISTS llm_profile (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL UNIQUE,
    base_url        VARCHAR(200) NOT NULL DEFAULT 'https://api.openai.com',
    api_key_encrypted BYTEA NOT NULL,
    extract_model   VARCHAR(100) NOT NULL,
    multimodal_model VARCHAR(100) NOT NULL DEFAULT '',
    classify_model  VARCHAR(100) NOT NULL DEFAULT '',
    vision_supported BOOLEAN NOT NULL DEFAULT TRUE,
    is_default      BOOLEAN NOT NULL DEFAULT FALSE,
    created_by_id   INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_llm_profile_default
    ON llm_profile (is_default) WHERE is_default = TRUE;
SQL

# -----------------------------------------------------------------------------
# 5. Seed 4 LLMProfile (DeepSeek, OpenAI GPT-4o, Gemini, Grok)
# -----------------------------------------------------------------------------
log "[5/6] Seed LLMProfile (4 провайдера)..."
"$VENV_PYTHON" "$ROOT_DIR/scripts/seed_llm_profiles.py"

# -----------------------------------------------------------------------------
# 6. Storage + recognition-public + summary
# -----------------------------------------------------------------------------
log "[6/6] Storage + recognition-public..."
mkdir -p "$ROOT_DIR/storage/ismeta-uploads"
echo "  ./storage/ismeta-uploads/ создан"

# recognition-public опционально (зависит от F8-01). Стартуем но не падаем
# если build не проходит.
if docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d recognition-public 2>&1 | tee /tmp/f8-recog.log; then
    echo "  recognition-public контейнер запущен"
else
    warn "  recognition-public не поднялся (вероятно ждём F8-01 production Dockerfile)."
    warn "  F8-02/F8-04 БД-скоупа задачи это не блокирует."
fi

cat <<EOF

${GREEN}F8 локальный стенд готов.${NC}
  ${CYAN}postgres-erp:${NC}    localhost:${F8_ERP_DB_PORT:-5432}    ($DB_USER/****)
  ${CYAN}postgres-ismeta:${NC} localhost:${F8_ISMETA_DB_PORT:-5433} (${F8_ISMETA_DB_USER:-ismeta}/****)
  ${CYAN}redis:${NC}           localhost:${F8_REDIS_PORT:-6379}
  ${CYAN}recognition:${NC}     localhost:${F8_RECOGNITION_PORT:-8004}/v1/healthz
  ${CYAN}storage:${NC}         ./storage/ismeta-uploads/

Запуск приложений (нативно, hot-reload):
  ./dev-local.sh --f8     # ERP backend + Celery + frontend (без SSH-туннеля)

ismeta-backend (опционально, если нужен ISMeta MVP UI на :3001):
  cd ismeta && cp .env.example .env  # выставить POSTGRES_PORT=5433, REDIS_PORT=6380...
  docker compose up -d
  # При первом запуске пометить llm_profile миграцию как применённую:
  # docker exec ismeta-backend python manage.py migrate llm_profiles --fake-initial
EOF
