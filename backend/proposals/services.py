"""
proposals/services.py — бизнес-логика для ТКП и МП.

Вынесена из views.py для тонких view-обёрток.
"""
from __future__ import annotations

from django.utils import timezone


def record_tkp_creation(tkp, user):
    """Записать начальный статус при создании ТКП."""
    from .models import TKPStatusHistory

    TKPStatusHistory.objects.create(
        tkp=tkp,
        old_status='',
        new_status=tkp.status,
        changed_by=user,
    )


def handle_tkp_status_change(instance, old_status, user):
    """
    При смене статуса ТКП:
      — записать в историю
      — проставить checked_by / approved_by
    """
    from .models import TechnicalProposal, TKPStatusHistory

    new_status = instance.status
    if old_status == new_status:
        return

    TKPStatusHistory.objects.create(
        tkp=instance,
        old_status=old_status,
        new_status=new_status,
        changed_by=user,
    )

    if new_status == TechnicalProposal.Status.CHECKING:
        instance.checked_by = user
        instance.checked_at = timezone.now()
        instance.save(update_fields=['checked_by', 'checked_at'])
    elif new_status == TechnicalProposal.Status.APPROVED:
        instance.approved_by = user
        instance.approved_at = timezone.now()
        instance.save(update_fields=['approved_by', 'approved_at'])


def add_estimates_to_tkp(tkp, estimate_ids, copy_data=True):
    """
    Привязать сметы к ТКП. Возвращает кол-во добавленных и общее кол-во.
    """
    from estimates.models import Estimate

    estimates = Estimate.objects.filter(id__in=estimate_ids)
    tkp.estimates.add(*estimates)

    if copy_data:
        tkp.copy_data_from_estimates()

    return {
        'added_count': len(estimates),
        'estimates_count': tkp.estimates.count(),
    }


def remove_estimates_from_tkp(tkp, estimate_ids):
    """
    Убрать сметы из ТКП и пересчитать данные.
    """
    tkp.estimates.remove(*estimate_ids)
    tkp.copy_data_from_estimates()
    return {
        'removed_count': len(estimate_ids),
        'estimates_count': tkp.estimates.count(),
    }


def create_mp_from_tkp(tkp, user, request_data):
    """
    Создать МП на основе ТКП. Возвращает объект MountingProposal.
    """
    from .models import MountingProposal

    extra = {}
    if request_data.get('counterparty'):
        from accounting.models import Counterparty
        extra['counterparty'] = Counterparty.objects.get(pk=request_data['counterparty'])
    if request_data.get('total_amount'):
        extra['total_amount'] = request_data['total_amount']
    if request_data.get('man_hours'):
        extra['man_hours'] = request_data['man_hours']
    if request_data.get('notes'):
        extra['notes'] = request_data['notes']
    if request_data.get('mounting_estimates_ids'):
        extra['mounting_estimates_ids'] = request_data['mounting_estimates_ids']
    if request_data.get('conditions_ids'):
        extra['conditions_ids'] = request_data['conditions_ids']

    return MountingProposal.create_from_tkp(tkp, user, **extra)


def mark_mp_telegram_published(mp):
    """Пометить МП как опубликованное в Telegram."""
    mp.telegram_published = True
    mp.telegram_published_at = timezone.now()
    mp.save(update_fields=['telegram_published', 'telegram_published_at'])
