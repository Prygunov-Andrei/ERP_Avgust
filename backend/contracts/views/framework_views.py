from rest_framework import viewsets, filters, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema, extend_schema_view

from contracts.models import FrameworkContract
from contracts.serializers import (
    FrameworkContractSerializer, FrameworkContractListSerializer,
    ContractListSerializer,
)


@extend_schema_view(
    list=extend_schema(tags=['Рамочные договоры']),
    retrieve=extend_schema(tags=['Рамочные договоры']),
    create=extend_schema(tags=['Рамочные договоры']),
    update=extend_schema(tags=['Рамочные договоры']),
    partial_update=extend_schema(tags=['Рамочные договоры']),
    destroy=extend_schema(tags=['Рамочные договоры']),
)
class FrameworkContractViewSet(viewsets.ModelViewSet):
    """ViewSet для управления рамочными договорами"""
    queryset = FrameworkContract.objects.select_related('legal_entity', 'counterparty', 'created_by').prefetch_related('price_lists').all()
    serializer_class = FrameworkContractSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['counterparty', 'legal_entity', 'status']
    search_fields = ['number', 'name']
    ordering_fields = ['date', 'valid_from', 'valid_until', 'created_at']
    ordering = ['-date', '-created_at']

    def get_queryset(self):
        """Добавляем annotate для list view"""
        from django.db.models import Count
        queryset = super().get_queryset()
        if self.action == 'list':
            queryset = queryset.annotate(contracts_count=Count('contracts'))
        return queryset

    def get_serializer_class(self):
        if self.action == 'list':
            return FrameworkContractListSerializer
        return FrameworkContractSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @extend_schema(summary='Получить список договоров под рамочный')
    @action(detail=True, methods=['get'])
    def contracts(self, request, pk=None):
        """Список договоров под этот рамочный"""
        framework = self.get_object()
        contracts = framework.contracts.all()
        serializer = ContractListSerializer(contracts, many=True)
        return Response(serializer.data)

    @extend_schema(summary='Добавить прайс-листы к рамочному договору')
    @action(detail=True, methods=['post'])
    def add_price_lists(self, request, pk=None):
        """Добавить прайс-листы"""
        framework = self.get_object()
        price_list_ids = request.data.get('price_list_ids', [])
        if price_list_ids:
            framework.price_lists.add(*price_list_ids)
        return Response({'status': 'success'})

    @extend_schema(summary='Удалить прайс-листы из рамочного договора')
    @action(detail=True, methods=['post'])
    def remove_price_lists(self, request, pk=None):
        """Удалить прайс-листы"""
        framework = self.get_object()
        price_list_ids = request.data.get('price_list_ids', [])
        if price_list_ids:
            framework.price_lists.remove(*price_list_ids)
        return Response({'status': 'success'})

    @extend_schema(summary='Активировать рамочный договор')
    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """Перевести в статус Действующий"""
        from contracts.services.framework_contract_service import FrameworkContractService
        framework = self.get_object()
        FrameworkContractService.activate(framework)
        return Response({'status': 'activated'})

    @extend_schema(summary='Расторгнуть рамочный договор')
    @action(detail=True, methods=['post'])
    def terminate(self, request, pk=None):
        """Расторгнуть договор"""
        from contracts.services.framework_contract_service import FrameworkContractService
        framework = self.get_object()
        FrameworkContractService.terminate(framework)
        return Response({'status': 'terminated'})

    def destroy(self, request, *args, **kwargs):
        """Удаление только если нет связанных договоров"""
        framework = self.get_object()
        if framework.contracts.exists():
            return Response(
                {'error': 'Нельзя удалить рамочный договор с существующими договорами'},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().destroy(request, *args, **kwargs)
