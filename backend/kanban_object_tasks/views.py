from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from kanban_object_tasks.models import ObjectTask
from kanban_object_tasks.serializers import ObjectTaskSerializer
from core.kanban_permissions import KanbanRolePermissionMixin


class ObjectTaskViewSet(KanbanRolePermissionMixin, viewsets.ModelViewSet):
    queryset = ObjectTask.objects.select_related('card', 'card__board', 'card__column').all()
    serializer_class = ObjectTaskSerializer
    permission_classes = [IsAuthenticated]
    kanban_write_role = 'object_tasks'
