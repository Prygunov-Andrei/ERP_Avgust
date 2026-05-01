"""HvacIsmetaSettings — singleton настроек публичного сайта ISMeta на hvac-info.com.

Запись всегда одна (pk=1), CheckConstraint предотвращает создание других строк.
Поле default_llm_profile_id — soft-FK на llm_profile в ismeta-postgres
(валидация остаётся за UI/recognition сервисом, кросс-БД FK не делаем).
"""

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
