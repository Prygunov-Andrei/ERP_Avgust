"""IsmetaSnapshot — приём snapshot'ов смет из ISMeta."""

import uuid

from django.db import models


class SnapshotStatus(models.TextChoices):
    RECEIVED = "received", "Получен"
    PROCESSING = "processing", "Обрабатывается"
    ACCEPTED = "accepted", "Принят"
    REJECTED = "rejected", "Отклонён"


class IsmetaSnapshot(models.Model):
    """Snapshot сметы, отправленный из ISMeta в ERP."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    idempotency_key = models.UUIDField(unique=True)
    workspace_id = models.UUIDField()
    ismeta_version_id = models.UUIDField()
    payload = models.JSONField(help_text="Полный JSON snapshot сметы из ISMeta")
    status = models.CharField(
        max_length=16, choices=SnapshotStatus.choices, default=SnapshotStatus.RECEIVED
    )
    created_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "ismeta_snapshot"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        name = self.payload.get("estimate", {}).get("name", "???") if self.payload else "???"
        return f"Snapshot {self.id} ({name}) [{self.status}]"
