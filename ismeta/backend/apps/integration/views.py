"""Webhook receiver — POST /api/v1/webhooks/erp/."""

import logging

from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import ProcessedEvent
from .webhook_handlers import SUPPORTED_EVENTS

logger = logging.getLogger(__name__)


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def webhook_receiver(request):
    """POST /api/v1/webhooks/erp/ — приём событий от ERP."""
    # Verify webhook secret
    secret = request.META.get("HTTP_X_WEBHOOK_SECRET", "")
    expected = getattr(settings, "ISMETA_ERP_WEBHOOK_SECRET", "")
    if not expected or secret != expected:
        return Response({"detail": "Invalid webhook secret"}, status=status.HTTP_401_UNAUTHORIZED)

    event_id = request.META.get("HTTP_X_WEBHOOK_EVENT_ID", "")
    event_type = request.META.get("HTTP_X_WEBHOOK_EVENT_TYPE", "")

    if not event_id or not event_type:
        return Response(
            {"detail": "X-Webhook-Event-Id and X-Webhook-Event-Type required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Idempotency: дедупликация по event_id
    if ProcessedEvent.objects.filter(event_id=event_id).exists():
        return Response({"status": "already_processed"}, status=status.HTTP_200_OK)

    handler = SUPPORTED_EVENTS.get(event_type)
    if not handler:
        logger.warning("Unknown webhook event_type: %s", event_type)
        # Сохраняем как обработанный чтобы не ретрайить
        ProcessedEvent.objects.create(event_id=event_id, event_type=event_type)
        return Response({"status": "unknown_event_type"}, status=status.HTTP_200_OK)

    payload = request.data
    workspace_id = payload.get("workspace_id")

    handler(payload, workspace_id)

    ProcessedEvent.objects.create(
        event_id=event_id, event_type=event_type, workspace_id=workspace_id,
    )

    return Response({"status": "processed"}, status=status.HTTP_200_OK)
