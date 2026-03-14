"""
Тесты для ColumnConfigTemplate — шаблоны конфигурации столбцов.
~7 тест-кейсов.
"""
from django.test import TestCase
from django.contrib.auth.models import User

from estimates.models import ColumnConfigTemplate
from estimates.column_defaults import DEFAULT_COLUMN_CONFIG
from estimates.serializers import ColumnConfigTemplateSerializer


class TestColumnConfigTemplate(TestCase):

    def setUp(self):
        self.user = User.objects.create_user('tester', password='test')
        self.valid_config = [
            {'key': 'name', 'type': 'builtin', 'builtin_field': 'name', 'label': 'Наим.',
             'width': 200, 'editable': True, 'visible': True, 'formula': None,
             'decimal_places': None, 'aggregatable': False, 'options': None},
            {'key': 'quantity', 'type': 'builtin', 'builtin_field': 'quantity', 'label': 'Кол.',
             'width': 80, 'editable': True, 'visible': True, 'formula': None,
             'decimal_places': 3, 'aggregatable': False, 'options': None},
        ]

    def test_create_template(self):
        t = ColumnConfigTemplate.objects.create(
            name='Электрика', description='Для электрики',
            column_config=self.valid_config, created_by=self.user,
        )
        self.assertEqual(t.name, 'Электрика')
        self.assertEqual(len(t.column_config), 2)

    def test_is_default_uniqueness(self):
        """Только один шаблон может быть is_default=True."""
        t1 = ColumnConfigTemplate.objects.create(
            name='A', column_config=self.valid_config,
            created_by=self.user, is_default=True,
        )
        t2 = ColumnConfigTemplate.objects.create(
            name='B', column_config=self.valid_config,
            created_by=self.user, is_default=True,
        )
        t1.refresh_from_db()
        self.assertFalse(t1.is_default)
        self.assertTrue(t2.is_default)

    def test_delete_template(self):
        t = ColumnConfigTemplate.objects.create(
            name='Удалить', column_config=self.valid_config, created_by=self.user,
        )
        tid = t.id
        t.delete()
        self.assertFalse(ColumnConfigTemplate.objects.filter(id=tid).exists())

    def test_serializer_validates_config(self):
        """Шаблон с невалидным column_config — ошибка."""
        data = {
            'name': 'Bad',
            'column_config': [{'key': '123bad', 'type': 'custom_text', 'label': 'Bad',
                                'width': 100, 'editable': True, 'visible': True,
                                'aggregatable': False}],
        }
        s = ColumnConfigTemplateSerializer(data=data)
        self.assertFalse(s.is_valid())
        self.assertIn('column_config', s.errors)

    def test_serializer_valid_config(self):
        data = {
            'name': 'Good',
            'column_config': self.valid_config,
        }
        s = ColumnConfigTemplateSerializer(data=data)
        self.assertTrue(s.is_valid(), s.errors)

    def test_apply_template_to_estimate(self):
        """Применение шаблона копирует column_config в смету."""
        from estimates.tests.test_column_config import _make_estimate

        t = ColumnConfigTemplate.objects.create(
            name='Шаблон', column_config=self.valid_config, created_by=self.user,
        )
        estimate = _make_estimate(self.user)
        estimate.column_config = t.column_config
        estimate.save(update_fields=['column_config'])
        estimate.refresh_from_db()
        self.assertEqual(len(estimate.column_config), 2)
        self.assertEqual(estimate.column_config[0]['key'], 'name')
