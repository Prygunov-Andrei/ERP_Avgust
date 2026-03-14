from decimal import Decimal
from unittest.mock import patch, MagicMock

import pytest

from catalog.models import Product, ProductAlias
from supplier_integrations.models import (
    SupplierCategory,
    SupplierBrand,
    SupplierProduct,
    SupplierSyncLog,
)
from supplier_integrations.services.breez_import import BreezImportService


@pytest.mark.django_db
class TestBreezImportService:

    @pytest.fixture
    def mock_client(self):
        with patch('supplier_integrations.services.breez_import.BreezAPIClient') as mock_cls:
            client = MagicMock()
            mock_cls.return_value = client
            client.__enter__ = MagicMock(return_value=client)
            client.__exit__ = MagicMock(return_value=False)
            yield client

    @pytest.fixture
    def api_categories(self):
        return [
            {'id': 1, 'title': 'Вентиляция', 'parent_id': None},
            {'id': 2, 'title': 'Канальные вентиляторы', 'parent_id': 1},
        ]

    @pytest.fixture
    def api_brands(self):
        return [
            {'id': 10, 'title': 'Systemair', 'image': 'https://img/sys.png', 'website': 'https://systemair.com'},
        ]

    @pytest.fixture
    def api_products(self):
        return [
            {
                'id': 1001,
                'nc': 'НС-0001',
                'articul': 'KD-315',
                'title': 'Вентилятор канальный KD 315',
                'description': 'Описание вентилятора',
                'category_id': 1,
                'brand_id': 10,
                'series': 'KD',
                'base_price': '12500.00',
                'ric_price': '18900.00',
                'images': ['https://img/1.jpg', 'https://img/2.jpg'],
                'booklet': 'https://docs/booklet.pdf',
                'manual': 'https://docs/manual.pdf',
                'tech': {'Мощность': '250 Вт', 'Расход': '1500 м³/ч'},
            },
        ]

    def test_import_categories(self, supplier_integration, mock_client, api_categories):
        mock_client.get_categories.return_value = api_categories
        mock_client.get_brands.return_value = []
        mock_client.get_products.return_value = []

        service = BreezImportService(supplier_integration)
        sync_log = service.import_full_catalog()

        assert SupplierCategory.objects.filter(integration=supplier_integration).count() == 2
        assert sync_log.status == SupplierSyncLog.Status.SUCCESS

    def test_import_categories_with_parent(self, supplier_integration, mock_client, api_categories):
        mock_client.get_categories.return_value = api_categories
        mock_client.get_brands.return_value = []
        mock_client.get_products.return_value = []

        service = BreezImportService(supplier_integration)
        service.import_full_catalog()

        child = SupplierCategory.objects.get(
            integration=supplier_integration, external_id=2,
        )
        assert child.parent is not None
        assert child.parent.external_id == 1

    def test_import_brands(self, supplier_integration, mock_client, api_brands):
        mock_client.get_categories.return_value = []
        mock_client.get_brands.return_value = api_brands
        mock_client.get_products.return_value = []

        service = BreezImportService(supplier_integration)
        service.import_full_catalog()

        assert SupplierBrand.objects.filter(integration=supplier_integration).count() == 1
        brand = SupplierBrand.objects.get(integration=supplier_integration, external_id=10)
        assert brand.title == 'Systemair'

    def test_import_products_creates_supplier_product(
        self, supplier_integration, mock_client, api_categories, api_brands, api_products,
    ):
        mock_client.get_categories.return_value = api_categories
        mock_client.get_brands.return_value = api_brands
        mock_client.get_products.return_value = api_products

        service = BreezImportService(supplier_integration)
        sync_log = service.import_full_catalog()

        sp = SupplierProduct.objects.get(integration=supplier_integration, nc_code='НС-0001')
        assert sp.title == 'Вентилятор канальный KD 315'
        assert sp.base_price == Decimal('12500.00')
        assert sp.ric_price == Decimal('18900.00')
        assert len(sp.images) == 2
        assert sync_log.items_created == 1

    def test_import_products_creates_catalog_product(
        self, supplier_integration, mock_client, api_categories, api_brands, api_products,
    ):
        mock_client.get_categories.return_value = api_categories
        mock_client.get_brands.return_value = api_brands
        mock_client.get_products.return_value = api_products

        service = BreezImportService(supplier_integration)
        service.import_full_catalog()

        sp = SupplierProduct.objects.get(nc_code='НС-0001')
        assert sp.product is not None
        assert sp.product.status == Product.Status.VERIFIED

    def test_import_products_enriches_product(
        self, supplier_integration, mock_client, api_categories, api_brands, api_products,
    ):
        mock_client.get_categories.return_value = api_categories
        mock_client.get_brands.return_value = api_brands
        mock_client.get_products.return_value = api_products

        service = BreezImportService(supplier_integration)
        service.import_full_catalog()

        sp = SupplierProduct.objects.get(nc_code='НС-0001')
        product = sp.product
        assert len(product.images) == 2
        assert product.description == 'Описание вентилятора'
        assert product.brand == 'Systemair'
        assert product.series == 'KD'

    def test_import_does_not_overwrite_manual_data(
        self, supplier_integration, mock_client, api_categories, api_brands, api_products,
    ):
        # Создаём Product с ручными данными
        product = Product.objects.create(
            name='Вентилятор канальный KD 315',
            normalized_name=Product.normalize_name('Вентилятор канальный KD 315'),
            description='Ручное описание',
            brand='MyBrand',
        )

        mock_client.get_categories.return_value = api_categories
        mock_client.get_brands.return_value = api_brands
        mock_client.get_products.return_value = api_products

        service = BreezImportService(supplier_integration)
        service.import_full_catalog()

        product.refresh_from_db()
        # Ручные данные не перезатёрты
        assert product.description == 'Ручное описание'
        assert product.brand == 'MyBrand'

    def test_import_creates_alias(
        self, supplier_integration, mock_client, api_categories, api_brands, api_products,
    ):
        mock_client.get_categories.return_value = api_categories
        mock_client.get_brands.return_value = api_brands
        mock_client.get_products.return_value = api_products

        service = BreezImportService(supplier_integration)
        service.import_full_catalog()

        sp = SupplierProduct.objects.get(nc_code='НС-0001')
        alias = ProductAlias.objects.filter(
            product=sp.product,
            alias_name='breez:НС-0001',
        )
        assert alias.exists()

    def test_import_idempotent(
        self, supplier_integration, mock_client, api_categories, api_brands, api_products,
    ):
        mock_client.get_categories.return_value = api_categories
        mock_client.get_brands.return_value = api_brands
        mock_client.get_products.return_value = api_products

        service = BreezImportService(supplier_integration)
        service.import_full_catalog()
        service.import_full_catalog()

        assert SupplierProduct.objects.filter(
            integration=supplier_integration,
        ).count() == 1

    def test_import_error_marks_log_failed(self, supplier_integration, mock_client):
        mock_client.get_categories.side_effect = Exception('API down')

        service = BreezImportService(supplier_integration)
        with pytest.raises(Exception):
            service.import_full_catalog()

        log = SupplierSyncLog.objects.filter(
            integration=supplier_integration,
        ).first()
        assert log.status == SupplierSyncLog.Status.FAILED

    def test_import_creates_sync_log(
        self, supplier_integration, mock_client, api_categories, api_brands, api_products,
    ):
        mock_client.get_categories.return_value = api_categories
        mock_client.get_brands.return_value = api_brands
        mock_client.get_products.return_value = api_products

        service = BreezImportService(supplier_integration)
        sync_log = service.import_full_catalog()

        assert sync_log.pk is not None
        assert sync_log.sync_type == SupplierSyncLog.SyncType.CATALOG_FULL
        assert sync_log.duration_seconds is not None
        assert sync_log.duration_seconds > 0
