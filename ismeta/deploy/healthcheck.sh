#!/usr/bin/env bash
# ISMeta — проверка здоровья всех сервисов (E23).
# Cron: */5 * * * * /opt/ismeta/deploy/healthcheck.sh || mail -s "ISMeta DOWN" admin@example.com
# Exit 0 = ок, 1 = проблема.
set -uo pipefail

BACKEND_URL="${BACKEND_URL:-http://localhost:8001/health}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3001}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-ismeta-postgres}"
REDIS_CONTAINER="${REDIS_CONTAINER:-ismeta-redis}"
DRY_RUN="${DRY_RUN:-0}"

ERRORS=0

check() {
    local name="$1" cmd="$2"
    if [ "$DRY_RUN" = "1" ]; then
        echo "[DRY-RUN] check: ${name} → ${cmd}"
        return
    fi
    if eval "$cmd" > /dev/null 2>&1; then
        echo "✅ ${name}"
    else
        echo "❌ ${name}"
        ERRORS=$((ERRORS + 1))
    fi
}

check "Backend /health" "curl -fsS --max-time 5 ${BACKEND_URL}"
check "Frontend HTTP" "curl -fsS --max-time 5 ${FRONTEND_URL}"
check "PostgreSQL" "docker exec ${POSTGRES_CONTAINER} pg_isready -U ismeta -q"
check "Redis" "docker exec ${REDIS_CONTAINER} redis-cli ping"

if [ "$DRY_RUN" = "1" ]; then
    echo "[DRY-RUN] Все проверки показаны, не выполнялись."
    exit 0
fi

if [ "$ERRORS" -gt 0 ]; then
    echo "⚠️  ${ERRORS} проблем(а) обнаружено"
    exit 1
else
    echo "Все сервисы работают."
    exit 0
fi
