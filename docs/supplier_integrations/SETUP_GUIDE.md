# Руководство по настройке интеграции с поставщиками

## Быстрый старт

### 1. Настройка окружения

Добавьте в `.env` или окружение Docker:

```env
BREEZ_API_BASE_URL=https://api.breez.ru/v1
BREEZ_API_AUTH_HEADER=Basic aGVyci5wcnlndW5vdkBnbWFpbC5jb206ZmNjNTIzNGNkNGY2YzdhN2M4Njg=
```

### 2. Применение миграций

```bash
# В Docker
docker compose exec backend python manage.py migrate supplier_integrations
docker compose exec backend python manage.py migrate accounting
docker compose exec backend python manage.py migrate estimates
docker compose exec backend python manage.py migrate catalog
```

### 3. Начальный импорт через management-команду

```bash
# Создать интеграцию + импортировать каталог
docker compose exec backend python manage.py import_breez --create-integration

# Только тестовое подключение (dry run)
docker compose exec backend python manage.py import_breez --create-integration --dry-run

# Только синхронизация остатков
docker compose exec backend python manage.py import_breez --stock-only

# Использовать конкретную интеграцию
docker compose exec backend python manage.py import_breez --integration-id=1
```

### 4. Очистка и переимпорт (1:1)

Если нужно пересоздать маппинг Product ↔ SupplierProduct:

```bash
# Очистка: обнуляет привязки, удаляет breez-алиасы, архивирует пустые Product
docker compose exec backend python manage.py cleanup_breez_products

# Просмотр без изменений
docker compose exec backend python manage.py cleanup_breez_products --dry-run

# Полный переимпорт: cleanup + import + sync
docker compose exec backend python manage.py reimport_breez
```

### 5. Скачивание медиа в MinIO

```bash
# Все медиа для интеграции
docker compose exec backend python manage.py download_product_media --integration-id=1

# Медиа одного товара
docker compose exec backend python manage.py download_product_media --product-id=123

# Асинхронно через Celery
docker compose exec backend python manage.py download_product_media --integration-id=1 --async
```

### 6. Через UI

1. Перейти в **Настройки → Интеграции поставщиков**
2. Нажать **Добавить поставщика**
3. Заполнить: название, URL API, Authorization header
4. Нажать **Синхр. каталог** на карточке поставщика
5. Дождаться завершения (лог доступен на вкладке **Логи**)

## MinIO (S3) бакет для медиа

Бакет `product-media` создаётся автоматически через docker-compose (сервис `createbuckets`). Если нужно создать вручную:

```bash
docker compose exec minio mc mb myminio/product-media --ignore-existing
docker compose exec minio mc anonymous set download myminio/product-media
```

## Мониторинг

### Логи в Django Admin

- `/admin/supplier_integrations/suppliersynclog/` — все логи синхронизаций

### Celery

Задачи выполняются через Celery Worker. Проверка:
```bash
docker compose logs celery-worker | grep -i breez
```

## Troubleshooting

| Проблема | Решение |
|----------|---------|
| 401 Unauthorized | Проверить `BREEZ_API_AUTH_HEADER` (формат: `Basic <base64>`) |
| Timeout | Увеличить `TIMEOUT` в `BreezAPIClient` или проверить сеть |
| Дубликаты Product | Запустить `cleanup_breez_products` + `reimport_breez` для 1:1 маппинга |
| Остатки не обновляются | Сначала нужен импорт каталога (`sync-catalog`), потом `sync-stock` |
| Картинки не отображаются | Запустить `download_product_media` для скачивания в MinIO |
| Медиа не скачиваются | Проверить доступность MinIO и бакета `product-media` |
