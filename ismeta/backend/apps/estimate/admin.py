from django.contrib import admin

from .models import Estimate, EstimateItem, EstimateSection


@admin.register(Estimate)
class EstimateAdmin(admin.ModelAdmin):
    list_display = ("name", "workspace", "status", "version_number", "updated_at")
    list_filter = ("status", "workspace")
    search_fields = ("name",)
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(EstimateSection)
class EstimateSectionAdmin(admin.ModelAdmin):
    list_display = ("name", "estimate", "sort_order")
    raw_id_fields = ("estimate", "workspace")


@admin.register(EstimateItem)
class EstimateItemAdmin(admin.ModelAdmin):
    list_display = ("name", "unit", "quantity", "total", "match_source", "is_key_equipment")
    list_filter = ("match_source", "is_key_equipment", "procurement_status")
    raw_id_fields = ("estimate", "section", "workspace")
