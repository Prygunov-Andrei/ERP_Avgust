from decimal import Decimal
from unittest.mock import patch, MagicMock

import pytest

from supplier_integrations.models import (
    SupplierProduct,
    SupplierStock,
    SupplierSyncLog,
)
from supplier_integrations.services.breez_sync import BreezSyncService


@pytest.mark.django_db
class TestBreezSyncService:

    @pytest.fixture
    def mock_client(self):
        with patch('supplier_integrations.services.breez_sync.BreezAPIClient') as mock_cls:
            client = MagicMock()
            mock_cls.return_value = client
            client.__enter__ = MagicMock(return_value=client)
            client.__exit__ = MagicMock(return_value=False)
            yield client

    @pytest.fixture
    def leftovers_data(self):
        return [
            {
                'nc': 'НС-1234567',
                'prices': {
                    'base': '15000.00',
                    'ric': '22000.00',
                },
                'warehouses': [
                    {'name': 'Москва', 'quantity': 10},
                    {'name': 'Санкт-Петербург', 'quantity': 5},
                ],
            },
        ]

    def test_sync_updates_prices(
        self, supplier_integration, supplier_product, mock_client, leftovers_data,
    ):
        mock_client.get_leftovers.return_value = leftovers_data

        service = BreezSyncService(supplier_integration)
        service.sync_stock_and_prices()

        supplier_product.refresh_from_db()
        assert supplier_product.base_price == Decimal('15000.00')
        assert supplier_product.ric_price == Decimal('22000.00')
        assert supplier_product.price_updated_at is not None

    def test_sync_updates_stocks(
        self, supplier_integration, supplier_product, mock_client, leftovers_data,
    ):
        mock_client.get_leftovers.return_value = leftovers_data

        service = BreezSyncService(supplier_integration)
        service.sync_stock_and_prices()

        stocks = SupplierStock.objects.filter(supplier_product=supplier_product)
        assert stocks.count() == 2
        assert stocks.get(warehouse_name='Москва').quantity == 10
        assert stocks.get(warehouse_name='Санкт-Петербург').quantity == 5

    def test_sync_unknown_nc_skipped(
        self, supplier_integration, supplier_product, mock_client,
    ):
        mock_client.get_leftovers.return_value = [
            {'nc': 'НС-UNKNOWN', 'prices': {'base': '100'}, 'warehouses': []},
        ]

        service = BreezSyncService(supplier_integration)
        sync_log = service.sync_stock_and_prices()

        assert sync_log.items_processed == 0
        assert sync_log.items_errors == 1

    def test_sync_creates_sync_log(
        self, supplier_integration, supplier_product, mock_client, leftovers_data,
    ):
        mock_client.get_leftovers.return_value = leftovers_data

        service = BreezSyncService(supplier_integration)
        sync_log = service.sync_stock_and_prices()

        assert sync_log.pk is not None
        assert sync_log.sync_type == SupplierSyncLog.SyncType.STOCK_SYNC
        assert sync_log.status == SupplierSyncLog.Status.SUCCESS
        assert sync_log.items_processed == 1
        assert sync_log.items_updated == 1

    def test_sync_replaces_old_stocks(
        self, supplier_integration, supplier_product, supplier_stock, mock_client,
    ):
        """Старые остатки удаляются при синхронизации"""
        assert SupplierStock.objects.filter(supplier_product=supplier_product).count() == 1

        mock_client.get_leftovers.return_value = [
            {
                'nc': 'НС-1234567',
                'prices': {'base': '12500.00'},
                'warehouses': [{'name': 'Новый склад', 'quantity': 3}],
            },
        ]

        service = BreezSyncService(supplier_integration)
        service.sync_stock_and_prices()

        stocks = SupplierStock.objects.filter(supplier_product=supplier_product)
        assert stocks.count() == 1
        assert stocks.first().warehouse_name == 'Новый склад'

    def test_sync_error_marks_log_failed(
        self, supplier_integration, mock_client,
    ):
        mock_client.get_leftovers.side_effect = Exception('Connection error')

        service = BreezSyncService(supplier_integration)
        with pytest.raises(Exception):
            service.sync_stock_and_prices()

        log = SupplierSyncLog.objects.filter(integration=supplier_integration).first()
        assert log.status == SupplierSyncLog.Status.FAILED
