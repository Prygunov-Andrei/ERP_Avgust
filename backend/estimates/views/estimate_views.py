import logging

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from django.db.models import F, ExpressionWrapper, DecimalField, Sum
from django.http import HttpResponse
from django_filters.rest_framework import DjangoFilterBackend

logger = logging.getLogger(__name__)

# Лимит размера файла для импорта (50 МБ)
MAX_IMPORT_FILE_SIZE = 50 * 1024 * 1024

ALLOWED_EXCEL_CONTENT_TYPES = {
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/octet-stream',  # некоторые браузеры отправляют так
}
ALLOWED_PDF_CONTENT_TYPES = {
    'application/pdf',
    'application/octet-stream',
}

from core.version_mixin import VersioningMixin
from estimates.formula_engine import topological_sort
from estimates.models import (
    Estimate, EstimateSection, EstimateSubsection,
    EstimateCharacteristic, EstimateItem,
    MountingEstimate,
)
from estimates.serializers import (
    EstimateSerializer, EstimateCreateSerializer,
    EstimateSectionSerializer, EstimateSubsectionSerializer,
    EstimateCharacteristicSerializer,
    EstimateItemSerializer, EstimateItemBulkCreateSerializer,
    MountingEstimateSerializer,
)


class EstimateViewSet(VersioningMixin, viewsets.ModelViewSet):
    """ViewSet для смет (с поддержкой версионирования через VersioningMixin)"""

    queryset = Estimate.objects.select_related(
        'object', 'legal_entity', 'price_list', 'created_by',
        'checked_by', 'approved_by', 'parent_version'
    ).prefetch_related(
        'projects',
        'sections',
        'sections__subsections',
        'characteristics'
    )
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = [
        'object', 'legal_entity', 'status', 'approved_by_customer'
    ]
    search_fields = ['number', 'name']

    def get_serializer_class(self):
        if self.action == 'create':
            return EstimateCreateSerializer
        return EstimateSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        # Аннотируем агрегаты для избежания N+1 в сериализаторе
        if self.action in ('list', 'retrieve'):
            queryset = queryset.annotate(
                _total_materials_sale=Sum('sections__subsections__materials_sale'),
                _total_works_sale=Sum('sections__subsections__works_sale'),
                _total_materials_purchase=Sum('sections__subsections__materials_purchase'),
                _total_works_purchase=Sum('sections__subsections__works_purchase'),
            )
        return queryset

    # Методы versions() и create_version() наследуются от VersioningMixin

    @action(detail=True, methods=['post'], url_path='create-mounting-estimate')
    def create_mounting_estimate(self, request, pk=None):
        """Создать монтажную смету из обычной сметы"""
        estimate = self.get_object()
        created_by = request.user
        mounting_estimate = MountingEstimate.create_from_estimate(estimate, created_by)
        serializer = MountingEstimateSerializer(mounting_estimate)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], url_path='export')
    def export(self, request, pk=None):
        """Экспорт сметы в Excel с учётом column_config."""
        from estimates.services.estimate_excel_exporter import EstimateExcelExporter

        estimate = self.get_object()
        exporter = EstimateExcelExporter(estimate)
        buffer = exporter.export_with_column_config()

        response = HttpResponse(
            buffer.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        filename = f'Смета_{estimate.number}.xlsx'
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response


class EstimateSectionViewSet(viewsets.ModelViewSet):
    """ViewSet для разделов сметы"""

    queryset = EstimateSection.objects.select_related('estimate').prefetch_related('subsections')
    serializer_class = EstimateSectionSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['estimate']

    @action(detail=True, methods=['post'], url_path='demote-to-item')
    def demote_to_item(self, request, pk=None):
        """Превратить раздел обратно в обычную строку сметы."""
        try:
            section = EstimateSection.objects.get(pk=pk)
        except EstimateSection.DoesNotExist:
            return Response({'error': 'Раздел не найден'}, status=status.HTTP_404_NOT_FOUND)

        from estimates.services.estimate_import_service import EstimateImportService
        result = EstimateImportService().demote_section_to_item(int(pk))
        return Response(result)


class EstimateSubsectionViewSet(viewsets.ModelViewSet):
    """ViewSet для подразделов сметы"""

    queryset = EstimateSubsection.objects.select_related('section', 'section__estimate')
    serializer_class = EstimateSubsectionSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['section']

    def get_queryset(self):
        queryset = super().get_queryset()
        # Фильтрация по смете через раздел
        estimate_id = self.request.query_params.get('estimate')
        if estimate_id:
            queryset = queryset.filter(section__estimate_id=estimate_id)
        return queryset


class EstimateCharacteristicViewSet(viewsets.ModelViewSet):
    """ViewSet для характеристик сметы"""

    queryset = EstimateCharacteristic.objects.select_related('estimate')
    serializer_class = EstimateCharacteristicSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['estimate']


class EstimateItemPagination(PageNumberPagination):
    """Пагинация строк сметы. page_size=all отключает пагинацию (обратная совместимость)."""
    page_size = 200
    page_size_query_param = 'page_size'
    max_page_size = 2000

    def paginate_queryset(self, queryset, request, view=None):
        if request.query_params.get('page_size') == 'all':
            return None
        return super().paginate_queryset(queryset, request, view)


class EstimateItemViewSet(viewsets.ModelViewSet):
    """ViewSet для строк сметы"""
    pagination_class = EstimateItemPagination

    queryset = EstimateItem.objects.select_related(
        'estimate', 'section', 'subsection',
        'product', 'work_item', 'source_price_history',
        'supplier_product__integration__counterparty',
    )
    serializer_class = EstimateItemSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = [
        'estimate', 'section', 'subsection', 'product',
        'work_item', 'is_analog',
    ]
    search_fields = ['name', 'model_name', 'original_name']
    ordering_fields = ['sort_order', 'item_number', 'name', 'material_unit_price', 'work_unit_price']
    ordering = ['sort_order', 'item_number']

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        estimate_id = self.request.query_params.get('estimate')
        if estimate_id:
            try:
                estimate = Estimate.objects.only('column_config').get(pk=estimate_id)
                column_config = estimate.column_config or []
                ctx['column_config'] = column_config
                # Pre-compute topological sort once for all items
                ctx['sorted_columns'] = topological_sort(column_config)
            except Estimate.DoesNotExist:
                pass
        return ctx

    def get_queryset(self):
        return super().get_queryset().annotate(
            _material_total=ExpressionWrapper(
                F('quantity') * F('material_unit_price'),
                output_field=DecimalField(max_digits=15, decimal_places=2),
            ),
            _work_total=ExpressionWrapper(
                F('quantity') * F('work_unit_price'),
                output_field=DecimalField(max_digits=15, decimal_places=2),
            ),
            _line_total=ExpressionWrapper(
                F('quantity') * F('material_unit_price') + F('quantity') * F('work_unit_price'),
                output_field=DecimalField(max_digits=15, decimal_places=2),
            ),
        )

    @action(detail=True, methods=['post'], url_path='promote-to-section')
    def promote_to_section(self, request, pk=None):
        """Превратить строку сметы в раздел (секцию)."""
        try:
            EstimateItem.objects.get(pk=pk)
        except EstimateItem.DoesNotExist:
            return Response({'error': 'Строка не найдена'}, status=status.HTTP_404_NOT_FOUND)

        from estimates.services.estimate_import_service import EstimateImportService
        result = EstimateImportService().promote_item_to_section(int(pk))
        return Response(result)

    @action(detail=True, methods=['post'], url_path='move')
    def move(self, request, pk=None):
        """Переместить строку сметы вверх/вниз или в другой раздел."""
        try:
            EstimateItem.objects.get(pk=pk)
        except EstimateItem.DoesNotExist:
            return Response({'error': 'Строка не найдена'}, status=status.HTTP_404_NOT_FOUND)

        from estimates.services.estimate_import_service import EstimateImportService
        service = EstimateImportService()

        direction = request.data.get('direction')
        target_section_id = request.data.get('target_section_id')

        if direction in ('up', 'down'):
            if direction == 'up':
                result = service.move_item_up(int(pk))
            else:
                result = service.move_item_down(int(pk))
        elif target_section_id is not None:
            try:
                EstimateSection.objects.get(pk=target_section_id)
            except EstimateSection.DoesNotExist:
                return Response({'error': 'Раздел не найден'}, status=status.HTTP_404_NOT_FOUND)
            result = service.move_item_to_section(int(pk), int(target_section_id))
        else:
            return Response(
                {'error': 'Укажите direction (up/down) или target_section_id'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(result)

    @action(detail=False, methods=['post'], url_path='bulk-create')
    def bulk_create(self, request):
        """Создать множество строк сметы за одну операцию"""
        serializer = EstimateItemBulkCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        items = serializer.save()
        return Response(
            EstimateItemSerializer(items, many=True).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=['post'], url_path='bulk-move')
    def bulk_move(self, request):
        """Переместить группу строк на указанную позицию."""
        item_ids = request.data.get('item_ids', [])
        target_position = request.data.get('target_position')

        if not item_ids or not isinstance(item_ids, list):
            return Response(
                {'error': 'Необходим непустой массив item_ids'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if target_position is None or not isinstance(target_position, int) or target_position < 1:
            return Response(
                {'error': 'target_position должен быть целым числом >= 1'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from estimates.services.estimate_import_service import EstimateImportService
        result = EstimateImportService().bulk_move_items(item_ids, target_position)
        return Response(result)

    @action(detail=False, methods=['post'], url_path='bulk-update')
    def bulk_update_items(self, request):
        """Обновить множество строк сметы за одну операцию.
        Ожидает массив объектов с обязательным полем 'id'."""
        items_data = request.data
        if not isinstance(items_data, list):
            return Response(
                {'error': 'Ожидается массив объектов'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ids = [item.get('id') for item in items_data if item.get('id')]
        existing = {item.id: item for item in EstimateItem.objects.filter(id__in=ids)}
        updated = []

        for item_data in items_data:
            item_id = item_data.get('id')
            if not item_id or item_id not in existing:
                continue
            obj = existing[item_id]
            for field, value in item_data.items():
                if field == 'id':
                    continue
                setattr(obj, field, value)
            updated.append(obj)

        if updated:
            update_fields = [
                k for k in items_data[0].keys() if k != 'id'
            ]
            EstimateItem.objects.bulk_update(updated, update_fields)

        return Response(
            EstimateItemSerializer(updated, many=True).data,
        )

    @action(detail=False, methods=['post'], url_path='auto-match')
    def auto_match(self, request):
        """Автоматический подбор цен и работ для строк сметы"""
        estimate_id = request.data.get('estimate_id')
        price_list_id = request.data.get('price_list_id')

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

        supplier_ids = request.data.get('supplier_ids', [])
        price_strategy = request.data.get('price_strategy', 'cheapest')

        from estimates.services.estimate_auto_matcher import EstimateAutoMatcher
        matcher = EstimateAutoMatcher()
        results = matcher.preview_matches(
            estimate,
            supplier_ids=supplier_ids or None,
            price_strategy=price_strategy,
        )
        return Response(results)

    @action(detail=False, methods=['post'], url_path='auto-match-works')
    def auto_match_works(self, request):
        """Preview-подбор работ для строк сметы (без сохранения)"""
        estimate_id = request.data.get('estimate_id')
        price_list_id = request.data.get('price_list_id')

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

        from estimates.services.estimate_auto_matcher import EstimateAutoMatcher
        matcher = EstimateAutoMatcher()
        results = matcher.preview_works(estimate, price_list_id=price_list_id)
        return Response(results)

    @action(detail=False, methods=['post'], url_path='apply-match-works')
    def apply_match_works(self, request):
        """Применить выбранные совпадения работ и записать маппинги"""
        items_data = request.data.get('items', [])
        if not items_data:
            return Response(
                {'error': 'Пустой список'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from pricelists.models import WorkItem
        from estimates.services.estimate_auto_matcher import EstimateAutoMatcher

        ids = [d['item_id'] for d in items_data if d.get('item_id')]
        existing = {
            item.id: item
            for item in EstimateItem.objects.filter(id__in=ids).select_related('product')
        }

        work_ids = [d['work_item_id'] for d in items_data if d.get('work_item_id')]
        works = {wi.id: wi for wi in WorkItem.objects.filter(id__in=work_ids)}

        updated = []
        for d in items_data:
            item = existing.get(d.get('item_id'))
            wi = works.get(d.get('work_item_id'))
            if not item or not wi:
                continue

            item.work_item = wi
            if d.get('work_price') and item.work_unit_price == 0:
                item.work_unit_price = d['work_price']
            updated.append(item)

            # Записываем маппинг для обучения системы
            if item.product:
                EstimateAutoMatcher.record_manual_correction(item.product, wi)

        if updated:
            EstimateItem.objects.bulk_update(updated, ['work_item', 'work_unit_price'])

        return Response({'applied': len(updated)})

    @action(detail=False, methods=['post'], url_path='import',
            parser_classes=[MultiPartParser])
    def import_file(self, request):
        """Импорт строк сметы из Excel или PDF.
        Если preview=true, возвращает предпросмотр без сохранения."""
        estimate_id = request.data.get('estimate_id')
        file = request.FILES.get('file')
        preview_mode = request.data.get('preview', '').lower() in ('true', '1')

        if not estimate_id or not file:
            return Response(
                {'error': 'Необходимы estimate_id и file'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # B2: пустой файл
        if file.size == 0:
            return Response(
                {'error': 'Файл пуст'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # B1: лимит размера
        if file.size > MAX_IMPORT_FILE_SIZE:
            return Response(
                {'error': f'Файл слишком большой (макс. {MAX_IMPORT_FILE_SIZE // (1024 * 1024)} МБ)'},
                status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            )

        try:
            estimate = Estimate.objects.get(pk=estimate_id)
        except Estimate.DoesNotExist:
            return Response(
                {'error': 'Смета не найдена'},
                status=status.HTTP_404_NOT_FOUND,
            )

        filename = file.name.lower()
        ext = filename.rsplit('.', 1)[-1] if '.' in filename else ''

        # B3: проверка расширения + MIME-type
        if ext in ('xlsx', 'xls'):
            if file.content_type not in ALLOWED_EXCEL_CONTENT_TYPES:
                logger.warning('Import: unexpected content_type %s for Excel file %s', file.content_type, file.name)
        elif ext == 'pdf':
            if file.content_type not in ALLOWED_PDF_CONTENT_TYPES:
                logger.warning('Import: unexpected content_type %s for PDF file %s', file.content_type, file.name)
        else:
            return Response(
                {'error': 'Поддерживаются только файлы Excel (.xlsx) и PDF'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        file_content = file.read()

        from estimates.services.estimate_import_service import EstimateImportService
        importer = EstimateImportService()

        try:
            if ext in ('xlsx', 'xls'):
                parsed = importer.import_from_excel(file_content, file.name)
            else:
                parsed = importer.import_from_pdf(file_content, file.name)
        except Exception:
            logger.exception('Ошибка парсинга файла %s для сметы %s', file.name, estimate_id)
            return Response(
                {'error': 'Не удалось распознать файл. Проверьте формат.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if preview_mode:
            result = {
                'rows': [row.model_dump() for row in parsed.rows],
                'sections': parsed.sections,
                'total_rows': parsed.total_rows,
                'confidence': parsed.confidence,
            }
            if parsed.warnings:
                result['warnings'] = parsed.warnings
            return Response(result)

        created_items = importer.save_imported_items(int(estimate_id), parsed)
        return Response(
            EstimateItemSerializer(created_items, many=True).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=['post'], url_path='import-rows')
    def import_rows(self, request):
        """Импорт строк из предпросмотра (JSON) с назначенными разделами."""
        estimate_id = request.data.get('estimate_id')
        rows = request.data.get('rows', [])

        if not estimate_id or not rows:
            return Response(
                {'error': 'Необходимы estimate_id и rows'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # B8: валидация структуры rows
        if not isinstance(rows, list):
            return Response(
                {'error': 'rows должен быть массивом'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        for i, row in enumerate(rows):
            if not isinstance(row, dict) or not row.get('name', '').strip():
                return Response(
                    {'error': f'Строка {i + 1}: отсутствует или пустое поле name'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        try:
            Estimate.objects.get(pk=estimate_id)
        except Estimate.DoesNotExist:
            return Response(
                {'error': 'Смета не найдена'},
                status=status.HTTP_404_NOT_FOUND,
            )

        from estimates.services.estimate_import_service import EstimateImportService
        importer = EstimateImportService()
        try:
            created_items = importer.save_rows_from_preview(int(estimate_id), rows)
        except Exception:
            # B5: не возвращаем exception message клиенту
            logger.exception('Ошибка импорта строк сметы %s', estimate_id)
            return Response(
                {'error': 'Ошибка при сохранении строк. Проверьте данные и повторите.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(
            {'created_count': len(created_items), 'item_ids': [item.id for item in created_items]},
            status=status.HTTP_201_CREATED,
        )

    # -- Постраничный импорт PDF --

    @action(detail=False, methods=['post'], url_path='import-pdf',
            parser_classes=[MultiPartParser])
    def import_pdf(self, request):
        """Запуск постраничного импорта PDF. Возвращает session_id сразу."""
        estimate_id = request.data.get('estimate_id')
        file = request.FILES.get('file')

        if not estimate_id or not file:
            return Response(
                {'error': 'Необходимы estimate_id и file'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # B2: пустой файл
        if file.size == 0:
            return Response(
                {'error': 'Файл пуст'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # B1: лимит размера
        if file.size > MAX_IMPORT_FILE_SIZE:
            return Response(
                {'error': f'Файл слишком большой (макс. {MAX_IMPORT_FILE_SIZE // (1024 * 1024)} МБ)'},
                status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            )

        try:
            Estimate.objects.get(pk=estimate_id)
        except Estimate.DoesNotExist:
            return Response(
                {'error': 'Смета не найдена'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not file.name.lower().endswith('.pdf'):
            return Response(
                {'error': 'Только PDF файлы'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        file_content = file.read()

        from estimates.tasks import create_import_session, process_estimate_pdf_pages
        session = create_import_session(file_content, int(estimate_id), user_id=request.user.id)
        process_estimate_pdf_pages.delay(session['session_id'])

        return Response(session, status=status.HTTP_202_ACCEPTED)

    @action(detail=False, methods=['get'],
            url_path=r'import-progress/(?P<session_id>[a-f0-9]{16})')
    def import_progress(self, request, session_id=None):
        """Поллинг прогресса импорта PDF."""
        from estimates.tasks import get_session_data
        data = get_session_data(session_id)
        if not data:
            return Response(
                {'error': 'Сессия не найдена или истекла'},
                status=status.HTTP_404_NOT_FOUND,
            )
        # B7: проверяем что сессия принадлежит текущему пользователю
        session_user_id = data.pop('user_id', None)
        if session_user_id and session_user_id != '0' and int(session_user_id) != request.user.id:
            return Response(
                {'error': 'Сессия не найдена или истекла'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(data)

    @action(detail=False, methods=['post'],
            url_path=r'import-cancel/(?P<session_id>[a-f0-9]{16})')
    def import_cancel(self, request, session_id=None):
        """Отмена импорта PDF."""
        from estimates.tasks import get_session_data, cancel_session
        # B7: проверяем что сессия принадлежит текущему пользователю
        data = get_session_data(session_id)
        if data:
            session_user_id = data.get('user_id')
            if session_user_id and session_user_id != '0' and int(session_user_id) != request.user.id:
                return Response(
                    {'error': 'Сессия не найдена'},
                    status=status.HTTP_404_NOT_FOUND,
                )
        if cancel_session(session_id):
            return Response({'status': 'cancelled'})
        return Response(
            {'error': 'Сессия не найдена'},
            status=status.HTTP_404_NOT_FOUND,
        )
