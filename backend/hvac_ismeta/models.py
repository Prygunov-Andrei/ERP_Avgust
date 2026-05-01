"""hvac_ismeta — модели публичного сайта ISMeta.

* HvacIsmetaSettings — singleton настроек.
* IsmetaJob — async job обработки PDF.
* IsmetaFeedback — пользовательский feedback по конкретному job.

Поле default_llm_profile_id — soft-FK на llm_profile в ismeta-postgres
(валидация остаётся за UI/recognition сервисом, кросс-БД FK не делаем).
"""

import uuid

from django.db import models


class PipelineChoice(models.TextChoices):
    MAIN = "main", "Main (DeepSeek)"
    TD17G = "td17g", "TD-17g (Docling+Camelot+Vision hybrid)"


class HvacIsmetaSettings(models.Model):
    enabled = models.BooleanField(
        default=True,
        help_text="Включить публичный сайт ISMeta. False → пользователи видят 'Сервис временно недоступен'.",
    )
    default_pipeline = models.CharField(
        max_length=20,
        choices=PipelineChoice.choices,
        default=PipelineChoice.TD17G,
        help_text="Дефолтный движок распознавания.",
    )
    default_llm_profile_id = models.IntegerField(
        null=True,
        blank=True,
        help_text="Soft-FK на llm_profile.id в ismeta-postgres (валидация на стороне UI).",
    )
    concurrency_limit_enabled = models.BooleanField(
        default=True,
        help_text="Ограничить 1 PDF одновременно с одной сессии.",
    )
    pdf_storage_path = models.CharField(
        max_length=500,
        default="/storage/ismeta-uploads/",
        help_text="Куда сервер копирует загруженные PDF.",
    )
    require_registration = models.BooleanField(
        default=False,
        help_text="Требовать регистрацию для доступа.",
    )
    max_file_size_mb = models.IntegerField(
        default=50,
        help_text="Лимит на размер PDF.",
    )
    feedback_email = models.EmailField(
        default="andrei@aug-clim.ru",
        help_text="Адрес для feedback из формы внизу страницы.",
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "hvac_ismeta_settings"
        verbose_name = "Настройки публичного ISMeta"
        verbose_name_plural = "Настройки публичного ISMeta"
        constraints = [
            models.CheckConstraint(
                check=models.Q(pk=1),
                name="hvac_ismeta_settings_singleton",
            ),
        ]

    def __str__(self) -> str:
        state = "включено" if self.enabled else "выключено"
        return f"ISMeta settings ({state}, pipeline={self.default_pipeline})"

    @classmethod
    def get_settings(cls) -> "HvacIsmetaSettings":
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class IsmetaJob(models.Model):
    STATUS_QUEUED = "queued"
    STATUS_PROCESSING = "processing"
    STATUS_DONE = "done"
    STATUS_ERROR = "error"
    STATUS_CANCELLED = "cancelled"

    STATUS_CHOICES = [
        (STATUS_QUEUED, "В очереди"),
        (STATUS_PROCESSING, "Обработка"),
        (STATUS_DONE, "Готово"),
        (STATUS_ERROR, "Ошибка"),
        (STATUS_CANCELLED, "Отменено"),
    ]
    ACTIVE_STATUSES = (STATUS_QUEUED, STATUS_PROCESSING)

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session_key = models.CharField(max_length=64, db_index=True)
    ip_address = models.GenericIPAddressField(db_index=True)
    user_agent = models.TextField(blank=True)
    pdf_filename = models.CharField(max_length=255)
    pdf_storage_path = models.CharField(max_length=500)
    pdf_size_bytes = models.BigIntegerField()
    pipeline = models.CharField(max_length=20)
    llm_profile_id = models.IntegerField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_QUEUED)
    pages_total = models.IntegerField(default=0)
    pages_processed = models.IntegerField(default=0)
    items_count = models.IntegerField(default=0)
    result_json = models.JSONField(null=True, blank=True)
    error_message = models.TextField(blank=True)
    cost_usd = models.DecimalField(max_digits=10, decimal_places=4, default=0)
    feedback_email = models.EmailField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "hvac_ismeta_job"
        verbose_name = "ISMeta job"
        verbose_name_plural = "ISMeta jobs"
        indexes = [
            models.Index(fields=["session_key", "status"], name="ismeta_job_session_status"),
            models.Index(fields=["created_at"], name="ismeta_job_created_at_idx"),
        ]

    def __str__(self) -> str:
        return f"IsmetaJob({self.id}, {self.status}, {self.pdf_filename})"


class IsmetaFeedback(models.Model):
    job = models.ForeignKey(
        IsmetaJob,
        on_delete=models.CASCADE,
        related_name="feedbacks",
        null=True,
        blank=True,
    )
    helpful = models.BooleanField()
    comment = models.TextField(blank=True)
    contact_email = models.EmailField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "hvac_ismeta_feedback"
        verbose_name = "ISMeta feedback"
        verbose_name_plural = "ISMeta feedback"

    def __str__(self) -> str:
        verdict = "помогло" if self.helpful else "не помогло"
        return f"IsmetaFeedback({verdict}, job={self.job_id})"
