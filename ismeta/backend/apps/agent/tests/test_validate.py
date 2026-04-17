"""Тесты validate endpoint (E8.1)."""

import json
import uuid

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.estimate.matching.knowledge import ProductKnowledge
from apps.estimate.models import Estimate, EstimateSection
from apps.estimate.services.estimate_service import EstimateService
from apps.llm.models import LLMUsage
from apps.llm.providers.mock_provider import MockProvider
from apps.workspace.models import Workspace

User = get_user_model()

WS_HEADER = "HTTP_X_WORKSPACE_ID"

MOCK_VALIDATE_RESPONSE = json.dumps({
    "issues": [
        {
            "item_name": "Кабель UTP",
            "severity": "warning",
            "category": "price_outlier",
            "message": "Цена 500₽ за м выше рынка (~150₽)",
            "suggestion": "Актуальная цена ~150₽/м",
        }
    ],
    "summary": "Найдена 1 ценовая аномалия",
})


@pytest.fixture()
def ws():
    return Workspace.objects.create(name="WS-Agent", slug="ws-agent")


@pytest.fixture()
def user():
    return User.objects.create_user(username="agent-user", password="pass")


@pytest.fixture()
def client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@pytest.fixture()
def estimate(ws, user):
    return Estimate.objects.create(
        workspace=ws, name="Тест валидации",
        default_material_markup={"type": "percent", "value": 30},
        default_work_markup={"type": "percent", "value": 300},
        created_by=user,
    )


@pytest.fixture()
def section(estimate, ws):
    return EstimateSection.objects.create(
        estimate=estimate, workspace=ws, name="Вентиляция", sort_order=1,
    )


@pytest.fixture()
def items(section, estimate, ws):
    created = []
    for name, price in [("Кабель UTP", 500), ("Вентилятор", 85000)]:
        item = EstimateService.create_item(section, estimate, ws.id, {
            "name": name, "unit": "шт", "quantity": 1, "material_price": price,
        })
        created.append(item)
    return created


@pytest.mark.django_db
class TestValidateEndpoint:
    @pytest.fixture(autouse=True)
    def _mock_llm(self, settings):
        settings.ISMETA_LLM_MODE = "mock"

    def test_validate_returns_issues(self, client, estimate, items, ws, monkeypatch):
        mock = MockProvider(content=MOCK_VALIDATE_RESPONSE)
        monkeypatch.setattr("apps.llm.service._get_provider", lambda _: mock)

        resp = client.post(
            f"/api/v1/estimates/{estimate.id}/validate/",
            **{WS_HEADER: str(ws.id)},
        )
        assert resp.status_code == 200
        assert "issues" in resp.data
        assert len(resp.data["issues"]) == 1
        assert resp.data["issues"][0]["category"] == "price_outlier"
        assert resp.data["summary"] == "Найдена 1 ценовая аномалия"

    def test_validate_bad_json_graceful(self, client, estimate, items, ws, monkeypatch):
        mock = MockProvider(content="Not JSON at all")
        monkeypatch.setattr("apps.llm.service._get_provider", lambda _: mock)

        resp = client.post(
            f"/api/v1/estimates/{estimate.id}/validate/",
            **{WS_HEADER: str(ws.id)},
        )
        assert resp.status_code == 200
        assert resp.data["issues"] == []
        assert "Не удалось" in resp.data["summary"]

    def test_validate_records_llm_usage(self, client, estimate, items, ws):
        resp = client.post(
            f"/api/v1/estimates/{estimate.id}/validate/",
            **{WS_HEADER: str(ws.id)},
        )
        assert resp.status_code == 200
        assert LLMUsage.objects.filter(
            workspace_id=ws.id, task_type="validation"
        ).exists()
