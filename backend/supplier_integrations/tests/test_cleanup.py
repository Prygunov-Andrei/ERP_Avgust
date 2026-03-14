"""Тесты для management-команды cleanup_breez_products."""
from django.test import TestCase
from django.core.management import call_command
from io import StringIO

from accounting.models import Counterparty
from catalog.models import Product, ProductAlias
from supplier_integrations.models import SupplierIntegration, SupplierProduct


class CleanupBreezProductsTestCase(TestCase):
    """Тесты cleanup_breez_products."""

    def setUp(self):
        self.counterparty = Counterparty.objects.create(
            name='БРИЗ',
            type=Counterparty.Type.VENDOR,
            vendor_subtype=Counterparty.VendorSubtype.SUPPLIER,
            legal_form='ooo',
            inn='1234567890',
        )
        self.integration = SupplierIntegration.objects.create(
            name='Breez',
            provider='breez',
            base_url='https://api.breez.ru/v1',
            counterparty=self.counterparty,
            is_active=True,
        )
        # Создаём Product + SupplierProduct
        self.product1 = Product.objects.create(
            name='Вентилятор 1', default_unit='шт', status=Product.Status.VERIFIED,
        )
        self.product2 = Product.objects.create(
            name='Вентилятор 2', default_unit='шт', status=Product.Status.VERIFIED,
        )
        self.sp1 = SupplierProduct.objects.create(
            integration=self.integration,
            external_id=1,
            nc_code='НС-001',
            title='Вент 1',
            product=self.product1,
        )
        self.sp2 = SupplierProduct.objects.create(
            integration=self.integration,
            external_id=2,
            nc_code='НС-002',
            title='Вент 2',
            product=self.product2,
        )
        # Breez-алиасы
        ProductAlias.objects.create(
            product=self.product1,
            alias_name='breez:вент-1',
            normalized_alias='breez:вент-1',
        )

    def test_cleanup_detaches_supplier_products(self):
        """Cleanup обнуляет SupplierProduct.product."""
        out = StringIO()
        call_command('cleanup_breez_products', stdout=out)
        self.sp1.refresh_from_db()
        self.sp2.refresh_from_db()
        self.assertIsNone(self.sp1.product)
        self.assertIsNone(self.sp2.product)

    def test_cleanup_deletes_breez_aliases(self):
        """Cleanup удаляет алиасы breez:*."""
        self.assertEqual(ProductAlias.objects.filter(alias_name__startswith='breez:').count(), 1)
        call_command('cleanup_breez_products', stdout=StringIO())
        self.assertEqual(ProductAlias.objects.filter(alias_name__startswith='breez:').count(), 0)

    def test_cleanup_archives_empty_products(self):
        """Cleanup архивирует Product без связей."""
        call_command('cleanup_breez_products', stdout=StringIO())
        self.product1.refresh_from_db()
        self.product2.refresh_from_db()
        self.assertEqual(self.product1.status, Product.Status.ARCHIVED)
        self.assertEqual(self.product2.status, Product.Status.ARCHIVED)

    def test_cleanup_preserves_products_with_estimates(self):
        """Cleanup не архивирует Product с привязанными EstimateItem."""
        from django.contrib.auth.models import User
        from objects.models import Object
        from accounting.models import LegalEntity
        from estimates.models import Estimate, EstimateSection, EstimateItem

        user = User.objects.create_user('testuser', password='test')
        obj = Object.objects.create(name='Тест', address='test')
        entity = LegalEntity.objects.create(
            short_name='Тест', full_name='Тест', legal_form='ooo',
            inn='9999999999', is_active=True,
        )
        estimate = Estimate.objects.create(
            name='Тестовая', object=obj, legal_entity=entity, created_by=user,
        )
        section = EstimateSection.objects.create(estimate=estimate, name='Раздел 1')
        EstimateItem.objects.create(
            estimate=estimate, section=section, name='Позиция',
            product=self.product1,
        )

        call_command('cleanup_breez_products', stdout=StringIO())
        self.product1.refresh_from_db()
        self.product2.refresh_from_db()
        # product1 привязан к EstimateItem — не должен быть архивирован
        self.assertEqual(self.product1.status, Product.Status.VERIFIED)
        # product2 без связей — должен быть архивирован
        self.assertEqual(self.product2.status, Product.Status.ARCHIVED)

    def test_dry_run_makes_no_changes(self):
        """Dry-run не меняет данные."""
        call_command('cleanup_breez_products', '--dry-run', stdout=StringIO())
        self.sp1.refresh_from_db()
        self.assertIsNotNone(self.sp1.product)
        self.assertEqual(ProductAlias.objects.filter(alias_name__startswith='breez:').count(), 1)
        self.product1.refresh_from_db()
        self.assertEqual(self.product1.status, Product.Status.VERIFIED)
