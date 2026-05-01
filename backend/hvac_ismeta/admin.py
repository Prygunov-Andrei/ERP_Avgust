from datetime import timedelta
from decimal import Decimal

from django.contrib import admin
from django.db.models import Avg, Count, Sum
from django.template.response import TemplateResponse
from django.urls import path
from django.utils import timezone

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
            "Лимиты загрузок (rate limit, F8-06)",
            {"fields": ("hourly_per_session", "hourly_per_ip", "daily_per_ip")},
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


def _aggregate_jobs_for_period(start_at):
    """Срез статистики по IsmetaJob за период [start_at, now]."""
    qs = IsmetaJob.objects.filter(created_at__gte=start_at)
    completed = qs.filter(status=IsmetaJob.STATUS_DONE, started_at__isnull=False, completed_at__isnull=False)
    durations = list(
        completed.values_list("started_at", "completed_at")
    )
    seconds = sorted((c - s).total_seconds() for s, c in durations) if durations else []
    median = seconds[len(seconds) // 2] if seconds else 0
    p95 = seconds[int(len(seconds) * 0.95)] if seconds else 0
    return {
        "total": qs.count(),
        "done": completed.count(),
        "errors": qs.filter(status=IsmetaJob.STATUS_ERROR).count(),
        "queued": qs.filter(status=IsmetaJob.STATUS_QUEUED).count(),
        "processing": qs.filter(status=IsmetaJob.STATUS_PROCESSING).count(),
        "total_cost_usd": qs.aggregate(s=Sum("cost_usd"))["s"] or Decimal("0"),
        "avg_duration_s": (sum(seconds) / len(seconds)) if seconds else 0,
        "median_duration_s": median,
        "p95_duration_s": p95,
        "avg_pages": qs.aggregate(a=Avg("pages_total"))["a"] or 0,
    }


@admin.register(IsmetaJob)
class IsmetaJobAdmin(admin.ModelAdmin):
    change_list_template = "admin/hvac_ismeta/ismetajob/change_list.html"
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

    def get_urls(self):
        urls = super().get_urls()
        custom = [
            path(
                "stats/",
                self.admin_site.admin_view(self.stats_view),
                name="hvac_ismeta_ismetajob_stats",
            ),
        ]
        return custom + urls

    def stats_view(self, request):
        now = timezone.now()
        periods = {
            "today": now - timedelta(hours=24),
            "last_7d": now - timedelta(days=7),
            "last_30d": now - timedelta(days=30),
        }
        stats_by_period = {key: _aggregate_jobs_for_period(start) for key, start in periods.items()}

        last_30d_qs = IsmetaJob.objects.filter(created_at__gte=periods["last_30d"])
        pipeline_dist = list(
            last_30d_qs.values("pipeline")
            .annotate(count=Count("id"), cost=Sum("cost_usd"))
            .order_by("-count")
        )
        recent_errors = list(
            IsmetaJob.objects.filter(status=IsmetaJob.STATUS_ERROR)
            .order_by("-created_at")
            .values("id", "pipeline", "pdf_filename", "error_message", "created_at")[:20]
        )
        context = {
            **self.admin_site.each_context(request),
            "title": "Статистика ISMeta",
            "stats_by_period": stats_by_period,
            "pipeline_dist": pipeline_dist,
            "recent_errors": recent_errors,
            "opts": self.model._meta,
        }
        return TemplateResponse(request, "admin/hvac_ismeta/stats.html", context)


@admin.register(IsmetaFeedback)
class IsmetaFeedbackAdmin(admin.ModelAdmin):
    list_display = ("id", "job", "helpful", "contact_email", "created_at")
    list_filter = ("helpful", "created_at")
    search_fields = ("comment", "contact_email")
    readonly_fields = ("created_at",)
