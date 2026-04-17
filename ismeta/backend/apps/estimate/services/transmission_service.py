"""TransmissionService — отправка snapshot'а в ERP (ADR-0007, ADR-0014)."""

import logging
from datetime import timedelta

import httpx
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.estimate.models import Estimate, SnapshotTransmission, TransmissionStatus

from .snapshot_builder import build_snapshot

logger = logging.getLogger(__name__)


class TransmissionError(Exception):
    pass


class AlreadyTransmittedError(Exception):
    pass


class TransmissionService:
    @staticmethod
    def transmit(estimate_id, workspace_id) -> SnapshotTransmission:
        """Создать transmission + отправить в ERP.

        select_for_update на estimate предотвращает race condition
        при двух одновременных вызовах transmit().
        """
        with transaction.atomic():
            estimate = (
                Estimate.objects.select_for_update()
                .get(id=estimate_id, workspace_id=workspace_id)
            )

            # ADR-0007: нельзя повторно передать уже переданную смету
            if estimate.status == "transmitted":
                existing = SnapshotTransmission.objects.filter(
                    estimate=estimate, status=TransmissionStatus.SUCCESS
                ).first()
                if existing:
                    raise AlreadyTransmittedError(
                        f"Estimate {estimate_id} already transmitted (transmission {existing.id})"
                    )

            # Идемпотентность: если есть pending/sending/retrying — вернуть его
            active = SnapshotTransmission.objects.filter(
                estimate=estimate,
                status__in=[TransmissionStatus.PENDING, TransmissionStatus.SENDING, TransmissionStatus.RETRYING],
            ).first()
            if active:
                return active

            payload = build_snapshot(estimate_id, workspace_id)
            transmission = SnapshotTransmission.objects.create(
                estimate=estimate,
                workspace_id=workspace_id,
                payload=payload,
                status=TransmissionStatus.SENDING,
            )

        # _send() вне транзакции — HTTP запрос не должен держать row lock
        TransmissionService._send(transmission)
        return transmission

    @staticmethod
    def _send(transmission: SnapshotTransmission):
        """HTTP POST в ERP. Обновляет transmission status."""
        erp_url = getattr(settings, "ISMETA_ERP_BASE_URL", "http://localhost:8000")
        master_token = getattr(settings, "ISMETA_ERP_MASTER_TOKEN", "")
        url = f"{erp_url}/api/v1/ismeta/snapshots/"

        transmission.attempts += 1
        transmission.save(update_fields=["attempts"])

        try:
            with httpx.Client(timeout=30.0) as client:
                resp = client.post(
                    url,
                    json=transmission.payload,
                    headers={
                        "Authorization": f"Bearer {master_token}",
                        "Idempotency-Key": str(transmission.idempotency_key),
                        "Content-Type": "application/json",
                    },
                )

            if resp.status_code in (200, 201):
                transmission.status = TransmissionStatus.SUCCESS
                transmission.response_data = resp.json()
                transmission.sent_at = timezone.now()
                transmission.save(update_fields=["status", "response_data", "sent_at"])

                # ADR-0007: estimate → transmitted (read-only)
                Estimate.objects.filter(id=transmission.estimate_id).update(status="transmitted")
                return

            if resp.status_code == 409:
                # Уже принят — идемпотентно ок
                transmission.status = TransmissionStatus.SUCCESS
                transmission.response_data = resp.json()
                transmission.sent_at = timezone.now()
                transmission.save(update_fields=["status", "response_data", "sent_at"])
                Estimate.objects.filter(id=transmission.estimate_id).update(status="transmitted")
                return

            # Другие ошибки
            resp.raise_for_status()

        except httpx.HTTPStatusError as e:
            body = ""
            try:
                body = e.response.text[:500]
            except (AttributeError, UnicodeDecodeError):
                body = "(response body unreadable)"
            error_msg = f"HTTP {e.response.status_code}: {body}"
            logger.warning("Transmission %s failed: %s", transmission.id, error_msg)
            TransmissionService._handle_failure(transmission, error_msg)

        except httpx.TimeoutException as e:
            error_msg = f"Timeout: {e}"
            logger.warning("Transmission %s timeout: %s", transmission.id, error_msg)
            TransmissionService._handle_failure(transmission, error_msg)

        except httpx.ConnectError as e:
            error_msg = f"Connection error: {e}"
            logger.warning("Transmission %s connect error: %s", transmission.id, error_msg)
            TransmissionService._handle_failure(transmission, error_msg)

    @staticmethod
    def _handle_failure(transmission: SnapshotTransmission, error_msg: str):
        """Обработать ошибку: retry или failed."""
        transmission.error_message = error_msg
        if transmission.attempts < transmission.max_attempts:
            transmission.status = TransmissionStatus.RETRYING
            transmission.next_retry_at = timezone.now() + timedelta(seconds=60 * transmission.attempts)
        else:
            transmission.status = TransmissionStatus.FAILED
        transmission.save(update_fields=["status", "error_message", "next_retry_at"])

    @staticmethod
    def retry_pending():
        """Retry all retrying transmissions where next_retry_at <= now."""
        now = timezone.now()
        pending = SnapshotTransmission.objects.filter(
            status=TransmissionStatus.RETRYING,
            next_retry_at__lte=now,
        )
        for transmission in pending:
            logger.info("Retrying transmission %s (attempt %d)", transmission.id, transmission.attempts + 1)
            TransmissionService._send(transmission)
