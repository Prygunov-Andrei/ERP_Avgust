"""URL-конфиг ERP integration (E13 + E17)."""

from django.urls import path

from . import views

urlpatterns = [
    path("webhooks/erp/", views.webhook_receiver, name="webhook-erp"),
]
