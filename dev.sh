#!/bin/bash
# Запуск проекта локально со свежей сборкой
set -e

echo "=== Остановка контейнеров ==="
docker compose down

echo "=== Сборка образов (свежий код) ==="
docker compose build

echo "=== Запуск ==="
docker compose up -d

echo ""
echo "=== Готово! ==="
echo "Frontend:     http://localhost:3000"
echo "Backend API:  http://localhost:8000"
echo "Kanban API:   http://localhost:8010"
echo "Mini App:     http://localhost:3001"
echo "MinIO:        http://localhost:9001"
echo ""
echo "Логи: docker compose logs -f"
