"""
kanban_rules/tests.py — тесты бизнес-логики RuleViewSet и модели Rule.
"""
import uuid
from unittest.mock import Mock, patch, MagicMock

import pytest
from django.test import SimpleTestCase

from core.kanban_permissions import KanbanRolePermissionMixin
from kanban_rules.views import RuleViewSet


class TestRuleViewSetConfig(SimpleTestCase):
    """Проверяем конфигурацию RuleViewSet без БД."""

    def test_kanban_write_role_is_kanban_admin(self):
        assert RuleViewSet.kanban_write_role == 'kanban_admin'

    def test_uses_kanban_role_permission_mixin(self):
        assert issubclass(RuleViewSet, KanbanRolePermissionMixin)

    def test_serializer_class_set(self):
        from kanban_rules.serializers import RuleSerializer
        assert RuleViewSet.serializer_class is RuleSerializer


class TestRuleViewSetPermissions(SimpleTestCase):
    """Проверяем, что mixin правильно разруливает permissions по action."""

    def _make_viewset(self, action_name):
        vs = RuleViewSet()
        vs.action = action_name
        vs.format_kwarg = None
        return vs

    def test_list_returns_default_permissions(self):
        vs = self._make_viewset('list')
        perms = vs.get_permissions()
        # Для read-actions должен быть только IsAuthenticated (из permission_classes)
        assert len(perms) == 1
        assert perms[0].__class__.__name__ == 'IsAuthenticated'

    def test_create_returns_role_permission(self):
        vs = self._make_viewset('create')
        perms = vs.get_permissions()
        assert len(perms) == 2
        assert perms[0].__class__.__name__ == 'IsAuthenticated'
        assert perms[1].__class__.__name__ == 'RolePermission'

    def test_destroy_returns_role_permission(self):
        vs = self._make_viewset('destroy')
        perms = vs.get_permissions()
        assert len(perms) == 2
        perm_names = [p.__class__.__name__ for p in perms]
        assert 'RolePermission' in perm_names

    def test_retrieve_no_role_required(self):
        vs = self._make_viewset('retrieve')
        perms = vs.get_permissions()
        perm_names = [p.__class__.__name__ for p in perms]
        assert 'RolePermission' not in perm_names


class TestRuleModel(SimpleTestCase):
    """Проверяем модель Rule без БД."""

    def test_meta_verbose_name(self):
        from kanban_rules.models import Rule
        assert Rule._meta.verbose_name == 'Правило'

    def test_default_fields(self):
        from kanban_rules.models import Rule
        conditions_field = Rule._meta.get_field('conditions')
        actions_field = Rule._meta.get_field('actions')
        is_active_field = Rule._meta.get_field('is_active')
        assert conditions_field.default == dict
        assert actions_field.default == list
        assert is_active_field.default is True
