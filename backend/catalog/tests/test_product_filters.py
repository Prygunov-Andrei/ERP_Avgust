"""Тесты фильтров Product по поставщику и наличию."""
from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from accounting.models import Counterparty
from catalog.models import Category, Product
from supplier_integrations.models import (
    SupplierIntegration, SupplierProduct, SupplierStock,
)


class ProductSupplierFilterTestCase(TestCase):
    """Тесты фильтрации Product по supplier и in_stock."""

    def setUp(self):
        self.user = User.objects.create_user('testuser', password='test')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.category = Category.objects.create(name='Вентиляция', code='VENT')

        # Два поставщика
        self.cp_breez = Counterparty.objects.create(
            name='БРИЗ', type=Counterparty.Type.VENDOR,
            vendor_subtype=Counterparty.VendorSubtype.SUPPLIER,
            legal_form='ooo', inn='1111111111',
        )
        self.cp_galvent = Counterparty.objects.create(
            name='Галвент', type=Counterparty.Type.VENDOR,
            vendor_subtype=Counterparty.VendorSubtype.SUPPLIER,
            legal_form='ooo', inn='2222222222',
        )

        self.integration_breez = SupplierIntegration.objects.create(
            name='Breez', provider='breez',
            base_url='https://api.breez.ru/v1',
            counterparty=self.cp_breez, is_active=True,
        )
        self.integration_galvent = SupplierIntegration.objects.create(
            name='Galvent', provider='breez',
            base_url='https://api.galvent.ru/v1',
            counterparty=self.cp_galvent, is_active=True,
        )

        # Product 1 — от Breez, с наличием
        self.product1 = Product.objects.create(
            name='Вентилятор KD 250', default_unit='шт',
            category=self.category, status=Product.Status.VERIFIED,
        )
        self.sp1 = SupplierProduct.objects.create(
            integration=self.integration_breez,
            external_id=1, nc_code='НС-001',
            title='Вент KD 250', product=self.product1, is_active=True,
        )
        SupplierStock.objects.create(
            supplier_product=self.sp1, warehouse_name='Москва', quantity=10,
        )

        # Product 2 — от Galvent, без наличия
        self.product2 = Product.objects.create(
            name='Вентилятор KD 315', default_unit='шт',
            category=self.category, status=Product.Status.VERIFIED,
        )
        self.sp2 = SupplierProduct.objects.create(
            integration=self.integration_galvent,
            external_id=2, nc_code='ГВ-001',
            title='Вент KD 315', product=self.product2, is_active=True,
        )
        SupplierStock.objects.create(
            supplier_product=self.sp2, warehouse_name='СПб', quantity=0,
        )

        # Product 3 — без привязки к поставщику
        self.product3 = Product.objects.create(
            name='Решётка вентиляционная', default_unit='шт',
            category=self.category, status=Product.Status.VERIFIED,
        )

    def test_filter_by_supplier_breez(self):
        """Фильтр supplier=breez_id возвращает только товары Breez."""
        resp = self.client.get(
            '/api/v1/products/', {'supplier': self.cp_breez.id},
        )
        self.assertEqual(resp.status_code, 200)
        ids = {item['id'] for item in resp.data['results']}
        self.assertIn(self.product1.id, ids)
        self.assertNotIn(self.product2.id, ids)
        self.assertNotIn(self.product3.id, ids)

    def test_filter_by_supplier_galvent(self):
        """Фильтр supplier=galvent_id возвращает только товары Galvent."""
        resp = self.client.get(
            '/api/v1/products/', {'supplier': self.cp_galvent.id},
        )
        self.assertEqual(resp.status_code, 200)
        ids = {item['id'] for item in resp.data['results']}
        self.assertIn(self.product2.id, ids)
        self.assertNotIn(self.product1.id, ids)

    def test_filter_in_stock_true(self):
        """Фильтр in_stock=true возвращает только товары с quantity > 0."""
        resp = self.client.get(
            '/api/v1/products/', {'in_stock': 'true'},
        )
        self.assertEqual(resp.status_code, 200)
        ids = {item['id'] for item in resp.data['results']}
        self.assertIn(self.product1.id, ids)
        self.assertNotIn(self.product2.id, ids)
        self.assertNotIn(self.product3.id, ids)

    def test_no_filter_returns_all(self):
        """Без фильтров возвращаются все товары."""
        resp = self.client.get('/api/v1/products/')
        self.assertEqual(resp.status_code, 200)
        ids = {item['id'] for item in resp.data['results']}
        self.assertIn(self.product1.id, ids)
        self.assertIn(self.product2.id, ids)
        self.assertIn(self.product3.id, ids)

    def test_combined_supplier_and_in_stock(self):
        """Фильтры supplier + in_stock комбинируются."""
        # Breez + in_stock: product1 в наличии — ок
        resp = self.client.get(
            '/api/v1/products/',
            {'supplier': self.cp_breez.id, 'in_stock': 'true'},
        )
        self.assertEqual(resp.status_code, 200)
        ids = {item['id'] for item in resp.data['results']}
        self.assertIn(self.product1.id, ids)
        self.assertEqual(len(ids), 1)

    def test_supplier_filter_no_duplicates(self):
        """Товар не дублируется если у поставщика несколько SupplierProduct."""
        # Добавляем второй SupplierProduct от Breez к product1
        SupplierProduct.objects.create(
            integration=self.integration_breez,
            external_id=99, nc_code='НС-099',
            title='Вент KD 250 v2', product=self.product1, is_active=True,
        )

        resp = self.client.get(
            '/api/v1/products/', {'supplier': self.cp_breez.id},
        )
        self.assertEqual(resp.status_code, 200)
        ids = [item['id'] for item in resp.data['results']]
        # product1 не должен дублироваться
        self.assertEqual(ids.count(self.product1.id), 1)
