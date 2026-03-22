import logging
from decimal import Decimal

from rest_framework import viewsets, filters, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Count
import django_filters
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema

from payments.models import Invoice, InvoiceItem, InvoiceEvent
from payments.serializers import (
    InvoiceListSerializer,
    InvoiceDetailSerializer,
    InvoiceCreateSerializer,
    InvoiceActionSerializer,
    InvoiceItemSerializer,
    InvoiceItemWriteSerializer,
)
from payments.services import InvoiceService, get_invoice_dashboard
from payments.journal_service import JournalService

logger = logging.getLogger(__name__)


class InvoiceFilter(django_filters.FilterSet):
    status__in = django_filters.BaseInFilter(
        field_name='status', lookup_expr='in',
    )
    estimate__isnull = django_filters.BooleanFilter(
        field_name='estimate', lookup_expr='isnull',
    )
    estimate = django_filters.NumberFilter(field_name='estimate')

    class Meta:
        model = Invoice
        fields = [
            'status', 'source', 'invoice_type', 'is_debt',
            'object', 'counterparty', 'category', 'account',
            'estimate',
        ]


class InvoiceViewSet(viewsets.ModelViewSet):
    """
    CRUD для счетов на оплату (Invoice).

    Включает actions для workflow:
    - submit_to_registry: оператор подтвердил
    - approve: директор одобрил
    - reject: директор отклонил
    - reschedule: директор перенёс дату
    - dashboard: сводная аналитика
    - check_balance: проверка сальдо объекта
    """
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = InvoiceFilter
    search_fields = ['invoice_number', 'counterparty__name', 'description']
    ordering_fields = ['created_at', 'due_date', 'amount_gross', 'invoice_date']
    ordering = ['-created_at']

    def get_queryset(self):
        qs = (
            Invoice.objects
            .select_related(
                'counterparty', 'object', 'contract', 'act',
                'estimate',
                'category', 'target_internal_account',
                'account', 'legal_entity', 'supply_request',
                'recurring_payment', 'bank_payment_order',
                'created_by', 'reviewed_by', 'approved_by',
                'parsed_document',
            )
            .prefetch_related('items', 'items__product', 'events')
            .order_by('-created_at')
        )
        if self.action == 'list':
            qs = qs.annotate(items_count=Count('items'))
        return qs

    def get_serializer_class(self):
        if self.action == 'list':
            return InvoiceListSerializer
        if self.action == 'create':
            return InvoiceCreateSerializer
        return InvoiceDetailSerializer

    def perform_create(self, serializer):
        """Создание счёта вручную."""
        invoice = InvoiceService.create_manual(
            validated_data=serializer.validated_data,
            user=self.request.user,
        )
        if invoice.invoice_file and not invoice.skip_recognition:
            from supply.tasks import recognize_invoice
            recognize_invoice.delay(invoice.id, auto_counterparty=True)
        serializer.instance = invoice

    def perform_destroy(self, instance):
        """Удаление только в начальных/отменённых статусах."""
        deletable = {
            Invoice.Status.RECOGNITION, Invoice.Status.REVIEW,
            Invoice.Status.VERIFIED, Invoice.Status.CANCELLED,
        }
        if instance.status not in deletable:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied(
                f'Нельзя удалить счёт в статусе «{instance.get_status_display()}». '
                'Удаление возможно только для статусов: Распознавание, На проверке, Проверен, Отменён.'
            )
        instance.delete()

    @extend_schema(summary='Проверка сальдо объекта', tags=['Счета на оплату'])
    @action(detail=False, methods=['get'])
    def check_balance(self, request):
        """Проверить баланс объекта перед оплатой."""
        object_id = request.query_params.get('object_id')
        amount = request.query_params.get('amount', '0')
        if not object_id:
            return Response(
                {'error': 'Укажите object_id'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        from objects.models import Object as Obj
        try:
            obj = Obj.objects.get(pk=object_id)
        except Obj.DoesNotExist:
            return Response(
                {'error': 'Объект не найден'},
                status=status.HTTP_404_NOT_FOUND,
            )
        result = JournalService.check_object_balance(obj, Decimal(amount))
        result['balance'] = str(result['balance'])
        result['deficit'] = str(result['deficit'])
        return Response(result)

    @action(detail=True, methods=['post'])
    def verify(self, request, pk=None):
        """Оператор подтвердил данные: REVIEW -> VERIFIED."""
        try:
            InvoiceService.verify(int(pk), request.user)
            invoice = self.get_object()
            return Response(InvoiceDetailSerializer(invoice).data)
        except ValueError as exc:
            return Response(
                {'error': str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=True, methods=['post'])
    def submit_to_registry(self, request, pk=None):
        """Оператор отправил в реестр: VERIFIED -> IN_REGISTRY."""
        try:
            InvoiceService.submit_to_registry(int(pk), request.user)
            invoice = self.get_object()
            return Response(InvoiceDetailSerializer(invoice).data)
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Директор одобрил: IN_REGISTRY -> APPROVED."""
        serializer = InvoiceActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            InvoiceService.approve(
                int(pk), request.user,
                comment=serializer.validated_data.get('comment', ''),
            )
            invoice = self.get_object()
            return Response(InvoiceDetailSerializer(invoice).data)
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Директор отклонил: IN_REGISTRY -> CANCELLED."""
        serializer = InvoiceActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        comment = serializer.validated_data.get('comment', '')
        if not comment:
            return Response(
                {'error': 'Необходимо указать причину отклонения'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            InvoiceService.reject(int(pk), request.user, comment=comment)
            invoice = self.get_object()
            return Response(InvoiceDetailSerializer(invoice).data)
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def reschedule(self, request, pk=None):
        """Директор перенёс дату."""
        serializer = InvoiceActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_date = serializer.validated_data.get('new_date')
        comment = serializer.validated_data.get('comment', '')
        if not new_date:
            return Response(
                {'error': 'Необходимо указать новую дату'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not comment:
            return Response(
                {'error': 'Необходимо указать причину переноса'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            InvoiceService.reschedule(int(pk), request.user, new_date, comment)
            invoice = self.get_object()
            return Response(InvoiceDetailSerializer(invoice).data)
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    @extend_schema(summary='Оплата наличными', tags=['Счета'])
    @action(detail=True, methods=['post'], url_path='mark-cash-paid')
    def mark_cash_paid(self, request, pk=None):
        """Наличная оплата: APPROVED -> PAID (для cash-счетов)."""
        try:
            InvoiceService.mark_cash_paid(int(pk), request.user)
            invoice = self.get_object()
            return Response(InvoiceDetailSerializer(invoice).data)
        except ValueError as exc:
            return Response(
                {'error': str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    # =================================================================
    # Массовый импорт
    # =================================================================

    @extend_schema(
        summary='Массовая загрузка счетов',
        tags=['Счета на оплату'],
    )
    @action(detail=False, methods=['post'], url_path='bulk-upload')
    def bulk_upload(self, request):
        """
        Массовая загрузка счетов.

        Принимает множественные файлы, создаёт BulkImportSession,
        для каждого файла создаёт Invoice(RECOGNITION) и ставит
        Celery task.
        """
        files = request.FILES.getlist('files')
        if not files:
            return Response(
                {'error': 'Нет файлов'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Поддержка привязки к смете (для сметчика)
        estimate_id = request.data.get('estimate_id')
        estimate = None
        if estimate_id:
            from estimates.models import Estimate
            try:
                estimate = Estimate.objects.get(pk=estimate_id)
            except Estimate.DoesNotExist:
                return Response(
                    {'error': 'Смета не найдена'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        session, accepted = InvoiceService.bulk_upload(
            files=files, user=request.user, estimate=estimate,
        )

        return Response(
            {
                'session_id': session.id,
                'total_files': accepted,
                'status': session.status,
            },
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(
        summary='Статус сессии массового импорта',
        tags=['Счета на оплату'],
    )
    @action(
        detail=False, methods=['get'],
        url_path=r'bulk-sessions/(?P<session_id>[0-9]+)',
    )
    def bulk_session_status(self, request, session_id=None):
        """Статус сессии массового импорта (поллинг)."""
        from payments.models import BulkImportSession

        try:
            session = BulkImportSession.objects.get(
                id=session_id,
            )
        except BulkImportSession.DoesNotExist:
            return Response(
                {'error': 'Сессия не найдена'},
                status=status.HTTP_404_NOT_FOUND,
            )

        invoices = list(
            session.invoices.values(
                'id', 'status', 'invoice_number',
                'amount_gross', 'description',
            )
        )

        return Response({
            'id': session.id,
            'status': session.status,
            'total_files': session.total_files,
            'processed_files': session.processed_files,
            'successful': session.successful,
            'failed': session.failed,
            'skipped_duplicate': session.skipped_duplicate,
            'errors': session.errors,
            'invoices': invoices,
        })

    @action(detail=False, methods=['get'])
    def dashboard(self, request):
        """Сводная аналитика для директора."""
        data = get_invoice_dashboard()
        return Response(data)


class InvoiceItemViewSet(viewsets.ModelViewSet):
    """CRUD для позиций счёта. Редактирование только в статусе REVIEW."""

    permission_classes = [permissions.IsAuthenticated]
    queryset = InvoiceItem.objects.select_related('invoice', 'product').order_by('id')
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['invoice']

    def get_serializer_class(self):
        if self.action in ('list', 'retrieve'):
            return InvoiceItemSerializer
        return InvoiceItemWriteSerializer

    def _check_review_status(self, invoice):
        from rest_framework.exceptions import PermissionDenied
        if invoice.status != Invoice.Status.REVIEW:
            raise PermissionDenied(
                'Позиции можно редактировать только в статусе «На проверке»'
            )

    def perform_update(self, serializer):
        self._check_review_status(serializer.instance.invoice)
        serializer.save()

    def perform_destroy(self, instance):
        self._check_review_status(instance.invoice)
        instance.delete()
