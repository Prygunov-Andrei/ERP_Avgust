"""Core-модели сметы: Estimate, EstimateSection, EstimateItem.

ADR-0003 (UUID workspace_id), ADR-0010 (optimistic locking),
ADR-0021 (HASH partitioning EstimateItem), ADR-0022 (key equipment).
"""

import uuid

from django.conf import settings
from django.db import models

from apps.workspace.models import Workspace

from .schemas import MarkupConfig, TechSpecs


# ---------------------------------------------------------------------------
# Estimate
# ---------------------------------------------------------------------------


class EstimateStatus(models.TextChoices):
    DRAFT = "draft", "Черновик"
    IN_PROGRESS = "in_progress", "В работе"
    REVIEW = "review", "На проверке"
    READY = "ready", "Готова"
    TRANSMITTED = "transmitted", "Передана в ERP"
    ARCHIVED = "archived", "Архив"


class Estimate(models.Model):
    """Смета — корневая сущность иерархии."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        Workspace, on_delete=models.CASCADE, related_name="estimates"
    )
    folder_name = models.CharField(max_length=255, blank=True, default="")
    name = models.CharField(max_length=512)
    status = models.CharField(
        max_length=16, choices=EstimateStatus.choices, default=EstimateStatus.DRAFT
    )
    version_number = models.PositiveIntegerField(default=1)
    parent_version = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True, related_name="child_versions"
    )
    version = models.PositiveIntegerField(default=1)

    default_material_markup = models.JSONField(
        default=dict, blank=True, help_text='MarkupConfig JSON, e.g. {"type":"percent","value":30}'
    )
    default_work_markup = models.JSONField(
        default=dict, blank=True, help_text='MarkupConfig JSON, e.g. {"type":"percent","value":300}'
    )

    total_equipment = models.DecimalField(max_digits=19, decimal_places=2, default=0)
    total_materials = models.DecimalField(max_digits=19, decimal_places=2, default=0)
    total_works = models.DecimalField(max_digits=19, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=19, decimal_places=2, default=0)
    man_hours = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    profitability_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    advance_amount = models.DecimalField(max_digits=19, decimal_places=2, default=0)
    estimated_days = models.PositiveIntegerField(default=0)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "estimate"
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=["workspace", "status"], name="idx_estimate_ws_status"),
            models.Index(fields=["workspace", "created_at"], name="idx_estimate_ws_created"),
        ]

    def __str__(self) -> str:
        return f"{self.name} v{self.version_number} ({self.status})"

    def clean(self) -> None:
        super().clean()
        if self.default_material_markup:
            MarkupConfig.model_validate(self.default_material_markup)
        if self.default_work_markup:
            MarkupConfig.model_validate(self.default_work_markup)


# ---------------------------------------------------------------------------
# EstimateSection
# ---------------------------------------------------------------------------


class EstimateSection(models.Model):
    """Раздел сметы (Вентиляция, Кондиционирование, Слаботочка, ...)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    estimate = models.ForeignKey(Estimate, on_delete=models.CASCADE, related_name="sections")
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE)
    name = models.CharField(max_length=512)
    sort_order = models.PositiveIntegerField(default=0)
    version = models.PositiveIntegerField(default=1)
    parent_version_section = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True
    )
    material_markup = models.JSONField(null=True, blank=True)
    work_markup = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "estimate_section"
        ordering = ["sort_order"]

    def __str__(self) -> str:
        return f"{self.name} (#{self.sort_order})"

    def clean(self) -> None:
        super().clean()
        if self.material_markup:
            MarkupConfig.model_validate(self.material_markup)
        if self.work_markup:
            MarkupConfig.model_validate(self.work_markup)


# ---------------------------------------------------------------------------
# EstimateItem
# ---------------------------------------------------------------------------


class MatchSource(models.TextChoices):
    MANUAL = "manual", "Вручную"
    HISTORY = "history", "История"
    PRICELIST = "pricelist", "Прайс-лист"
    KNOWLEDGE = "knowledge", "База знаний"
    CATEGORY = "category", "Категория"
    FUZZY = "fuzzy", "Fuzzy"
    LLM = "llm", "LLM"
    WEB = "web", "Web"
    SUPPLIER = "supplier", "Поставщик"
    UNMATCHED = "unmatched", "Не подобрано"


class ProcurementStatus(models.TextChoices):
    NONE = "none", "—"
    REQUESTED = "requested", "Запрошено"
    QUOTED = "quoted", "КП получено"
    BOOKED = "booked", "Забронировано"
    ORDERED = "ordered", "Заказано"


class EstimateItemManager(models.Manager):
    """Default manager: скрывает soft-deleted записи."""

    def get_queryset(self):
        return super().get_queryset().filter(is_deleted=False)


class EstimateItemAllManager(models.Manager):
    """Все записи, включая is_deleted=True."""

    pass


class EstimateItem(models.Model):
    """Строка сметы — позиция оборудования/материала/работы."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    section = models.ForeignKey(EstimateSection, on_delete=models.CASCADE, related_name="items")
    estimate = models.ForeignKey(Estimate, on_delete=models.CASCADE, related_name="items")
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE)
    row_id = models.UUIDField(default=uuid.uuid4, editable=False)
    sort_order = models.PositiveIntegerField(default=0)

    name = models.CharField(max_length=500)
    unit = models.CharField(max_length=50, default="шт")
    quantity = models.DecimalField(max_digits=14, decimal_places=4, default=0)

    equipment_price = models.DecimalField(max_digits=19, decimal_places=2, default=0)
    material_price = models.DecimalField(max_digits=19, decimal_places=2, default=0)
    work_price = models.DecimalField(max_digits=19, decimal_places=2, default=0)
    equipment_total = models.DecimalField(max_digits=19, decimal_places=2, default=0)
    material_total = models.DecimalField(max_digits=19, decimal_places=2, default=0)
    work_total = models.DecimalField(max_digits=19, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=19, decimal_places=2, default=0)

    version = models.PositiveIntegerField(default=1)
    source_item = models.ForeignKey("self", on_delete=models.SET_NULL, null=True, blank=True)
    match_source = models.CharField(
        max_length=16, choices=MatchSource.choices, default=MatchSource.UNMATCHED
    )

    material_markup = models.JSONField(null=True, blank=True)
    work_markup = models.JSONField(null=True, blank=True)
    tech_specs = models.JSONField(default=dict, blank=True)
    custom_data = models.JSONField(default=dict, blank=True)

    is_deleted = models.BooleanField(default=False)
    is_key_equipment = models.BooleanField(default=False)
    procurement_status = models.CharField(
        max_length=16, choices=ProcurementStatus.choices, default=ProcurementStatus.NONE
    )
    man_hours = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = EstimateItemManager()
    all_objects = EstimateItemAllManager()

    class Meta:
        db_table = "estimate_item"
        ordering = ["sort_order"]
        # Managed=False: таблица создаётся через RunSQL с HASH partitioning (ADR-0021).
        managed = False

    def __str__(self) -> str:
        return f"{self.name} ({self.unit} × {self.quantity})"

    def clean(self) -> None:
        super().clean()
        if self.material_markup:
            MarkupConfig.model_validate(self.material_markup)
        if self.work_markup:
            MarkupConfig.model_validate(self.work_markup)
        if self.tech_specs:
            TechSpecs.model_validate(self.tech_specs)
