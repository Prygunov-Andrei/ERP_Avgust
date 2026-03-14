from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest

from supplier_integrations.models import (
    SupplierBrand,
    SupplierCategory,
    SupplierIntegration,
    SupplierProduct,
    SupplierStock,
)


@pytest.fixture
def supplier_integration(db):
    return SupplierIntegration.objects.create(
        name='Breez',
        provider='breez',
        base_url='https://api.breez.ru/v1',
        auth_header='Basic dGVzdDp0ZXN0',
        is_active=True,
    )


@pytest.fixture
def supplier_category(supplier_integration):
    return SupplierCategory.objects.create(
        integration=supplier_integration,
        external_id=1,
        title='Вентиляция',
    )


@pytest.fixture
def supplier_brand(supplier_integration):
    return SupplierBrand.objects.create(
        integration=supplier_integration,
        external_id=1,
        title='Systemair',
    )


@pytest.fixture
def supplier_product(supplier_integration, supplier_category, supplier_brand):
    return SupplierProduct.objects.create(
        integration=supplier_integration,
        external_id=1000001,
        nc_code='НС-1234567',
        articul='KD-315-M1',
        title='Вентилятор канальный KD 315 M1',
        supplier_category=supplier_category,
        brand=supplier_brand,
        base_price=Decimal('12500.00'),
        ric_price=Decimal('18900.00'),
        images=['https://breez.ru/img/1.jpg'],
    )


@pytest.fixture
def supplier_stock(supplier_product):
    return SupplierStock.objects.create(
        supplier_product=supplier_product,
        warehouse_name='Москва',
        quantity=15,
    )


@pytest.fixture
def mock_breez_api():
    """Мок BreezAPIClient для тестов без реального API."""
    with patch('supplier_integrations.clients.breez.BreezAPIClient') as mock_cls:
        client = MagicMock()
        mock_cls.return_value = client
        client.__enter__ = MagicMock(return_value=client)
        client.__exit__ = MagicMock(return_value=False)
        yield client
