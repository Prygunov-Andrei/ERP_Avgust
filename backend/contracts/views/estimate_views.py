from rest_framework import viewsets, filters, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema

from contracts.models import (
    Contract, ContractAmendment,
    ContractEstimate, ContractEstimateSection, ContractEstimateItem,
    EstimatePurchaseLink,
)
from contracts.serializers import (
    ContractEstimateSerializer, ContractEstimateListSerializer,
    ContractEstimateSectionSerializer, ContractEstimateItemSerializer,
    EstimatePurchaseLinkSerializer,
)


class ContractEstimateViewSet(viewsets.ModelViewSet):
    """ViewSet для смет к договорам"""
    queryset = ContractEstimate.objects.select_related(
        'contract', 'source_estimate', 'parent_version', 'amendment',
    ).prefetch_related('sections', 'items')
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['contract', 'status']
    search_fields = ['number', 'name']
    ordering = ['-version_number', '-created_at']

    def get_serializer_class(self):
        if self.action == 'list':
            return ContractEstimateListSerializer
        return ContractEstimateSerializer

    @action(detail=False, methods=['post'], url_path='from-estimate')
    def from_estimate(self, request):
        """Создать смету к договору из estimates.Estimate."""
        estimate_id = request.data.get('estimate_id')
        contract_id = request.data.get('contract_id')
        if not estimate_id or not contract_id:
            return Response(
                {'error': 'Укажите estimate_id и contract_id'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        from estimates.models import Estimate
        try:
            estimate = Estimate.objects.get(pk=estimate_id)
            contract = Contract.objects.get(pk=contract_id)
        except (Estimate.DoesNotExist, Contract.DoesNotExist):
            return Response(
                {'error': 'Смета или договор не найдены'},
                status=status.HTTP_404_NOT_FOUND,
            )
        ce = ContractEstimate.create_from_estimate(estimate, contract)
        return Response(
            ContractEstimateSerializer(ce).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'], url_path='create-version')
    def create_version(self, request, pk=None):
        """Создать новую версию сметы (при ДОП)."""
        ce = self.get_object()
        amendment_id = request.data.get('amendment_id')
        amendment = None
        if amendment_id:
            amendment = ContractAmendment.objects.filter(pk=amendment_id).first()
        new_ce = ce.create_new_version(amendment=amendment)
        return Response(
            ContractEstimateSerializer(new_ce).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'], url_path='split')
    def split(self, request, pk=None):
        """Разбить смету на несколько для разных Исполнителей."""
        ce = self.get_object()
        sections_mapping = request.data.get('sections_mapping', {})
        if not sections_mapping:
            return Response(
                {'error': 'Укажите sections_mapping: {contract_id: [section_id, ...]}'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            new_estimates = ce.split_by_sections(sections_mapping)
            return Response(
                ContractEstimateSerializer(new_estimates, many=True).data,
                status=status.HTTP_201_CREATED,
            )
        except Contract.DoesNotExist:
            return Response(
                {'error': 'Один из указанных договоров не найден'},
                status=status.HTTP_404_NOT_FOUND,
            )


class ContractEstimateSectionViewSet(viewsets.ModelViewSet):
    """ViewSet для разделов смет к договорам"""
    queryset = ContractEstimateSection.objects.select_related('contract_estimate').prefetch_related('items__product')
    serializer_class = ContractEstimateSectionSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['contract_estimate']


class ContractEstimateItemViewSet(viewsets.ModelViewSet):
    """ViewSet для строк смет к договорам"""
    queryset = ContractEstimateItem.objects.select_related(
        'contract_estimate', 'section', 'product', 'work_item', 'source_item',
    )
    serializer_class = ContractEstimateItemSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['contract_estimate', 'section', 'product', 'item_type', 'is_analog']
    search_fields = ['name', 'model_name']


class EstimatePurchaseLinkViewSet(viewsets.ModelViewSet):
    """ViewSet для сопоставлений закупок со сметами"""
    queryset = EstimatePurchaseLink.objects.select_related(
        'contract_estimate_item', 'invoice_item',
    )
    serializer_class = EstimatePurchaseLinkSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = [
        'contract_estimate_item', 'invoice_item',
        'match_type', 'price_exceeds', 'quantity_exceeds',
    ]

    @action(detail=False, methods=['post'], url_path='check-invoice')
    def check_invoice(self, request):
        """Проверить счёт на соответствие смете"""
        invoice_id = request.data.get('invoice_id')
        if not invoice_id:
            return Response(
                {'error': 'Укажите invoice_id'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        from payments.models import Invoice
        try:
            invoice = Invoice.objects.get(pk=invoice_id)
        except Invoice.DoesNotExist:
            return Response(
                {'error': 'Счёт не найден'},
                status=status.HTTP_404_NOT_FOUND,
            )
        from contracts.services.estimate_compliance_checker import EstimateComplianceChecker
        checker = EstimateComplianceChecker()
        result = checker.check_invoice(invoice)
        return Response(result)

    @action(detail=False, methods=['post'], url_path='auto-link')
    def auto_link(self, request):
        """Автоматически сопоставить позиции счёта со сметой"""
        invoice_id = request.data.get('invoice_id')
        if not invoice_id:
            return Response(
                {'error': 'Укажите invoice_id'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        from payments.models import Invoice
        try:
            invoice = Invoice.objects.get(pk=invoice_id)
        except Invoice.DoesNotExist:
            return Response(
                {'error': 'Счёт не найден'},
                status=status.HTTP_404_NOT_FOUND,
            )
        from contracts.services.estimate_compliance_checker import EstimateComplianceChecker
        checker = EstimateComplianceChecker()
        result = checker.auto_link_invoice(invoice)
        return Response(result, status=status.HTTP_201_CREATED)
