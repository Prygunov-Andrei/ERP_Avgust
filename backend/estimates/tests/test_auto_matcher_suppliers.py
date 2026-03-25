"""Тесты подбора цен из каталога поставщиков и счетов."""
from decimal import Decimal
from unittest.mock import patch, MagicMock

from django.test import TestCase
from django.contrib.auth.models import User

from accounting.models import Counterparty, LegalEntity, TaxSystem
from catalog.models import Product, ProductPriceHistory
from estimates.models import Estimate, EstimateSection, EstimateItem
from objects.models import Object
from supplier_integrations.models import SupplierIntegration, SupplierProduct


class AutoMatcherSuppliersTestCase(TestCase):
    """Тесты preview_matches с фильтрацией по поставщикам и стратегией цен."""

    def setUp(self):
        self.user = User.objects.create_user('testuser', password='test')
        self.obj = Object.objects.create(name='Тест', address='test')
        self.tax_system = TaxSystem.objects.create(
            name='УСН (Доходы)', code='usn_6', has_vat=False,
        )
        self.entity = LegalEntity.objects.create(
            name='Тест', short_name='Тест',
            inn='9999999999', is_active=True,
            tax_system=self.tax_system,
        )
        self.estimate = Estimate.objects.create(
            name='Тестовая', object=self.obj,
            legal_entity=self.entity, created_by=self.user,
        )
        self.section = EstimateSection.objects.create(
            estimate=self.estimate, name='Раздел 1',
        )

        # Поставщик 1 — БРИЗ
        self.cp_breez = Counterparty.objects.create(
            name='БРИЗ', type=Counterparty.Type.VENDOR,
            vendor_subtype=Counterparty.VendorSubtype.SUPPLIER,
            legal_form='ooo', inn='1111111111',
        )
        self.integration_breez = SupplierIntegration.objects.create(
            name='Breez', provider='breez',
            base_url='https://api.breez.ru/v1',
            counterparty=self.cp_breez, is_active=True,
        )

        # Поставщик 2 — Галвент
        self.cp_galvent = Counterparty.objects.create(
            name='Галвент', type=Counterparty.Type.VENDOR,
            vendor_subtype=Counterparty.VendorSubtype.SUPPLIER,
            legal_form='ooo', inn='2222222222',
        )
        self.integration_galvent = SupplierIntegration.objects.create(
            name='Galvent', provider='breez',
            base_url='https://api.galvent.ru/v1',
            counterparty=self.cp_galvent, is_active=True,
        )

        # Product + SupplierProduct (разные цены у разных поставщиков)
        self.product = Product.objects.create(
            name='Вентилятор KD 315', default_unit='шт',
            status=Product.Status.VERIFIED,
        )

        self.sp_breez = SupplierProduct.objects.create(
            integration=self.integration_breez,
            external_id=100, nc_code='НС-100',
            title='Вентилятор KD 315',
            product=self.product,
            base_price=Decimal('15000.00'),
            is_active=True,
        )

        self.sp_galvent = SupplierProduct.objects.create(
            integration=self.integration_galvent,
            external_id=200, nc_code='ГВ-200',
            title='Вент KD 315 M1',
            product=self.product,
            base_price=Decimal('12500.00'),
            is_active=True,
        )

        # Строка сметы без цены
        self.item = EstimateItem.objects.create(
            estimate=self.estimate, section=self.section,
            name='Вентилятор KD 315', unit='шт', quantity=Decimal('2'),
        )

    def _run_preview(self, supplier_ids=None, price_strategy='cheapest'):
        """Хелпер: запуск preview_matches с моком ProductMatcher."""
        from estimates.services.estimate_auto_matcher import EstimateAutoMatcher

        matcher = EstimateAutoMatcher()
        # Мокаем ProductMatcher чтобы он возвращал наш product
        matcher.product_matcher = MagicMock()
        matcher.product_matcher.find_or_create_product.return_value = (
            self.product, False,
        )

        return matcher.preview_matches(
            self.estimate,
            supplier_ids=supplier_ids,
            price_strategy=price_strategy,
        )

    def test_cheapest_strategy_picks_lowest_price(self):
        """Стратегия 'cheapest' выбирает минимальную цену."""
        results = self._run_preview(price_strategy='cheapest')

        self.assertEqual(len(results), 1)
        result = results[0]
        self.assertIsNotNone(result['best_offer'])
        # Галвент дешевле: 12500 < 15000
        self.assertEqual(Decimal(result['best_offer']['price']), Decimal('12500.00'))
        self.assertEqual(result['best_offer']['counterparty_name'], 'Галвент')

    def test_all_offers_includes_both_suppliers(self):
        """all_offers содержит предложения от обоих поставщиков."""
        results = self._run_preview()
        all_offers = results[0]['all_offers']

        counterparty_names = {o['counterparty_name'] for o in all_offers}
        self.assertIn('БРИЗ', counterparty_names)
        self.assertIn('Галвент', counterparty_names)
        self.assertEqual(len(all_offers), 2)

    def test_supplier_filter_limits_offers(self):
        """supplier_ids ограничивает поиск до указанных поставщиков."""
        results = self._run_preview(supplier_ids=[self.cp_breez.id])

        all_offers = results[0]['all_offers']
        self.assertEqual(len(all_offers), 1)
        self.assertEqual(all_offers[0]['counterparty_name'], 'БРИЗ')
        self.assertEqual(Decimal(all_offers[0]['price']), Decimal('15000.00'))

    def test_empty_supplier_ids_uses_all(self):
        """supplier_ids=None возвращает предложения от всех поставщиков."""
        results = self._run_preview(supplier_ids=None)
        self.assertEqual(len(results[0]['all_offers']), 2)

    def test_no_offers_returns_null_best_offer(self):
        """Если нет предложений — best_offer=None."""
        # Удаляем все SupplierProduct
        SupplierProduct.objects.all().delete()

        results = self._run_preview()
        self.assertEqual(len(results), 1)
        self.assertIsNone(results[0]['best_offer'])
        self.assertEqual(len(results[0]['all_offers']), 0)

    def test_mixed_sources_catalog_and_invoice(self):
        """all_offers содержит предложения и из каталога, и из счетов."""
        # Добавляем ProductPriceHistory (цена из счёта)
        ProductPriceHistory.objects.create(
            product=self.product,
            counterparty=self.cp_breez,
            price=Decimal('14000.00'),
            invoice_number='СЧ-001',
            invoice_date='2026-03-01',
        )

        results = self._run_preview()
        all_offers = results[0]['all_offers']

        source_types = {o['source_type'] for o in all_offers}
        self.assertIn('supplier_catalog', source_types)
        self.assertIn('invoice', source_types)
        # 2 каталога + 1 счёт = 3
        self.assertEqual(len(all_offers), 3)

    def test_latest_strategy_picks_first_offer(self):
        """Стратегия 'latest' выбирает первый элемент (по порядку)."""
        results = self._run_preview(price_strategy='latest')
        self.assertIsNotNone(results[0]['best_offer'])
        # Первый — из каталога (supplier_catalog идут первыми в коде)
        self.assertEqual(results[0]['best_offer']['source_type'], 'supplier_catalog')

    def test_invoice_offers_filtered_by_supplier_ids(self):
        """supplier_ids фильтрует и каталог, и счета."""
        ProductPriceHistory.objects.create(
            product=self.product,
            counterparty=self.cp_galvent,
            price=Decimal('11000.00'),
            invoice_number='ГВ-001',
            invoice_date='2026-02-15',
        )

        results = self._run_preview(supplier_ids=[self.cp_galvent.id])
        all_offers = results[0]['all_offers']

        # 1 из каталога Галвент + 1 из счёта Галвент
        self.assertEqual(len(all_offers), 2)
        for offer in all_offers:
            self.assertEqual(offer['counterparty_id'], self.cp_galvent.id)

    def test_skips_items_with_existing_price(self):
        """Строки с уже установленной ценой пропускаются."""
        self.item.product = self.product
        self.item.material_unit_price = Decimal('20000.00')
        self.item.save()

        results = self._run_preview()
        self.assertEqual(len(results), 0)

    def test_offer_contains_supplier_product_id(self):
        """Каталожное предложение содержит supplier_product_id."""
        results = self._run_preview()
        catalog_offers = [
            o for o in results[0]['all_offers']
            if o['source_type'] == 'supplier_catalog'
        ]
        for offer in catalog_offers:
            self.assertIn('supplier_product_id', offer)
            self.assertIn(
                offer['supplier_product_id'],
                [self.sp_breez.id, self.sp_galvent.id],
            )

    def test_invoice_offer_contains_history_id(self):
        """Счётное предложение содержит source_price_history_id."""
        ph = ProductPriceHistory.objects.create(
            product=self.product,
            counterparty=self.cp_breez,
            price=Decimal('13000.00'),
            invoice_number='СЧ-002',
            invoice_date='2026-03-10',
        )

        results = self._run_preview()
        invoice_offers = [
            o for o in results[0]['all_offers']
            if o['source_type'] == 'invoice'
        ]
        self.assertEqual(len(invoice_offers), 1)
        self.assertEqual(invoice_offers[0]['source_price_history_id'], ph.id)
