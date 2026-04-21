from __future__ import annotations

from django.contrib import admin, messages
from django.core.files.base import ContentFile
from django.utils.safestring import mark_safe

from .models import Brand, BrandOriginClass
from .services.logo_normalizer import normalize_logo_file


@admin.register(BrandOriginClass)
class BrandOriginClassAdmin(admin.ModelAdmin):
    list_display = ("origin_type", "fallback_score")
    list_editable = ("fallback_score",)


@admin.register(Brand)
class BrandAdmin(admin.ModelAdmin):
    list_display = ("name", "logo_preview", "origin_class", "sales_start_year_ru", "is_active", "created_at")
    list_filter = ("is_active", "origin_class")
    search_fields = ("name",)
    list_per_page = 30
    list_select_related = ("origin_class",)
    readonly_fields = ("logo_preview_large",)
    actions = ("normalize_selected_logos",)

    @admin.action(description="Нормализовать логотипы (crop + canvas 200×56)")
    def normalize_selected_logos(self, request, queryset):
        ok = 0
        for brand in queryset.exclude(logo=""):
            storage = brand.logo.storage
            path = brand.logo.name
            try:
                with storage.open(path, "rb") as f:
                    src = f.read()
                normalized = normalize_logo_file(src)
            except Exception as exc:
                self.message_user(
                    request,
                    f"Ошибка для {brand.name}: {exc}",
                    level=messages.ERROR,
                )
                continue
            storage.delete(path)
            storage.save(path, ContentFile(normalized))
            ok += 1
        self.message_user(request, f"Нормализовано логотипов: {ok}")

    @admin.display(description="Лого")
    def logo_preview(self, obj: Brand) -> str:
        if obj.logo:
            return mark_safe(f'<img src="{obj.logo.url}" style="height:24px;" />')
        return "—"

    @admin.display(description="Превью")
    def logo_preview_large(self, obj: Brand) -> str:
        if obj.logo:
            return mark_safe(f'<img src="{obj.logo.url}" style="max-height:80px;" />')
        return "Нет логотипа"
