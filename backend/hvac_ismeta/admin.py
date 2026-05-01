from django.contrib import admin

from .models import HvacIsmetaSettings, IsmetaFeedback, IsmetaJob


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


@admin.register(IsmetaJob)
class IsmetaJobAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "status",
        "pipeline",
        "pdf_filename",
        "items_count",
        "pages_total",
        "cost_usd",
        "created_at",
    )
    list_filter = ("status", "pipeline", "created_at")
    search_fields = ("id", "pdf_filename", "session_key", "ip_address", "feedback_email")
    readonly_fields = (
        "id",
        "session_key",
        "ip_address",
        "user_agent",
        "pdf_filename",
        "pdf_storage_path",
        "pdf_size_bytes",
        "pipeline",
        "llm_profile_id",
        "status",
        "pages_total",
        "pages_processed",
        "items_count",
        "result_json",
        "error_message",
        "cost_usd",
        "feedback_email",
        "created_at",
        "started_at",
        "completed_at",
    )

    def has_add_permission(self, request):
        return False


@admin.register(IsmetaFeedback)
class IsmetaFeedbackAdmin(admin.ModelAdmin):
    list_display = ("id", "job", "helpful", "contact_email", "created_at")
    list_filter = ("helpful", "created_at")
    search_fields = ("comment", "contact_email")
    readonly_fields = ("created_at",)
