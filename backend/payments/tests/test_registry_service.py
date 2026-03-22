"""Тесты для payments.services.registry_service.RegistryService."""

import pytest
from unittest.mock import Mock, patch
from rest_framework.exceptions import ValidationError

from payments.services.registry_service import RegistryService, REGISTRY_TRANSITIONS


# Значения статусов из PaymentRegistry.Status
PLANNED = 'planned'
APPROVED = 'approved'
PAID = 'paid'
CANCELLED = 'cancelled'


def make_registry(status):
    """Создаёт Mock-объект PaymentRegistry с заданным статусом."""
    obj = Mock()
    obj.status = status
    return obj


class TestRegistryServiceApprove:
    @patch('payments.services.registry_service.timezone')
    @patch('payments.services.registry_service.PaymentRegistry')
    def test_approve_from_planned(self, mock_model, mock_tz):
        """planned -> approved: устанавливает approved_by и approved_at."""
        mock_model.Status.APPROVED = APPROVED
        mock_model.Status.PLANNED = PLANNED
        mock_model.Status.PAID = PAID
        mock_model.Status.CANCELLED = CANCELLED

        registry = make_registry(PLANNED)
        user = Mock()
        mock_tz.now.return_value = 'fake_now'

        result = RegistryService.approve(registry, user)

        assert result.status == APPROVED
        assert result.approved_by == user
        assert result.approved_at == 'fake_now'
        registry.save.assert_called_once()

    @patch('payments.services.registry_service.PaymentRegistry')
    def test_approve_from_wrong_status(self, mock_model):
        """approved -> approved raises ValidationError."""
        mock_model.Status.APPROVED = APPROVED
        mock_model.Status.PLANNED = PLANNED
        mock_model.Status.PAID = PAID
        mock_model.Status.CANCELLED = CANCELLED

        registry = make_registry(APPROVED)
        user = Mock()

        with pytest.raises(ValidationError):
            RegistryService.approve(registry, user)


class TestRegistryServicePay:
    @patch('payments.services.registry_service.PaymentRegistry')
    def test_pay_from_approved(self, mock_model):
        """approved -> paid."""
        mock_model.Status.APPROVED = APPROVED
        mock_model.Status.PLANNED = PLANNED
        mock_model.Status.PAID = PAID
        mock_model.Status.CANCELLED = CANCELLED

        registry = make_registry(APPROVED)

        result = RegistryService.pay(registry)

        assert result.status == PAID
        registry.save.assert_called_once()

    @patch('payments.services.registry_service.PaymentRegistry')
    def test_pay_from_planned(self, mock_model):
        """planned -> paid raises ValidationError (нужен approve сначала)."""
        mock_model.Status.APPROVED = APPROVED
        mock_model.Status.PLANNED = PLANNED
        mock_model.Status.PAID = PAID
        mock_model.Status.CANCELLED = CANCELLED

        registry = make_registry(PLANNED)

        with pytest.raises(ValidationError):
            RegistryService.pay(registry)


class TestRegistryServiceCancel:
    @patch('payments.services.registry_service.PaymentRegistry')
    def test_cancel_from_planned(self, mock_model):
        """planned -> cancelled."""
        mock_model.Status.APPROVED = APPROVED
        mock_model.Status.PLANNED = PLANNED
        mock_model.Status.PAID = PAID
        mock_model.Status.CANCELLED = CANCELLED

        registry = make_registry(PLANNED)

        result = RegistryService.cancel(registry)

        assert result.status == CANCELLED
        registry.save.assert_called_once()

    @patch('payments.services.registry_service.PaymentRegistry')
    def test_cancel_from_paid(self, mock_model):
        """paid -> cancelled raises ValidationError (терминальный статус)."""
        mock_model.Status.APPROVED = APPROVED
        mock_model.Status.PLANNED = PLANNED
        mock_model.Status.PAID = PAID
        mock_model.Status.CANCELLED = CANCELLED

        registry = make_registry(PAID)

        with pytest.raises(ValidationError):
            RegistryService.cancel(registry)
