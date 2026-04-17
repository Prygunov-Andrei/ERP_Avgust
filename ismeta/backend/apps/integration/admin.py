from django.contrib import admin

from .models import ProcessedEvent


@admin.register(ProcessedEvent)
class ProcessedEventAdmin(admin.ModelAdmin):
    list_display = ("event_id", "event_type", "workspace_id", "processed_at")
    list_filter = ("event_type",)
