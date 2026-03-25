#!/bin/bash
set -euo pipefail

echo "=========================================="
echo "Full Deployment Script"
echo "=========================================="
echo ""

# Проверка что мы на сервере
if [ ! -d "/opt/finans_assistant" ]; then
    echo "Error: /opt/finans_assistant does not exist!"
    echo "Please run this script on the production server."
    exit 1
fi

cd /opt/finans_assistant

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'
COMPOSE=(docker compose -f docker-compose.prod.yml)

wait_for_http() {
    local url="$1"
    local label="$2"
    local attempts="${3:-30}"
    local delay="${4:-2}"

    for ((i=1; i<=attempts; i++)); do
        if curl -fsS "$url" >/dev/null 2>&1; then
            echo -e "${GREEN}${label} OK${NC}"
            return 0
        fi
        sleep "$delay"
    done

    echo -e "${RED}${label} failed: ${url}${NC}"
    return 1
}

run_backend_check() {
    local description="$1"
    shift
    echo -e "${GREEN}${description}${NC}"
    "${COMPOSE[@]}" exec -T backend "$@"
}

echo -e "${GREEN}[1/9] Syncing application code...${NC}"
if [ "${SKIP_GIT_PULL:-0}" = "1" ]; then
    echo -e "${YELLOW}SKIP_GIT_PULL=1, using current server workspace without git pull.${NC}"
else
    git pull origin main
fi

# Проверка критических переменных окружения
MISSING_SECRETS=0
if ! grep -qE '^SECRET_KEY=.+' .env 2>/dev/null || grep -q 'django-insecure' .env 2>/dev/null; then
    echo -e "${RED}ВНИМАНИЕ: SECRET_KEY не задан или содержит django-insecure! Это небезопасно для production.${NC}"
    MISSING_SECRETS=1
fi
if ! grep -qE '^BANK_ENCRYPTION_KEY=.+' .env 2>/dev/null; then
    echo -e "${YELLOW}Внимание: BANK_ENCRYPTION_KEY не задан в .env. Добавьте его для работы банковского модуля.${NC}"
    echo "Сгенерировать: python3 -c \"from cryptography.fernet import Fernet; print('BANK_ENCRYPTION_KEY=' + Fernet.generate_key().decode())\""
fi
if ! grep -qE '^JWT_PRIVATE_KEY=.+' .env 2>/dev/null && ! grep -qE '^SIGNING_KEY=.+' .env 2>/dev/null; then
    echo -e "${YELLOW}Внимание: JWT_PRIVATE_KEY / SIGNING_KEY не задан. JWT аутентификация может работать с дефолтным SECRET_KEY.${NC}"
fi
if grep -qE '^DEBUG=True' .env 2>/dev/null; then
    echo -e "${RED}ВНИМАНИЕ: DEBUG=True в production! Это небезопасно.${NC}"
    MISSING_SECRETS=1
fi
if [ "$MISSING_SECRETS" -eq 1 ]; then
    echo -e "${YELLOW}Продолжить деплой? (y/N)${NC}"
    read -r -t 10 REPLY || REPLY="y"
    if [ "$REPLY" != "y" ] && [ "$REPLY" != "Y" ]; then
        echo "Деплой отменён."
        exit 1
    fi
fi

echo -e "${GREEN}[2/9] Backing up database before deploy...${NC}"
./deploy/backup.sh || echo -e "${YELLOW}Warning: Full backup failed (services may not be running yet)${NC}"

echo -e "${GREEN}[3/9] Stopping existing containers...${NC}"
"${COMPOSE[@]}" down --remove-orphans

echo -e "${GREEN}[4/9] Building Docker images...${NC}"
"${COMPOSE[@]}" build --no-cache

echo -e "${GREEN}[5/9] Starting containers...${NC}"
"${COMPOSE[@]}" up -d

echo -e "${GREEN}[6/9] Waiting for services to be healthy...${NC}"
wait_for_http "http://localhost:8000/api/v1/health/" "Backend health"

echo -e "${GREEN}[7/9] Running database migrations...${NC}"
"${COMPOSE[@]}" exec -T backend python manage.py migrate --noinput

echo -e "${GREEN}[7.1/9] Настройка LLM-провайдеров...${NC}"
"${COMPOSE[@]}" exec -T backend python manage.py setup_providers

echo -e "${GREEN}[7.2/9] Collecting static files...${NC}"
"${COMPOSE[@]}" exec -T backend python manage.py collectstatic --noinput

run_backend_check "[7.3/9] Django system checks..." python manage.py check
run_backend_check "[7.4/9] HVAC smoke checks..." python manage.py hvac_api_smoke --skip-feedback-write

echo -e "${GREEN}[8/9] Checking service status...${NC}"
"${COMPOSE[@]}" ps

echo -e "${GREEN}[9/9] Testing backend health...${NC}"
wait_for_http "http://localhost:8000/api/schema/" "Backend schema"
wait_for_http "http://localhost:3000/" "Frontend root" 40 3

echo -e "${GREEN}[9.1/9] Cleaning unused Docker artifacts...${NC}"
docker container prune -f >/dev/null 2>&1 || true
docker image prune -af >/dev/null 2>&1 || true
docker builder prune -af >/dev/null 2>&1 || true

echo ""
echo -e "${GREEN}Deployment completed!${NC}"
echo ""
echo "Services status:"
"${COMPOSE[@]}" ps
echo ""
echo "To view logs: docker compose -f docker-compose.prod.yml logs -f [service]"
echo "To restart: docker compose -f docker-compose.prod.yml restart [service]"
echo "Для локальной разработки с production DB используйте SSH-туннель на 127.0.0.1:5432 сервера."
echo ""
