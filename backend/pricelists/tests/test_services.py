"""
Тесты для pricelists/services.py — add_items, remove_items, versioning, excel export.
"""
from datetime import date
from decimal import Decimal
from io import BytesIO
from unittest.mock import MagicMock, patch, PropertyMock

import pytest
from django.test import TestCase

from pricelists.services import (
    add_items_to_pricelist,
    remove_items_from_pricelist,
    create_work_item_version,
    export_pricelist_to_excel,
)


class AddItemsToPricelistTest(TestCase):
    """Тесты add_items_to_pricelist."""

    def _make_work_item(self, pk, is_current=True):
        wi = MagicMock()
        wi.id = pk
        wi.pk = pk
        wi.is_current = is_current
        return wi

    @patch('pricelists.models.PriceListItem')
    @patch('pricelists.models.WorkItem')
    def test_add_new_items(self, MockWorkItem, MockPriceListItem):
        """Добавление новых работ создаёт PriceListItem'ы."""
        wi1 = self._make_work_item(1)
        wi2 = self._make_work_item(2)

        MockWorkItem.objects.filter.return_value = [wi1, wi2]

        # Нет существующих items
        MockPriceListItem.objects.filter.return_value.select_related.return_value = []

        price_list = MagicMock()
        result = add_items_to_pricelist(price_list, [1, 2])

        self.assertEqual(result['count'], 2)
        self.assertIn(1, result['added'])
        self.assertIn(2, result['added'])
        MockPriceListItem.objects.bulk_create.assert_called_once()

    @patch('pricelists.models.PriceListItem')
    @patch('pricelists.models.WorkItem')
    def test_reactivate_excluded_items(self, MockWorkItem, MockPriceListItem):
        """Реактивация ранее исключённых элементов."""
        wi1 = self._make_work_item(1)
        MockWorkItem.objects.filter.return_value = [wi1]

        # Существующий элемент с is_included=False
        existing_item = MagicMock()
        existing_item.work_item_id = 1
        existing_item.is_included = False
        MockPriceListItem.objects.filter.return_value.select_related.return_value = [existing_item]

        price_list = MagicMock()
        result = add_items_to_pricelist(price_list, [1])

        self.assertEqual(result['count'], 1)
        self.assertIn(1, result['added'])
        MockPriceListItem.objects.bulk_update.assert_called_once()

    @patch('pricelists.models.PriceListItem')
    @patch('pricelists.models.WorkItem')
    def test_skip_already_included(self, MockWorkItem, MockPriceListItem):
        """Уже включённые элементы не добавляются повторно."""
        wi1 = self._make_work_item(1)
        MockWorkItem.objects.filter.return_value = [wi1]

        existing_item = MagicMock()
        existing_item.work_item_id = 1
        existing_item.is_included = True
        MockPriceListItem.objects.filter.return_value.select_related.return_value = [existing_item]

        price_list = MagicMock()
        result = add_items_to_pricelist(price_list, [1])

        self.assertEqual(result['count'], 0)

    @patch('pricelists.models.PriceListItem')
    @patch('pricelists.models.WorkItem')
    def test_nonexistent_work_item_ids_ignored(self, MockWorkItem, MockPriceListItem):
        """Несуществующие ID работ игнорируются."""
        MockWorkItem.objects.filter.return_value = []  # Ничего не найдено
        MockPriceListItem.objects.filter.return_value.select_related.return_value = []

        price_list = MagicMock()
        result = add_items_to_pricelist(price_list, [999, 1000])

        self.assertEqual(result['count'], 0)
        self.assertEqual(result['added'], [])


class RemoveItemsFromPricelistTest(TestCase):
    """Тесты remove_items_from_pricelist."""

    @patch('pricelists.models.PriceListItem')
    def test_remove_items(self, MockPriceListItem):
        """Удаление существующих элементов."""
        MockPriceListItem.objects.filter.return_value.delete.return_value = (2, {})

        price_list = MagicMock()
        result = remove_items_from_pricelist(price_list, [1, 2])

        self.assertEqual(result['count'], 2)
        self.assertEqual(result['removed'], [1, 2])

    @patch('pricelists.models.PriceListItem')
    def test_remove_nonexistent_items(self, MockPriceListItem):
        """Удаление несуществующих — count=0."""
        MockPriceListItem.objects.filter.return_value.delete.return_value = (0, {})

        price_list = MagicMock()
        result = remove_items_from_pricelist(price_list, [999])

        self.assertEqual(result['count'], 0)


class CreateWorkItemVersionTest(TestCase):
    """Тесты create_work_item_version."""

    def test_creates_new_version_and_applies_data(self):
        """Создаёт новую версию и применяет update_data."""
        instance = MagicMock()
        new_version = MagicMock()
        instance.create_new_version.return_value = new_version

        result = create_work_item_version(instance, {'name': 'New Name', 'unit': 'м'})

        instance.create_new_version.assert_called_once()
        new_version.save.assert_called_once()
        self.assertEqual(result, new_version)

    def test_ignores_protected_fields(self):
        """Защищённые поля (article, version_number и т.д.) не устанавливаются через setattr."""
        instance = MagicMock()
        new_version = MagicMock()
        instance.create_new_version.return_value = new_version

        # Отслеживаем вызовы setattr через side_effect
        set_attrs = {}
        original_setattr = type(new_version).__setattr__

        def track_setattr(self, key, value):
            set_attrs[key] = value
            original_setattr(self, key, value)

        with patch.object(type(new_version), '__setattr__', track_setattr):
            create_work_item_version(instance, {
                'article': 'SHOULD_IGNORE',
                'version_number': 99,
                'is_current': True,
                'parent_version': 1,
                'name': 'Valid Name',
            })

        # name должен быть установлен, а article и прочие — нет
        self.assertIn('name', set_attrs)
        self.assertNotIn('article', set_attrs)
        self.assertNotIn('version_number', set_attrs)
        self.assertNotIn('is_current', set_attrs)
        self.assertNotIn('parent_version', set_attrs)
        new_version.save.assert_called_once()

    def test_empty_update_data(self):
        """Пустой update_data — версия создаётся без изменений."""
        instance = MagicMock()
        new_version = MagicMock()
        instance.create_new_version.return_value = new_version

        result = create_work_item_version(instance, {})

        instance.create_new_version.assert_called_once()
        new_version.save.assert_called_once()
        self.assertEqual(result, new_version)


class ExportPricelistToExcelTest(TestCase):
    """Тесты export_pricelist_to_excel."""

    def _make_price_list(self, number='PL-001', name='Тестовый прайс', items=None):
        price_list = MagicMock()
        price_list.number = number
        price_list.name = name
        price_list.date = date(2024, 3, 15)
        price_list.get_rate_for_grade = MagicMock(side_effect=lambda g: Decimal('500') + g * 100)

        if items is None:
            # Создаём один элемент по умолчанию
            work = MagicMock()
            work.article = 'ART-001'
            work.section = MagicMock()
            work.section.code = 'S01'
            work.name = 'Монтаж трубопровода'
            work.unit = 'м.п.'
            work.comment = 'Медные трубы'

            item = MagicMock()
            item.work_item = work
            item.effective_hours = Decimal('2.5')
            item.effective_grade = Decimal('3')
            item.effective_coefficient = Decimal('1.1')
            item.calculated_cost = Decimal('1500.50')
            items = [item]

        # items.filter(is_included=True).select_related(...)
        filter_mock = MagicMock()
        filter_mock.select_related.return_value = items
        filter_mock.__iter__ = lambda self: iter(items)

        price_list.items = MagicMock()
        price_list.items.filter.return_value = filter_mock

        return price_list

    def test_export_returns_bytes_and_filename(self):
        """Экспорт возвращает (bytes, filename)."""
        price_list = self._make_price_list()

        content, filename = export_pricelist_to_excel(price_list)

        self.assertIsInstance(content, bytes)
        self.assertTrue(len(content) > 0)
        self.assertIn('PL-001', filename)
        self.assertIn('20240315', filename)
        self.assertTrue(filename.endswith('.xlsx'))

    def test_export_without_name(self):
        """Экспорт без name — не падает."""
        price_list = self._make_price_list(name='', items=[])

        content, filename = export_pricelist_to_excel(price_list)
        self.assertIsInstance(content, bytes)
        self.assertTrue(len(content) > 0)

    def test_export_valid_xlsx(self):
        """Результат — валидный xlsx, который openpyxl может открыть."""
        import openpyxl
        price_list = self._make_price_list()

        content, filename = export_pricelist_to_excel(price_list)

        wb = openpyxl.load_workbook(BytesIO(content))
        ws = wb.active
        self.assertEqual(ws.title, "Прайс-лист")
        # Проверяем заголовок
        self.assertIn('PL-001', ws['A1'].value)
        wb.close()
