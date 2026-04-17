from django.contrib import admin

from .models import LLMUsage


@admin.register(LLMUsage)
class LLMUsageAdmin(admin.ModelAdmin):
    list_display = ("task_type", "provider", "model", "tokens_in", "tokens_out", "cost_usd", "latency_ms", "created_at")
    list_filter = ("task_type", "provider", "model")
    readonly_fields = ("id", "created_at")
