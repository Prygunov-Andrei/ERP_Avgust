"""LLMUsage — учёт токенов и стоимости LLM-вызовов."""

import uuid

from django.db import models


class LLMUsage(models.Model):
    """Журнал LLM-запросов: токены, стоимость, latency."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace_id = models.UUIDField(db_index=True)
    task_type = models.CharField(max_length=32)
    provider = models.CharField(max_length=32)
    model = models.CharField(max_length=64)
    tokens_in = models.IntegerField()
    tokens_out = models.IntegerField()
    cost_usd = models.DecimalField(max_digits=10, decimal_places=6)
    latency_ms = models.IntegerField()
    estimate_id = models.UUIDField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "llm_usage"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["workspace_id", "created_at"], name="idx_llm_usage_ws_created"),
        ]

    def __str__(self) -> str:
        return f"{self.task_type}/{self.model} in={self.tokens_in} out={self.tokens_out}"
