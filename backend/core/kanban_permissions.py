"""
Миксин для role-based permissions в kanban ViewSets.

Заменяет повторяющийся паттерн get_permissions() в 8+ ViewSets:

    class MyViewSet(KanbanRolePermissionMixin, viewsets.ModelViewSet):
        kanban_write_role = 'warehouse'
"""

from rest_framework.permissions import IsAuthenticated
from kanban_core.permissions import RolePermission


class KanbanRolePermissionMixin:
    """Read = IsAuthenticated, Write = IsAuthenticated + RolePermission(role)."""

    kanban_write_role: str = None

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            if self.kanban_write_role:
                return [IsAuthenticated(), RolePermission(self.kanban_write_role)]
        return super().get_permissions()
