#!/bin/bash
# =============================================================================
# Остановка локальной разработки (из другого терминала)
# Использование: ./dev-stop.sh
# =============================================================================

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
PIDFILE="$ROOT_DIR/.dev-pids"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Остановить приложения по PID-файлу
if [ -f "$PIDFILE" ]; then
    echo -e "${YELLOW}Останавливаю приложения...${NC}"
    while read -r pid; do
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null && echo "  Остановлен PID $pid" || true
        fi
    done < "$PIDFILE"
    rm -f "$PIDFILE"
else
    echo -e "${YELLOW}PID-файл не найден, пробую найти процессы...${NC}"
    # Fallback: убить известные процессы
    pkill -f "manage.py runserver" 2>/dev/null && echo "  Остановлен Django" || true
    pkill -f "celery -A finans_assistant" 2>/dev/null && echo "  Остановлен Celery" || true
    pkill -f "next-server" 2>/dev/null && echo "  Остановлен Next.js" || true
fi

sleep 1

# Остановить Docker инфраструктуру
echo -e "${YELLOW}Останавливаю Docker инфраструктуру...${NC}"
docker compose -f "$ROOT_DIR/docker-compose.dev.yml" down

echo -e "${GREEN}Всё остановлено.${NC}"
