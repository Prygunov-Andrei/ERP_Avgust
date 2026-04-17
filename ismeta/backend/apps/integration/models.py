"""ProcessedEvent — дедупликация webhook'ов (idempotency)."""

import uuid

from django.db import models


class ProcessedEvent(models.Model):
    """Обработанные webhook-события (TTL 14 дней, чистка фоновой задачей)."""

    event_id = models.CharField(max_length=64, primary_key=True)
    event_type = models.CharField(max_length=64)
    workspace_id = models.UUIDField(null=True, blank=True)
    processed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "processed_event"

    def __str__(self) -> str:
        return f"{self.event_type} [{self.event_id}]"
