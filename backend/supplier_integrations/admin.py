from django.contrib import admin
from .models import (
    SupplierIntegration,
    SupplierCategory,
    SupplierBrand,
    SupplierProduct,
    SupplierStock,
    SupplierSyncLog,
)


class SupplierStockInline(admin.TabularInline):
    model = SupplierStock
    extra = 0
    readonly_fields = ['warehouse_name', 'quantity']


@admin.register(SupplierIntegration)
class SupplierIntegrationAdmin(admin.ModelAdmin):
    list_display = ['name', 'provider', 'is_active', 'last_catalog_sync', 'last_stock_sync']
    list_filter = ['provider', 'is_active']


@admin.register(SupplierCategory)
class SupplierCategoryAdmin(admin.ModelAdmin):
    list_display = ['title', 'integration', 'external_id', 'parent', 'our_category']
    list_filter = ['integration']
    search_fields = ['title']
    raw_id_fields = ['our_category', 'parent']


@admin.register(SupplierBrand)
class SupplierBrandAdmin(admin.ModelAdmin):
    list_display = ['title', 'integration', 'external_id']
    list_filter = ['integration']
    search_fields = ['title']


@admin.register(SupplierProduct)
class SupplierProductAdmin(admin.ModelAdmin):
    list_display = ['nc_code', 'title', 'brand', 'base_price', 'ric_price', 'product', 'is_active']
    list_filter = ['integration', 'is_active', 'brand']
    search_fields = ['nc_code', 'articul', 'title']
    raw_id_fields = ['product', 'supplier_category', 'brand']
    inlines = [SupplierStockInline]
    readonly_fields = ['created_at', 'updated_at']


@admin.register(SupplierSyncLog)
class SupplierSyncLogAdmin(admin.ModelAdmin):
    list_display = [
        'integration', 'sync_type', 'status',
        'items_processed', 'items_created', 'items_updated', 'items_errors',
        'duration_seconds', 'created_at',
    ]
    list_filter = ['integration', 'sync_type', 'status']
    readonly_fields = [
        'integration', 'sync_type', 'status',
        'items_processed', 'items_created', 'items_updated', 'items_errors',
        'error_details', 'duration_seconds', 'created_at',
    ]
