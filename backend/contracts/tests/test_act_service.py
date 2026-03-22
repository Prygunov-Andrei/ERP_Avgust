"""Тесты для contracts.services.act_service.ActService."""

import pytest
from unittest.mock import Mock, patch
from rest_framework.exceptions import ValidationError

from contracts.services.act_service import ActService, ACT_TRANSITIONS


# Значения статусов из Act.Status
DRAFT = 'draft'
AGREED = 'agreed'
SIGNED = 'signed'
CANCELLED = 'cancelled'


def make_act(status):
    """Создаёт Mock-объект Act с заданным статусом."""
    obj = Mock()
    obj.status = status
    return obj


class TestActServiceAgree:
    @patch('contracts.services.act_service.Act')
    def test_agree_from_draft(self, mock_model):
        """draft -> agreed."""
        mock_model.Status.DRAFT = DRAFT
        mock_model.Status.AGREED = AGREED
        mock_model.Status.SIGNED = SIGNED
        mock_model.Status.CANCELLED = CANCELLED

        act = make_act(DRAFT)

        result = ActService.agree(act)

        assert result.status == AGREED
        act.save.assert_called_once()

    @patch('contracts.services.act_service.Act')
    def test_agree_from_signed(self, mock_model):
        """signed -> agreed raises ValidationError (терминальный статус)."""
        mock_model.Status.DRAFT = DRAFT
        mock_model.Status.AGREED = AGREED
        mock_model.Status.SIGNED = SIGNED
        mock_model.Status.CANCELLED = CANCELLED

        act = make_act(SIGNED)

        with pytest.raises(ValidationError):
            ActService.agree(act)


class TestActServiceSign:
    @patch('contracts.services.act_service.Act')
    def test_sign_from_agreed(self, mock_model):
        """agreed -> signed."""
        mock_model.Status.DRAFT = DRAFT
        mock_model.Status.AGREED = AGREED
        mock_model.Status.SIGNED = SIGNED
        mock_model.Status.CANCELLED = CANCELLED

        act = make_act(AGREED)

        result = ActService.sign(act)

        assert result.status == SIGNED
        act.save.assert_called_once()

    @patch('contracts.services.act_service.Act')
    def test_sign_from_draft(self, mock_model):
        """draft -> signed тоже допустим (в ACT_TRANSITIONS)."""
        mock_model.Status.DRAFT = DRAFT
        mock_model.Status.AGREED = AGREED
        mock_model.Status.SIGNED = SIGNED
        mock_model.Status.CANCELLED = CANCELLED

        act = make_act(DRAFT)

        result = ActService.sign(act)

        assert result.status == SIGNED
        act.save.assert_called_once()

    @patch('contracts.services.act_service.Act')
    def test_sign_from_signed(self, mock_model):
        """signed -> signed raises ValidationError (уже подписан)."""
        mock_model.Status.DRAFT = DRAFT
        mock_model.Status.AGREED = AGREED
        mock_model.Status.SIGNED = SIGNED
        mock_model.Status.CANCELLED = CANCELLED

        act = make_act(SIGNED)

        with pytest.raises(ValidationError):
            ActService.sign(act)

    @patch('contracts.services.act_service.Act')
    def test_sign_from_cancelled(self, mock_model):
        """cancelled -> signed raises ValidationError."""
        mock_model.Status.DRAFT = DRAFT
        mock_model.Status.AGREED = AGREED
        mock_model.Status.SIGNED = SIGNED
        mock_model.Status.CANCELLED = CANCELLED

        act = make_act(CANCELLED)

        with pytest.raises(ValidationError):
            ActService.sign(act)
