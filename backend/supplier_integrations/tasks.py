import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=300)
def sync_breez_catalog(self, integration_id):
    """Полный импорт каталога Breez (запускается вручную из UI)"""
    from supplier_integrations.models import SupplierIntegration
    from supplier_integrations.services.breez_import import BreezImportService

    try:
        integration = SupplierIntegration.objects.get(pk=integration_id)
        service = BreezImportService(integration)
        sync_log = service.import_full_catalog()
        logger.info(
            'Импорт каталога Breez завершён: обработано=%d, создано=%d, ошибок=%d',
            sync_log.items_processed, sync_log.items_created, sync_log.items_errors,
        )
        return {
            'status': sync_log.status,
            'items_processed': sync_log.items_processed,
            'items_created': sync_log.items_created,
            'items_errors': sync_log.items_errors,
        }
    except SupplierIntegration.DoesNotExist:
        logger.error('Интеграция #%d не найдена', integration_id)
        return {'status': 'error', 'message': f'Integration {integration_id} not found'}
    except Exception as exc:
        logger.exception('Ошибка импорта каталога Breez: %s', exc)
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=300)
def sync_breez_stock(self, integration_id):
    """Синхронизация остатков/цен Breez (запускается вручную из UI)"""
    from supplier_integrations.models import SupplierIntegration
    from supplier_integrations.services.breez_sync import BreezSyncService

    try:
        integration = SupplierIntegration.objects.get(pk=integration_id)
        service = BreezSyncService(integration)
        sync_log = service.sync_stock_and_prices()
        logger.info(
            'Синхронизация остатков Breez завершена: обработано=%d, обновлено=%d, ошибок=%d',
            sync_log.items_processed, sync_log.items_updated, sync_log.items_errors,
        )
        return {
            'status': sync_log.status,
            'items_processed': sync_log.items_processed,
            'items_updated': sync_log.items_updated,
            'items_errors': sync_log.items_errors,
        }
    except SupplierIntegration.DoesNotExist:
        logger.error('Интеграция #%d не найдена', integration_id)
        return {'status': 'error', 'message': f'Integration {integration_id} not found'}
    except Exception as exc:
        logger.exception('Ошибка синхронизации остатков Breez: %s', exc)
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=2, default_retry_delay=60)
def download_all_product_media(self, integration_id=None):
    """Скачать все внешние медиа товаров в MinIO."""
    from supplier_integrations.services.media_downloader import ProductMediaDownloader

    try:
        with ProductMediaDownloader() as downloader:
            if integration_id:
                stats = downloader.download_all_for_integration(integration_id)
            else:
                # Все интеграции
                from supplier_integrations.models import SupplierIntegration
                stats = {'downloaded': 0, 'skipped': 0, 'errors': 0}
                for integration in SupplierIntegration.objects.filter(is_active=True):
                    result = downloader.download_all_for_integration(integration.pk)
                    for k in stats:
                        stats[k] += result[k]
        logger.info('Загрузка медиа завершена: %s', stats)
        return stats
    except Exception as exc:
        logger.exception('Ошибка загрузки медиа: %s', exc)
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def download_product_media(self, product_id):
    """Скачать медиа одного Product."""
    from catalog.models import Product
    from supplier_integrations.services.media_downloader import ProductMediaDownloader

    try:
        product = Product.objects.get(pk=product_id)
        with ProductMediaDownloader() as downloader:
            downloader.download_for_product(product)
        return {'status': 'ok', 'product_id': product_id}
    except Product.DoesNotExist:
        logger.error('Product #%d не найден', product_id)
        return {'status': 'error', 'message': f'Product {product_id} not found'}
    except Exception as exc:
        logger.exception('Ошибка загрузки медиа Product #%d: %s', product_id, exc)
        raise self.retry(exc=exc)
