import re
from rest_framework import serializers
from decimal import Decimal
from django.contrib.auth.models import User

from .models import (
    Project, ProjectNote, Estimate, EstimateSection,
    EstimateSubsection, EstimateCharacteristic, EstimateItem,
    MountingEstimate, ColumnConfigTemplate,
)
from .column_defaults import (
    DEFAULT_COLUMN_CONFIG, ALLOWED_BUILTIN_FIELDS, ALLOWED_COLUMN_TYPES,
)
from .formula_engine import (
    validate_formula, topological_sort, compute_all_formulas, CycleError,
)
from accounting.serializers import CounterpartySerializer


class ProjectNoteSerializer(serializers.ModelSerializer):
    """Сериализатор для замечаний к проекту"""
    
    author = serializers.SerializerMethodField()
    
    class Meta:
        model = ProjectNote
        fields = [
            'id', 'project', 'author', 'text',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_author(self, obj):
        return {
            'id': obj.author.id,
            'username': obj.author.username
        }


class ProjectListSerializer(serializers.ModelSerializer):
    """Упрощённый сериализатор для списков проектов"""
    
    object_name = serializers.CharField(source='object.name', read_only=True)
    stage_display = serializers.CharField(source='get_stage_display', read_only=True)
    
    class Meta:
        model = Project
        fields = [
            'id', 'cipher', 'name', 'date', 'stage', 'stage_display',
            'object', 'object_name', 'is_approved_for_production',
            'primary_check_done', 'secondary_check_done',
            'version_number', 'is_current', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'version_number', 'is_current', 'created_at', 'updated_at'
        ]


class ProjectSerializer(serializers.ModelSerializer):
    """Полный сериализатор для проекта"""
    
    project_notes = ProjectNoteSerializer(many=True, read_only=True)
    object_name = serializers.CharField(source='object.name', read_only=True)
    stage_display = serializers.CharField(source='get_stage_display', read_only=True)
    primary_check_by_username = serializers.CharField(
        source='primary_check_by.username',
        read_only=True,
        allow_null=True
    )
    secondary_check_by_username = serializers.CharField(
        source='secondary_check_by.username',
        read_only=True,
        allow_null=True
    )
    
    class Meta:
        model = Project
        fields = [
            'id', 'cipher', 'name', 'date', 'stage', 'stage_display',
            'object', 'object_name', 'file', 'notes',
            'is_approved_for_production', 'production_approval_file',
            'production_approval_date', 'primary_check_done',
            'primary_check_by', 'primary_check_by_username',
            'primary_check_date', 'secondary_check_done',
            'secondary_check_by', 'secondary_check_by_username',
            'secondary_check_date', 'parent_version', 'version_number',
            'is_current', 'project_notes', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'version_number', 'is_current', 'parent_version',
            'created_at', 'updated_at'
        ]


class EstimateSubsectionSerializer(serializers.ModelSerializer):
    """Сериализатор для подраздела сметы"""
    
    total_sale = serializers.DecimalField(
        max_digits=14,
        decimal_places=2,
        read_only=True
    )
    total_purchase = serializers.DecimalField(
        max_digits=14,
        decimal_places=2,
        read_only=True
    )
    
    class Meta:
        model = EstimateSubsection
        fields = [
            'id', 'section', 'name', 'materials_sale', 'works_sale',
            'materials_purchase', 'works_purchase', 'sort_order',
            'total_sale', 'total_purchase', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class EstimateSectionSerializer(serializers.ModelSerializer):
    """Сериализатор для раздела сметы"""
    
    subsections = EstimateSubsectionSerializer(many=True, read_only=True)
    total_materials_sale = serializers.DecimalField(
        max_digits=14,
        decimal_places=2,
        read_only=True
    )
    total_works_sale = serializers.DecimalField(
        max_digits=14,
        decimal_places=2,
        read_only=True
    )
    total_materials_purchase = serializers.DecimalField(
        max_digits=14,
        decimal_places=2,
        read_only=True
    )
    total_works_purchase = serializers.DecimalField(
        max_digits=14,
        decimal_places=2,
        read_only=True
    )
    total_sale = serializers.DecimalField(
        max_digits=14,
        decimal_places=2,
        read_only=True
    )
    total_purchase = serializers.DecimalField(
        max_digits=14,
        decimal_places=2,
        read_only=True
    )
    
    class Meta:
        model = EstimateSection
        fields = [
            'id', 'estimate', 'name', 'sort_order', 'subsections',
            'total_materials_sale', 'total_works_sale',
            'total_materials_purchase', 'total_works_purchase',
            'total_sale', 'total_purchase', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class EstimateCharacteristicSerializer(serializers.ModelSerializer):
    """Сериализатор для характеристики сметы"""
    
    source_type_display = serializers.CharField(
        source='get_source_type_display',
        read_only=True
    )
    
    class Meta:
        model = EstimateCharacteristic
        fields = [
            'id', 'estimate', 'name', 'purchase_amount', 'sale_amount',
            'is_auto_calculated', 'source_type', 'source_type_display',
            'sort_order', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def update(self, instance, validated_data):
        """При обновлении суммы сбрасываем is_auto_calculated"""
        if 'purchase_amount' in validated_data or 'sale_amount' in validated_data:
            validated_data['is_auto_calculated'] = False
        return super().update(instance, validated_data)


class EstimateItemSerializer(serializers.ModelSerializer):
    """Сериализатор для строки сметы"""

    product_name = serializers.CharField(
        source='product.name', read_only=True, allow_null=True
    )
    work_item_name = serializers.CharField(
        source='work_item.name', read_only=True, allow_null=True
    )
    supplier_product_name = serializers.CharField(
        source='supplier_product.title', read_only=True, allow_null=True
    )
    supplier_counterparty_name = serializers.SerializerMethodField()
    material_total = serializers.SerializerMethodField()
    work_total = serializers.SerializerMethodField()
    line_total = serializers.SerializerMethodField()
    computed_values = serializers.SerializerMethodField()

    def get_material_total(self, obj):
        val = getattr(obj, '_material_total', None)
        if val is not None:
            return val.quantize(Decimal('0.01'))
        return obj.material_total

    def get_work_total(self, obj):
        val = getattr(obj, '_work_total', None)
        if val is not None:
            return val.quantize(Decimal('0.01'))
        return obj.work_total

    def get_line_total(self, obj):
        val = getattr(obj, '_line_total', None)
        if val is not None:
            return val.quantize(Decimal('0.01'))
        return obj.line_total

    def get_supplier_counterparty_name(self, obj):
        sp = obj.supplier_product
        if sp and hasattr(sp, 'integration') and sp.integration and sp.integration.counterparty:
            return sp.integration.counterparty.name
        return None

    def get_computed_values(self, obj):
        """Вычислить formula-столбцы из column_config сметы."""
        column_config = self.context.get('column_config')
        if not column_config:
            return {}

        formula_cols = [c for c in column_config if c.get('type') == 'formula']
        if not formula_cols:
            return {}

        builtin_values = {
            'item_number': Decimal(str(obj.item_number or 0)),
            'quantity': obj.quantity or Decimal('0'),
            'material_unit_price': obj.material_unit_price or Decimal('0'),
            'work_unit_price': obj.work_unit_price or Decimal('0'),
            'material_total': self.get_material_total(obj) or Decimal('0'),
            'work_total': self.get_work_total(obj) or Decimal('0'),
            'line_total': self.get_line_total(obj) or Decimal('0'),
        }
        custom_data = obj.custom_data or {}
        results = compute_all_formulas(column_config, builtin_values, custom_data)
        return {k: str(v) if v is not None else None for k, v in results.items()}

    class Meta:
        model = EstimateItem
        fields = [
            'id', 'estimate', 'section', 'subsection', 'sort_order',
            'item_number', 'name', 'model_name', 'unit', 'quantity',
            'material_unit_price', 'work_unit_price',
            'product', 'product_name', 'work_item', 'work_item_name',
            'supplier_product', 'supplier_product_name',
            'supplier_counterparty_name',
            'is_analog', 'analog_reason', 'original_name',
            'source_price_history',
            'material_total', 'work_total', 'line_total',
            'custom_data', 'computed_values',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate(self, data):
        if data.get('is_analog') and not data.get('analog_reason'):
            raise serializers.ValidationError({
                'analog_reason': 'При применении аналога необходимо указать обоснование'
            })
        subsection = data.get('subsection')
        section = data.get('section')
        if subsection and section and subsection.section != section:
            raise serializers.ValidationError({
                'subsection': 'Подраздел должен принадлежать выбранному разделу'
            })
        return data


class EstimateItemBulkCreateSerializer(serializers.Serializer):
    """Сериализатор для bulk-создания строк сметы"""
    
    items = EstimateItemSerializer(many=True)

    def create(self, validated_data):
        items_data = validated_data['items']
        items = [EstimateItem(**item_data) for item_data in items_data]
        return EstimateItem.objects.bulk_create(items)


class EstimateSerializer(serializers.ModelSerializer):
    """Полный сериализатор для сметы"""
    
    sections = EstimateSectionSerializer(many=True, read_only=True)
    characteristics = EstimateCharacteristicSerializer(many=True, read_only=True)
    projects = serializers.SerializerMethodField()
    object_name = serializers.CharField(source='object.name', read_only=True)
    legal_entity_name = serializers.CharField(
        source='legal_entity.short_name',
        read_only=True
    )
    price_list_name = serializers.CharField(
        source='price_list.name',
        read_only=True,
        allow_null=True
    )
    status_display = serializers.CharField(
        source='get_status_display',
        read_only=True
    )
    created_by_username = serializers.CharField(
        source='created_by.username',
        read_only=True
    )
    checked_by_username = serializers.CharField(
        source='checked_by.username',
        read_only=True,
        allow_null=True
    )
    approved_by_username = serializers.CharField(
        source='approved_by.username',
        read_only=True,
        allow_null=True
    )
    
    # Вычисляемые поля — используют DB-аннотации с fallback на @cached_property
    total_materials_sale = serializers.SerializerMethodField()
    total_works_sale = serializers.SerializerMethodField()
    total_materials_purchase = serializers.SerializerMethodField()
    total_works_purchase = serializers.SerializerMethodField()
    total_sale = serializers.SerializerMethodField()
    total_purchase = serializers.SerializerMethodField()
    vat_amount = serializers.SerializerMethodField()
    total_with_vat = serializers.SerializerMethodField()
    profit_amount = serializers.SerializerMethodField()
    profit_percent = serializers.SerializerMethodField()

    def _get_annotated_or_prop(self, obj, annotation_name, prop_name):
        val = getattr(obj, annotation_name, None)
        if val is not None:
            return val
        return getattr(obj, prop_name)

    def get_total_materials_sale(self, obj):
        return self._get_annotated_or_prop(obj, '_total_materials_sale', 'total_materials_sale')

    def get_total_works_sale(self, obj):
        return self._get_annotated_or_prop(obj, '_total_works_sale', 'total_works_sale')

    def get_total_materials_purchase(self, obj):
        return self._get_annotated_or_prop(obj, '_total_materials_purchase', 'total_materials_purchase')

    def get_total_works_purchase(self, obj):
        return self._get_annotated_or_prop(obj, '_total_works_purchase', 'total_works_purchase')

    def get_total_sale(self, obj):
        ms = self.get_total_materials_sale(obj) or Decimal('0')
        ws = self.get_total_works_sale(obj) or Decimal('0')
        return ms + ws

    def get_total_purchase(self, obj):
        mp = self.get_total_materials_purchase(obj) or Decimal('0')
        wp = self.get_total_works_purchase(obj) or Decimal('0')
        return mp + wp

    def get_vat_amount(self, obj):
        if not obj.with_vat:
            return Decimal('0')
        total_sale = self.get_total_sale(obj) or Decimal('0')
        return (total_sale * obj.vat_rate / Decimal('100')).quantize(Decimal('0.01'))

    def get_total_with_vat(self, obj):
        total_sale = self.get_total_sale(obj) or Decimal('0')
        return total_sale + self.get_vat_amount(obj)

    def get_profit_amount(self, obj):
        total_sale = self.get_total_sale(obj) or Decimal('0')
        total_purchase = self.get_total_purchase(obj) or Decimal('0')
        return total_sale - total_purchase

    def get_profit_percent(self, obj):
        total_sale = self.get_total_sale(obj) or Decimal('0')
        if total_sale == 0:
            return Decimal('0')
        profit = self.get_profit_amount(obj)
        return ((profit / total_sale) * 100).quantize(Decimal('0.01'))
    
    class Meta:
        model = Estimate
        fields = [
            'id', 'number', 'name', 'object', 'object_name',
            'legal_entity', 'legal_entity_name', 'with_vat', 'vat_rate',
            'projects', 'price_list', 'price_list_name', 'man_hours',
            'usd_rate', 'eur_rate', 'cny_rate', 'file', 'status',
            'status_display', 'approved_by_customer', 'approved_date',
            'created_by', 'created_by_username', 'checked_by',
            'checked_by_username', 'approved_by', 'approved_by_username',
            'parent_version', 'version_number', 'column_config',
            'sections', 'characteristics',
            'total_materials_sale', 'total_works_sale',
            'total_materials_purchase', 'total_works_purchase',
            'total_sale', 'total_purchase', 'vat_amount', 'total_with_vat',
            'profit_amount', 'profit_percent', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'number', 'version_number', 'parent_version',
            'created_at', 'updated_at'
        ]

    _KEY_RE = re.compile(r'^[a-z][a-z0-9_]{0,49}$')

    def validate_column_config(self, value):
        """Валидация конфигурации столбцов."""
        if not value:
            return value

        if not isinstance(value, list):
            raise serializers.ValidationError('column_config должен быть списком')

        keys_seen = set()
        errors = []
        for i, col in enumerate(value):
            if not isinstance(col, dict):
                errors.append(f'Столбец #{i}: должен быть объектом')
                continue

            key = col.get('key', '')
            col_type = col.get('type', '')

            if not key or not self._KEY_RE.match(key):
                errors.append(
                    f'Столбец #{i}: key должен содержать только [a-z0-9_], '
                    f'начинаться с буквы, длина 1-50'
                )
            if key in keys_seen:
                errors.append(f'Столбец #{i}: дублирующийся key "{key}"')
            keys_seen.add(key)

            if col_type not in ALLOWED_COLUMN_TYPES:
                errors.append(f'Столбец "{key}": недопустимый тип "{col_type}"')

            if col_type == 'builtin':
                bf = col.get('builtin_field')
                if bf not in ALLOWED_BUILTIN_FIELDS:
                    errors.append(f'Столбец "{key}": недопустимое builtin_field "{bf}"')

            if col_type == 'custom_select':
                opts = col.get('options')
                if not opts or not isinstance(opts, list) or len(opts) == 0:
                    errors.append(f'Столбец "{key}": custom_select требует непустой options')

            if col_type == 'formula':
                formula = col.get('formula', '')
                if formula:
                    formula_errors = validate_formula(formula, keys_seen | ALLOWED_BUILTIN_FIELDS)
                    for fe in formula_errors:
                        errors.append(f'Столбец "{key}": {fe}')

        # Check for cycles
        if not errors:
            try:
                topological_sort(value)
            except CycleError as e:
                errors.append(str(e))

        if errors:
            raise serializers.ValidationError(errors)

        return value

    def get_projects(self, obj):
        """Возвращает краткую информацию о проектах"""
        request = self.context.get('request')
        return [
            {
                'id': p.id,
                'cipher': p.cipher,
                'name': p.name,
                'file': request.build_absolute_uri(p.file.url) if p.file and request else (p.file.url if p.file else None),
            }
            for p in obj.projects.all()
        ]


class EstimateCreateSerializer(serializers.ModelSerializer):
    """Сериализатор для создания сметы"""
    
    projects = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Project.objects.all(),
        required=False
    )
    number = serializers.CharField(read_only=True)  # Добавляем number как read_only
    
    class Meta:
        model = Estimate
        fields = [
            'id', 'object', 'legal_entity', 'name', 'with_vat', 'vat_rate',
            'projects', 'price_list', 'man_hours', 'usd_rate', 'eur_rate',
            'cny_rate', 'number'
        ]
        read_only_fields = ['id', 'number']
    
    def create(self, validated_data):
        projects = validated_data.pop('projects', [])
        created_by = self.context['request'].user
        
        estimate = Estimate.objects.create(
            **validated_data,
            created_by=created_by
        )
        
        if projects:
            estimate.projects.set(projects)
        
        # Создаём начальные характеристики
        estimate.create_initial_characteristics()
        
        return estimate


class MountingEstimateSerializer(serializers.ModelSerializer):
    """Сериализатор для монтажной сметы"""
    
    source_estimate = serializers.SerializerMethodField()
    agreed_counterparty = CounterpartySerializer(read_only=True)
    object_name = serializers.CharField(source='object.name', read_only=True)
    status_display = serializers.CharField(
        source='get_status_display',
        read_only=True
    )
    created_by_username = serializers.CharField(
        source='created_by.username',
        read_only=True
    )
    
    class Meta:
        model = MountingEstimate
        fields = [
            'id', 'number', 'name', 'object', 'object_name',
            'source_estimate', 'total_amount', 'man_hours', 'file',
            'status', 'status_display', 'agreed_counterparty',
            'agreed_date', 'created_by', 'created_by_username',
            'parent_version', 'version_number', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'number', 'version_number', 'parent_version',
            'created_by', 'created_at', 'updated_at'
        ]
    
    def get_source_estimate(self, obj):
        """Возвращает краткую информацию об исходной смете"""
        if obj.source_estimate:
            return {
                'id': obj.source_estimate.id,
                'number': obj.source_estimate.number,
                'name': obj.source_estimate.name
            }
        return None


class ColumnConfigTemplateSerializer(serializers.ModelSerializer):
    """Сериализатор для шаблонов конфигурации столбцов."""

    created_by_username = serializers.CharField(
        source='created_by.username', read_only=True
    )

    class Meta:
        model = ColumnConfigTemplate
        fields = [
            'id', 'name', 'description', 'column_config',
            'is_default', 'created_by', 'created_by_username',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']

    def validate_column_config(self, value):
        """Переиспользуем валидацию из EstimateSerializer."""
        dummy = EstimateSerializer()
        return dummy.validate_column_config(value)


class MountingEstimateCreateFromEstimateSerializer(serializers.Serializer):
    """Сериализатор для создания монтажной сметы из обычной сметы"""
    
    estimate_id = serializers.IntegerField()
    
    def validate_estimate_id(self, value):
        try:
            Estimate.objects.get(id=value)
        except Estimate.DoesNotExist:
            raise serializers.ValidationError("Смета с указанным ID не найдена")
        return value
    
    def create(self, validated_data):
        estimate = Estimate.objects.get(id=validated_data['estimate_id'])
        created_by = self.context['request'].user
        return MountingEstimate.create_from_estimate(estimate, created_by)
