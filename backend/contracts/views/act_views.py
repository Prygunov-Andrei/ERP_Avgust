from rest_framework import viewsets, filters, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema

from contracts.models import (
    Act, ActPaymentAllocation, ContractEstimate,
)
from contracts.serializers import (
    ActSerializer, ActPaymentAllocationSerializer,
    ActItemSerializer,
)


class ActViewSet(viewsets.ModelViewSet):
    """ViewSet для Актов выполненных работ"""
    queryset = Act.objects.select_related(
        'contract', 'contract_estimate',
    ).prefetch_related('payment_allocations', 'act_items')
    serializer_class = ActSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['contract', 'status', 'act_type']
    search_fields = ['number', 'description']

    def get_queryset(self):
        """Добавляем annotate для вычисления unpaid_amount на уровне БД"""
        from django.db.models import Sum
        from django.db.models.functions import Coalesce
        from decimal import Decimal

        return super().get_queryset().annotate(
            paid_amount=Coalesce(Sum('payment_allocations__amount'), Decimal('0'))
        )

    @extend_schema(summary='Подписать акт')
    @action(detail=True, methods=['post'])
    def sign(self, request, pk=None):
        """Перевод акта в статус 'Подписан'"""
        from contracts.services.act_service import ActService
        act = self.get_object()
        ActService.sign(act)
        return Response({'status': 'signed'})

    @action(detail=True, methods=['post'])
    def agree(self, request, pk=None):
        """Перевод акта в статус 'Согласован'"""
        from contracts.services.act_service import ActService
        act = self.get_object()
        ActService.agree(act)
        return Response({'status': 'agreed'})

    @action(detail=False, methods=['post'], url_path='from-accumulative')
    def from_accumulative(self, request):
        """Сформировать акт КС-2 из накопительной сметы"""
        contract_estimate_id = request.data.get('contract_estimate_id')
        items_data = request.data.get('items', [])
        act_kwargs = {
            'number': request.data.get('number', ''),
            'date': request.data.get('date'),
        }
        if request.data.get('period_start'):
            act_kwargs['period_start'] = request.data['period_start']
        if request.data.get('period_end'):
            act_kwargs['period_end'] = request.data['period_end']

        if not contract_estimate_id or not items_data:
            return Response(
                {'error': 'Укажите contract_estimate_id и items'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            ce = ContractEstimate.objects.get(pk=contract_estimate_id)
        except ContractEstimate.DoesNotExist:
            return Response(
                {'error': 'Смета к договору не найдена'},
                status=status.HTTP_404_NOT_FOUND,
            )

        act = Act.create_from_accumulative(ce, items_data, **act_kwargs)
        return Response(ActSerializer(act).data, status=status.HTTP_201_CREATED)


class ActPaymentAllocationViewSet(viewsets.ReadOnlyModelViewSet):
    """Просмотр распределений оплат по актам"""
    queryset = ActPaymentAllocation.objects.all()
    serializer_class = ActPaymentAllocationSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['act', 'payment']
