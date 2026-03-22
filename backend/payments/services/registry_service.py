"""Сервис для управления статусами заявок на оплату (PaymentRegistry)."""

from django.utils import timezone

from core.state_machine import validate_transition
from payments.models import PaymentRegistry


REGISTRY_TRANSITIONS = {
    PaymentRegistry.Status.PLANNED: [
        PaymentRegistry.Status.APPROVED,
        PaymentRegistry.Status.CANCELLED,
    ],
    PaymentRegistry.Status.APPROVED: [
        PaymentRegistry.Status.PAID,
        PaymentRegistry.Status.CANCELLED,
    ],
    PaymentRegistry.Status.PAID: [],
    PaymentRegistry.Status.CANCELLED: [],
}


class RegistryService:

    @staticmethod
    def approve(registry: PaymentRegistry, user) -> PaymentRegistry:
        validate_transition(registry, PaymentRegistry.Status.APPROVED, REGISTRY_TRANSITIONS)
        registry.status = PaymentRegistry.Status.APPROVED
        registry.approved_by = user
        registry.approved_at = timezone.now()
        registry.save()
        return registry

    @staticmethod
    def pay(registry: PaymentRegistry) -> PaymentRegistry:
        validate_transition(registry, PaymentRegistry.Status.PAID, REGISTRY_TRANSITIONS)
        registry.status = PaymentRegistry.Status.PAID
        registry.save()
        return registry

    @staticmethod
    def cancel(registry: PaymentRegistry) -> PaymentRegistry:
        validate_transition(registry, PaymentRegistry.Status.CANCELLED, REGISTRY_TRANSITIONS)
        registry.status = PaymentRegistry.Status.CANCELLED
        registry.save()
        return registry
