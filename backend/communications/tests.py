"""
Тесты для communications app — модель, авто-заполнение, API, сериализация.
"""
from datetime import date

from django.test import TestCase
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model

from .models import Correspondence, correspondence_scan_path
from accounting.models import Counterparty, LegalEntity, TaxSystem
from contracts.models import Contract
from objects.models import Object

User = get_user_model()


class CorrespondenceTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='testuser', password='password')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.tax_system = TaxSystem.objects.create(code='osn', name='ОСН')
        self.legal_entity = LegalEntity.objects.create(name='Our Company', tax_system=self.tax_system, inn='111')
        self.counterparty = Counterparty.objects.create(name='Partner', inn='222', type=Counterparty.Type.CUSTOMER, legal_form=Counterparty.LegalForm.OOO)
        self.object = Object.objects.create(name='Test Object')
        self.contract = Contract.objects.create(
            object=self.object,
            contract_type=Contract.Type.INCOME,
            number='C-001',
            name='Test Contract',
            contract_date=date(2023, 1, 1),
            counterparty=self.counterparty,
            legal_entity=self.legal_entity,
            total_amount=100000
        )

    def test_create_correspondence(self):
        response = self.client.post('/api/v1/correspondence/', {
            'type': 'incoming',
            'category': 'letter',
            'contract': self.contract.id,
            'number': 'IN-123',
            'date': '2023-02-01',
            'subject': 'Important Letter',
            'description': 'Some text'
        })
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Correspondence.objects.count(), 1)
        obj = Correspondence.objects.first()
        # Проверяем автозаполнение контрагента
        self.assertEqual(obj.counterparty, self.counterparty)

    def test_related_correspondence(self):
        # Create initial letter
        c1 = Correspondence.objects.create(
            type='incoming',
            contract=self.contract,
            number='1',
            date=date(2023, 1, 1),
            subject='Q1'
        )
        # Create response
        response = self.client.post('/api/v1/correspondence/', {
            'type': 'outgoing',
            'related_to': c1.id,
            'contract': self.contract.id,
            'number': 'OUT-1',
            'date': '2023-01-02',
            'subject': 'A1'
        })
        self.assertEqual(response.status_code, 201)
        c2 = Correspondence.objects.get(number='OUT-1')
        self.assertEqual(c2.related_to, c1)


class CorrespondenceModelTest(TestCase):
    """Тесты модели Correspondence — str, save, path."""

    def setUp(self):
        self.tax_system = TaxSystem.objects.create(code='osn2', name='ОСН2')
        self.legal_entity = LegalEntity.objects.create(name='Company', tax_system=self.tax_system, inn='333')
        self.counterparty = Counterparty.objects.create(
            name='Supplier', inn='444',
            type=Counterparty.Type.VENDOR,
            legal_form=Counterparty.LegalForm.OOO,
        )
        self.obj = Object.objects.create(name='Object')
        self.contract = Contract.objects.create(
            object=self.obj,
            contract_type=Contract.Type.INCOME,
            number='C-002',
            name='Contract 2',
            contract_date=date(2023, 6, 1),
            counterparty=self.counterparty,
            legal_entity=self.legal_entity,
            total_amount=200000,
        )

    def test_str_incoming(self):
        c = Correspondence.objects.create(
            type=Correspondence.Type.INCOMING,
            number='IN-001',
            date=date(2024, 1, 15),
            subject='Тестовая тема',
        )
        s = str(c)
        self.assertIn('Вх.', s)
        self.assertIn('IN-001', s)
        self.assertIn('Тестовая тема', s)

    def test_str_outgoing(self):
        c = Correspondence.objects.create(
            type=Correspondence.Type.OUTGOING,
            number='OUT-001',
            date=date(2024, 2, 20),
            subject='Ответ',
        )
        s = str(c)
        self.assertIn('Исх.', s)

    def test_auto_counterparty_from_contract(self):
        """save() заполняет counterparty из contract, если не указан явно."""
        c = Correspondence(
            type=Correspondence.Type.INCOMING,
            contract=self.contract,
            number='X-1',
            date=date(2024, 1, 1),
            subject='Test',
        )
        c.save()
        self.assertEqual(c.counterparty, self.counterparty)

    def test_no_auto_counterparty_without_contract(self):
        """Без контракта counterparty остаётся None."""
        c = Correspondence(
            type=Correspondence.Type.INCOMING,
            number='X-2',
            date=date(2024, 1, 1),
            subject='No contract',
        )
        c.save()
        self.assertIsNone(c.counterparty)

    def test_correspondence_scan_path_with_contract(self):
        instance = Correspondence(contract=self.contract)
        path = correspondence_scan_path(instance, 'scan.pdf')
        self.assertIn(f'contract_{self.contract.id}', path)

    def test_correspondence_scan_path_without_contract(self):
        instance = Correspondence()
        path = correspondence_scan_path(instance, 'scan.pdf')
        self.assertIn('general', path)

    def test_filter_by_type(self):
        """Фильтрация по типу."""
        Correspondence.objects.create(
            type=Correspondence.Type.INCOMING,
            number='F-1', date=date(2024, 1, 1), subject='In',
        )
        Correspondence.objects.create(
            type=Correspondence.Type.OUTGOING,
            number='F-2', date=date(2024, 1, 2), subject='Out',
        )
        self.assertEqual(
            Correspondence.objects.filter(type=Correspondence.Type.INCOMING).count(), 1
        )
