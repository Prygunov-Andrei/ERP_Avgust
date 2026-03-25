"""
Тесты для column_config, custom_data, computed_values.
~15 тест-кейсов.
"""
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth.models import User

from estimates.models import Estimate, EstimateSection, EstimateItem
from estimates.serializers import EstimateSerializer, EstimateItemSerializer
from estimates.column_defaults import DEFAULT_COLUMN_CONFIG


def _make_estimate(user, **kwargs):
    """Helper: создать смету с минимальными полями."""
    from accounting.models import LegalEntity, TaxSystem
    from objects.models import Object as BuildObject

    obj, _ = BuildObject.objects.get_or_create(name='Тест-объект', defaults={'address': 'тест'})
    ts, _ = TaxSystem.objects.get_or_create(name='УСН', defaults={'code': 'usn', 'has_vat': False})
    le, _ = LegalEntity.objects.get_or_create(
        short_name='ТестООО',
        defaults={'name': 'ООО Тест', 'inn': '1234567890', 'tax_system': ts},
    )
    return Estimate.objects.create(
        object=obj, legal_entity=le, name='Тест-смета',
        created_by=user, **kwargs,
    )


class TestColumnConfigValidation(TestCase):
    """Тесты валидации column_config через сериализатор."""

    def setUp(self):
        self.user = User.objects.create_user('tester', password='test')

    def test_empty_column_config_ok(self):
        """Пустой column_config — допустим (будут дефолты)."""
        s = EstimateSerializer()
        result = s.validate_column_config([])
        self.assertEqual(result, [])

    def test_valid_config_passes(self):
        s = EstimateSerializer()
        result = s.validate_column_config(DEFAULT_COLUMN_CONFIG)
        self.assertEqual(len(result), len(DEFAULT_COLUMN_CONFIG))

    def test_duplicate_key_rejected(self):
        s = EstimateSerializer()
        config = [
            {'key': 'name', 'type': 'builtin', 'builtin_field': 'name', 'label': 'A',
             'width': 100, 'editable': True, 'visible': True, 'aggregatable': False},
            {'key': 'name', 'type': 'builtin', 'builtin_field': 'name', 'label': 'B',
             'width': 100, 'editable': True, 'visible': True, 'aggregatable': False},
        ]
        from rest_framework.exceptions import ValidationError
        with self.assertRaises(ValidationError) as ctx:
            s.validate_column_config(config)
        self.assertTrue(any('дублирующийся' in str(e).lower() for e in ctx.exception.detail))

    def test_invalid_key_rejected(self):
        s = EstimateSerializer()
        config = [{'key': '123bad', 'type': 'custom_text', 'label': 'Bad', 'width': 100,
                    'editable': True, 'visible': True, 'aggregatable': False}]
        from rest_framework.exceptions import ValidationError
        with self.assertRaises(ValidationError):
            s.validate_column_config(config)

    def test_invalid_formula_rejected(self):
        s = EstimateSerializer()
        config = [{'key': 'bad_formula', 'type': 'formula', 'formula': 'nonexistent * 2',
                    'label': 'Плохая', 'width': 100, 'editable': False, 'visible': True,
                    'aggregatable': False}]
        from rest_framework.exceptions import ValidationError
        with self.assertRaises(ValidationError):
            s.validate_column_config(config)

    def test_cyclic_dependency_rejected(self):
        s = EstimateSerializer()
        config = [
            {'key': 'a', 'type': 'formula', 'formula': 'b + 1', 'label': 'A',
             'width': 100, 'editable': False, 'visible': True, 'aggregatable': False},
            {'key': 'b', 'type': 'formula', 'formula': 'a + 1', 'label': 'B',
             'width': 100, 'editable': False, 'visible': True, 'aggregatable': False},
        ]
        from rest_framework.exceptions import ValidationError
        with self.assertRaises(ValidationError):
            s.validate_column_config(config)

    def test_custom_select_without_options_rejected(self):
        s = EstimateSerializer()
        config = [{'key': 'status', 'type': 'custom_select', 'label': 'Статус',
                    'width': 100, 'editable': True, 'visible': True, 'aggregatable': False}]
        from rest_framework.exceptions import ValidationError
        with self.assertRaises(ValidationError):
            s.validate_column_config(config)

    def test_invalid_builtin_field_rejected(self):
        s = EstimateSerializer()
        config = [{'key': 'x', 'type': 'builtin', 'builtin_field': 'nonexistent',
                    'label': 'X', 'width': 100, 'editable': True, 'visible': True,
                    'aggregatable': False}]
        from rest_framework.exceptions import ValidationError
        with self.assertRaises(ValidationError):
            s.validate_column_config(config)


class TestEstimateItemWithColumnConfig(TestCase):
    """Тесты EstimateItem с custom_data и computed_values."""

    def setUp(self):
        self.user = User.objects.create_user('tester', password='test')
        self.estimate = _make_estimate(self.user, column_config=[
            {'key': 'quantity', 'type': 'builtin', 'builtin_field': 'quantity',
             'label': 'Кол-во', 'width': 80, 'editable': True, 'visible': True,
             'formula': None, 'decimal_places': 3, 'aggregatable': False, 'options': None},
            {'key': 'material_unit_price', 'type': 'builtin', 'builtin_field': 'material_unit_price',
             'label': 'Цена мат.', 'width': 100, 'editable': True, 'visible': True,
             'formula': None, 'decimal_places': 2, 'aggregatable': False, 'options': None},
            {'key': 'markup_pct', 'type': 'custom_number', 'label': 'Наценка %',
             'width': 80, 'editable': True, 'visible': True, 'formula': None,
             'decimal_places': 1, 'aggregatable': False, 'options': None},
            {'key': 'with_markup', 'type': 'formula',
             'formula': 'quantity * material_unit_price * (1 + markup_pct / 100)',
             'label': 'С наценкой', 'width': 120, 'editable': False, 'visible': True,
             'decimal_places': 2, 'aggregatable': True, 'options': None},
        ])
        self.section = EstimateSection.objects.create(
            estimate=self.estimate, name='Раздел 1', sort_order=1,
        )

    def test_custom_data_saved(self):
        item = EstimateItem.objects.create(
            estimate=self.estimate, section=self.section,
            name='Тест', quantity=Decimal('10'), material_unit_price=Decimal('500'),
            work_unit_price=Decimal('0'), custom_data={'markup_pct': '20'},
        )
        item.refresh_from_db()
        self.assertEqual(item.custom_data['markup_pct'], '20')

    def test_computed_values_formula(self):
        item = EstimateItem.objects.create(
            estimate=self.estimate, section=self.section,
            name='Тест', quantity=Decimal('10'), material_unit_price=Decimal('500'),
            work_unit_price=Decimal('0'), custom_data={'markup_pct': '20'},
        )
        ctx = {'column_config': self.estimate.column_config}
        serializer = EstimateItemSerializer(item, context=ctx)
        data = serializer.data
        self.assertIn('computed_values', data)
        self.assertEqual(data['computed_values']['with_markup'], '6000.00')

    def test_backward_compat_no_column_config(self):
        """Смета без column_config — builtin поля работают как раньше."""
        estimate2 = _make_estimate(self.user)
        section2 = EstimateSection.objects.create(
            estimate=estimate2, name='Раздел', sort_order=1,
        )
        item = EstimateItem.objects.create(
            estimate=estimate2, section=section2,
            name='Тест', quantity=Decimal('5'), material_unit_price=Decimal('100'),
            work_unit_price=Decimal('50'),
        )
        serializer = EstimateItemSerializer(item, context={})
        data = serializer.data
        self.assertEqual(data['computed_values'], {})
        self.assertIsNotNone(data['material_total'])
        self.assertIsNotNone(data['work_total'])
        self.assertIsNotNone(data['line_total'])

    def test_create_new_version_copies_column_config(self):
        """create_new_version() копирует column_config."""
        new_version = self.estimate.create_new_version()
        self.assertEqual(new_version.column_config, self.estimate.column_config)
        self.assertEqual(new_version.version_number, 2)
