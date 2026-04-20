#!/usr/bin/env bash
# ISMeta — ежедневный бэкап PostgreSQL (E23, specs/12-security.md).
# Cron: 0 3 * * * /opt/ismeta/deploy/backup.sh
# Ротация: 7 дней.
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/backups/ismeta}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
COMPOSE_PROJECT="${COMPOSE_PROJECT:-ismeta}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-ismeta-postgres}"
DB_NAME="${DB_NAME:-ismeta}"
DB_USER="${DB_USER:-ismeta}"
DRY_RUN="${DRY_RUN:-0}"
DATE="$(date +%Y-%m-%d_%H%M)"
DUMP_FILE="${BACKUP_DIR}/${DB_NAME}-${DATE}.sql.gz"

log() { echo "[$(date +%H:%M:%S)] $*"; }

# --- Проверки ---
if ! docker ps --format '{{.Names}}' | grep -q "^${POSTGRES_CONTAINER}$"; then
    log "ERROR: контейнер ${POSTGRES_CONTAINER} не запущен"
    exit 1
fi

# --- Создать директорию ---
if [ "$DRY_RUN" = "1" ]; then
    log "[DRY-RUN] mkdir -p ${BACKUP_DIR}"
    log "[DRY-RUN] pg_dump → ${DUMP_FILE}"
    log "[DRY-RUN] Удалить бэкапы старше ${RETENTION_DAYS} дней"
    exit 0
fi

mkdir -p "${BACKUP_DIR}"

# --- Дамп ---
log "Начинаю бэкап ${DB_NAME} → ${DUMP_FILE}"
docker exec "${POSTGRES_CONTAINER}" pg_dump -U "${DB_USER}" "${DB_NAME}" | gzip > "${DUMP_FILE}"

DUMP_SIZE=$(du -h "${DUMP_FILE}" | cut -f1)
log "Бэкап завершён: ${DUMP_FILE} (${DUMP_SIZE})"

# --- Ротация ---
DELETED=$(find "${BACKUP_DIR}" -name "${DB_NAME}-*.sql.gz" -mtime "+${RETENTION_DAYS}" -print -delete | wc -l)
if [ "$DELETED" -gt 0 ]; then
    log "Удалено ${DELETED} старых бэкапов (>${RETENTION_DAYS} дней)"
fi

log "Бэкапы в ${BACKUP_DIR}:"
ls -lh "${BACKUP_DIR}"/${DB_NAME}-*.sql.gz 2>/dev/null | tail -7
