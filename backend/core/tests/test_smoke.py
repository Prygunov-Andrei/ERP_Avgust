"""
Smoke tests — проверяют что ключевые API endpoints доступны и отвечают корректно.
Запускать перед деплоем и в CI.
"""
from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status


class SmokeTestMixin:
    """Базовый mixin с авторизованным клиентом."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='smoke_test_user',
            password='smoke_pass_123',
            is_staff=True,
        )
        self.client.force_authenticate(user=self.user)


class AuthSmokeTests(TestCase):
    """Smoke: авторизация работает."""

    def test_register_endpoint_exists(self):
        client = APIClient()
        resp = client.post('/api/v1/users/register/', {
            'username': 'smokeuser',
            'email': 'smoke@test.com',
            'password': 'smoke_pass_123',
            'password_confirm': 'smoke_pass_123',
            'first_name': 'Smoke',
            'last_name': 'Test',
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

    def test_me_requires_auth(self):
        client = APIClient()
        resp = client.get('/api/v1/users/me/')
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_returns_user(self):
        user = User.objects.create_user(username='meuser', password='pass123')
        client = APIClient()
        client.force_authenticate(user=user)
        resp = client.get('/api/v1/users/me/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data['username'], 'meuser')


class AccountingSmokeTests(SmokeTestMixin, TestCase):
    """Smoke: accounting endpoints отвечают."""

    def test_legal_entities_list(self):
        resp = self.client.get('/api/v1/legal-entities/')
        self.assertIn(resp.status_code, [status.HTTP_200_OK])

    def test_accounts_list(self):
        resp = self.client.get('/api/v1/accounts/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_counterparties_list(self):
        resp = self.client.get('/api/v1/counterparties/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)


class ContractsSmokeTests(SmokeTestMixin, TestCase):
    """Smoke: contracts endpoints отвечают."""

    def test_contracts_list(self):
        resp = self.client.get('/api/v1/contracts/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_framework_contracts_list(self):
        resp = self.client.get('/api/v1/framework-contracts/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_acts_list(self):
        resp = self.client.get('/api/v1/acts/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)


class PaymentsSmokeTests(SmokeTestMixin, TestCase):
    """Smoke: payments endpoints отвечают."""

    def test_invoices_list(self):
        resp = self.client.get('/api/v1/invoices/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_payment_registry_list(self):
        resp = self.client.get('/api/v1/payment-registry/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_expense_categories_list(self):
        resp = self.client.get('/api/v1/expense-categories/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)


class ObjectsSmokeTests(SmokeTestMixin, TestCase):
    """Smoke: construction objects endpoints отвечают."""

    def test_objects_list(self):
        resp = self.client.get('/api/v1/objects/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)


class EstimatesSmokeTests(SmokeTestMixin, TestCase):
    """Smoke: estimates endpoints отвечают."""

    def test_projects_list(self):
        resp = self.client.get('/api/v1/projects/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_estimates_list(self):
        resp = self.client.get('/api/v1/estimates/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)


class PersonnelSmokeTests(SmokeTestMixin, TestCase):
    """Smoke: personnel endpoints отвечают."""

    def test_employees_list(self):
        resp = self.client.get('/api/v1/personnel/employees/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)


class SupplySmokeTests(SmokeTestMixin, TestCase):
    """Smoke: supply endpoints отвечают."""

    def test_supply_requests_list(self):
        resp = self.client.get('/api/v1/supply-requests/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
