from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.http import HttpResponse

from core.version_mixin import VersioningMixin
from .models import (
    WorkerGrade, WorkSection, WorkerGradeSkills,
    WorkItem, PriceList, PriceListAgreement, PriceListItem
)
from .serializers import (
    WorkerGradeSerializer, WorkSectionSerializer, WorkerGradeSkillsSerializer,
    WorkItemSerializer, WorkItemListSerializer,
    PriceListSerializer, PriceListListSerializer, PriceListCreateSerializer,
    PriceListAgreementSerializer, PriceListItemSerializer,
    AddRemoveItemsSerializer
)
from .services import (
    add_items_to_pricelist,
    remove_items_from_pricelist,
    create_work_item_version,
    export_pricelist_to_excel,
)


class WorkerGradeViewSet(viewsets.ModelViewSet):
    """ViewSet для разрядов рабочих"""
    
    queryset = WorkerGrade.objects.prefetch_related('skills', 'skills__section')
    serializer_class = WorkerGradeSerializer
    http_method_names = ['get', 'post', 'patch', 'head', 'options']
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['is_active']


class WorkSectionViewSet(viewsets.ModelViewSet):
    """ViewSet для разделов работ"""
    
    queryset = WorkSection.objects.select_related('parent').prefetch_related('children')
    serializer_class = WorkSectionSerializer
    http_method_names = ['get', 'post', 'patch', 'head', 'options']
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['is_active', 'parent']
    search_fields = ['code', 'name']

    def get_queryset(self):
        queryset = super().get_queryset()
        # Если запрошен параметр tree=true, возвращаем только корневые разделы
        if self.request.query_params.get('tree') == 'true':
            queryset = queryset.filter(parent__isnull=True)
        return queryset
    
    @action(detail=False, methods=['get'])
    def tree(self, request):
        """
        Возвращает иерархическое дерево разделов работ.
        Оптимизировано: загружает всё дерево одним запросом.
        """
        from collections import defaultdict
        
        # Загружаем ВСЕ активные разделы ОДНИМ запросом
        all_sections = list(
            WorkSection.objects.filter(is_active=True)
            .order_by('sort_order', 'code', 'name')
            .values('id', 'code', 'name', 'parent_id')
        )
        
        # Строим дерево в памяти
        sections_by_parent = defaultdict(list)
        for section in all_sections:
            sections_by_parent[section['parent_id']].append(section)
        
        def build_tree(parent_id):
            result = []
            for section in sections_by_parent.get(parent_id, []):
                result.append({
                    'id': section['id'],
                    'code': section['code'],
                    'name': section['name'],
                    'children': build_tree(section['id'])
                })
            return result
        
        return Response(build_tree(None))


class WorkerGradeSkillsViewSet(viewsets.ModelViewSet):
    """ViewSet для навыков разрядов"""
    
    queryset = WorkerGradeSkills.objects.select_related('grade', 'section')
    serializer_class = WorkerGradeSkillsSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['grade', 'section']


class WorkItemViewSet(VersioningMixin, viewsets.ModelViewSet):
    """ViewSet для работ (с поддержкой версионирования через VersioningMixin)"""

    queryset = WorkItem.objects.select_related('section', 'grade', 'parent_version')
    pagination_class = None
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['section', 'grade', 'is_current']
    search_fields = ['article', 'name']
    version_list_serializer_class = WorkItemListSerializer

    def get_serializer_class(self):
        if self.action == 'list':
            return WorkItemListSerializer
        return WorkItemSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        # По умолчанию показываем только актуальные версии
        if 'is_current' not in self.request.query_params:
            queryset = queryset.filter(is_current=True)
        return queryset

    def partial_update(self, request, *args, **kwargs):
        """При обновлении создаём новую версию работы"""
        instance = self.get_object()

        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        new_version = create_work_item_version(instance, serializer.validated_data)
        return Response(WorkItemSerializer(new_version).data)
    
    # Метод versions() наследуется от VersioningMixin


class PriceListViewSet(viewsets.ModelViewSet):
    """ViewSet для прайс-листов"""
    
    queryset = PriceList.objects.prefetch_related(
        'items',
        'items__work_item',
        'items__work_item__section',
        'items__work_item__grade',
        'agreements',
        'agreements__counterparty'
    ).select_related('parent_version')
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['status']
    search_fields = ['number', 'name']

    def get_serializer_class(self):
        if self.action == 'list':
            return PriceListListSerializer
        if self.action == 'create':
            return PriceListCreateSerializer
        return PriceListSerializer

    def get_queryset(self):
        from django.db.models import Count, Q, Sum
        from django.db.models.functions import Coalesce
        from decimal import Decimal
        
        queryset = super().get_queryset()
        
        # Фильтрация по дате
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        
        if date_from:
            queryset = queryset.filter(date__gte=date_from)
        if date_to:
            queryset = queryset.filter(date__lte=date_to)
        
        # Добавляем annotate для list и retrieve view (оптимизация N+1)
        if self.action in ['list', 'retrieve']:
            queryset = queryset.annotate(
                annotated_items_count=Count('items', filter=Q(items__is_included=True)),
                annotated_agreements_count=Count('agreements')
            )
        
        return queryset

    @action(detail=True, methods=['post'], url_path='create-version')
    def create_version(self, request, pk=None):
        """Создать новую версию прайс-листа"""
        price_list = self.get_object()
        new_version = price_list.create_new_version()
        serializer = PriceListSerializer(new_version)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='add-items')
    def add_items(self, request, pk=None):
        """Добавить работы в прайс-лист"""
        price_list = self.get_object()
        serializer = AddRemoveItemsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        result = add_items_to_pricelist(price_list, serializer.validated_data['work_item_ids'])
        return Response(result)

    @action(detail=True, methods=['post'], url_path='remove-items')
    def remove_items(self, request, pk=None):
        """Удалить работы из прайс-листа"""
        price_list = self.get_object()
        serializer = AddRemoveItemsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        result = remove_items_from_pricelist(price_list, serializer.validated_data['work_item_ids'])
        return Response(result)

    @action(detail=True, methods=['get'])
    def export(self, request, pk=None):
        """Экспорт прайс-листа в Excel"""
        price_list = self.get_object()
        content, filename = export_pricelist_to_excel(price_list)

        response = HttpResponse(
            content,
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response


class PriceListItemViewSet(viewsets.ModelViewSet):
    """ViewSet для позиций прайс-листа"""
    
    queryset = PriceListItem.objects.select_related(
        'price_list', 'work_item', 'work_item__section', 'work_item__grade'
    )
    serializer_class = PriceListItemSerializer
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['price_list', 'is_included']


class PriceListAgreementViewSet(viewsets.ModelViewSet):
    """ViewSet для согласований прайс-листов"""
    
    queryset = PriceListAgreement.objects.select_related('price_list', 'counterparty')
    serializer_class = PriceListAgreementSerializer
    http_method_names = ['get', 'post', 'delete', 'head', 'options']
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['price_list', 'counterparty']
