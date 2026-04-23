from __future__ import annotations

from django.contrib import admin, messages

from ..models import Criterion

KEY_MEASUREMENT_NOTE = (
    "⚠️ Заметка про «Ключевой замер» (is_key_measurement): "
    "флаг применяется на фронте ТОЛЬКО для критериев, включённых в активную "
    "методологию (MethodologyVersion.is_active=True + "
    "MethodologyCriterion.is_active=True). Сейчас активна методология v1.0. "
    "Если помеченный критерий не показывается на детальной странице модели — "
    "проверь что он включён в v1.0 через раздел «Методологии»."
)


@admin.register(Criterion)
class CriterionAdmin(admin.ModelAdmin):
    """Справочник параметров (standalone).

    См. KEY_MEASUREMENT_NOTE про связку is_key_measurement ↔ активная методология.
    """

    list_display = (
        "code", "name_ru", "unit", "value_type", "group",
        "is_active", "is_key_measurement",
    )
    list_editable = ("is_key_measurement",)
    list_filter = ("value_type", "group", "is_active", "is_key_measurement")
    search_fields = ("code", "name_ru", "name_en")
    list_per_page = 50
    ordering = ("code",)
    fieldsets = (
        ("Основное", {
            "fields": ("code", "name_ru", "name_en", "name_de", "name_pt", "unit", "photo"),
        }),
        ("Описание", {
            "classes": ("collapse",),
            "fields": (
                "description_ru", "description_en", "description_de", "description_pt",
            ),
        }),
        ("Тип и статус", {
            "description": KEY_MEASUREMENT_NOTE,
            "fields": ("value_type", "group", "is_active", "is_key_measurement"),
        }),
    )

    def changelist_view(self, request, extra_context=None):
        messages.info(request, KEY_MEASUREMENT_NOTE)
        return super().changelist_view(request, extra_context=extra_context)
