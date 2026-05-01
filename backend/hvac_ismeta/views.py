"""API для настроек публичного сайта ISMeta.

Endpoints:
  GET  /api/v1/hvac/ismeta/settings/   — текущие настройки (создаёт pk=1 если нет)
  PUT  /api/v1/hvac/ismeta/settings/   — обновление (admin only)
  PATCH /api/v1/hvac/ismeta/settings/  — частичное обновление (admin only)
"""

from rest_framework import generics
from rest_framework.permissions import IsAdminUser, IsAuthenticated

from .models import HvacIsmetaSettings
from .serializers import HvacIsmetaSettingsSerializer


class HvacIsmetaSettingsView(generics.RetrieveUpdateAPIView):
    serializer_class = HvacIsmetaSettingsSerializer

    def get_permissions(self):
        if self.request.method in ("PUT", "PATCH"):
            return [IsAuthenticated(), IsAdminUser()]
        return [IsAuthenticated()]

    def get_object(self) -> HvacIsmetaSettings:
        return HvacIsmetaSettings.get_settings()
