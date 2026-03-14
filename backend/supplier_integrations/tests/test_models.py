import pytest
from decimal import Decimal

from supplier_integrations.models import (
    SupplierIntegration,
    SupplierCategory,
    SupplierBrand,
    SupplierProduct,
    SupplierStock,
    SupplierSyncLog,
)


@pytest.mark.django_db
class TestSupplierIntegration:
    def test_create(self, supplier_integration):
        assert supplier_integration.pk is not None
        assert str(supplier_integration) == 'Breez'
        assert supplier_integration.is_active is True

    def test_provider_choices(self):
        assert SupplierIntegration.Provider.BREEZ == 'breez'


@pytest.mark.django_db
class TestSupplierCategory:
    def test_create(self, supplier_category):
        assert supplier_category.pk is not None
        assert str(supplier_category) == 'Вентиляция'

    def test_unique_constraint(self, supplier_integration, supplier_category):
        with pytest.raises(Exception):
            SupplierCategory.objects.create(
                integration=supplier_integration,
                external_id=1,  # тот же external_id
                title='Дубликат',
            )

    def test_hierarchy(self, supplier_integration, supplier_category):
        child = SupplierCategory.objects.create(
            integration=supplier_integration,
            external_id=2,
            title='Канальные вентиляторы',
            parent=supplier_category,
            parent_external_id=1,
        )
        assert child.parent == supplier_category
        assert supplier_category.children.count() == 1


@pytest.mark.django_db
class TestSupplierProduct:
    def test_create(self, supplier_product):
        assert supplier_product.pk is not None
        assert 'НС-1234567' in str(supplier_product)

    def test_unique_constraint(self, supplier_integration, supplier_product):
        with pytest.raises(Exception):
            SupplierProduct.objects.create(
                integration=supplier_integration,
                external_id=999,
                nc_code='НС-1234567',  # тот же nc_code
                title='Дубликат',
            )

    def test_total_stock(self, supplier_product, supplier_stock):
        assert supplier_product.total_stock == 15

    def test_total_stock_empty(self, supplier_product):
        assert supplier_product.total_stock == 0


@pytest.mark.django_db
class TestSupplierStock:
    def test_create(self, supplier_stock):
        assert supplier_stock.pk is not None
        assert supplier_stock.quantity == 15

    def test_unique_per_warehouse(self, supplier_product, supplier_stock):
        with pytest.raises(Exception):
            SupplierStock.objects.create(
                supplier_product=supplier_product,
                warehouse_name='Москва',  # тот же склад
                quantity=10,
            )

    def test_multiple_warehouses(self, supplier_product):
        SupplierStock.objects.create(
            supplier_product=supplier_product,
            warehouse_name='Москва',
            quantity=10,
        )
        SupplierStock.objects.create(
            supplier_product=supplier_product,
            warehouse_name='Санкт-Петербург',
            quantity=5,
        )
        assert supplier_product.total_stock == 15


@pytest.mark.django_db
class TestSupplierSyncLog:
    def test_create(self, supplier_integration):
        log = SupplierSyncLog.objects.create(
            integration=supplier_integration,
            sync_type=SupplierSyncLog.SyncType.CATALOG_FULL,
            status=SupplierSyncLog.Status.SUCCESS,
            items_processed=100,
            items_created=80,
            items_updated=20,
            duration_seconds=45.5,
        )
        assert log.pk is not None
        assert 'Успешно' in str(log)
