from django.contrib import admin

from .models import IsmetaSnapshot


@admin.register(IsmetaSnapshot)
class IsmetaSnapshotAdmin(admin.ModelAdmin):
    list_display = ("id", "workspace_id", "ismeta_version_id", "status", "created_at")
    list_filter = ("status",)
    readonly_fields = ("id", "idempotency_key", "payload", "created_at", "processed_at")
