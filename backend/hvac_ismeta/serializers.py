from rest_framework import serializers

from .models import HvacIsmetaSettings


class HvacIsmetaSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = HvacIsmetaSettings
        fields = (
            "id",
            "enabled",
            "default_pipeline",
            "default_llm_profile_id",
            "concurrency_limit_enabled",
            "hourly_per_session",
            "hourly_per_ip",
            "daily_per_ip",
            "pdf_storage_path",
            "require_registration",
            "max_file_size_mb",
            "feedback_email",
            "updated_at",
        )
        read_only_fields = ("id", "updated_at")
