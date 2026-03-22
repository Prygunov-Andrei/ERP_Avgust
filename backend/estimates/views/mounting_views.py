from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone

from estimates.models import (
    Estimate, MountingEstimate, ColumnConfigTemplate,
)
from estimates.serializers import (
    MountingEstimateSerializer, MountingEstimateCreateFromEstimateSerializer,
    ColumnConfigTemplateSerializer,
)


class MountingEstimateViewSet(viewsets.ModelViewSet):
    """ViewSet для монтажных смет"""

    queryset = MountingEstimate.objects.select_related(
        'object', 'source_estimate', 'agreed_counterparty',
        'created_by', 'parent_version'
    )
    serializer_class = MountingEstimateSerializer

    def perform_create(self, serializer):
        """Автоматически устанавливаем created_by из текущего пользователя"""
        serializer.save(created_by=self.request.user)
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = [
        'object', 'source_estimate', 'status', 'agreed_counterparty'
    ]
    search_fields = ['number', 'name']

    @action(detail=False, methods=['post'], url_path='from-estimate')
    def from_estimate(self, request):
        """Создать монтажную смету из обычной сметы"""
        serializer = MountingEstimateCreateFromEstimateSerializer(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        mounting_estimate = serializer.save()
        return Response(
            MountingEstimateSerializer(mounting_estimate).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=['post'], url_path='create-version')
    def create_version(self, request, pk=None):
        """Создать новую версию монтажной сметы"""
        mounting_estimate = self.get_object()
        new_version = mounting_estimate.create_new_version()
        serializer = MountingEstimateSerializer(new_version)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def agree(self, request, pk=None):
        """Согласовать с Исполнителем"""
        mounting_estimate = self.get_object()
        counterparty_id = request.data.get('counterparty_id')

        if not counterparty_id:
            return Response(
                {'error': 'Не указан ID контрагента'},
                status=status.HTTP_400_BAD_REQUEST
            )

        from accounting.models import Counterparty
        try:
            counterparty = Counterparty.objects.get(id=counterparty_id)
            if counterparty.type not in [Counterparty.Type.VENDOR, Counterparty.Type.BOTH]:
                return Response(
                    {'error': 'Контрагент должен быть типа "Исполнитель/Поставщик" или "Заказчик и Исполнитель"'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            mounting_estimate.agreed_counterparty = counterparty
            mounting_estimate.agreed_date = timezone.now().date()
            mounting_estimate.status = MountingEstimate.Status.APPROVED
            mounting_estimate.save()
            serializer = MountingEstimateSerializer(mounting_estimate)
            return Response(serializer.data)
        except Counterparty.DoesNotExist:
            return Response(
                {'error': 'Контрагент не найден'},
                status=status.HTTP_404_NOT_FOUND
            )


class ColumnConfigTemplateViewSet(viewsets.ModelViewSet):
    """ViewSet для шаблонов конфигурации столбцов."""

    queryset = ColumnConfigTemplate.objects.select_related('created_by')
    serializer_class = ColumnConfigTemplateSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'description']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'], url_path='apply')
    def apply_to_estimate(self, request, pk=None):
        """Применить шаблон к смете (копирует column_config)."""
        template = self.get_object()
        estimate_id = request.data.get('estimate_id')
        if not estimate_id:
            return Response(
                {'error': 'Не указан estimate_id'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            estimate = Estimate.objects.get(pk=estimate_id)
        except Estimate.DoesNotExist:
            return Response(
                {'error': 'Смета не найдена'},
                status=status.HTTP_404_NOT_FOUND,
            )
        estimate.column_config = template.column_config
        estimate.save(update_fields=['column_config'])
        return Response({'status': 'ok', 'estimate_id': estimate.id})
