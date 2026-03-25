#!/bin/bash
set -euo pipefail

if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <dump_file> <target_db>"
    exit 1
fi

DUMP_FILE="$1"
TARGET_DB="$2"

if [ ! -f "$DUMP_FILE" ]; then
    echo "Dump file not found: $DUMP_FILE"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUN_MODE="${BACKUP_MODE:-auto}"

if [ "$RUN_MODE" = "auto" ]; then
    if [ -d "/opt/finans_assistant" ] && command -v docker >/dev/null 2>&1; then
        RUN_MODE="docker"
        PROJECT_ROOT="/opt/finans_assistant"
    else
        RUN_MODE="local"
    fi
fi

cd "$PROJECT_ROOT"

if [ "${BACKUP_SKIP_ENV_FILE:-0}" != "1" ] && [ -f ".env" ]; then
    set -a
    . ./.env
    set +a
fi

DB_USER_VALUE="${DB_USER:-postgres}"
DB_HOST_VALUE="${DB_HOST:-localhost}"
DB_PORT_VALUE="${DB_PORT:-5432}"

echo "Restoring $DUMP_FILE into $TARGET_DB"
if [ "$RUN_MODE" = "docker" ]; then
    docker compose -f docker-compose.prod.yml exec -T postgres dropdb -U "$DB_USER_VALUE" --if-exists "$TARGET_DB"
    docker compose -f docker-compose.prod.yml exec -T postgres createdb -U "$DB_USER_VALUE" "$TARGET_DB"
    docker compose -f docker-compose.prod.yml exec -T postgres pg_restore -U "$DB_USER_VALUE" -d "$TARGET_DB" --clean --if-exists < "$DUMP_FILE"
else
    dropdb -h "$DB_HOST_VALUE" -p "$DB_PORT_VALUE" -U "$DB_USER_VALUE" --if-exists "$TARGET_DB"
    createdb -h "$DB_HOST_VALUE" -p "$DB_PORT_VALUE" -U "$DB_USER_VALUE" "$TARGET_DB"
    pg_restore -h "$DB_HOST_VALUE" -p "$DB_PORT_VALUE" -U "$DB_USER_VALUE" -d "$TARGET_DB" --clean --if-exists "$DUMP_FILE"
fi

echo "Restore completed."
