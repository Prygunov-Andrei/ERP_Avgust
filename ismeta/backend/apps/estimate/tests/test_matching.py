"""Тесты matching pipeline (E5.1)."""

import uuid
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.estimate.matching.grouping import ItemGroup, find_groups, normalize_name
from apps.estimate.matching.knowledge import ProductKnowledge
from apps.estimate.matching.pipeline import run_pipeline
from apps.estimate.matching.service import MatchingService
from apps.estimate.matching.tiers import FuzzyTier, HistoryTier, KnowledgeTier, LLMTier
from apps.estimate.matching.types import MatchResult
from apps.estimate.models import Estimate, EstimateSection
from apps.estimate.services.estimate_service import EstimateService
from apps.workspace.models import Workspace

User = get_user_model()


@pytest.fixture()
def ws():
    return Workspace.objects.create(name="WS-Match", slug="ws-match")


@pytest.fixture()
def estimate(ws):
    return Estimate.objects.create(
        workspace=ws, name="Matching test",
        default_material_markup={"type": "percent", "value": 30},
        default_work_markup={"type": "percent", "value": 300},
    )


@pytest.fixture()
def section(estimate, ws):
    return EstimateSection.objects.create(
        estimate=estimate, workspace=ws, name="Вентиляция", sort_order=1
    )


@pytest.fixture()
def knowledge_rules(ws):
    rules = [
        ProductKnowledge(workspace_id=ws.id, pattern="кабель+utp", work_name="Прокладка кабеля UTP", work_unit="м", work_price=150),
        ProductKnowledge(workspace_id=ws.id, pattern="вентилятор+крышный", work_name="Монтаж вентилятора крышного", work_unit="шт", work_price=12000),
        ProductKnowledge(workspace_id=ws.id, pattern="датчик+дым", work_name="Монтаж датчика дыма", work_unit="шт", work_price=350),
    ]
    ProductKnowledge.objects.bulk_create(rules)
    return rules


@pytest.mark.django_db
class TestGrouping:
    def test_normalize_name(self):
        assert normalize_name("Кабель UTP Cat.6 (100м)") == "кабель utp cat.6"
        assert normalize_name("Воздуховод 500x400 оцинк.") == "воздуховод оцинк."

    def test_find_groups_same_items(self, estimate, section, ws):
        for i in range(5):
            EstimateService.create_item(section, estimate, ws.id, {
                "name": "Кабель UTP Cat.6", "unit": "м", "quantity": 10,
            })
        items = list(estimate.items.all())
        groups = find_groups(items)
        assert len(groups) == 1
        assert len(groups[0].item_ids) == 5

    def test_find_groups_different_items(self, estimate, section, ws):
        EstimateService.create_item(section, estimate, ws.id, {"name": "Кабель UTP", "unit": "м", "quantity": 10})
        EstimateService.create_item(section, estimate, ws.id, {"name": "Вентилятор крышный", "unit": "шт", "quantity": 2})
        items = list(estimate.items.all())
        groups = find_groups(items)
        assert len(groups) == 2


@pytest.mark.django_db
class TestKnowledgeTier:
    def test_contains_match(self, ws, knowledge_rules):
        group = ItemGroup(normalized_name="кабель utp cat.6", unit="м", item_ids=["1"])
        tier = KnowledgeTier()
        result = tier.match(group, str(ws.id), "est-1")
        assert result is not None
        assert result.source == "knowledge"
        assert result.work_name == "Прокладка кабеля UTP"
        assert result.work_price == Decimal("150")

    def test_no_match(self, ws, knowledge_rules):
        group = ItemGroup(normalized_name="трансформатор силовой", unit="шт", item_ids=["1"])
        tier = KnowledgeTier()
        result = tier.match(group, str(ws.id), "est-1")
        assert result is None


@pytest.mark.django_db
class TestFuzzyTier:
    def test_fuzzy_match(self, ws, knowledge_rules):
        group = ItemGroup(normalized_name="кабель утп", unit="м", item_ids=["1"])
        tier = FuzzyTier()
        result = tier.match(group, str(ws.id), "est-1")
        assert result is not None
        assert result.source == "fuzzy"

    def test_fuzzy_no_match(self, ws, knowledge_rules):
        group = ItemGroup(normalized_name="абсолютно другое оборудование", unit="шт", item_ids=["1"])
        tier = FuzzyTier()
        result = tier.match(group, str(ws.id), "est-1")
        assert result is None


@pytest.mark.django_db
class TestLLMTier:
    @pytest.fixture(autouse=True)
    def _mock_mode(self, settings):
        settings.ISMETA_LLM_MODE = "mock"

    def test_llm_tier_mock(self, ws):
        group = ItemGroup(normalized_name="чиллер промышленный", unit="шт", item_ids=["1"])
        tier = LLMTier()
        # Mock provider returns "Mock response" — not valid JSON, tier returns None
        result = tier.match(group, str(ws.id), "est-1")
        assert result is None  # JSON parse fails on "Mock response"


@pytest.mark.django_db
class TestPipeline:
    def test_pipeline_stops_on_confident(self, ws, knowledge_rules):
        group = ItemGroup(normalized_name="кабель utp cat.6", unit="м", item_ids=["1"])
        result = run_pipeline(group, str(ws.id), "est-1")
        assert result.source == "knowledge"
        assert result.confidence >= Decimal("0.5")

    def test_pipeline_unmatched(self, ws):
        group = ItemGroup(normalized_name="неизвестное оборудование xyz", unit="шт", item_ids=["1"])
        result = run_pipeline(group, str(ws.id), "est-1")
        assert result.source == "unmatched"


@pytest.mark.django_db
class TestMatchingService:
    def test_start_session(self, estimate, section, ws, knowledge_rules):
        EstimateService.create_item(section, estimate, ws.id, {
            "name": "Кабель UTP Cat.6", "unit": "м", "quantity": 100,
        })
        EstimateService.create_item(section, estimate, ws.id, {
            "name": "Датчик дыма СС-2151", "unit": "шт", "quantity": 18,
        })

        result = MatchingService.start_session(str(estimate.id), str(ws.id))
        assert result["total_items"] == 2
        assert result["groups"] == 2
        assert len(result["results"]) == 2

        sources = {r["match"]["source"] for r in result["results"]}
        assert "knowledge" in sources

    def test_confidence_colors(self, estimate, section, ws, knowledge_rules):
        """Green (>0.9), yellow (0.5-0.9), red (<0.5) — через confidence значения."""
        EstimateService.create_item(section, estimate, ws.id, {
            "name": "Кабель UTP", "unit": "м", "quantity": 1,
        })
        result = MatchingService.start_session(str(estimate.id), str(ws.id))
        conf = Decimal(result["results"][0]["match"]["confidence"])
        if conf > Decimal("0.9"):
            color = "green"
        elif conf >= Decimal("0.5"):
            color = "yellow"
        else:
            color = "red"
        assert color in ("green", "yellow")


@pytest.mark.django_db
class TestMatchingAPI:
    @pytest.fixture()
    def user(self):
        return User.objects.create_user(username="match-user", password="pass")

    def test_match_works_endpoint(self, estimate, section, ws, knowledge_rules, user):
        EstimateService.create_item(section, estimate, ws.id, {
            "name": "Кабель UTP", "unit": "м", "quantity": 50,
        })
        client = APIClient()
        client.force_authenticate(user=user)
        resp = client.post(
            f"/api/v1/estimates/{estimate.id}/match-works/",
            HTTP_X_WORKSPACE_ID=str(ws.id),
        )
        assert resp.status_code == 200
        assert "results" in resp.data
        assert resp.data["total_items"] == 1
