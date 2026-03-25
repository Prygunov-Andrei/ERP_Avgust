import logging

from rest_framework import viewsets, filters, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from .models import TaxSystem, LegalEntity, Account, AccountBalance, Counterparty
from .serializers import (
    TaxSystemSerializer, LegalEntitySerializer, AccountSerializer,
    AccountBalanceSerializer, CounterpartySerializer
)
from .services import find_duplicate_groups, merge_counterparties

logger = logging.getLogger('accounting')

class TaxSystemViewSet(viewsets.ReadOnlyModelViewSet):
    """Справочник налоговых систем"""
    queryset = TaxSystem.objects.filter(is_active=True)
    serializer_class = TaxSystemSerializer
    pagination_class = None

class LegalEntityViewSet(viewsets.ModelViewSet):
    """Управление нашими юридическими лицами"""
    queryset = LegalEntity.objects.select_related('tax_system').all()
    serializer_class = LegalEntitySerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, DjangoFilterBackend]
    search_fields = ['name', 'short_name', 'inn']
    filterset_fields = ['is_active', 'tax_system']

class AccountViewSet(viewsets.ModelViewSet):
    """Управление счетами компании"""
    queryset = Account.objects.select_related('legal_entity', 'bank_account').all()
    serializer_class = AccountSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, DjangoFilterBackend]
    search_fields = ['name', 'number', 'bank_name']
    filterset_fields = ['legal_entity', 'account_type', 'currency', 'is_active']

    @action(detail=True, methods=['get'])
    def balance(self, request, pk=None):
        """Получить текущий баланс счета"""
        account = self.get_object()
        current_balance = account.get_current_balance()
        return Response({'balance': current_balance, 'currency': account.currency})

    @action(detail=True, methods=['get'], url_path='balances')
    def balances(self, request, pk=None):
        """
        История остатков (snapshots) по счету.

        Query params:
          - source: internal | bank_tochka | all (по умолчанию internal)
        """
        account = self.get_object()
        source = (request.query_params.get('source') or 'internal').strip()

        qs = AccountBalance.objects.filter(account=account)
        if source and source != 'all':
            qs = qs.filter(source=source)

        qs = qs.order_by('-balance_date', '-id')
        serializer = AccountBalanceSerializer(qs, many=True)
        return Response(serializer.data)

class AccountBalanceViewSet(viewsets.ModelViewSet):
    """Управление историческими остатками"""
    queryset = AccountBalance.objects.select_related('account').all()
    serializer_class = AccountBalanceSerializer
    filter_backends = [filters.OrderingFilter, DjangoFilterBackend]
    filterset_fields = ['account', 'balance_date']
    ordering_fields = ['balance_date']
    ordering = ['-balance_date']

class CounterpartyViewSet(viewsets.ModelViewSet):
    """Управление контрагентами"""
    queryset = Counterparty.objects.all()
    serializer_class = CounterpartySerializer
    pagination_class = None
    filter_backends = [filters.SearchFilter, DjangoFilterBackend]
    search_fields = ['name', 'short_name', 'inn']
    filterset_fields = ['type', 'legal_form', 'is_active']

    def get_permissions(self):
        # Чтение контрагентов доступно любому авторизованному пользователю
        # (нужно при заполнении счётов, смет и т.д.)
        # Запись требует отдельного права settings.counterparties (через ERPSectionPermission)
        if self.request.method in ('GET', 'HEAD', 'OPTIONS'):
            return [permissions.IsAuthenticated()]
        return super().get_permissions()

    @action(detail=False, methods=['get'], url_path='duplicates')
    def duplicates(self, request):
        """
        Поиск групп дубликатов контрагентов по похожим названиям.
        Query params:
            min_similarity: float (0..1, default 0.85)
        """
        min_sim = float(request.query_params.get('min_similarity', '0.85'))
        groups = find_duplicate_groups(min_similarity=min_sim)
        return Response({'groups': groups, 'total_groups': len(groups)})

    @action(detail=False, methods=['post'], url_path='merge')
    def merge(self, request):
        """
        Слияние контрагентов-дубликатов.
        Body: { "keep_id": int, "remove_ids": [int, ...] }
        """
        keep_id = request.data.get('keep_id')
        remove_ids = request.data.get('remove_ids', [])

        if not keep_id or not remove_ids:
            return Response(
                {'error': 'Укажите keep_id и remove_ids'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if keep_id in remove_ids:
            return Response(
                {'error': 'keep_id не может быть в списке remove_ids'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            result = merge_counterparties(keep_id, remove_ids)
        except Counterparty.DoesNotExist:
            return Response(
                {'error': f'Контрагент с id={keep_id} не найден'},
                status=status.HTTP_404_NOT_FOUND,
            )
        except Exception as e:
            logger.exception('Ошибка слияния контрагентов')
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(result)

    @action(detail=False, methods=['post'], url_path='validate-inns')
    def validate_inns(self, request):
        """
        Пакетная проверка ИНН через ФНС (multinfo).
        Body: { "inns": ["1234567890", ...] }
        Возвращает для каждого ИНН: найден в ФНС или нет, название из ФНС.
        """
        inns = request.data.get('inns', [])
        if not inns:
            return Response({'error': 'Укажите inns'}, status=status.HTTP_400_BAD_REQUEST)

        from fns.services import FNSClient, FNSClientError
        client = FNSClient()

        results = {}
        # multinfo поддерживает до 100 ИНН
        for i in range(0, len(inns), 100):
            batch = inns[i:i + 100]
            try:
                raw = client.get_multinfo(batch)
                items = raw.get('items', [])

                if isinstance(items, list):
                    for item in items:
                        # Формат: {"ЮЛ": {"ИНН": ..., ...}} или {"ИП": {"ИНН": ..., ...}}
                        entity = item.get('ЮЛ') or item.get('ИП') or item
                        if not isinstance(entity, dict):
                            continue
                        inn = entity.get('ИНН', '')
                        if not inn:
                            continue
                        # Название
                        name = entity.get('НаимЮЛСокр', '') or entity.get('НаимЮЛПолworst', '') or entity.get('ФИО', '') or ''
                        found_status = entity.get('Статус', '')
                        results[inn] = {
                            'found': True,
                            'fns_name': name,
                            'status': found_status,
                        }
            except FNSClientError as e:
                for inn in batch:
                    results[inn] = {'found': False, 'error': str(e)}

        # ИНН, которых не было в ответе — не найдены в ФНС
        for inn in inns:
            if inn not in results:
                results[inn] = {'found': False, 'fns_name': '', 'status': ''}

        return Response({'results': results})

class AnalyticsViewSet(viewsets.ViewSet):
    """Аналитические отчеты"""
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['get'])
    def cashflow(self, request):
        """Cashflow по месяцам."""
        from .services.analytics_service import AnalyticsService
        return Response(AnalyticsService.get_cashflow())

    @action(detail=False, methods=['get'])
    def debt_summary(self, request):
        """Сводка задолженностей по контрактам."""
        from .services.analytics_service import AnalyticsService
        return Response(AnalyticsService.get_debt_summary())
