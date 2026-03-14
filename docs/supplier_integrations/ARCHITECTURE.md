# Архитектура модуля Интеграции поставщиков

## Обзор

Модуль `supplier_integrations` реализует импорт каталогов товаров, цен и остатков от поставщиков через их REST API. Первый подключённый поставщик — **Breez** (климатическое оборудование).

## Поток данных

```
Breez API ──► BreezAPIClient ──► BreezImportService ──► SupplierProduct
                                       │                      │
                                       │                SupplierProductLinker
                                       │                      │
                                       ▼                      ▼
                              SupplierSyncLog         catalog.Product (1:1)
```

### Маппинг Product ↔ SupplierProduct (1:1)

Каждый SupplierProduct получает свой собственный Product. При импорте:
1. `BreezImportService._import_single_product()` создаёт SupplierProduct
2. Если `supplier_product.product` отсутствует — создаёт новый `Product.objects.create()`
3. `SupplierProductLinker.link_and_enrich()` обогащает Product данными поставщика

Fuzzy-matching (`ProductMatcher`) **не** используется при импорте каталога поставщика. Он используется только при подборе цен в сметах (`EstimateAutoMatcher`).

## Модели

| Модель | Описание |
|--------|----------|
| `SupplierIntegration` | Конфигурация подключения (URL, ключи, контрагент) |
| `SupplierCategory` | Категория поставщика с маппингом на нашу Category |
| `SupplierBrand` | Бренд поставщика |
| `SupplierProduct` | Товар поставщика (цены, ТХ, изображения, привязка к Product) |
| `SupplierStock` | Остатки по складам поставщика |
| `SupplierSyncLog` | Лог каждой синхронизации |

### Связь с каталогом

- `SupplierProduct.product` → FK к `catalog.Product` (1:1 после импорта)
- `SupplierProduct.base_price` — закупочная цена (внутренняя, не для публичного API)
- `SupplierProduct.ric_price` — рекомендованная цена (безопасна для публичного API)
- `SupplierIntegration.counterparty` → FK к `accounting.Counterparty`

### Связь со сметами

- `EstimateItem.supplier_product` → FK к `SupplierProduct` — выбранное предложение поставщика
- Устанавливается при автоподборе цен (`EstimateAutoMatcher.preview_matches` → apply)

## Сервисы

### BreezAPIClient (`clients/breez.py`)
HTTP-клиент с retry-логикой (3 попытки), контекст-менеджер. Использует `httpx`.

### BreezImportService (`services/breez_import.py`)
Полный импорт каталога: категории → бренды → товары. При импорте товара:
1. `update_or_create` SupplierProduct по NC-коду
2. Создание нового Product (1:1, без fuzzy-matching)
3. Обогащение Product через `SupplierProductLinker` (только пустые поля)
4. Создание alias `breez:<NC-код>`

### BreezSyncService (`services/breez_sync.py`)
Синхронизация остатков и цен из `/v1/leftoversnew/`. Остатки пересоздаются в транзакции.

### SupplierProductLinker (`services/product_linker.py`)
Привязка SupplierProduct → Product с обогащением (images, description, brand, series, tech_specs, booklet_url, manual_url).

### ProductMediaDownloader (`services/media_downloader.py`)
Скачивает внешние URL (картинки, буклеты, инструкции) в MinIO. Идемпотентный — пропускает уже скачанные. Rate limiting: 0.2с между запросами.

## Management-команды

| Команда | Описание |
|---------|----------|
| `import_breez` | Первичный импорт каталога Breez |
| `cleanup_breez_products` | Очистка: обнуляет привязки, архивирует пустые Product |
| `reimport_breez` | Cleanup + полный переимпорт 1:1 |
| `download_product_media` | Скачать медиа из внешних URL в MinIO |

## Celery задачи

Две задачи — только ручной запуск через UI (НЕ в beat schedule):
- `sync_breez_catalog` — полный импорт каталога
- `sync_breez_stock` — синхронизация остатков/цен
- `download_all_product_media` — скачивание медиа в MinIO (batch)

## REST API

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET/POST | `/supplier-integrations/` | CRUD подключений |
| POST | `/supplier-integrations/{id}/sync-catalog/` | Запуск импорта |
| POST | `/supplier-integrations/{id}/sync-stock/` | Запуск синхр. остатков |
| GET | `/supplier-integrations/{id}/status/` | Статус синхронизаций |
| GET | `/supplier-products/` | Каталог товаров поставщика |
| GET | `/supplier-products/?product={id}` | Товары поставщика для конкретного Product |
| POST | `/supplier-products/{id}/link/` | Привязка к нашему Product |
| GET/PATCH | `/supplier-categories/` | Категории с маппингом |
| GET | `/supplier-brands/` | Бренды |
| GET | `/supplier-sync-logs/` | Логи |

### Фильтры Product по поставщику

В `ProductViewSet` доступны:
- `?supplier={counterparty_id}` — товары от конкретного поставщика
- `?in_stock=true` — товары с наличием на складах

## Подбор цен в сметах

`EstimateAutoMatcher.preview_matches()` собирает предложения из двух источников:
1. **Каталог поставщика** — `SupplierProduct.base_price`
2. **Счета** — `ProductPriceHistory`

Параметры:
- `supplier_ids` — список ID Counterparty для фильтрации (None = все)
- `price_strategy` — `cheapest` (мин. цена) или `latest` (последняя)

Результат: `best_offer` + `all_offers` для каждой строки сметы.

## Публичное API (заготовка)

Модуль `api_public` содержит заготовки для будущего внешнего сервиса:
- `PublicProductSerializer` — без закупочных цен (`base_price`)
- `PublicSupplierProductSerializer` — только `ric_price`, только `is_public` поставщики
- `APIKeyAuthentication` — заглушка авторизации по API-ключу

Поле `Counterparty.is_public` определяет видимость поставщика в публичном API.

## Как добавить нового поставщика

1. Создать API-клиент в `clients/` (по образцу `breez.py`)
2. Создать сервис импорта в `services/` (по образцу `breez_import.py`)
3. Добавить provider в `SupplierIntegration.Provider` choices
4. Добавить Celery задачи в `tasks.py`
5. Обновить views для роутинга по `integration.provider`

## Конфигурация

Env-переменные (Docker):
- `BREEZ_API_BASE_URL` — URL API (default: `https://api.breez.ru/v1`)
- `BREEZ_API_AUTH_HEADER` — заголовок авторизации
- `PRODUCT_MEDIA_S3_BUCKET` — бакет MinIO для медиа (default: `product-media`)

Django settings:
```python
BREEZ_API_BASE_URL = os.environ.get('BREEZ_API_BASE_URL', 'https://api.breez.ru/v1')
BREEZ_API_AUTH_HEADER = os.environ.get('BREEZ_API_AUTH_HEADER', '')
PRODUCT_MEDIA_S3_BUCKET = os.environ.get('PRODUCT_MEDIA_S3_BUCKET', 'product-media')
```
