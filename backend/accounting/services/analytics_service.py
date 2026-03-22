"""Аналитические сервисы: cashflow, задолженности."""

from django.db import models
from django.db.models import Sum, F, OuterRef, Subquery, Value
from django.db.models.functions import TruncMonth, Coalesce

from payments.models import Payment
from contracts.models import Contract, Act


class AnalyticsService:

    @staticmethod
    def get_cashflow() -> dict:
        """
        Cashflow по месяцам.
        Возвращает агрегированные данные по приходам и расходам.
        """
        data = Payment.objects.filter(status='paid').annotate(
            month=TruncMonth('payment_date')
        ).values('month', 'payment_type').annotate(
            total=Sum('amount')
        ).order_by('month')

        result = {}
        for item in data:
            if not item['month']:
                continue
            month_str = item['month'].strftime('%Y-%m')
            if month_str not in result:
                result[month_str] = {'income': 0, 'expense': 0, 'net': 0}

            amount = float(item['total'])
            if item['payment_type'] == Payment.PaymentType.INCOME:
                result[month_str]['income'] += amount
                result[month_str]['net'] += amount
            else:
                result[month_str]['expense'] += amount
                result[month_str]['net'] -= amount

        return result

    @staticmethod
    def get_debt_summary() -> dict:
        """Сводка задолженностей по контрактам."""
        acts_sum = Act.objects.filter(
            contract=OuterRef('pk'),
            status=Act.Status.SIGNED
        ).values('contract').annotate(
            total=Sum('amount_gross')
        ).values('total')

        payments_sum = Payment.objects.filter(
            contract=OuterRef('pk'),
            status=Payment.Status.PAID
        ).values('contract').annotate(
            total=Sum('amount')
        ).values('total')

        contracts = Contract.objects.filter(
            status__in=['active', 'completed']
        ).select_related(
            'counterparty'
        ).annotate(
            total_acts=Coalesce(Subquery(acts_sum), Value(0, output_field=models.DecimalField())),
            total_payments=Coalesce(Subquery(payments_sum), Value(0, output_field=models.DecimalField()))
        ).annotate(
            calc_balance=F('total_acts') - F('total_payments')
        )

        receivables = 0
        payables = 0
        details = []

        for contract in contracts:
            balance = contract.calc_balance
            if balance == 0:
                continue

            if contract.contract_type == Contract.Type.INCOME:
                if balance > 0:
                    receivables += balance
            else:
                if balance > 0:
                    payables += balance

            details.append({
                'contract_id': contract.id,
                'contract_number': contract.number,
                'counterparty': contract.counterparty.short_name if contract.counterparty else 'N/A',
                'type': contract.contract_type,
                'balance': balance,
            })

        return {
            'total_receivables': receivables,
            'total_payables': payables,
            'details': details,
        }
