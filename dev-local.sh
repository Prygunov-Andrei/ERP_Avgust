#!/bin/bash
# =============================================================================
# Локальная разработка: полный запуск одной командой
# SSH-туннель → venv → Docker инфраструктура → миграции → приложения
#
# Запуск:
#   ./dev-local.sh         # дефолт: прод-БД через SSH-туннель + dev infra
#   ./dev-local.sh --f8    # F8: локальный postgres-erp + ismeta + redis,
#                          # БЕЗ SSH-туннеля. См. docker-compose.local.yml.
# Остановка: Ctrl+C (или ./dev-stop.sh из другого терминала)
#
# БД: продакшен через SSH-туннель (localhost:15432 → prod:5432)
# Docker: только Redis + MinIO (для Celery и файлов)
# Приложения: нативно на хосте (Django, Celery, Next.js)
# =============================================================================

set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
PIDFILE="$ROOT_DIR/.dev-pids"
VENV_DIR="$ROOT_DIR/backend/.venv"
PYTHON="$VENV_DIR/bin/python"
CELERY="$VENV_DIR/bin/celery"

# --- Флаги -------------------------------------------------------------------
F8_MODE=false
for arg in "$@"; do
    case "$arg" in
        --f8) F8_MODE=true ;;
        -h|--help)
            sed -n '2,11p' "$0" | sed 's/^# *//'
            exit 0
            ;;
    esac
done

# Цвета
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

cleanup() {
    echo ""
    echo -e "${YELLOW}Останавливаю приложения...${NC}"

    if [ -f "$PIDFILE" ]; then
        while read -r pid; do
            if kill -0 "$pid" 2>/dev/null; then
                kill "$pid" 2>/dev/null || true
            fi
        done < "$PIDFILE"
        rm -f "$PIDFILE"
    fi

    sleep 1

    echo -e "${YELLOW}Останавливаю Docker инфраструктуру...${NC}"
    if [ "$F8_MODE" = true ]; then
        docker compose --env-file "$ROOT_DIR/.env.local" -f "$ROOT_DIR/docker-compose.local.yml" down
        echo -e "${GREEN}Всё остановлено.${NC}"
    else
        docker compose -f "$ROOT_DIR/docker-compose.dev.yml" down
        # SSH-туннель НЕ убиваем — он переживает перезапуски
        echo -e "${GREEN}Всё остановлено. SSH-туннель оставлен активным.${NC}"
    fi
    exit 0
}

trap cleanup SIGINT SIGTERM

# =========================================================================
# Очистка: убить старые процессы на наших портах
# =========================================================================
echo -e "${YELLOW}Очищаю старые процессы...${NC}"

# Старый pidfile
if [ -f "$PIDFILE" ]; then
    while read -r pid; do
        kill "$pid" 2>/dev/null || true
    done < "$PIDFILE"
    rm -f "$PIDFILE"
fi

# Django (порт 8000)
OLD_DJANGO=$(lsof -ti :8000 2>/dev/null || true)
if [ -n "$OLD_DJANGO" ]; then
    echo "  Убиваю старый Django на :8000 (PID: $OLD_DJANGO)"
    echo "$OLD_DJANGO" | xargs kill 2>/dev/null || true
fi

# Next.js (порт 3000)
OLD_NEXT=$(lsof -ti :3000 2>/dev/null || true)
if [ -n "$OLD_NEXT" ]; then
    echo "  Убиваю старый Next.js на :3000 (PID: $OLD_NEXT)"
    echo "$OLD_NEXT" | xargs kill 2>/dev/null || true
fi

# Celery
pkill -f "celery -A finans_assistant" 2>/dev/null && echo "  Убит старый Celery" || true

# Подождать освобождения портов
if [ -n "$OLD_DJANGO" ] || [ -n "$OLD_NEXT" ]; then
    sleep 1
fi

echo "  OK"

# =========================================================================
# 0. Загрузить переменные окружения
# =========================================================================
if [ "$F8_MODE" = true ]; then
    if [ ! -f "$ROOT_DIR/.env.local" ]; then
        echo -e "${RED}.env.local не найден!${NC}"
        echo "Скопируйте .env.local.example → .env.local и заполните"
        echo "(см. docs/epics/F8-public-ismeta/local-dev.md)"
        exit 1
    fi
    set -a
    source "$ROOT_DIR/.env.local"
    set +a
    echo -e "${CYAN}F8 режим: локальный стенд (postgres-erp + ismeta + redis)${NC}"
else
    if [ -f "$ROOT_DIR/backend/.env" ]; then
        set -a
        source "$ROOT_DIR/backend/.env"
        set +a
    else
        echo -e "${RED}backend/.env не найден!${NC}"
        echo "Скопируйте .env.example → .env и заполните значениями"
        exit 1
    fi
fi

# =========================================================================
# 1. SSH-туннель к прод-БД (только в дефолтном режиме)
# =========================================================================
if [ "$F8_MODE" = true ]; then
    echo -e "${GREEN}[1/6] SSH-туннель пропущен (--f8 использует локальный postgres)${NC}"
else
TUNNEL_PORT="${DB_PORT:-15432}"
echo -e "${GREEN}[1/6] SSH-туннель к прод-БД (порт $TUNNEL_PORT)...${NC}"

if lsof -i :"$TUNNEL_PORT" > /dev/null 2>&1; then
    echo "  Туннель уже активен"
else
    echo "  Туннель не найден, поднимаю..."

    if [ -z "$PROD_SSH_HOST" ]; then
        echo -e "${RED}PROD_SSH_HOST не задан в backend/.env${NC}"
        exit 1
    fi

    if ! command -v sshpass &> /dev/null; then
        echo -e "${RED}sshpass не установлен!${NC}"
        echo "  Установите: brew install hudochenkov/sshpass/sshpass"
        exit 1
    fi

    SSHPASS="$PROD_SSH_PASS" sshpass -e ssh \
        -o StrictHostKeyChecking=no \
        -o ServerAliveInterval=60 \
        -o ServerAliveCountMax=3 \
        -N -L "$TUNNEL_PORT":127.0.0.1:5432 \
        "${PROD_SSH_USER:-root}@${PROD_SSH_HOST}" &
    SSH_PID=$!

    echo -n "  Жду подключения"
    for i in $(seq 1 15); do
        if lsof -i :"$TUNNEL_PORT" > /dev/null 2>&1; then
            echo " OK"
            break
        fi
        if ! kill -0 "$SSH_PID" 2>/dev/null; then
            echo ""
            echo -e "${RED}SSH-туннель упал. Проверьте доступ к $PROD_SSH_HOST${NC}"
            exit 1
        fi
        echo -n "."
        sleep 1
    done

    if ! lsof -i :"$TUNNEL_PORT" > /dev/null 2>&1; then
        echo ""
        echo -e "${RED}Таймаут: SSH-туннель не поднялся за 15 сек${NC}"
        kill "$SSH_PID" 2>/dev/null || true
        exit 1
    fi
fi

# Быстрая проверка что БД отвечает
echo -n "  Проверяю соединение с БД..."
if PGPASSWORD="$DB_PASSWORD" psql -h "${DB_HOST:-localhost}" -p "$TUNNEL_PORT" -U "${DB_USER:-postgres}" -d "${DB_NAME:-finans_assistant}" -c "SELECT 1" > /dev/null 2>&1; then
    echo " OK"
else
    echo ""
    echo -e "${RED}БД не отвечает на порту $TUNNEL_PORT. Туннель есть, но БД недоступна.${NC}"
    exit 1
fi
fi  # /F8_MODE != true (SSH-туннель блок)

# =========================================================================
# 2. Python venv
# =========================================================================
echo -e "${GREEN}[2/6] Python venv...${NC}"

NEED_VENV=false
if [ ! -f "$PYTHON" ]; then
    NEED_VENV=true
    echo "  venv не найден, создаю..."
elif ! "$PYTHON" -c "import django" 2>/dev/null; then
    NEED_VENV=true
    echo "  venv сломан (django не импортируется), пересоздаю..."
    rm -rf "$VENV_DIR"
fi

if [ "$NEED_VENV" = true ]; then
    python3.12 -m venv "$VENV_DIR"
    "$VENV_DIR/bin/pip" install --quiet --upgrade pip
    "$VENV_DIR/bin/pip" install --quiet -r "$ROOT_DIR/backend/requirements.txt"
    "$VENV_DIR/bin/pip" install --quiet whitenoise
    echo "  venv создан и зависимости установлены"
else
    echo "  OK"
fi

# =========================================================================
# 3. Docker инфраструктура
#    --f8: postgres-erp + postgres-ismeta + redis + recognition-public
#    default: Redis + MinIO
# =========================================================================
if [ "$F8_MODE" = true ]; then
    echo -e "${GREEN}[3/6] Docker инфраструктура (postgres-erp/ismeta, redis, recognition-public)...${NC}"
    docker compose --env-file "$ROOT_DIR/.env.local" -f "$ROOT_DIR/docker-compose.local.yml" up -d
else
    echo -e "${GREEN}[3/6] Docker инфраструктура (Redis, MinIO)...${NC}"
    docker compose -f "$ROOT_DIR/docker-compose.dev.yml" up -d
fi

# =========================================================================
# 4. Ждём готовности сервисов
# =========================================================================
echo -e "${GREEN}[4/6] Жду готовности сервисов...${NC}"

if [ "$F8_MODE" = true ]; then
    for service in postgres-erp-local postgres-ismeta-local redis-local; do
        echo -n "  $service..."
        for _ in $(seq 1 60); do
            status=$(docker inspect -f '{{.State.Health.Status}}' "$service" 2>/dev/null || echo "starting")
            if [ "$status" = "healthy" ]; then echo " OK"; break; fi
            echo -n "."
            sleep 1
        done
    done
else
    echo -n "  Redis..."
    until docker compose -f "$ROOT_DIR/docker-compose.dev.yml" exec -T redis redis-cli ping > /dev/null 2>&1; do
        echo -n "."
        sleep 1
    done
    echo " OK"

    echo -n "  MinIO..."
    until curl -sf http://localhost:9000/minio/health/live > /dev/null 2>&1; do
        echo -n "."
        sleep 1
    done
    echo " OK"
fi

# =========================================================================
# 5. Миграции
# =========================================================================
echo -e "${GREEN}[5/6] Применяю миграции...${NC}"
cd "$ROOT_DIR/backend"

echo "  ERP (finans_assistant)..."
$PYTHON manage.py migrate --no-input

echo "  Настройка LLM-провайдеров..."
$PYTHON manage.py setup_providers

cd "$ROOT_DIR"

# =========================================================================
# 6. Запуск приложений
# =========================================================================
echo -e "${GREEN}[6/6] Запускаю приложения...${NC}"

# Django ERP (порт 8000)
cd "$ROOT_DIR/backend"
$PYTHON manage.py runserver 0.0.0.0:8000 &
echo $! >> "$PIDFILE"
echo "  Django ERP         → PID $!"

# Celery ERP worker
# macOS: --pool=solo чтобы избежать SIGSEGV при fork() (ObjC runtime)
CELERY_POOL="prefork"
if [ "$(uname)" = "Darwin" ]; then
    CELERY_POOL="solo"
fi
$CELERY -A finans_assistant worker --pool=$CELERY_POOL --concurrency=1 -l info &
echo $! >> "$PIDFILE"
echo "  Celery ERP worker  → PID $! (pool=$CELERY_POOL)"

# Celery ERP beat (периодические задачи)
$CELERY -A finans_assistant beat -l info --schedule=/tmp/celerybeat-erp &
echo $! >> "$PIDFILE"
echo "  Celery ERP beat    → PID $!"

# Next.js dev server (порт 3000)
cd "$ROOT_DIR/frontend"
npm run dev &
echo $! >> "$PIDFILE"
echo "  Next.js frontend   → PID $!"

cd "$ROOT_DIR"

# =========================================================================
# Готово
# =========================================================================
echo ""
echo -e "${GREEN}Локальная разработка запущена!${NC}"
echo ""
echo -e "  ${CYAN}Frontend:${NC}    http://localhost:3000"
echo -e "  ${CYAN}ERP API:${NC}     http://localhost:8000/api/v1/"
echo -e "  ${CYAN}Kanban API:${NC}  http://localhost:8000/kanban-api/v1/"
if [ "$F8_MODE" = true ]; then
    echo -e "  ${CYAN}postgres-erp:${NC}    localhost:${F8_ERP_DB_PORT:-5432}"
    echo -e "  ${CYAN}postgres-ismeta:${NC} localhost:${F8_ISMETA_DB_PORT:-5433}"
    echo -e "  ${CYAN}recognition:${NC}     http://localhost:${F8_RECOGNITION_PORT:-8004}/v1/healthz"
    echo ""
    echo -e "${YELLOW}Ctrl+C для остановки. F8 БД сохранится в docker volumes.${NC}"
else
    echo -e "  ${CYAN}MinIO:${NC}       http://localhost:9001"
    echo -e "  ${CYAN}Прод-БД:${NC}     localhost:$TUNNEL_PORT → $PROD_SSH_HOST"
    echo ""
    echo -e "${YELLOW}Ctrl+C для остановки (SSH-туннель останется активным)${NC}"
fi
echo ""

# Ждём завершения (Ctrl+C вызовет cleanup через trap)
wait
