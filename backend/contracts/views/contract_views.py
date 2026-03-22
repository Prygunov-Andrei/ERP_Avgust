from decimal import Decimal
from rest_framework import viewsets, filters, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema, extend_schema_view
from core.mixins import CashFlowMixin
from contracts.models import (
    Contract, ContractAmendment, WorkScheduleItem,
    ContractEstimate, ContractText,
)
from contracts.serializers import (
    ContractSerializer, ContractListSerializer,
    ContractAmendmentSerializer, WorkScheduleItemSerializer,
    ContractTextSerializer,
)
from communications.models import Correspondence
from communications.serializers import CorrespondenceSerializer


@extend_schema_view(
    list=extend_schema(tags=['Договоры']),
    retrieve=extend_schema(tags=['Договоры']),
    create=extend_schema(tags=['Договоры']),
    update=extend_schema(tags=['Договоры']),
    partial_update=extend_schema(tags=['Договоры']),
    destroy=extend_schema(tags=['Договоры']),
    cash_flow=extend_schema(tags=['Договоры']),
    cash_flow_periods=extend_schema(tags=['Договоры']),
    correspondence=extend_schema(tags=['Договоры']),
    schedule=extend_schema(tags=['Договоры']),
    amendments=extend_schema(tags=['Договоры']),
)
class ContractViewSet(CashFlowMixin, viewsets.ModelViewSet):
    """ViewSet для управления договорами"""
    queryset = Contract.objects.select_related('object', 'counterparty', 'legal_entity', 'technical_proposal', 'mounting_proposal').all()
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['object', 'status', 'currency', 'contract_type', 'legal_entity', 'counterparty', 'framework_contract', 'responsible_manager', 'responsible_engineer']
    search_fields = ['number', 'name', 'counterparty__name', 'object__name']
    ordering_fields = ['contract_date', 'total_amount', 'created_at']
    ordering = ['-contract_date', '-created_at']

    def get_serializer_class(self):
        if self.action == 'list':
            return ContractListSerializer
        return ContractSerializer

    def get_cash_flow_params(self):
        contract = self.get_object()
        return {
            'entity_id': contract.id,
            'entity_name': f"{contract.number} — {contract.name}",
            'entity_id_key': 'contract_id',
            'entity_name_key': 'contract_name',
        }

    @action(detail=True, methods=['get'], url_path='accumulative-estimate')
    def accumulative_estimate(self, request, pk=None):
        """Накопительная смета по договору"""
        contract = self.get_object()
        ce = ContractEstimate.objects.filter(
            contract=contract,
            status__in=[ContractEstimate.Status.AGREED, ContractEstimate.Status.SIGNED],
        ).order_by('-version_number').first()
        if not ce:
            return Response({'error': 'Нет подписанной сметы'}, status=status.HTTP_404_NOT_FOUND)
        from contracts.services.accumulative_estimate import AccumulativeEstimateService
        data = AccumulativeEstimateService.get_accumulative(ce.id)
        return Response(data)

    @action(detail=True, methods=['get'], url_path='estimate-remainder')
    def estimate_remainder(self, request, pk=None):
        """Остатки по смете (смета минус закуплено)"""
        contract = self.get_object()
        ce = ContractEstimate.objects.filter(
            contract=contract,
            status__in=[ContractEstimate.Status.AGREED, ContractEstimate.Status.SIGNED],
        ).order_by('-version_number').first()
        if not ce:
            return Response({'error': 'Нет подписанной сметы'}, status=status.HTTP_404_NOT_FOUND)
        from contracts.services.accumulative_estimate import AccumulativeEstimateService
        data = AccumulativeEstimateService.get_remainder(ce.id)
        return Response(data)

    @action(detail=True, methods=['get'], url_path='estimate-deviations')
    def estimate_deviations(self, request, pk=None):
        """Отклонения от сметы (аналоги, допработы, превышения)"""
        contract = self.get_object()
        ce = ContractEstimate.objects.filter(
            contract=contract,
            status__in=[ContractEstimate.Status.AGREED, ContractEstimate.Status.SIGNED],
        ).order_by('-version_number').first()
        if not ce:
            return Response({'error': 'Нет подписанной сметы'}, status=status.HTTP_404_NOT_FOUND)
        from contracts.services.accumulative_estimate import AccumulativeEstimateService
        data = AccumulativeEstimateService.get_deviations(ce.id)
        return Response(data)

    @action(detail=True, methods=['get'], url_path='accumulative-estimate/export')
    def accumulative_estimate_export(self, request, pk=None):
        """Экспорт накопительной сметы в Excel"""
        contract = self.get_object()
        ce = ContractEstimate.objects.filter(
            contract=contract,
            status__in=[ContractEstimate.Status.AGREED, ContractEstimate.Status.SIGNED],
        ).order_by('-version_number').first()
        if not ce:
            return Response({'error': 'Нет подписанной сметы'}, status=status.HTTP_404_NOT_FOUND)
        from contracts.services.accumulative_estimate import AccumulativeEstimateService
        return AccumulativeEstimateService.export_to_excel(ce.id)

    @extend_schema(summary='Получить текущий баланс договора')
    @action(detail=True, methods=['get'])
    def balance(self, request, pk=None):
        """Возвращает сальдо расчетов по договору (Акты - Платежи)"""
        contract = self.get_object()
        balance = contract.get_balance()
        return Response({'balance': balance, 'currency': contract.currency})

    @extend_schema(summary='Маржа договора', tags=['Договоры'])
    @action(detail=True, methods=['get'])
    def margin(self, request, pk=None):
        """Возвращает маржу для доходного договора."""
        contract = self.get_object()
        if contract.contract_type != 'income':
            return Response(
                {'error': 'Маржа доступна только для доходных договоров'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        margin = contract.get_margin()
        total = contract.total_amount or Decimal('0')
        margin_percent = (
            (margin / total * 100) if total else Decimal('0')
        )
        return Response({
            'margin': str(margin),
            'margin_percent': str(margin_percent),
        })

    @extend_schema(summary='Скачать график работ (PDF)')
    @action(detail=True, methods=['get'], url_path='schedule/export_pdf')
    def export_schedule_pdf(self, request, pk=None):
        """
        Генерация PDF с графиком работ.

        Статус: Не реализовано. Планируется использование reportlab.
        """
        return Response(
            {'detail': 'Экспорт PDF графика работ пока не реализован'},
            status=status.HTTP_501_NOT_IMPLEMENTED
        )

    @extend_schema(
        summary='Переписка по договору',
        description='Получить список переписки, связанной с договором',
        tags=['Договоры'],
    )
    @action(detail=True, methods=['get'], url_path='correspondence')
    def correspondence(self, request, pk=None):
        """Возвращает список переписки по договору"""
        contract = self.get_object()
        correspondence = Correspondence.objects.filter(contract=contract).order_by('-date', '-created_at')
        serializer = CorrespondenceSerializer(correspondence, many=True)
        return Response(serializer.data)

    @extend_schema(
        summary='График работ по договору',
        description='Получить график работ (WorkScheduleItem) для договора',
        tags=['Договоры'],
    )
    @action(detail=True, methods=['get'], url_path='schedule')
    def schedule(self, request, pk=None):
        """Возвращает график работ по договору"""
        contract = self.get_object()
        schedule_items = WorkScheduleItem.objects.filter(contract=contract).order_by('start_date')
        serializer = WorkScheduleItemSerializer(schedule_items, many=True)
        return Response(serializer.data)

    @extend_schema(
        summary='Создать доп. соглашение',
        description='Создать дополнительное соглашение к договору',
        tags=['Договоры'],
        request=ContractAmendmentSerializer,
    )
    @action(detail=True, methods=['post'], url_path='amendments')
    def amendments(self, request, pk=None):
        """Создать дополнительное соглашение к договору"""
        contract = self.get_object()
        serializer = ContractAmendmentSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(contract=contract)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ContractAmendmentViewSet(viewsets.ModelViewSet):
    """ViewSet для Дополнительных соглашений"""
    queryset = ContractAmendment.objects.select_related('contract').all()
    serializer_class = ContractAmendmentSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['contract']


class WorkScheduleItemViewSet(viewsets.ModelViewSet):
    """ViewSet для Графика работ"""
    queryset = WorkScheduleItem.objects.select_related('contract').all()
    serializer_class = WorkScheduleItemSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['contract', 'status']


class ContractTextViewSet(viewsets.ModelViewSet):
    """ViewSet для текстов договоров (md)"""
    queryset = ContractText.objects.select_related(
        'contract', 'amendment', 'created_by',
    )
    serializer_class = ContractTextSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['contract', 'amendment']
    search_fields = ['content_md']

    def perform_create(self, serializer):
        contract = serializer.validated_data['contract']
        amendment = serializer.validated_data.get('amendment')
        last_version = ContractText.objects.filter(
            contract=contract, amendment=amendment,
        ).order_by('-version').first()
        next_version = (last_version.version + 1) if last_version else 1
        serializer.save(
            created_by=self.request.user,
            version=next_version,
        )
