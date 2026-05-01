from django.contrib import admin

from .models import HvacIsmetaSettings


@admin.register(HvacIsmetaSettings)
class HvacIsmetaSettingsAdmin(admin.ModelAdmin):
    list_display = ("id", "enabled", "default_pipeline", "default_llm_profile_id", "updated_at")
    readonly_fields = ("updated_at",)
    fieldsets = (
        (
            "Доступность",
            {"fields": ("enabled", "require_registration", "concurrency_limit_enabled")},
        ),
        (
            "Распознавание",
            {"fields": ("default_pipeline", "default_llm_profile_id")},
        ),
        (
            "Хранение и лимиты",
            {"fields": ("pdf_storage_path", "max_file_size_mb")},
        ),
        (
            "Контакты",
            {"fields": ("feedback_email",)},
        ),
        (
            "Служебное",
            {"fields": ("updated_at",)},
        ),
    )

    def has_add_permission(self, request):
        # Singleton: запись создаётся через get_or_create при первом GET.
        return not HvacIsmetaSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False
