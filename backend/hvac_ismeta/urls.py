from django.urls import path

from .views import HvacIsmetaSettingsView

urlpatterns = [
    path("settings/", HvacIsmetaSettingsView.as_view(), name="hvac-ismeta-settings"),
]
