#!/bin/bash
# Проверяет, что все критичные env-переменные присутствуют в .env.example.
#
# Защита от кейса: разработчик добавил в код чтение новой переменной (например,
# ANTHROPIC_API_KEY), но забыл прописать её в .env.example. После деплоя переменная
# отсутствует в окружении → функционал падает "молча".
#
# Exit 0 — всё ок; exit 1 — расхождение.
#
# Использование:
#   bash deploy/check_env_keys.sh            # проверка
#   REQUIRED_KEYS="FOO BAR" bash ...         # добавить ключи адхок

set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_EXAMPLE="$ROOT/.env.example"

# --- Список обязательных ключей ---
# Держим один источник истины здесь. При добавлении новой env-переменной в код —
# обязательно добавьте её сюда.
DEFAULT_REQUIRED=(
    # Инфраструктура
    DB_NAME DB_USER DB_PASSWORD DB_HOST DB_PORT
    MINIO_ROOT_USER MINIO_ROOT_PASSWORD
    SECRET_KEY
    BANK_ENCRYPTION_KEY
    # LLM (критично для импорта смет/счетов и HVAC discovery)
    OPENAI_API_KEY
    GEMINI_API_KEY
    GOOGLE_AI_API_KEY
    GROK_API_KEY
    # Telegram
    TELEGRAM_BOT_TOKEN
    # JWT
    JWT_PRIVATE_KEY JWT_PUBLIC_KEY JWT_ISSUER JWT_AUDIENCE
)

REQUIRED=(${REQUIRED_KEYS:-${DEFAULT_REQUIRED[@]}})

if [ ! -f "$ENV_EXAMPLE" ]; then
    echo "ERROR: $ENV_EXAMPLE не найден"
    exit 1
fi

missing=()
for key in "${REQUIRED[@]}"; do
    if ! grep -qE "^${key}=" "$ENV_EXAMPLE"; then
        missing+=("$key")
    fi
done

if [ ${#missing[@]} -gt 0 ]; then
    echo "❌ В .env.example отсутствуют обязательные ключи:"
    for k in "${missing[@]}"; do
        echo "   - $k"
    done
    echo ""
    echo "Добавьте их в .env.example (можно с пустым значением) и пересохраните PR."
    exit 1
fi

echo "✓ Все ${#REQUIRED[@]} обязательных env-ключа присутствуют в .env.example"
