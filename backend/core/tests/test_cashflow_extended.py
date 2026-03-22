"""
Расширенные тесты для core/cashflow.py — CashFlowCalculator.
Моковые DB-запросы для unit-тестирования без TestCase(DB).
"""
from decimal import Decimal
from datetime import date
from unittest.mock import patch, MagicMock

import pytest

from core.cashflow import CashFlowCalculator


class TestCashFlowCalculateLogic:
    """Unit-тесты для CashFlowCalculator.calculate — мокаем ORM."""

    @patch('core.cashflow.Payment')
    def test_calculate_no_filters(self, MockPayment):
        """Без фильтров — возвращает агрегат по всем платежам."""
        MockPayment.objects.filter.return_value.aggregate.return_value = {
            'income': Decimal('1000'),
            'expense': Decimal('400'),
        }
        result = CashFlowCalculator.calculate()
        assert result['income'] == Decimal('1000')
        assert result['expense'] == Decimal('400')
        assert result['cash_flow'] == Decimal('600')

    @patch('core.cashflow.Payment')
    def test_calculate_with_contract_id(self, MockPayment):
        """Фильтрация по contract_id."""
        MockPayment.objects.filter.return_value.aggregate.return_value = {
            'income': Decimal('500'),
            'expense': Decimal('100'),
        }
        result = CashFlowCalculator.calculate(contract_id=42)
        assert result['cash_flow'] == Decimal('400')

    @patch('contracts.models.Contract')
    @patch('core.cashflow.Payment')
    def test_calculate_with_object_id(self, MockPayment, MockContract):
        """Фильтрация по object_id — сначала ищет contract_ids."""
        MockContract.objects.filter.return_value.values_list.return_value = [1, 2, 3]
        MockPayment.objects.filter.return_value.aggregate.return_value = {
            'income': Decimal('300'),
            'expense': Decimal('50'),
        }

        result = CashFlowCalculator.calculate(object_id=10)
        assert result['income'] == Decimal('300')
        assert result['expense'] == Decimal('50')

    @patch('core.cashflow.Payment')
    def test_calculate_empty_result_gives_zeros(self, MockPayment):
        """Нет платежей — все поля 0."""
        MockPayment.objects.filter.return_value.aggregate.return_value = {
            'income': None,
            'expense': None,
        }
        result = CashFlowCalculator.calculate()
        assert result['income'] == Decimal('0')
        assert result['expense'] == Decimal('0')
        assert result['cash_flow'] == Decimal('0')

    @patch('core.cashflow.Payment')
    def test_calculate_date_filters(self, MockPayment):
        """Проверка что start_date и end_date передаются."""
        MockPayment.objects.filter.return_value.aggregate.return_value = {
            'income': Decimal('100'),
            'expense': Decimal('0'),
        }
        result = CashFlowCalculator.calculate(
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
        )
        assert result['income'] == Decimal('100')


class TestCashFlowConvenienceMethods:
    """Тесты convenience-методов calculate_for_*."""

    @patch.object(CashFlowCalculator, 'calculate')
    def test_calculate_for_object_delegates(self, mock_calc):
        mock_calc.return_value = {'income': Decimal('1'), 'expense': Decimal('0'), 'cash_flow': Decimal('1')}
        result = CashFlowCalculator.calculate_for_object(object_id=5)
        mock_calc.assert_called_once_with(object_id=5, start_date=None, end_date=None)
        assert result['cash_flow'] == Decimal('1')

    @patch.object(CashFlowCalculator, 'calculate')
    def test_calculate_for_contract_delegates(self, mock_calc):
        mock_calc.return_value = {'income': Decimal('2'), 'expense': Decimal('1'), 'cash_flow': Decimal('1')}
        result = CashFlowCalculator.calculate_for_contract(contract_id=7)
        mock_calc.assert_called_once_with(contract_id=7, start_date=None, end_date=None)

    @patch.object(CashFlowCalculator, 'calculate')
    def test_calculate_for_all_objects_delegates(self, mock_calc):
        mock_calc.return_value = {'income': Decimal('0'), 'expense': Decimal('0'), 'cash_flow': Decimal('0')}
        CashFlowCalculator.calculate_for_all_objects(start_date=date(2024, 1, 1))
        mock_calc.assert_called_once_with(start_date=date(2024, 1, 1), end_date=None)


class TestCashFlowByPeriods:
    """Тесты calculate_by_periods."""

    @patch('core.cashflow.Payment')
    def test_by_periods_invalid_type_raises(self, MockPayment):
        with pytest.raises(ValueError, match="Неизвестный тип периода"):
            CashFlowCalculator.calculate_by_periods(period_type='quarter')

    @patch('core.cashflow.Payment')
    def test_by_periods_empty_result(self, MockPayment):
        MockPayment.objects.filter.return_value.annotate.return_value.values.return_value.annotate.return_value.order_by.return_value = []
        result = CashFlowCalculator.calculate_by_periods(period_type='month')
        assert result == []

    @patch('core.cashflow.Payment')
    def test_by_periods_day_type(self, MockPayment):
        """period_type='day' не вызывает ошибку."""
        MockPayment.objects.filter.return_value.annotate.return_value.values.return_value.annotate.return_value.order_by.return_value = [
            {'period': date(2024, 3, 1), 'income': Decimal('100'), 'expense': Decimal('50'), 'count': 2},
        ]
        result = CashFlowCalculator.calculate_by_periods(period_type='day')
        assert len(result) == 1
        assert result[0]['cash_flow'] == Decimal('50')
        assert result[0]['count'] == 2

    @patch('core.cashflow.Payment')
    def test_by_periods_week_type(self, MockPayment):
        MockPayment.objects.filter.return_value.annotate.return_value.values.return_value.annotate.return_value.order_by.return_value = []
        result = CashFlowCalculator.calculate_by_periods(period_type='week')
        assert result == []
