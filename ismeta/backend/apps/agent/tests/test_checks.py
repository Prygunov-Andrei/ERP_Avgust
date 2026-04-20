"""Тесты pre-checks + combined validate (E29)."""

import json
from decimal import Decimal
from unittest.mock import MagicMock

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.agent.checks import run_pre_checks
from apps.estimate.models import Estimate, EstimateSection
from apps.estimate.services.estimate_service import EstimateService
from apps.llm.providers.mock_provider import MockProvider
from apps.workspace.models import Workspace

User = get_user_model()

WS_HEADER = "HTTP_X_WORKSPACE_ID"


@pytest.fixture()
def ws():
    return Workspace.objects.create(name="WS-Checks", slug="ws-checks")


@pytest.fixture()
def user():
    return User.objects.create_user(username="checks-user", password="pass")


@pytest.fixture()
def client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@pytest.fixture()
def estimate(ws, user):
    return Estimate.objects.create(
        workspace=ws, name="Checks test",
        default_material_markup={"type": "percent", "value": 30},
        default_work_markup={"type": "percent", "value": 300},
        created_by=user,
    )


@pytest.fixture()
def section(estimate, ws):
    return EstimateSection.objects.create(
        estimate=estimate, workspace=ws, name="Тест", sort_order=1,
    )


@pytest.mark.django_db
class TestPreCheckZeroPrices:
    def test_all_prices_zero(self, section, estimate, ws):
        item = EstimateService.create_item(section, estimate, ws.id, {
            "name": "Пустая позиция", "unit": "шт", "quantity": 1,
            "equipment_price": 0, "material_price": 0, "work_price": 0,
        })
        items = list(estimate.items.all())
        issues = run_pre_checks(items)
        zero_issues = [i for i in issues if i["category"] == "price_outlier" and "Все цены = 0" in i["message"]]
        assert len(zero_issues) == 1

    def test_normal_prices_no_issue(self, section, estimate, ws):
        EstimateService.create_item(section, estimate, ws.id, {
            "name": "Вентилятор", "unit": "шт", "quantity": 2,
            "equipment_price": 85000, "material_price": 0, "work_price": 12000,
        })
        items = list(estimate.items.all())
        issues = run_pre_checks(items)
        zero_issues = [i for i in issues if "Все цены = 0" in i.get("message", "")]
        assert len(zero_issues) == 0


@pytest.mark.django_db
class TestPreCheckUnmatched:
    def test_unmatched_work(self, section, estimate, ws):
        # По умолчанию match_source="unmatched", work_price=0
        EstimateService.create_item(section, estimate, ws.id, {
            "name": "Кабель без работы", "unit": "м", "quantity": 100,
            "material_price": 150,
        })
        items = list(estimate.items.all())
        issues = run_pre_checks(items)
        unmatched = [i for i in issues if i["category"] == "missing_work"]
        assert len(unmatched) == 1


@pytest.mark.django_db
class TestPreCheckDuplicates:
    def test_duplicate_names(self, section, estimate, ws):
        for _ in range(3):
            EstimateService.create_item(section, estimate, ws.id, {
                "name": "Кабель UTP", "unit": "м", "quantity": 100,
                "material_price": 150,
            })
        items = list(estimate.items.all())
        issues = run_pre_checks(items)
        dups = [i for i in issues if i["category"] == "duplicate"]
        assert len(dups) == 1
        assert "3 раз" in dups[0]["message"]


@pytest.mark.django_db
class TestPreCheckUnitError:
    def test_vozdukhovod_sht(self, section, estimate, ws):
        EstimateService.create_item(section, estimate, ws.id, {
            "name": "Воздуховод прямоугольный 300x300", "unit": "шт", "quantity": 10,
            "material_price": 920,
        })
        items = list(estimate.items.all())
        issues = run_pre_checks(items)
        unit_issues = [i for i in issues if i["category"] == "unit_error"]
        assert len(unit_issues) == 1


@pytest.mark.django_db
class TestCombinedValidate:
    @pytest.fixture(autouse=True)
    def _mock_llm(self, settings):
        settings.ISMETA_LLM_MODE = "mock"

    def test_pre_checks_plus_llm(self, client, estimate, section, ws, monkeypatch):
        # Создаём позицию с проблемой (нулевые цены)
        EstimateService.create_item(section, estimate, ws.id, {
            "name": "Пустая", "unit": "шт", "quantity": 1,
        })
        # Мокаем LLM → дополнительная issue
        mock_resp = json.dumps({
            "issues": [{"item_name": "Пустая", "severity": "error", "category": "spec_error",
                        "message": "LLM нашёл проблему", "suggestion": "Исправить"}],
            "summary": "LLM: 1 проблема",
        })
        monkeypatch.setattr("apps.llm.service._get_provider", lambda _: MockProvider(content=mock_resp))

        resp = client.post(
            f"/api/v1/estimates/{estimate.id}/validate/",
            **{WS_HEADER: str(ws.id)},
        )
        assert resp.status_code == 200
        assert resp.data["pre_check_count"] >= 1
        assert resp.data["llm_count"] == 1
        total_issues = len(resp.data["issues"])
        assert total_issues >= 2  # pre-check + LLM

    def test_real_prices_no_false_positives(self, client, estimate, section, ws):
        """Нормальная позиция → pre-checks не должны ругаться на цены."""
        EstimateService.create_item(section, estimate, ws.id, {
            "name": "Вентилятор крышный", "unit": "шт", "quantity": 2,
            "equipment_price": 85000, "material_price": 0, "work_price": 12000,
            "match_source": "knowledge",
        })
        from apps.estimate.models import EstimateItem
        items = list(EstimateItem.objects.filter(estimate=estimate, workspace_id=ws.id))
        issues = run_pre_checks(items)
        # Нет нулевых цен (equipment > 0), нет unmatched (knowledge), нет unit error
        false_pos = [i for i in issues if i["category"] in ("price_outlier", "missing_work", "unit_error")]
        assert len(false_pos) == 0
