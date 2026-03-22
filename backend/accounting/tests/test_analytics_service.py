"""Unit-тесты для AnalyticsService (mock-based, без БД)."""

from datetime import date
from decimal import Decimal
from unittest import mock

from django.test import SimpleTestCase

from accounting.services.analytics_service import AnalyticsService


class TestGetCashflow(SimpleTestCase):
    """Тесты для AnalyticsService.get_cashflow()."""

    @mock.patch('accounting.services.analytics_service.Payment')
    def test_get_cashflow_returns_dict(self, MockPayment):
        """get_cashflow возвращает dict с income/expense/net по месяцам."""
        qs = MockPayment.objects.filter.return_value
        qs.annotate.return_value = qs
        qs.values.return_value = qs
        qs.order_by.return_value = [
            {
                'month': date(2025, 1, 1),
                'payment_type': 'income',
                'total': Decimal('500000'),
            },
            {
                'month': date(2025, 1, 1),
                'payment_type': 'expense',
                'total': Decimal('200000'),
            },
            {
                'month': date(2025, 2, 1),
                'payment_type': 'income',
                'total': Decimal('300000'),
            },
        ]
        MockPayment.PaymentType.INCOME = 'income'

        result = AnalyticsService.get_cashflow()

        assert isinstance(result, dict)
        assert '2025-01' in result
        assert '2025-02' in result

        jan = result['2025-01']
        assert jan['income'] == 500000.0
        assert jan['expense'] == 200000.0
        assert jan['net'] == 300000.0

        feb = result['2025-02']
        assert feb['income'] == 300000.0
        assert feb['expense'] == 0
        assert feb['net'] == 300000.0

    @mock.patch('accounting.services.analytics_service.Payment')
    def test_get_cashflow_empty(self, MockPayment):
        """get_cashflow возвращает пустой dict при отсутствии данных."""
        qs = MockPayment.objects.filter.return_value
        qs.annotate.return_value = qs
        qs.values.return_value = qs
        qs.order_by.return_value = []

        result = AnalyticsService.get_cashflow()

        assert result == {}

    @mock.patch('accounting.services.analytics_service.Payment')
    def test_get_cashflow_skips_null_month(self, MockPayment):
        """Записи с month=None пропускаются."""
        qs = MockPayment.objects.filter.return_value
        qs.annotate.return_value = qs
        qs.values.return_value = qs
        qs.order_by.return_value = [
            {
                'month': None,
                'payment_type': 'income',
                'total': Decimal('100'),
            },
        ]

        result = AnalyticsService.get_cashflow()

        assert result == {}


class TestGetDebtSummary(SimpleTestCase):
    """Тесты для AnalyticsService.get_debt_summary()."""

    @mock.patch('accounting.services.analytics_service.Contract')
    @mock.patch('accounting.services.analytics_service.Act')
    @mock.patch('accounting.services.analytics_service.Payment')
    def test_get_debt_summary_returns_dict(self, MockPayment, MockAct, MockContract):
        """get_debt_summary возвращает dict с receivables, payables и details."""
        # Настраиваем цепочку queryset для Contract
        mock_counterparty_income = mock.Mock()
        mock_counterparty_income.short_name = 'Заказчик ООО'

        mock_counterparty_expense = mock.Mock()
        mock_counterparty_expense.short_name = 'Подрядчик ООО'

        income_contract = mock.Mock()
        income_contract.id = 1
        income_contract.number = 'IN-001'
        income_contract.contract_type = 'income'
        income_contract.counterparty = mock_counterparty_income
        income_contract.calc_balance = Decimal('150000')

        expense_contract = mock.Mock()
        expense_contract.id = 2
        expense_contract.number = 'OUT-001'
        expense_contract.contract_type = 'expense'
        expense_contract.counterparty = mock_counterparty_expense
        expense_contract.calc_balance = Decimal('75000')

        zero_contract = mock.Mock()
        zero_contract.id = 3
        zero_contract.number = 'Z-001'
        zero_contract.contract_type = 'income'
        zero_contract.counterparty = mock_counterparty_income
        zero_contract.calc_balance = Decimal('0')

        MockContract.Type.INCOME = 'income'

        qs = MockContract.objects.filter.return_value
        qs.select_related.return_value = qs
        qs.annotate.return_value = qs
        # Итерация по queryset возвращает наши mock-контракты
        qs.__iter__ = mock.Mock(
            return_value=iter([income_contract, expense_contract, zero_contract])
        )

        result = AnalyticsService.get_debt_summary()

        assert isinstance(result, dict)
        assert 'total_receivables' in result
        assert 'total_payables' in result
        assert 'details' in result

        assert result['total_receivables'] == Decimal('150000')
        assert result['total_payables'] == Decimal('75000')

        # zero_contract с balance=0 исключён из details
        assert len(result['details']) == 2
        assert result['details'][0]['contract_number'] == 'IN-001'
        assert result['details'][1]['contract_number'] == 'OUT-001'

    @mock.patch('accounting.services.analytics_service.Contract')
    @mock.patch('accounting.services.analytics_service.Act')
    @mock.patch('accounting.services.analytics_service.Payment')
    def test_get_debt_summary_empty(self, MockPayment, MockAct, MockContract):
        """get_debt_summary при отсутствии контрактов возвращает нули."""
        MockContract.Type.INCOME = 'income'

        qs = MockContract.objects.filter.return_value
        qs.select_related.return_value = qs
        qs.annotate.return_value = qs
        qs.__iter__ = mock.Mock(return_value=iter([]))

        result = AnalyticsService.get_debt_summary()

        assert result['total_receivables'] == 0
        assert result['total_payables'] == 0
        assert result['details'] == []
