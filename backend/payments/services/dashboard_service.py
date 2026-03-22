"""
Сервисный слой для аналитического дашборда счетов на оплату.
"""
from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Count, Sum

from payments.models import Invoice


def get_invoice_dashboard() -> dict:
    """
    Сводная аналитика для директора.

    Returns:
        dict с ключами: account_balances, registry_summary, by_object, by_category.
    """
    from accounting.models import Account, AccountBalance

    today = date.today()

    # Остатки на счетах
    accounts = Account.objects.filter(is_active=True)
    account_balances = []
    for acc in accounts:
        latest_bank_balance = (
            AccountBalance.objects
            .filter(account=acc, source=AccountBalance.Source.BANK_TOCHKA)
            .order_by('-balance_date')
            .first()
        )
        account_balances.append({
            'id': acc.id,
            'name': acc.name,
            'number': acc.number,
            'currency': acc.currency,
            'internal_balance': str(acc.get_current_balance()),
            'bank_balance': str(latest_bank_balance.balance) if latest_bank_balance else None,
            'bank_balance_date': str(latest_bank_balance.balance_date) if latest_bank_balance else None,
        })

    # Сводка по реестру
    registry_qs = Invoice.objects.filter(status=Invoice.Status.IN_REGISTRY)
    overdue_qs = registry_qs.filter(due_date__lt=today)
    today_qs = registry_qs.filter(due_date=today)

    week_end = today + timedelta(days=7)
    month_end = today + timedelta(days=30)
    week_qs = registry_qs.filter(due_date__lte=week_end)
    month_qs = registry_qs.filter(due_date__lte=month_end)

    def sum_amount(qs):
        return qs.aggregate(total=Sum('amount_gross'))['total'] or Decimal('0')

    registry_summary = {
        'total_amount': str(sum_amount(registry_qs)),
        'total_count': registry_qs.count(),
        'overdue_amount': str(sum_amount(overdue_qs)),
        'overdue_count': overdue_qs.count(),
        'today_amount': str(sum_amount(today_qs)),
        'today_count': today_qs.count(),
        'this_week_amount': str(sum_amount(week_qs)),
        'this_week_count': week_qs.count(),
        'this_month_amount': str(sum_amount(month_qs)),
        'this_month_count': month_qs.count(),
    }

    # Группировка по объектам
    by_object = list(
        registry_qs
        .values('object__id', 'object__name')
        .annotate(total=Sum('amount_gross'), count=Count('id'))
        .order_by('-total')
    )

    # Группировка по категориям
    by_category = list(
        registry_qs
        .values('category__id', 'category__name')
        .annotate(total=Sum('amount_gross'), count=Count('id'))
        .order_by('-total')
    )

    return {
        'account_balances': account_balances,
        'registry_summary': registry_summary,
        'by_object': by_object,
        'by_category': by_category,
    }
