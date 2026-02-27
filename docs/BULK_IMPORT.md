# Массовый импорт счетов — архитектура

## Обзор

`InvoiceService.recognize()` — единственная точка обработки для всех сценариев:
- Одиночная загрузка через UI
- Массовая загрузка через UI (bulk-upload)
- Management command (`import_invoices_full`)
- Bitrix24 webhook (`process_bitrix_deal` → `recognize_invoice`)

## Статусный workflow

```
RECOGNITION → REVIEW → VERIFIED → [IN_REGISTRY → APPROVED → SENDING → PAID]
                                                              ↓ CANCELLED
```

| Статус | Описание |
|--------|----------|
| `recognition` | LLM обрабатывает файл |
| `review` | Оператор проверяет/исправляет данные |
| `verified` | Данные подтверждены, товары в каталоге. Счёт доступен для сравнения |
| `in_registry` | Отправлен на оплату (очередь директора) |
| `approved` | Директор подтвердил |
| `sending` | Отправляется в банк |
| `paid` | Оплачен |
| `cancelled` | Отменён на любом этапе |

**Важно:** VERIFIED → IN_REGISTRY — опциональный шаг. Не все счета идут на оплату (например, справочные счета сметчика для сравнения цен).

## Поток данных

```
1. Файл сохраняется в Invoice.invoice_file
2. Celery task recognize_invoice(invoice_id) запускается
3. InvoiceService.recognize():
   a) _parse_invoice_file()      → PDF/Excel/Image → ParsedInvoice
   b) _save_parsed_document()    → ParsedDocument (SHA256 file_hash)
   c) _populate_invoice_fields() → номер, дата, суммы
   d) _match_or_create_counterparty() → поиск/создание по ИНН
   e) _check_business_duplicate()    → номер + сумма + ИНН
   f) _create_invoice_items()    → InvoiceItem (product=None, raw_name сохраняется)
4. Invoice.status = REVIEW
5. Оператор проверяет данные → InvoiceService.verify():
   a) Валидация (контрагент обязателен, сумма обязательна)
   b) _create_products_from_items() → Product + ProductPriceHistory
   c) LLM batch-категоризация новых товаров
   d) Invoice.status = VERIFIED
6. [опционально] InvoiceService.submit_to_registry():
   Invoice.status = IN_REGISTRY (только VERIFIED → IN_REGISTRY)
```

**Ключевое изменение:** Товары создаются в каталоге только на шаге 5 (verify), а не при распознавании. Это исключает попадание ошибок OCR в каталог.

## Ключевые сервисы

| Сервис | Файл | Назначение |
|--------|------|-----------|
| InvoiceService | `payments/services.py` | Единый pipeline обработки |
| DocumentParser | `llm_services/services/document_parser.py` | PDF/Image → LLM Vision → ParsedInvoice |
| ExcelInvoiceParser | `llm_services/services/excel_parser.py` | Excel → текст → LLM → ParsedInvoice |
| ProductMatcher | `catalog/services.py` | Поиск/создание товаров (fuzzy + LLM) |
| ProductCategorizer | `catalog/categorizer.py` | LLM batch-категоризация |

## Модели

| Модель | Назначение |
|--------|-----------|
| `BulkImportSession` | Сессия массового импорта (прогресс, ошибки) |
| `Invoice.bulk_session` FK | Привязка счёта к сессии |
| `Invoice.Source.BULK_IMPORT` | Метка источника |

## Дедупликация

Два уровня:
1. **Файловый** — `ParsedDocument.file_hash` (SHA256). Одинаковый файл не парсится повторно.
2. **Бизнес-уровень** — после парсинга: `invoice_number` + `amount_gross` + ИНН контрагента. При обнаружении дубликата Invoice создаётся в REVIEW с предупреждением, Items НЕ создаются.

## API endpoints

| Метод | URL | Описание |
|-------|-----|----------|
| POST | `/api/v1/invoices/bulk-upload/` | Загрузка файлов → BulkImportSession |
| GET | `/api/v1/invoices/bulk-sessions/{id}/` | Статус сессии (поллинг) |
| POST | `/api/v1/invoices/{id}/verify/` | Подтвердить данные → VERIFIED |
| POST | `/api/v1/invoices/{id}/submit_to_registry/` | Отправить в реестр → IN_REGISTRY |

## Management command

```bash
python manage.py import_invoices_full ./invoices [--dry-run] [--limit N] [--no-auto-counterparty]
```

## Тестирование

```bash
pytest payments/tests/test_bulk_import_models.py
pytest payments/tests/test_recognize_service.py
pytest payments/tests/test_bulk_upload_api.py
```
