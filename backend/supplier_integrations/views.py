from django.db.models import Sum
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from catalog.models import Product
from .models import (
    SupplierIntegration,
    SupplierCategory,
    SupplierBrand,
    SupplierProduct,
    SupplierSyncLog,
)
from .serializers import (
    SupplierIntegrationSerializer,
    SupplierCategorySerializer,
    SupplierBrandSerializer,
    SupplierProductListSerializer,
    SupplierProductDetailSerializer,
    SupplierProductLinkSerializer,
    SupplierSyncLogSerializer,
)
from .services.product_linker import SupplierProductLinker
from .tasks import sync_breez_catalog, sync_breez_stock


class SupplierIntegrationViewSet(viewsets.ModelViewSet):
    """CRUD + действия для подключений к поставщикам"""

    queryset = SupplierIntegration.objects.all()
    serializer_class = SupplierIntegrationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return SupplierIntegration.objects.select_related('counterparty')

    @action(detail=True, methods=['post'], url_path='sync-catalog')
    def sync_catalog(self, request, pk=None):
        """Запуск полного импорта каталога (Celery task)"""
        integration = self.get_object()
        if not integration.is_active:
            return Response(
                {'detail': 'Интеграция неактивна'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        task = sync_breez_catalog.delay(integration.pk)
        return Response({
            'task_id': task.id,
            'message': 'Импорт каталога запущен',
        })

    @action(detail=True, methods=['post'], url_path='sync-stock')
    def sync_stock(self, request, pk=None):
        """Запуск синхронизации остатков/цен (Celery task)"""
        integration = self.get_object()
        if not integration.is_active:
            return Response(
                {'detail': 'Интеграция неактивна'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        task = sync_breez_stock.delay(integration.pk)
        return Response({
            'task_id': task.id,
            'message': 'Синхронизация остатков запущена',
        })

    @action(detail=True, methods=['get'])
    def status(self, request, pk=None):
        """Статус последних синхронизаций"""
        integration = self.get_object()
        latest_catalog = SupplierSyncLog.objects.filter(
            integration=integration,
            sync_type=SupplierSyncLog.SyncType.CATALOG_FULL,
        ).first()
        latest_stock = SupplierSyncLog.objects.filter(
            integration=integration,
            sync_type=SupplierSyncLog.SyncType.STOCK_SYNC,
        ).first()
        return Response({
            'last_catalog_sync': SupplierSyncLogSerializer(latest_catalog).data if latest_catalog else None,
            'last_stock_sync': SupplierSyncLogSerializer(latest_stock).data if latest_stock else None,
            'products_count': integration.products.filter(is_active=True).count(),
            'categories_count': integration.categories.count(),
            'brands_count': integration.brands.count(),
        })


class SupplierProductViewSet(viewsets.ReadOnlyModelViewSet):
    """Товары поставщиков (только чтение + привязка)"""

    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = {
        'supplier_category': ['exact'],
        'brand': ['exact'],
        'is_active': ['exact'],
        'product': ['exact', 'isnull'],
        'integration': ['exact'],
        'for_marketplace': ['exact'],
    }
    search_fields = ['title', 'nc_code', 'articul']
    ordering_fields = ['title', 'base_price', 'ric_price', 'created_at']
    ordering = ['title']

    def get_queryset(self):
        qs = SupplierProduct.objects.select_related(
            'brand', 'supplier_category', 'product', 'integration',
            'integration__counterparty',
        ).prefetch_related(
            'stocks',
        ).annotate(
            annotated_total_stock=Sum('stocks__quantity'),
        )
        # Фильтр наличия
        in_stock = self.request.query_params.get('in_stock')
        if in_stock == 'true':
            qs = qs.filter(annotated_total_stock__gt=0)
        # Фильтр привязки
        linked = self.request.query_params.get('linked')
        if linked == 'true':
            qs = qs.filter(product__isnull=False)
        elif linked == 'false':
            qs = qs.filter(product__isnull=True)
        return qs

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return SupplierProductDetailSerializer
        return SupplierProductListSerializer

    @action(detail=True, methods=['post'])
    def link(self, request, pk=None):
        """Привязка товара поставщика к нашему каталогу"""
        supplier_product = self.get_object()
        serializer = SupplierProductLinkSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        product_id = serializer.validated_data['product_id']
        try:
            product = Product.objects.get(pk=product_id)
        except Product.DoesNotExist:
            return Response(
                {'detail': f'Товар #{product_id} не найден'},
                status=status.HTTP_404_NOT_FOUND,
            )

        linker = SupplierProductLinker()
        linker.link_and_enrich(supplier_product, product)

        return Response(
            SupplierProductDetailSerializer(supplier_product).data,
            status=status.HTTP_200_OK,
        )


class SupplierCategoryViewSet(viewsets.ModelViewSet):
    """Категории поставщика с маппингом на наши категории"""

    serializer_class = SupplierCategorySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['integration', 'our_category']
    search_fields = ['title']
    http_method_names = ['get', 'patch', 'head', 'options']

    def get_queryset(self):
        return SupplierCategory.objects.select_related('our_category', 'parent')


class SupplierBrandViewSet(viewsets.ReadOnlyModelViewSet):
    """Бренды поставщика"""

    serializer_class = SupplierBrandSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['integration']
    search_fields = ['title']

    def get_queryset(self):
        return SupplierBrand.objects.all()


class SupplierSyncLogViewSet(viewsets.ReadOnlyModelViewSet):
    """Логи синхронизаций"""

    serializer_class = SupplierSyncLogSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = {
        'integration': ['exact'],
        'sync_type': ['exact'],
        'status': ['exact'],
    }

    def get_queryset(self):
        return SupplierSyncLog.objects.select_related('integration')
