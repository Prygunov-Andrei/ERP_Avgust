from unittest.mock import patch, MagicMock

import pytest

from supplier_integrations.models import SupplierSyncLog
from supplier_integrations.tasks import sync_breez_catalog, sync_breez_stock


@pytest.mark.django_db
class TestCeleryTasks:

    @patch('supplier_integrations.services.breez_import.BreezImportService')
    def test_sync_catalog_task_calls_service(
        self, mock_service_cls, supplier_integration,
    ):
        mock_service = MagicMock()
        mock_service.import_full_catalog.return_value = MagicMock(
            status='success', items_processed=100, items_created=80, items_errors=0,
        )
        mock_service_cls.return_value = mock_service

        result = sync_breez_catalog(supplier_integration.pk)

        mock_service_cls.assert_called_once_with(supplier_integration)
        mock_service.import_full_catalog.assert_called_once()
        assert result['status'] == 'success'

    @patch('supplier_integrations.services.breez_sync.BreezSyncService')
    def test_sync_stock_task_calls_service(
        self, mock_service_cls, supplier_integration,
    ):
        mock_service = MagicMock()
        mock_service.sync_stock_and_prices.return_value = MagicMock(
            status='success', items_processed=50, items_updated=50, items_errors=0,
        )
        mock_service_cls.return_value = mock_service

        result = sync_breez_stock(supplier_integration.pk)

        mock_service_cls.assert_called_once_with(supplier_integration)
        mock_service.sync_stock_and_prices.assert_called_once()
        assert result['status'] == 'success'

    def test_sync_catalog_with_invalid_id(self):
        result = sync_breez_catalog(99999)
        assert result['status'] == 'error'

    def test_sync_stock_with_invalid_id(self):
        result = sync_breez_stock(99999)
        assert result['status'] == 'error'
