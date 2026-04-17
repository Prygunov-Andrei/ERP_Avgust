"""ProductKnowledge model + KnowledgeTier."""

import re
import uuid

from django.db import models

from .types import MatchResult


class ProductKnowledge(models.Model):
    """Правило подбора: паттерн в названии → работа."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace_id = models.UUIDField(db_index=True)
    pattern = models.CharField(max_length=500)
    match_type = models.CharField(
        max_length=16,
        choices=[("contains", "Contains"), ("regex", "Regex"), ("exact", "Exact")],
        default="contains",
    )
    work_name = models.CharField(max_length=500)
    work_unit = models.CharField(max_length=50, default="шт")
    work_price = models.DecimalField(max_digits=19, decimal_places=2, default=0)
    confidence = models.DecimalField(max_digits=3, decimal_places=2, default="0.85")
    notes = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "product_knowledge"
        indexes = [
            models.Index(fields=["workspace_id", "is_active"], name="idx_pk_ws_active"),
        ]

    def __str__(self) -> str:
        return f"{self.pattern} → {self.work_name}"

    def matches(self, name: str) -> bool:
        """Проверить совпадение паттерна с именем позиции."""
        name_lower = name.lower()
        pattern_lower = self.pattern.lower()
        match self.match_type:
            case "contains":
                return all(part.strip() in name_lower for part in pattern_lower.split("+"))
            case "regex":
                return bool(re.search(self.pattern, name, re.IGNORECASE))
            case "exact":
                return name_lower == pattern_lower
        return False
