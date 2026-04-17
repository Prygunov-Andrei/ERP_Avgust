"""Тесты webhook receiver (E17)."""

import uuid

import pytest
from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APIClient

from apps.estimate.models import Estimate, SnapshotTransmission, TransmissionStatus
from apps.integration.models import ProcessedEvent
from apps.workspace.models import Workspace

User = get_user_model()

WEBHOOK_SECRET = "test-webhook-secret"
WS_HEADER = "HTTP_X_WORKSPACE_ID"


@pytest.fixture()
def client():
    return APIClient()


@pytest.fixture()
def ws():
    return Workspace.objects.create(name="WS-WH", slug="ws-wh")


@pytest.fixture()
def user():
    return User.objects.create_user(username="wh-user", password="pass")


@pytest.fixture()
def estimate(ws, user):
    return Estimate.objects.create(workspace=ws, name="Webhook test", status="ready", created_by=user)


def _webhook_headers(event_type: str, event_id: str | None = None) -> dict:
    return {
        "HTTP_X_WEBHOOK_SECRET": WEBHOOK_SECRET,
        "HTTP_X_WEBHOOK_EVENT_ID": event_id or str(uuid.uuid4()),
        "HTTP_X_WEBHOOK_EVENT_TYPE": event_type,
    }


@pytest.mark.django_db
class TestWebhookReceiver:
    @pytest.fixture(autouse=True)
    def _set_secret(self, settings):
        settings.ISMETA_ERP_WEBHOOK_SECRET = WEBHOOK_SECRET
    def test_product_updated(self, client):
        resp = client.post(
            "/api/v1/webhooks/erp/",
            {"id": "prod-1", "name": "Вентилятор", "workspace_id": str(uuid.uuid4())},
            format="json",
            **_webhook_headers("product.updated"),
        )
        assert resp.status_code == 200
        assert resp.data["status"] == "processed"
        assert ProcessedEvent.objects.count() == 1

    def test_contract_signed(self, client, estimate, ws):
        resp = client.post(
            "/api/v1/webhooks/erp/",
            {
                "ismeta_version_id": str(estimate.id),
                "contract_id": "c-123",
                "workspace_id": str(ws.id),
            },
            format="json",
            **_webhook_headers("contract.signed"),
        )
        assert resp.status_code == 200
        estimate.refresh_from_db()
        assert estimate.status == "transmitted"

    def test_pricelist_updated(self, client):
        resp = client.post(
            "/api/v1/webhooks/erp/",
            {"pricelist_id": "pl-1", "workspace_id": str(uuid.uuid4())},
            format="json",
            **_webhook_headers("pricelist.updated"),
        )
        assert resp.status_code == 200
        assert resp.data["status"] == "processed"

    def test_idempotency_duplicate(self, client):
        event_id = str(uuid.uuid4())
        headers = _webhook_headers("product.updated", event_id=event_id)

        client.post("/api/v1/webhooks/erp/", {"name": "test"}, format="json", **headers)
        resp2 = client.post("/api/v1/webhooks/erp/", {"name": "test"}, format="json", **headers)
        assert resp2.status_code == 200
        assert resp2.data["status"] == "already_processed"
        assert ProcessedEvent.objects.count() == 1

    def test_invalid_secret_401(self, client):
        resp = client.post(
            "/api/v1/webhooks/erp/",
            {"name": "test"},
            format="json",
            HTTP_X_WEBHOOK_SECRET="wrong",
            HTTP_X_WEBHOOK_EVENT_ID=str(uuid.uuid4()),
            HTTP_X_WEBHOOK_EVENT_TYPE="product.updated",
        )
        assert resp.status_code == 401

    def test_missing_secret_401(self, client):
        resp = client.post(
            "/api/v1/webhooks/erp/",
            {"name": "test"},
            format="json",
            HTTP_X_WEBHOOK_EVENT_ID=str(uuid.uuid4()),
            HTTP_X_WEBHOOK_EVENT_TYPE="product.updated",
        )
        assert resp.status_code == 401

    def test_missing_event_headers_400(self, client):
        resp = client.post(
            "/api/v1/webhooks/erp/",
            {"name": "test"},
            format="json",
            HTTP_X_WEBHOOK_SECRET=WEBHOOK_SECRET,
        )
        assert resp.status_code == 400

    def test_unknown_event_type(self, client):
        resp = client.post(
            "/api/v1/webhooks/erp/",
            {"data": "test"},
            format="json",
            **_webhook_headers("unknown.event"),
        )
        assert resp.status_code == 200
        assert resp.data["status"] == "unknown_event_type"
        assert ProcessedEvent.objects.count() == 1
