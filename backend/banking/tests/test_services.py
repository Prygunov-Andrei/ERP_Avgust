"""Tests for banking.services — payment order workflow, statement sync, webhook processing."""

import os
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import MagicMock, patch, PropertyMock

import pytest
from django.contrib.auth.models import User
from django.utils import timezone

os.environ.setdefault(
    'BANK_ENCRYPTION_KEY',
    'Cba2op88Xj8PxFfPduejikxKMdYcY1VS76j45BdfrYw=',
)

from accounting.models import TaxSystem, LegalEntity, Account
from banking.clients.tochka import TochkaAPIError
from banking.models import (
    BankAccount,
    BankConnection,
    BankPaymentOrder,
    BankPaymentOrderEvent,
    BankTransaction,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def tax_system(db):
    return TaxSystem.objects.create(
        code='osn_vat_20_svc',
        name='ОСН (НДС 20%)',
        vat_rate=Decimal('20.00'),
        has_vat=True,
    )


@pytest.fixture
def legal_entity(tax_system):
    return LegalEntity.objects.create(
        name='ООО Тест Сервис',
        short_name='Тест',
        inn='111111111199',
        tax_system=tax_system,
    )


@pytest.fixture
def internal_account(legal_entity):
    return Account.objects.create(
        legal_entity=legal_entity,
        name='Тестовый р/с',
        number='40702810000000000099',
        initial_balance=Decimal('500000.00'),
    )


@pytest.fixture
def bank_connection(legal_entity):
    return BankConnection.objects.create(
        legal_entity=legal_entity,
        name='Точка — тестовое (services)',
        client_id='svc-client-id',
        client_secret='svc-client-secret',
        customer_code='CUST-SVC-001',
    )


@pytest.fixture
def bank_account(internal_account, bank_connection):
    return BankAccount.objects.create(
        account=internal_account,
        bank_connection=bank_connection,
        external_account_id='ext-svc-acc-001',
    )


@pytest.fixture
def user(db):
    return User.objects.create_user(username='svc_testuser', password='pass123')


@pytest.fixture
def approver(db):
    return User.objects.create_user(username='svc_approver', password='pass123')


@pytest.fixture
def draft_order(bank_account, user):
    from banking.services import create_payment_order
    return create_payment_order(
        bank_account=bank_account,
        user=user,
        recipient_name='ООО Получатель',
        recipient_inn='888888888888',
        recipient_kpp='',
        recipient_account='40702810000000000088',
        recipient_bank_name='Альфа-Банк',
        recipient_bik='044525593',
        recipient_corr_account='30101810200000000593',
        amount=Decimal('25000.00'),
        purpose='Оплата по договору тест',
    )


# ===================================================================
# submit_for_approval
# ===================================================================

@pytest.mark.django_db
class TestSubmitForApproval:

    def test_submit_from_draft(self, draft_order, user):
        from banking.services import submit_for_approval
        result = submit_for_approval(draft_order, user)
        assert result.status == BankPaymentOrder.Status.PENDING_APPROVAL

    def test_submit_creates_event(self, draft_order, user):
        from banking.services import submit_for_approval
        submit_for_approval(draft_order, user)
        events = draft_order.events.filter(event_type=BankPaymentOrderEvent.EventType.SUBMITTED)
        assert events.count() == 1

    def test_submit_from_wrong_status_raises(self, draft_order, user):
        from banking.services import submit_for_approval
        draft_order.status = BankPaymentOrder.Status.APPROVED
        draft_order.save()
        with pytest.raises(ValueError):
            submit_for_approval(draft_order, user)


# ===================================================================
# approve_order
# ===================================================================

@pytest.mark.django_db
class TestApproveOrder:

    def _pending_order(self, draft_order, user):
        from banking.services import submit_for_approval
        submit_for_approval(draft_order, user)
        return draft_order

    def test_approve_success(self, draft_order, user, approver):
        from banking.services import approve_order
        order = self._pending_order(draft_order, user)
        result = approve_order(order, approver)
        assert result.status == BankPaymentOrder.Status.APPROVED
        assert result.approved_by == approver
        assert result.approved_at is not None

    def test_approve_with_new_date(self, draft_order, user, approver):
        from banking.services import approve_order
        order = self._pending_order(draft_order, user)
        new_date = date(2026, 6, 15)
        result = approve_order(order, approver, payment_date=new_date)
        assert result.payment_date == new_date

    def test_approve_creates_event(self, draft_order, user, approver):
        from banking.services import approve_order
        order = self._pending_order(draft_order, user)
        approve_order(order, approver)
        events = order.events.filter(event_type=BankPaymentOrderEvent.EventType.APPROVED)
        assert events.count() == 1

    def test_approve_from_wrong_status_raises(self, draft_order, approver):
        from banking.services import approve_order
        with pytest.raises(ValueError):
            approve_order(draft_order, approver)


# ===================================================================
# reject_order
# ===================================================================

@pytest.mark.django_db
class TestRejectOrder:

    def test_reject_success(self, draft_order, user):
        from banking.services import submit_for_approval, reject_order
        submit_for_approval(draft_order, user)
        result = reject_order(draft_order, user, comment='Неверные реквизиты')
        assert result.status == BankPaymentOrder.Status.REJECTED

    def test_reject_creates_event_with_comment(self, draft_order, user):
        from banking.services import submit_for_approval, reject_order
        submit_for_approval(draft_order, user)
        reject_order(draft_order, user, comment='Проблемный контрагент')
        event = draft_order.events.filter(event_type=BankPaymentOrderEvent.EventType.REJECTED).first()
        assert event is not None
        assert event.comment == 'Проблемный контрагент'


# ===================================================================
# reschedule_order
# ===================================================================

@pytest.mark.django_db
class TestRescheduleOrder:

    def _approved_order(self, draft_order, user, approver):
        from banking.services import submit_for_approval, approve_order
        submit_for_approval(draft_order, user)
        approve_order(draft_order, approver)
        return draft_order

    def test_reschedule_success(self, draft_order, user, approver):
        from banking.services import reschedule_order
        order = self._approved_order(draft_order, user, approver)
        new_date = date(2026, 7, 1)
        result = reschedule_order(order, user, new_date, comment='Перенос по просьбе')
        assert result.payment_date == new_date

    def test_reschedule_creates_event(self, draft_order, user, approver):
        from banking.services import reschedule_order
        order = self._approved_order(draft_order, user, approver)
        reschedule_order(order, user, date(2026, 7, 1), comment='Перенос')
        events = order.events.filter(event_type=BankPaymentOrderEvent.EventType.RESCHEDULED)
        assert events.count() == 1

    def test_reschedule_without_comment_raises(self, draft_order, user, approver):
        from banking.services import reschedule_order
        order = self._approved_order(draft_order, user, approver)
        with pytest.raises(ValueError, match='Комментарий'):
            reschedule_order(order, user, date(2026, 7, 1), comment='')

    def test_reschedule_from_wrong_status_raises(self, draft_order, user):
        from banking.services import reschedule_order
        with pytest.raises(ValueError):
            reschedule_order(draft_order, user, date(2026, 7, 1), comment='test')


# ===================================================================
# _parse_statement_transactions
# ===================================================================

class TestParseStatementTransactions:

    def test_data_key_statement(self):
        from banking.services.statement_sync import _parse_statement_transactions
        data = {'Data': {'Statement': [{'paymentId': '1'}, {'paymentId': '2'}]}}
        result = _parse_statement_transactions(data)
        assert len(result) == 2

    def test_data_key_transaction(self):
        from banking.services.statement_sync import _parse_statement_transactions
        # Statement key must be absent or non-list so fallback to Transaction
        data = {'Data': {'Statement': 'not-a-list', 'Transaction': [{'paymentId': '1'}]}}
        result = _parse_statement_transactions(data)
        assert len(result) == 1

    def test_statements_key(self):
        from banking.services.statement_sync import _parse_statement_transactions
        data = {'statements': [{'paymentId': '1'}]}
        result = _parse_statement_transactions(data)
        assert len(result) == 1

    def test_list_input(self):
        from banking.services.statement_sync import _parse_statement_transactions
        data = [{'paymentId': '1'}]
        result = _parse_statement_transactions(data)
        assert len(result) == 1

    def test_empty_data(self):
        from banking.services.statement_sync import _parse_statement_transactions
        assert _parse_statement_transactions({}) == []


# ===================================================================
# process_webhook
# ===================================================================

@pytest.mark.django_db
class TestProcessWebhook:

    @patch('banking.services.tochka_api.verify_webhook_jwt')
    def test_invalid_jwt_returns_none(self, mock_verify):
        from banking.services import process_webhook
        mock_verify.side_effect = Exception('bad token')
        result = process_webhook('invalid-jwt')
        assert result is None

    @patch('banking.services.tochka_api.verify_webhook_jwt')
    def test_missing_payment_id_returns_none(self, mock_verify):
        from banking.services import process_webhook
        mock_verify.return_value = {'webhookType': 'incomingPayment', 'customerCode': 'C1'}
        result = process_webhook('some-jwt')
        assert result is None

    @patch('banking.services.tochka_api.verify_webhook_jwt')
    def test_duplicate_payment_id_returns_none(self, mock_verify, bank_account):
        from banking.services import process_webhook
        # Create existing transaction
        BankTransaction.objects.create(
            bank_account=bank_account,
            external_id='PAY-DUP-001',
            transaction_type=BankTransaction.TransactionType.INCOMING,
            amount=Decimal('1000.00'),
            date=date.today(),
        )
        mock_verify.return_value = {
            'webhookType': 'incomingPayment',
            'customerCode': 'CUST-SVC-001',
            'paymentId': 'PAY-DUP-001',
        }
        result = process_webhook('some-jwt')
        assert result is None


# ===================================================================
# TochkaAPIClient.build_payment_data
# ===================================================================

class TestBuildPaymentData:

    def test_build_payment_data(self):
        from banking.clients.tochka import TochkaAPIClient
        mock_connection = MagicMock()
        client = TochkaAPIClient(mock_connection)

        data = client.build_payment_data(
            customer_code='CUST001',
            account_code='ACC001',
            recipient_name='ООО Тест',
            recipient_inn='1234567890',
            recipient_kpp='770701001',
            recipient_account='40702810000000000001',
            recipient_bank_name='Сбербанк',
            recipient_bik='044525225',
            recipient_corr_account='30101810400000000225',
            amount='50000.00',
            purpose='Оплата по счету',
            payment_date=date(2026, 3, 15),
        )

        assert data['Data']['customerCode'] == 'CUST001'
        assert data['Data']['amount'] == '50000.00'
        assert data['Data']['recipientINN'] == '1234567890'
        assert data['Data']['paymentDate'] == '2026-03-15'
        client.close()

    def test_build_payment_data_default_date(self):
        from banking.clients.tochka import TochkaAPIClient
        mock_connection = MagicMock()
        client = TochkaAPIClient(mock_connection)

        data = client.build_payment_data(
            customer_code='C1',
            account_code='A1',
            recipient_name='Test',
            recipient_inn='111',
            recipient_kpp='',
            recipient_account='40702',
            recipient_bank_name='Bank',
            recipient_bik='044',
            recipient_corr_account='301',
            amount='100',
            purpose='Test',
        )
        assert data['Data']['paymentDate'] == date.today().isoformat()
        client.close()


# ===================================================================
# BankPaymentOrder model properties
# ===================================================================

@pytest.mark.django_db
class TestBankPaymentOrderProperties:

    def test_can_reschedule_approved(self, draft_order, user, approver):
        from banking.services import submit_for_approval, approve_order
        submit_for_approval(draft_order, user)
        approve_order(draft_order, approver)
        assert draft_order.can_reschedule is True

    def test_can_reschedule_draft_false(self, draft_order):
        assert draft_order.can_reschedule is False

    def test_reschedule_count_zero(self, draft_order):
        assert draft_order.reschedule_count == 0

    def test_reschedule_count_increments(self, draft_order, user, approver):
        from banking.services import submit_for_approval, approve_order, reschedule_order
        submit_for_approval(draft_order, user)
        approve_order(draft_order, approver)
        reschedule_order(draft_order, user, date(2026, 7, 1), comment='Причина 1')
        reschedule_order(draft_order, user, date(2026, 7, 15), comment='Причина 2')
        assert draft_order.reschedule_count == 2


# ===================================================================
# Encryption round-trip
# ===================================================================

class TestEncryption:

    def test_encrypt_decrypt_roundtrip(self):
        from banking.encryption import encrypt_value, decrypt_value
        plaintext = 'super-secret-token-12345'
        cipher = encrypt_value(plaintext)
        assert cipher != plaintext
        assert decrypt_value(cipher) == plaintext

    def test_empty_string(self):
        from banking.encryption import encrypt_value, decrypt_value
        assert encrypt_value('') == ''
        assert decrypt_value('') == ''
