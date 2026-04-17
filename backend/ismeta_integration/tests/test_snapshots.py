"""Тесты E12: приём snapshot'ов из ISMeta."""

import uuid

import pytest
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from ismeta_integration.models import IsmetaSnapshot

MASTER_TOKEN = "test-master-token"
AUTH_HEADER = f"Bearer {MASTER_TOKEN}"

SAMPLE_PAYLOAD = {
    "ismeta_version_id": str(uuid.uuid4()),
    "workspace_id": str(uuid.uuid4()),
    "estimate": {"name": "Тестовая смета", "number": "СМ-001"},
    "sections": [{"name": "Вентиляция", "items": [{"name": "Вентилятор"}]}],
}


@override_settings(ISMETA_MASTER_TOKEN=MASTER_TOKEN)
class TestSnapshotReceiver(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_create_snapshot(self):
        idem_key = str(uuid.uuid4())
        resp = self.client.post(
            "/api/v1/ismeta/snapshots/",
            SAMPLE_PAYLOAD,
            format="json",
            HTTP_AUTHORIZATION=AUTH_HEADER,
            HTTP_IDEMPOTENCY_KEY=idem_key,
        )
        assert resp.status_code == 201
        assert resp.data["created"] is True
        assert resp.data["status"] == "received"
        assert IsmetaSnapshot.objects.count() == 1

    def test_idempotency_409(self):
        idem_key = str(uuid.uuid4())
        self.client.post(
            "/api/v1/ismeta/snapshots/",
            SAMPLE_PAYLOAD,
            format="json",
            HTTP_AUTHORIZATION=AUTH_HEADER,
            HTTP_IDEMPOTENCY_KEY=idem_key,
        )
        resp2 = self.client.post(
            "/api/v1/ismeta/snapshots/",
            SAMPLE_PAYLOAD,
            format="json",
            HTTP_AUTHORIZATION=AUTH_HEADER,
            HTTP_IDEMPOTENCY_KEY=idem_key,
        )
        assert resp2.status_code == 409
        assert resp2.data["created"] is False
        assert IsmetaSnapshot.objects.count() == 1

    def test_invalid_payload_422(self):
        resp = self.client.post(
            "/api/v1/ismeta/snapshots/",
            {"bad": "data"},
            format="json",
            HTTP_AUTHORIZATION=AUTH_HEADER,
            HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4()),
        )
        assert resp.status_code == 400

    def test_missing_auth_401(self):
        resp = self.client.post(
            "/api/v1/ismeta/snapshots/",
            SAMPLE_PAYLOAD,
            format="json",
            HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4()),
        )
        assert resp.status_code == 401

    def test_wrong_token_401(self):
        resp = self.client.post(
            "/api/v1/ismeta/snapshots/",
            SAMPLE_PAYLOAD,
            format="json",
            HTTP_AUTHORIZATION="Bearer wrong-token",
            HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4()),
        )
        assert resp.status_code == 401

    def test_list_snapshots(self):
        for _ in range(3):
            self.client.post(
                "/api/v1/ismeta/snapshots/",
                SAMPLE_PAYLOAD,
                format="json",
                HTTP_AUTHORIZATION=AUTH_HEADER,
                HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4()),
            )
        resp = self.client.get(
            "/api/v1/ismeta/snapshots/list/",
            HTTP_AUTHORIZATION=AUTH_HEADER,
        )
        assert resp.status_code == 200
        assert len(resp.data) == 3
