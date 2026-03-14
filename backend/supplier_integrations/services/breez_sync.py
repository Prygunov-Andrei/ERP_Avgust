import logging
import time

from django.db import transaction
from django.utils import timezone

from supplier_integrations.clients.breez import BreezAPIClient
from supplier_integrations.models import (
    SupplierProduct,
    SupplierStock,
    SupplierSyncLog,
)

logger = logging.getLogger(__name__)


class BreezSyncService:
    """Синхронизация остатков и цен из Breez API"""

    def __init__(self, integration):
        self.integration = integration

    def sync_stock_and_prices(self):
        """Синхронизация из /leftoversnew/

        Формат ответа: {nc_code: {nc, articul, title, stocks: [{stock, quantity}],
        price: [{base, base_currency}, {ric, ric_currency}], for_marketplace, reload_time}}
        """
        sync_log = SupplierSyncLog.objects.create(
            integration=self.integration,
            sync_type=SupplierSyncLog.SyncType.STOCK_SYNC,
            status=SupplierSyncLog.Status.STARTED,
        )
        start_time = time.time()

        try:
            with BreezAPIClient(self.integration) as client:
                data = client.get_leftovers()

            if not isinstance(data, dict):
                raise ValueError(f'Неожиданный формат leftovers: {type(data)}')

            # Карта nc_code → SupplierProduct
            existing_products = {
                sp.nc_code: sp
                for sp in SupplierProduct.objects.filter(
                    integration=self.integration,
                    is_active=True,
                )
            }

            stocks_to_create = []

            for nc_code, item in data.items():
                if not nc_code:
                    continue

                supplier_product = existing_products.get(nc_code)
                if not supplier_product:
                    sync_log.items_errors += 1
                    continue

                try:
                    self._update_prices(supplier_product, item)
                    new_stocks = self._parse_stocks(supplier_product, item)
                    stocks_to_create.extend(new_stocks)

                    # Update for_marketplace flag
                    if 'for_marketplace' in item:
                        supplier_product.for_marketplace = bool(item['for_marketplace'])
                        supplier_product.save(update_fields=['for_marketplace', 'updated_at'])

                    sync_log.items_processed += 1
                    sync_log.items_updated += 1
                except Exception as e:
                    sync_log.items_errors += 1
                    sync_log.error_details.append(f'{nc_code}: {e}')
                    logger.warning('Ошибка синхронизации %s: %s', nc_code, e)

            # Пересоздание остатков в транзакции
            with transaction.atomic():
                SupplierStock.objects.filter(
                    supplier_product__integration=self.integration,
                ).delete()
                SupplierStock.objects.bulk_create(stocks_to_create, batch_size=500)

            sync_log.status = (
                SupplierSyncLog.Status.PARTIAL
                if sync_log.items_errors > 0
                else SupplierSyncLog.Status.SUCCESS
            )
            self.integration.last_stock_sync = timezone.now()
            self.integration.save(update_fields=['last_stock_sync', 'updated_at'])

        except Exception as e:
            sync_log.status = SupplierSyncLog.Status.FAILED
            sync_log.error_details.append(str(e))
            logger.exception('Ошибка синхронизации остатков Breez: %s', e)
            raise
        finally:
            sync_log.duration_seconds = time.time() - start_time
            sync_log.save()

        return sync_log

    def _update_prices(self, supplier_product, item):
        """Обновляет цены на SupplierProduct.

        Формат price: [{base: N, base_currency: "RUB"}, {ric: N, ric_currency: "RUB"}]
        """
        updated_fields = []
        price_list = item.get('price', [])

        if isinstance(price_list, list):
            for price_entry in price_list:
                if isinstance(price_entry, dict):
                    if 'base' in price_entry:
                        supplier_product.base_price = price_entry['base']
                        supplier_product.base_price_currency = price_entry.get('base_currency', 'RUB')
                        updated_fields.extend(['base_price', 'base_price_currency'])
                    if 'ric' in price_entry:
                        supplier_product.ric_price = price_entry['ric']
                        supplier_product.ric_price_currency = price_entry.get('ric_currency', 'RUB')
                        updated_fields.extend(['ric_price', 'ric_price_currency'])

        if updated_fields:
            supplier_product.price_updated_at = timezone.now()
            updated_fields.extend(['price_updated_at', 'updated_at'])
            supplier_product.save(update_fields=updated_fields)

    def _parse_stocks(self, supplier_product, item):
        """Парсит остатки по складам → список SupplierStock.

        Формат stocks: [{stock: "МОС Бриз Медведково LV", quantity: 0}, ...]
        """
        stocks = []
        warehouses = item.get('stocks', [])

        if isinstance(warehouses, list):
            for wh in warehouses:
                name = wh.get('stock', '')
                qty = wh.get('quantity', 0)
                if name:
                    stocks.append(SupplierStock(
                        supplier_product=supplier_product,
                        warehouse_name=name,
                        quantity=int(qty) if qty else 0,
                    ))

        return stocks
