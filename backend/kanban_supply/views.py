from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from kanban_supply.models import SupplyCase, InvoiceRef, DeliveryBatch
from kanban_supply.serializers import SupplyCaseSerializer, InvoiceRefSerializer, DeliveryBatchSerializer
from core.kanban_permissions import KanbanRolePermissionMixin


class SupplyCaseViewSet(KanbanRolePermissionMixin, viewsets.ModelViewSet):
    queryset = SupplyCase.objects.select_related('card').all()
    serializer_class = SupplyCaseSerializer
    permission_classes = [IsAuthenticated]
    kanban_write_role = 'supply_operator'


class InvoiceRefViewSet(KanbanRolePermissionMixin, viewsets.ModelViewSet):
    queryset = InvoiceRef.objects.select_related('supply_case').all()
    serializer_class = InvoiceRefSerializer
    permission_classes = [IsAuthenticated]
    kanban_write_role = 'supply_operator'


class DeliveryBatchViewSet(KanbanRolePermissionMixin, viewsets.ModelViewSet):
    queryset = DeliveryBatch.objects.select_related('supply_case', 'invoice_ref').all()
    serializer_class = DeliveryBatchSerializer
    permission_classes = [IsAuthenticated]
    kanban_write_role = 'supply_operator'
