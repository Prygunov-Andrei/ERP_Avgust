#!/usr/bin/env bash
# ISMeta — восстановление из бэкапа (E23).
# Использование: ./restore.sh /opt/backups/ismeta/ismeta-2026-04-20_0300.sql.gz
set -euo pipefail

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-ismeta-postgres}"
DB_NAME="${DB_NAME:-ismeta}"
DB_USER="${DB_USER:-ismeta}"
DRY_RUN="${DRY_RUN:-0}"

log() { echo "[$(date +%H:%M:%S)] $*"; }

if [ $# -lt 1 ]; then
    echo "Использование: $0 <path-to-dump.sql.gz>"
    echo "  DRY_RUN=1 $0 dump.sql.gz  — показать план без выполнения"
    exit 1
fi

DUMP_FILE="$1"

if [ ! -f "${DUMP_FILE}" ]; then
    log "ERROR: файл не найден: ${DUMP_FILE}"
    exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -q "^${POSTGRES_CONTAINER}$"; then
    log "ERROR: контейнер ${POSTGRES_CONTAINER} не запущен"
    exit 1
fi

if [ "$DRY_RUN" = "1" ]; then
    log "[DRY-RUN] Будет восстановлена БД ${DB_NAME} из ${DUMP_FILE}"
    log "[DRY-RUN] 1. DROP DATABASE ${DB_NAME} (IF EXISTS)"
    log "[DRY-RUN] 2. CREATE DATABASE ${DB_NAME}"
    log "[DRY-RUN] 3. gunzip | psql"
    exit 0
fi

log "⚠️  ВНИМАНИЕ: восстановление удалит текущую БД ${DB_NAME}!"
read -p "Продолжить? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    log "Отменено."
    exit 0
fi

log "Останавливаю backend для безопасного восстановления..."
docker stop ismeta-backend 2>/dev/null || true

log "Пересоздаю БД ${DB_NAME}..."
docker exec "${POSTGRES_CONTAINER}" psql -U "${DB_USER}" -d postgres \
    -c "DROP DATABASE IF EXISTS ${DB_NAME};" \
    -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"

log "Восстанавливаю из ${DUMP_FILE}..."
gunzip -c "${DUMP_FILE}" | docker exec -i "${POSTGRES_CONTAINER}" psql -U "${DB_USER}" -d "${DB_NAME}" -q

log "Запускаю backend..."
docker start ismeta-backend

log "✅ Восстановление завершено."
