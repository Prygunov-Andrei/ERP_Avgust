"""
kanban_supply/tests.py — тесты бизнес-логики модуля снабжения.
"""
import uuid
from unittest.mock import Mock

import pytest
from django.test import SimpleTestCase

from kanban_supply.models import SupplyCase, InvoiceRef, DeliveryBatch
from kanban_supply.views import SupplyCaseViewSet, InvoiceRefViewSet, DeliveryBatchViewSet
from core.kanban_permissions import KanbanRolePermissionMixin


class TestSupplyViewSetConfig(SimpleTestCase):
    """Проверяем конфигурацию ViewSet'ов снабжения."""

    def test_supply_case_write_role(self):
        assert SupplyCaseViewSet.kanban_write_role == 'supply_operator'

    def test_invoice_ref_write_role(self):
        assert InvoiceRefViewSet.kanban_write_role == 'supply_operator'

    def test_delivery_batch_write_role(self):
        assert DeliveryBatchViewSet.kanban_write_role == 'supply_operator'

    def test_all_use_kanban_role_mixin(self):
        assert issubclass(SupplyCaseViewSet, KanbanRolePermissionMixin)
        assert issubclass(InvoiceRefViewSet, KanbanRolePermissionMixin)
        assert issubclass(DeliveryBatchViewSet, KanbanRolePermissionMixin)


class TestSupplyViewSetPermissions(SimpleTestCase):
    """Проверяем, что write-actions требуют RolePermission."""

    def _make_viewset(self, cls, action_name):
        vs = cls()
        vs.action = action_name
        vs.format_kwarg = None
        return vs

    def test_supply_case_list_only_is_authenticated(self):
        vs = self._make_viewset(SupplyCaseViewSet, 'list')
        perms = vs.get_permissions()
        assert len(perms) == 1
        assert perms[0].__class__.__name__ == 'IsAuthenticated'

    def test_supply_case_create_requires_role(self):
        vs = self._make_viewset(SupplyCaseViewSet, 'create')
        perms = vs.get_permissions()
        perm_names = [p.__class__.__name__ for p in perms]
        assert 'RolePermission' in perm_names

    def test_delivery_batch_update_requires_role(self):
        vs = self._make_viewset(DeliveryBatchViewSet, 'update')
        perms = vs.get_permissions()
        perm_names = [p.__class__.__name__ for p in perms]
        assert 'RolePermission' in perm_names


class TestDeliveryBatchStatusChoices(SimpleTestCase):
    """Проверяем статусы DeliveryBatch."""

    def test_status_choices_count(self):
        choices = DeliveryBatch.Status.choices
        assert len(choices) == 3

    def test_status_values(self):
        values = {c[0] for c in DeliveryBatch.Status.choices}
        assert values == {'planned', 'in_progress', 'delivered'}

    def test_default_status_is_planned(self):
        field = DeliveryBatch._meta.get_field('status')
        assert field.default == DeliveryBatch.Status.PLANNED


class TestInvoiceRefUniqueConstraint(SimpleTestCase):
    """Проверяем unique_together на модели InvoiceRef."""

    def test_unique_together_defined(self):
        ut = InvoiceRef._meta.unique_together
        assert ('supply_case', 'erp_invoice_id') in ut
