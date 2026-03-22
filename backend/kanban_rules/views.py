from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from kanban_rules.models import Rule
from kanban_rules.serializers import RuleSerializer
from core.kanban_permissions import KanbanRolePermissionMixin


class RuleViewSet(KanbanRolePermissionMixin, viewsets.ModelViewSet):
    queryset = Rule.objects.select_related('board').all()
    serializer_class = RuleSerializer
    permission_classes = [IsAuthenticated]
    kanban_write_role = 'kanban_admin'
