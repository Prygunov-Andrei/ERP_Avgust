#!/bin/bash
set -e

echo "=========================================="
echo "Backup Script"
echo "=========================================="
echo ""

BACKUP_DIR="/opt/backups/finans_assistant"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

cd /opt/finans_assistant

GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}[1/3] Backing up PostgreSQL database...${NC}"
docker compose -f docker-compose.prod.yml exec -T postgres \
    pg_dump -U finans_user finans_assistant_prod \
    > "$BACKUP_DIR/postgres_backup_$DATE.sql"

# Верификация: проверяем что дамп не пустой и читаем
if [ ! -s "$BACKUP_DIR/postgres_backup_$DATE.sql" ]; then
    echo "ERROR: Backup file is empty! Aborting."
    rm -f "$BACKUP_DIR/postgres_backup_$DATE.sql"
    exit 1
fi
# Проверка что дамп содержит валидные SQL-команды
if ! head -5 "$BACKUP_DIR/postgres_backup_$DATE.sql" | grep -q 'PostgreSQL database dump'; then
    echo "WARNING: Backup file doesn't look like a valid pg_dump output."
fi
# Полная верификация через pg_restore --list (dry-run парсинг дампа)
if docker compose -f docker-compose.prod.yml exec -T postgres pg_restore --list "$BACKUP_DIR/postgres_backup_$DATE.sql" > /dev/null 2>&1; then
    echo "Backup verification: pg_restore --list OK"
else
    # pg_restore --list не работает с plain-text дампами, это нормально
    # Для custom/directory формата это была бы полная проверка
    echo "Note: pg_restore --list skipped (plain-text SQL format)"
fi

echo -e "${GREEN}[2/3] Backing up MinIO data...${NC}"
docker run --rm \
    -v finans_assistant_minio_data:/data:ro \
    -v "$BACKUP_DIR":/backup \
    alpine tar czf "/backup/minio_backup_$DATE.tar.gz" -C /data .

echo -e "${GREEN}[3/3] Backing up .env file...${NC}"
cp /opt/finans_assistant/.env "$BACKUP_DIR/env_backup_$DATE"

echo ""
echo "Backup completed! Files saved to: $BACKUP_DIR"
ls -lh "$BACKUP_DIR" | tail -3
echo ""

# Ротация бэкапов: оставляем минимум 5 последних, остальные старше 30 дней удаляем
echo "Cleaning up old backups (keeping at least 5 newest, removing >30 days)..."
for PREFIX in postgres_backup minio_backup env_backup; do
    COUNT=$(ls -1 "$BACKUP_DIR"/${PREFIX}_* 2>/dev/null | wc -l)
    if [ "$COUNT" -gt 5 ]; then
        ls -1t "$BACKUP_DIR"/${PREFIX}_* | tail -n +6 | while read -r OLD; do
            if [ "$(find "$OLD" -mtime +30 2>/dev/null)" ]; then
                rm -f "$OLD"
                echo "  Removed: $(basename "$OLD")"
            fi
        done
    fi
done
echo "Done!"
