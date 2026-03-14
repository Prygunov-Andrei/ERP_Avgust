"""
Celery-задачи для парсинга каталогов поставщиков.

parse_supplier_catalog_task — полный цикл: TOC → парсинг → JSON
import_catalog_to_db_task — импорт JSON в таблицу Product
"""
import logging
import time

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=0, time_limit=7200, soft_time_limit=7000)
def parse_supplier_catalog_task(self, catalog_id: int, detect_toc: bool = True):
    """
    Асинхронный парсинг PDF-каталога поставщика.

    1. Определение оглавления (TOC) через LLM (если detect_toc=True)
    2. Парсинг всех секций батчами
    3. Сохранение результата в JSON

    Прогресс сохраняется в модель SupplierCatalog — фронтенд поллит по API.
    """
    from catalog.models import SupplierCatalog
    from catalog.services.catalog_parser import CatalogParserService

    catalog = SupplierCatalog.objects.get(pk=catalog_id)
    catalog.task_id = self.request.id
    catalog.errors = []
    catalog.error_message = ''
    catalog.save(update_fields=['task_id', 'errors', 'error_message'])

    service = CatalogParserService(catalog)

    try:
        # Фаза 1: определение оглавления
        if detect_toc and not catalog.sections:
            catalog.status = SupplierCatalog.Status.DETECTING_TOC
            catalog.save(update_fields=['status'])

            service.detect_toc()
            catalog.refresh_from_db()

            catalog.status = SupplierCatalog.Status.TOC_READY
            catalog.save(update_fields=['status'])

            logger.info('TOC определён для каталога %d: %d секций',
                        catalog_id, len(catalog.sections))

        # Создаём недостающие категории
        created = service.ensure_categories()
        if created:
            logger.info('Создано %d категорий для каталога %d', created, catalog_id)

        # Фаза 2: парсинг секций
        catalog.status = SupplierCatalog.Status.PARSING
        catalog.save(update_fields=['status'])

        def on_progress(section_idx, batch_idx, total_batches, products_count, variants_count):
            # Проверяем отмену перед каждым батчем
            catalog.refresh_from_db()
            if catalog.status != SupplierCatalog.Status.PARSING:
                raise InterruptedError('Парсинг отменён пользователем')

            catalog.current_section = section_idx
            catalog.current_batch = batch_idx
            catalog.total_batches = total_batches
            catalog.products_count = products_count
            catalog.variants_count = variants_count
            catalog.save(update_fields=[
                'current_section', 'current_batch', 'total_batches',
                'products_count', 'variants_count',
            ])

        service.parse_all_sections(progress_callback=on_progress)

        # Успех
        catalog.status = SupplierCatalog.Status.PARSED
        catalog.save(update_fields=['status'])

        logger.info('Парсинг каталога %d завершён: %d товаров, %d вариантов',
                     catalog_id, catalog.products_count, catalog.variants_count)

    except InterruptedError:
        logger.info('Парсинг каталога %d отменён', catalog_id)

    except Exception as e:
        catalog.status = SupplierCatalog.Status.ERROR
        catalog.error_message = str(e)
        catalog.save(update_fields=['status', 'error_message'])
        logger.exception('Ошибка парсинга каталога %d: %s', catalog_id, e)
        raise


@shared_task(bind=True, max_retries=0, time_limit=600, soft_time_limit=550)
def import_catalog_to_db_task(self, catalog_id: int, reset: bool = False):
    """
    Импорт распарсенного JSON в таблицу Product.

    Создаёт недостающие категории, затем импортирует товары.
    """
    from catalog.models import SupplierCatalog
    from catalog.services.catalog_parser import CatalogParserService

    catalog = SupplierCatalog.objects.get(pk=catalog_id)
    catalog.task_id = self.request.id
    catalog.status = SupplierCatalog.Status.IMPORTING
    catalog.error_message = ''
    catalog.save(update_fields=['task_id', 'status', 'error_message'])

    try:
        # Создаём недостающие категории (если не были созданы на этапе парсинга)
        service = CatalogParserService(catalog)
        service.ensure_categories()

        # Импорт товаров
        created = CatalogParserService.import_to_db(catalog, reset=reset)

        catalog.status = SupplierCatalog.Status.IMPORTED
        catalog.save(update_fields=['status'])

        logger.info('Импорт каталога %d завершён: %d товаров', catalog_id, created)

    except Exception as e:
        catalog.status = SupplierCatalog.Status.ERROR
        catalog.error_message = str(e)
        catalog.save(update_fields=['status', 'error_message'])
        logger.exception('Ошибка импорта каталога %d: %s', catalog_id, e)
        raise
