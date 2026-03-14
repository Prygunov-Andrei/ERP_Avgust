from decimal import Decimal
from unittest.mock import patch

import pytest
from rest_framework import status

from supplier_integrations.models import (
    SupplierIntegration,
    SupplierProduct,
    SupplierSyncLog,
)
from catalog.models import Product


@pytest.mark.django_db
class TestSupplierIntegrationAPI:

    def test_unauthenticated_returns_401(self, api_client):
        response = api_client.get('/api/v1/supplier-integrations/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_list_integrations(self, authenticated_client, supplier_integration):
        response = authenticated_client.get('/api/v1/supplier-integrations/')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1

    def test_create_integration(self, authenticated_client):
        data = {
            'name': 'Test Supplier',
            'provider': 'breez',
            'base_url': 'https://api.test.ru/v1',
            'auth_header': 'Basic abc123',
        }
        response = authenticated_client.post('/api/v1/supplier-integrations/', data)
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['name'] == 'Test Supplier'

    def test_auth_header_not_in_response(self, authenticated_client, supplier_integration):
        response = authenticated_client.get(
            f'/api/v1/supplier-integrations/{supplier_integration.pk}/'
        )
        assert 'auth_header' not in response.data

    def test_update_integration(self, authenticated_client, supplier_integration):
        response = authenticated_client.patch(
            f'/api/v1/supplier-integrations/{supplier_integration.pk}/',
            {'name': 'Updated Name'},
        )
        assert response.status_code == status.HTTP_200_OK
        supplier_integration.refresh_from_db()
        assert supplier_integration.name == 'Updated Name'

    def test_delete_integration(self, authenticated_client, supplier_integration):
        response = authenticated_client.delete(
            f'/api/v1/supplier-integrations/{supplier_integration.pk}/'
        )
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not SupplierIntegration.objects.filter(pk=supplier_integration.pk).exists()

    @patch('supplier_integrations.views.sync_breez_catalog')
    def test_sync_catalog_starts_task(self, mock_task, authenticated_client, supplier_integration):
        mock_task.delay.return_value.id = 'test-task-id'
        response = authenticated_client.post(
            f'/api/v1/supplier-integrations/{supplier_integration.pk}/sync-catalog/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['task_id'] == 'test-task-id'
        mock_task.delay.assert_called_once_with(supplier_integration.pk)

    @patch('supplier_integrations.views.sync_breez_stock')
    def test_sync_stock_starts_task(self, mock_task, authenticated_client, supplier_integration):
        mock_task.delay.return_value.id = 'test-task-id'
        response = authenticated_client.post(
            f'/api/v1/supplier-integrations/{supplier_integration.pk}/sync-stock/'
        )
        assert response.status_code == status.HTTP_200_OK
        mock_task.delay.assert_called_once_with(supplier_integration.pk)

    def test_sync_inactive_returns_400(self, authenticated_client, supplier_integration):
        supplier_integration.is_active = False
        supplier_integration.save()
        response = authenticated_client.post(
            f'/api/v1/supplier-integrations/{supplier_integration.pk}/sync-catalog/'
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_status_endpoint(self, authenticated_client, supplier_integration):
        response = authenticated_client.get(
            f'/api/v1/supplier-integrations/{supplier_integration.pk}/status/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert 'products_count' in response.data


@pytest.mark.django_db
class TestSupplierProductAPI:

    def test_list_products(self, authenticated_client, supplier_product):
        response = authenticated_client.get('/api/v1/supplier-products/')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1

    def test_retrieve_product(self, authenticated_client, supplier_product):
        response = authenticated_client.get(f'/api/v1/supplier-products/{supplier_product.pk}/')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['nc_code'] == 'НС-1234567'
        assert 'stocks' in response.data

    def test_search_by_title(self, authenticated_client, supplier_product):
        response = authenticated_client.get('/api/v1/supplier-products/?search=Вентилятор')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1

    def test_search_by_nc_code(self, authenticated_client, supplier_product):
        response = authenticated_client.get('/api/v1/supplier-products/?search=НС-1234567')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1

    def test_search_by_articul(self, authenticated_client, supplier_product):
        response = authenticated_client.get('/api/v1/supplier-products/?search=KD-315-M1')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1

    def test_link_product(self, authenticated_client, supplier_product):
        product = Product.objects.create(
            name='Тестовый товар',
            normalized_name='тестовый товар',
        )
        response = authenticated_client.post(
            f'/api/v1/supplier-products/{supplier_product.pk}/link/',
            {'product_id': product.pk},
        )
        assert response.status_code == status.HTTP_200_OK
        supplier_product.refresh_from_db()
        assert supplier_product.product == product

    def test_link_nonexistent_product(self, authenticated_client, supplier_product):
        response = authenticated_client.post(
            f'/api/v1/supplier-products/{supplier_product.pk}/link/',
            {'product_id': 99999},
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_filter_by_brand(self, authenticated_client, supplier_product, supplier_brand):
        response = authenticated_client.get(
            f'/api/v1/supplier-products/?brand={supplier_brand.pk}'
        )
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1


@pytest.mark.django_db
class TestSupplierCategoryAPI:

    def test_list_categories(self, authenticated_client, supplier_category):
        response = authenticated_client.get('/api/v1/supplier-categories/')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1

    def test_update_mapping(self, authenticated_client, supplier_category):
        from catalog.models import Category
        cat = Category.objects.create(name='Вентиляция', code='vent')
        response = authenticated_client.patch(
            f'/api/v1/supplier-categories/{supplier_category.pk}/',
            {'our_category': cat.pk},
        )
        assert response.status_code == status.HTTP_200_OK
        supplier_category.refresh_from_db()
        assert supplier_category.our_category == cat


@pytest.mark.django_db
class TestSupplierSyncLogAPI:

    def test_list_sync_logs(self, authenticated_client, supplier_integration):
        SupplierSyncLog.objects.create(
            integration=supplier_integration,
            sync_type=SupplierSyncLog.SyncType.CATALOG_FULL,
            status=SupplierSyncLog.Status.SUCCESS,
        )
        response = authenticated_client.get('/api/v1/supplier-sync-logs/')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1

    def test_filter_by_sync_type(self, authenticated_client, supplier_integration):
        SupplierSyncLog.objects.create(
            integration=supplier_integration,
            sync_type=SupplierSyncLog.SyncType.CATALOG_FULL,
            status=SupplierSyncLog.Status.SUCCESS,
        )
        SupplierSyncLog.objects.create(
            integration=supplier_integration,
            sync_type=SupplierSyncLog.SyncType.STOCK_SYNC,
            status=SupplierSyncLog.Status.SUCCESS,
        )
        response = authenticated_client.get(
            '/api/v1/supplier-sync-logs/?sync_type=catalog_full'
        )
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1
