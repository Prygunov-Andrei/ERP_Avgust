"""
kanban_object_tasks/tests.py — тесты бизнес-логики модуля задач по объектам.
"""
import uuid
from datetime import date
from unittest.mock import Mock

import pytest
from django.test import SimpleTestCase

from kanban_object_tasks.models import ObjectTask, OverdueMarker
from kanban_object_tasks.views import ObjectTaskViewSet
from core.kanban_permissions import KanbanRolePermissionMixin


class TestObjectTaskViewSetConfig(SimpleTestCase):
    """Проверяем конфигурацию ObjectTaskViewSet."""

    def test_kanban_write_role(self):
        assert ObjectTaskViewSet.kanban_write_role == 'object_tasks'

    def test_uses_kanban_role_permission_mixin(self):
        assert issubclass(ObjectTaskViewSet, KanbanRolePermissionMixin)

    def test_serializer_class_set(self):
        from kanban_object_tasks.serializers import ObjectTaskSerializer
        assert ObjectTaskViewSet.serializer_class is ObjectTaskSerializer


class TestObjectTaskPermissions(SimpleTestCase):
    """Проверяем permissions по action."""

    def _make_viewset(self, action_name):
        vs = ObjectTaskViewSet()
        vs.action = action_name
        vs.format_kwarg = None
        return vs

    def test_list_only_is_authenticated(self):
        vs = self._make_viewset('list')
        perms = vs.get_permissions()
        assert len(perms) == 1
        assert perms[0].__class__.__name__ == 'IsAuthenticated'

    def test_create_requires_role(self):
        vs = self._make_viewset('create')
        perms = vs.get_permissions()
        perm_names = [p.__class__.__name__ for p in perms]
        assert 'RolePermission' in perm_names

    def test_partial_update_requires_role(self):
        vs = self._make_viewset('partial_update')
        perms = vs.get_permissions()
        perm_names = [p.__class__.__name__ for p in perms]
        assert 'RolePermission' in perm_names


class TestOverdueMarkerModel(SimpleTestCase):
    """Проверяем модель OverdueMarker без БД."""

    def test_unique_together_card_and_date(self):
        ut = OverdueMarker._meta.unique_together
        assert ('card', 'marker_date') in ut

    def test_default_marker_date_is_today(self):
        field = OverdueMarker._meta.get_field('marker_date')
        assert field.default == date.today

    def test_has_marker_date_index(self):
        index_fields = [
            idx.fields for idx in OverdueMarker._meta.indexes
        ]
        assert ['marker_date'] in index_fields


class TestObjectTaskModelDefaults(SimpleTestCase):
    """Проверяем дефолты модели ObjectTask."""

    def test_default_priority_is_zero(self):
        field = ObjectTask._meta.get_field('priority')
        assert field.default == 0
