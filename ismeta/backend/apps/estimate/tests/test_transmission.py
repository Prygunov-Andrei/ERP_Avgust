"""Тесты E18: snapshot transmission ISMeta → ERP."""

import uuid
from decimal import Decimal
from unittest.mock import MagicMock, patch

import httpx
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.estimate.models import (
    Estimate,
    EstimateSection,
    SnapshotTransmission,
    TransmissionStatus,
)
from apps.estimate.services.estimate_service import EstimateService
from apps.estimate.services.snapshot_builder import build_snapshot
from apps.estimate.services.transmission_service import (
    AlreadyTransmittedError,
    TransmissionService,
)
from apps.workspace.models import Workspace

User = get_user_model()


@pytest.fixture()
def ws():
    return Workspace.objects.create(name="WS-Trans", slug="ws-trans")


@pytest.fixture()
def user():
    return User.objects.create_user(username="trans-user", password="pass")


@pytest.fixture()
def estimate(ws, user):
    return Estimate.objects.create(
        workspace=ws, name="Тестовая смета", status="ready",
        default_material_markup={"type": "percent", "value": 30},
        default_work_markup={"type": "percent", "value": 300},
        created_by=user,
    )


@pytest.fixture()
def section(estimate, ws):
    return EstimateSection.objects.create(
        estimate=estimate, workspace=ws, name="Вентиляция", sort_order=1
    )


@pytest.fixture()
def items(section, estimate, ws):
    created = []
    for name in ["Вентилятор", "Кабель UTP"]:
        item = EstimateService.create_item(section, estimate, ws.id, {
            "name": name, "unit": "шт", "quantity": 2,
            "equipment_price": 100, "material_price": 200, "work_price": 50,
        })
        created.append(item)
    return created


def _mock_httpx_success():
    """Mock httpx.Client.post → 201 Created."""
    mock_resp = MagicMock()
    mock_resp.status_code = 201
    mock_resp.json.return_value = {"erp_contract_estimate_id": "ce-123", "created": True}

    mock_client = MagicMock()
    mock_client.__enter__ = MagicMock(return_value=mock_client)
    mock_client.__exit__ = MagicMock(return_value=False)
    mock_client.post.return_value = mock_resp
    return mock_client


@pytest.mark.django_db
class TestBuildSnapshot:
    def test_build_snapshot_format(self, estimate, section, items, ws):
        payload = build_snapshot(str(estimate.id), str(ws.id))
        assert payload["ismeta_version_id"] == str(estimate.id)
        assert payload["workspace_id"] == str(ws.id)
        assert payload["estimate"]["name"] == "Тестовая смета"
        assert len(payload["sections"]) == 1
        assert len(payload["sections"][0]["items"]) == 2


@pytest.mark.django_db
class TestTransmissionService:
    @patch("apps.estimate.services.transmission_service.httpx.Client")
    def test_transmit_success(self, mock_client_cls, estimate, section, items, ws):
        mock_client_cls.return_value = _mock_httpx_success()
        t = TransmissionService.transmit(str(estimate.id), str(ws.id))
        assert t.status == TransmissionStatus.SUCCESS
        assert t.attempts == 1
        estimate.refresh_from_db()
        assert estimate.status == "transmitted"

    @patch("apps.estimate.services.transmission_service.httpx.Client")
    def test_transmit_409_idempotent(self, mock_client_cls, estimate, section, items, ws):
        mock_resp = MagicMock()
        mock_resp.status_code = 409
        mock_resp.json.return_value = {"created": False}
        mock_client = MagicMock()
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client.post.return_value = mock_resp
        mock_client_cls.return_value = mock_client

        t = TransmissionService.transmit(str(estimate.id), str(ws.id))
        assert t.status == TransmissionStatus.SUCCESS

    @patch("apps.estimate.services.transmission_service.httpx.Client")
    def test_already_transmitted_403(self, mock_client_cls, estimate, section, items, ws):
        mock_client_cls.return_value = _mock_httpx_success()
        TransmissionService.transmit(str(estimate.id), str(ws.id))
        estimate.refresh_from_db()
        assert estimate.status == "transmitted"

        with pytest.raises(AlreadyTransmittedError):
            TransmissionService.transmit(str(estimate.id), str(ws.id))

    @patch("apps.estimate.services.transmission_service.httpx.Client")
    def test_httpx_error_sets_failed(self, mock_client_cls, estimate, section, items, ws):
        mock_resp = MagicMock(spec=httpx.Response)
        mock_resp.status_code = 500
        mock_resp.text = "Internal Server Error"
        mock_resp.raise_for_status.side_effect = httpx.HTTPStatusError(
            "500", request=MagicMock(), response=mock_resp
        )
        mock_client = MagicMock()
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client.post.return_value = mock_resp
        mock_client_cls.return_value = mock_client

        t = TransmissionService.transmit(str(estimate.id), str(ws.id))
        assert t.status in (TransmissionStatus.FAILED, TransmissionStatus.RETRYING)
        assert "500" in t.error_message

    @patch("apps.estimate.services.transmission_service.httpx.Client")
    def test_max_attempts_exceeded(self, mock_client_cls, estimate, section, items, ws):
        mock_resp = MagicMock(spec=httpx.Response)
        mock_resp.status_code = 503
        mock_resp.text = "Service Unavailable"
        mock_resp.raise_for_status.side_effect = httpx.HTTPStatusError(
            "503", request=MagicMock(), response=mock_resp
        )
        mock_client = MagicMock()
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client.post.return_value = mock_resp
        mock_client_cls.return_value = mock_client

        # Первая попытка
        t = TransmissionService.transmit(str(estimate.id), str(ws.id))
        assert t.status == TransmissionStatus.RETRYING

        # Ещё 2 retry → max exceeded
        for _ in range(2):
            TransmissionService._send(t)
        t.refresh_from_db()
        assert t.status == TransmissionStatus.FAILED
        assert t.attempts == 3


@pytest.mark.django_db
class TestTransmissionAPI:
    @patch("apps.estimate.services.transmission_service.httpx.Client")
    def test_transmit_endpoint(self, mock_client_cls, estimate, section, items, ws, user):
        mock_client_cls.return_value = _mock_httpx_success()
        client = APIClient()
        client.force_authenticate(user=user)
        resp = client.post(
            f"/api/v1/estimates/{estimate.id}/transmit/",
            HTTP_X_WORKSPACE_ID=str(ws.id),
        )
        assert resp.status_code == 200
        assert resp.data["status"] == "success"

    @patch("apps.estimate.services.transmission_service.httpx.Client")
    def test_list_transmissions(self, mock_client_cls, estimate, section, items, ws, user):
        mock_client_cls.return_value = _mock_httpx_success()
        TransmissionService.transmit(str(estimate.id), str(ws.id))

        client = APIClient()
        client.force_authenticate(user=user)
        resp = client.get(
            f"/api/v1/estimates/{estimate.id}/transmissions/",
            HTTP_X_WORKSPACE_ID=str(ws.id),
        )
        assert resp.status_code == 200
        assert len(resp.data) == 1
        assert resp.data[0]["status"] == "success"
