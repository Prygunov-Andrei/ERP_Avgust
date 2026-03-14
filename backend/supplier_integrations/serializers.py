from rest_framework import serializers
from .models import (
    SupplierIntegration,
    SupplierCategory,
    SupplierBrand,
    SupplierProduct,
    SupplierStock,
    SupplierSyncLog,
)


class SupplierIntegrationSerializer(serializers.ModelSerializer):
    counterparty_name = serializers.CharField(
        source='counterparty.name', read_only=True, allow_null=True
    )
    products_count = serializers.SerializerMethodField()

    class Meta:
        model = SupplierIntegration
        fields = [
            'id', 'name', 'provider', 'counterparty', 'counterparty_name',
            'base_url', 'auth_header', 'is_active',
            'last_catalog_sync', 'last_stock_sync',
            'products_count',
            'created_at', 'updated_at',
        ]
        extra_kwargs = {
            'auth_header': {'write_only': True},
        }
        read_only_fields = ['id', 'last_catalog_sync', 'last_stock_sync', 'created_at', 'updated_at']

    def get_products_count(self, obj):
        if hasattr(obj, 'annotated_products_count'):
            return obj.annotated_products_count
        return obj.products.filter(is_active=True).count()


class SupplierCategorySerializer(serializers.ModelSerializer):
    our_category_name = serializers.CharField(
        source='our_category.name', read_only=True, allow_null=True
    )

    class Meta:
        model = SupplierCategory
        fields = [
            'id', 'external_id', 'title', 'parent', 'parent_external_id',
            'our_category', 'our_category_name',
        ]
        read_only_fields = ['id', 'external_id', 'title', 'parent', 'parent_external_id']


class SupplierBrandSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupplierBrand
        fields = ['id', 'external_id', 'title', 'image_url', 'website_url']
        read_only_fields = ['id', 'external_id', 'title']


class SupplierStockSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupplierStock
        fields = ['warehouse_name', 'quantity']


class SupplierProductListSerializer(serializers.ModelSerializer):
    brand_name = serializers.CharField(source='brand.title', read_only=True, allow_null=True)
    category_name = serializers.CharField(
        source='supplier_category.title', read_only=True, allow_null=True
    )
    product_name = serializers.CharField(source='product.name', read_only=True, allow_null=True)
    total_stock = serializers.SerializerMethodField()

    class Meta:
        model = SupplierProduct
        fields = [
            'id', 'nc_code', 'articul', 'title',
            'brand_name', 'category_name', 'series',
            'base_price', 'base_price_currency',
            'ric_price', 'ric_price_currency',
            'for_marketplace', 'images',
            'product', 'product_name',
            'total_stock', 'is_active',
            'price_updated_at',
        ]

    def get_total_stock(self, obj):
        if hasattr(obj, 'annotated_total_stock'):
            return obj.annotated_total_stock or 0
        return obj.total_stock


class SupplierProductDetailSerializer(serializers.ModelSerializer):
    brand_name = serializers.CharField(source='brand.title', read_only=True, allow_null=True)
    category_name = serializers.CharField(
        source='supplier_category.title', read_only=True, allow_null=True
    )
    product_name = serializers.CharField(source='product.name', read_only=True, allow_null=True)
    stocks = SupplierStockSerializer(many=True, read_only=True)
    total_stock = serializers.SerializerMethodField()

    class Meta:
        model = SupplierProduct
        fields = [
            'id', 'external_id', 'nc_code', 'articul', 'title', 'description',
            'brand_name', 'category_name', 'series',
            'base_price', 'base_price_currency',
            'ric_price', 'ric_price_currency',
            'for_marketplace',
            'images', 'booklet_url', 'manual_url', 'tech_specs',
            'product', 'product_name',
            'stocks', 'total_stock',
            'is_active', 'price_updated_at',
            'created_at', 'updated_at',
        ]

    def get_total_stock(self, obj):
        if hasattr(obj, 'annotated_total_stock'):
            return obj.annotated_total_stock or 0
        return obj.total_stock


class SupplierProductLinkSerializer(serializers.Serializer):
    product_id = serializers.IntegerField(help_text='ID нашего товара для привязки')


class SupplierSyncLogSerializer(serializers.ModelSerializer):
    sync_type_display = serializers.CharField(source='get_sync_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = SupplierSyncLog
        fields = [
            'id', 'sync_type', 'sync_type_display',
            'status', 'status_display',
            'items_processed', 'items_created', 'items_updated', 'items_errors',
            'error_details', 'duration_seconds',
            'created_at',
        ]
        read_only_fields = fields
