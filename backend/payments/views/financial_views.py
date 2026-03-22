from decimal import Decimal

from rest_framework import viewsets, filters, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema, extend_schema_view

from payments.models import (
    RecurringPayment, IncomeRecord, JournalEntry, ExpenseCategory,
)
from payments.serializers import (
    RecurringPaymentSerializer,
    IncomeRecordSerializer,
    JournalEntrySerializer,
)
from payments.journal_service import JournalService


class RecurringPaymentViewSet(viewsets.ModelViewSet):
    """CRUD для периодических платежей."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = RecurringPaymentSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active', 'frequency', 'counterparty']
    search_fields = ['name', 'counterparty__name', 'description']
    ordering = ['name']

    def get_queryset(self):
        return RecurringPayment.objects.select_related(
            'counterparty', 'category', 'account', 'contract',
            'object', 'legal_entity',
        )


class IncomeRecordViewSet(viewsets.ModelViewSet):
    """CRUD для поступлений (доходы)."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = IncomeRecordSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['account', 'category', 'counterparty', 'income_type', 'object', 'is_cash']
    search_fields = ['description', 'counterparty__name']
    ordering = ['-payment_date', '-created_at']

    def get_queryset(self):
        return IncomeRecord.objects.select_related(
            'account', 'object', 'contract', 'act',
            'category', 'legal_entity', 'counterparty',
            'bank_transaction',
        )


@extend_schema_view(
    list=extend_schema(summary='Список проводок', tags=['Проводки']),
    retrieve=extend_schema(summary='Детали проводки', tags=['Проводки']),
    create=extend_schema(summary='Создать проводку', tags=['Проводки']),
)
class JournalEntryViewSet(viewsets.ModelViewSet):
    """CRUD для проводок (двойная запись)."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = JournalEntrySerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['from_account', 'to_account', 'is_auto', 'invoice', 'income_record']
    search_fields = ['description']
    ordering_fields = ['date', 'amount', 'created_at']
    ordering = ['-date', '-created_at']

    def get_queryset(self):
        return JournalEntry.objects.select_related(
            'from_account', 'to_account',
            'invoice', 'income_record',
            'created_by',
        )

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @extend_schema(summary='Создать ручную проводку', tags=['Проводки'])
    @action(detail=False, methods=['post'])
    def manual(self, request):
        """Создать ручную проводку между счетами Внутреннего плана."""
        from_account_id = request.data.get('from_account')
        to_account_id = request.data.get('to_account')
        amount = request.data.get('amount')
        description = request.data.get('description', '')
        posting_date = request.data.get('date')

        if not all([from_account_id, to_account_id, amount]):
            return Response(
                {'error': 'Укажите from_account, to_account и amount'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            from_acc = ExpenseCategory.objects.get(pk=from_account_id)
            to_acc = ExpenseCategory.objects.get(pk=to_account_id)
        except ExpenseCategory.DoesNotExist:
            return Response(
                {'error': 'Счёт не найден'},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            from datetime import date as date_cls
            p_date = None
            if posting_date:
                p_date = date_cls.fromisoformat(posting_date)

            entry = JournalService.create_manual_posting(
                from_account=from_acc,
                to_account=to_acc,
                amount=Decimal(str(amount)),
                description=description,
                user=request.user,
                posting_date=p_date,
            )
            return Response(
                JournalEntrySerializer(entry).data,
                status=status.HTTP_201_CREATED,
            )
        except ValueError as exc:
            return Response(
                {'error': str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )
