"""E22: Multi-tenancy isolation tests.

Каждый тест создаёт 2 workspace с данными в обоих и доказывает,
что операция от ws_a не видит и не может изменить данные ws_b.
"""

import uuid
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.estimate.matching.knowledge import ProductKnowledge
from apps.estimate.matching.service import MatchingService
from apps.estimate.models import (
    Estimate,
    EstimateItem,
    EstimateSection,
    SnapshotTransmission,
    TransmissionStatus,
)
from apps.estimate.services.estimate_service import EstimateService
from apps.llm.models import LLMUsage
from apps.workspace.models import Workspace

User = get_user_model()

WS_HEADER = "HTTP_X_WORKSPACE_ID"


# ---------------------------------------------------------------------------
# Fixtures: два workspace с полными данными
# ---------------------------------------------------------------------------


@pytest.fixture()
def user():
    return User.objects.create_user(username="iso-user", password="pass")


@pytest.fixture()
def client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@pytest.fixture()
def ws_a():
    return Workspace.objects.create(name="Isolation-A", slug="iso-a")


@pytest.fixture()
def ws_b():
    return Workspace.objects.create(name="Isolation-B", slug="iso-b")


@pytest.fixture()
def data_a(ws_a, user):
    est = Estimate.objects.create(
        workspace=ws_a, name="Смета A", created_by=user,
        default_material_markup={"type": "percent", "value": 30},
        default_work_markup={"type": "percent", "value": 300},
    )
    sec = EstimateSection.objects.create(
        estimate=est, workspace=ws_a, name="Вентиляция A", sort_order=1
    )
    item = EstimateService.create_item(sec, est, ws_a.id, {
        "name": "Вентилятор A", "unit": "шт", "quantity": 2,
        "equipment_price": 100, "material_price": 200, "work_price": 50,
    })
    ProductKnowledge.objects.create(
        workspace_id=ws_a.id, pattern="вентилятор", work_name="Монтаж A",
        work_unit="шт", work_price=5000,
    )
    return {"ws": ws_a, "est": est, "sec": sec, "item": item}


@pytest.fixture()
def data_b(ws_b, user):
    est = Estimate.objects.create(
        workspace=ws_b, name="Смета B", created_by=user,
        default_material_markup={"type": "percent", "value": 20},
        default_work_markup={"type": "percent", "value": 200},
    )
    sec = EstimateSection.objects.create(
        estimate=est, workspace=ws_b, name="Слаботочка B", sort_order=1
    )
    item = EstimateService.create_item(sec, est, ws_b.id, {
        "name": "Камера B", "unit": "шт", "quantity": 10,
        "equipment_price": 500, "material_price": 300, "work_price": 100,
    })
    ProductKnowledge.objects.create(
        workspace_id=ws_b.id, pattern="камера", work_name="Монтаж B",
        work_unit="шт", work_price=1200,
    )
    return {"ws": ws_b, "est": est, "sec": sec, "item": item}


# ---------------------------------------------------------------------------
# 1. Estimate list isolation
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestEstimateListIsolation:
    def test_list_only_own_workspace(self, client, data_a, data_b):
        resp = client.get("/api/v1/estimates/", **{WS_HEADER: str(data_a["ws"].id)})
        assert resp.status_code == 200
        names = {e["name"] for e in resp.data}
        assert "Смета A" in names
        assert "Смета B" not in names


# ---------------------------------------------------------------------------
# 2. Estimate detail isolation
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestEstimateDetailIsolation:
    def test_get_foreign_estimate_404(self, client, data_a, data_b):
        """GET estimate из ws_b с заголовком ws_a → 404."""
        resp = client.get(
            f"/api/v1/estimates/{data_b['est'].id}/",
            **{WS_HEADER: str(data_a["ws"].id)},
        )
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# 3. Section list isolation
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestSectionListIsolation:
    def test_sections_foreign_estimate_404(self, client, data_a, data_b):
        resp = client.get(
            f"/api/v1/estimates/{data_b['est'].id}/sections/",
            **{WS_HEADER: str(data_a["ws"].id)},
        )
        # Sections filtered by workspace — should be empty or 404
        assert resp.status_code in (200, 404)
        if resp.status_code == 200:
            assert len(resp.data) == 0


# ---------------------------------------------------------------------------
# 4. Item list isolation
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestItemListIsolation:
    def test_items_foreign_estimate_empty(self, client, data_a, data_b):
        resp = client.get(
            f"/api/v1/estimates/{data_b['est'].id}/items/",
            **{WS_HEADER: str(data_a["ws"].id)},
        )
        assert resp.status_code == 200
        assert len(resp.data) == 0


# ---------------------------------------------------------------------------
# 5. Item update cross-workspace
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestItemUpdateIsolation:
    def test_patch_foreign_item_fails(self, client, data_a, data_b):
        """PATCH item из ws_b с заголовком ws_a → 409 (version conflict = 0 rows)."""
        resp = client.patch(
            f"/api/v1/items/{data_b['item'].id}/",
            {"name": "Взломанное имя"},
            format="json",
            HTTP_IF_MATCH="1",
            **{WS_HEADER: str(data_a["ws"].id)},
        )
        # EstimateService.update_item фильтрует по workspace_id → 0 rows → 409
        assert resp.status_code == 409

        # Данные ws_b не изменились
        item_b = EstimateItem.all_objects.get(id=data_b["item"].id)
        assert item_b.name == "Камера B"


# ---------------------------------------------------------------------------
# 6. Matching isolation
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestMatchingIsolation:
    @pytest.fixture(autouse=True)
    def _mock_llm(self, settings):
        settings.ISMETA_LLM_MODE = "mock"

    def test_matching_uses_own_knowledge(self, data_a, data_b):
        """Matching ws_a использует только ProductKnowledge ws_a."""
        result = MatchingService.start_session(str(data_a["est"].id), str(data_a["ws"].id))
        for r in result["results"]:
            if r["match"]["source"] == "knowledge":
                assert "Монтаж A" in r["match"]["work_name"]
                assert "Монтаж B" not in r["match"]["work_name"]


# ---------------------------------------------------------------------------
# 7. Transmission isolation
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestTransmissionIsolation:
    def test_transmissions_foreign_estimate_empty(self, client, data_a, data_b):
        # Создадим transmission в ws_b
        SnapshotTransmission.objects.create(
            estimate=data_b["est"], workspace=data_b["ws"],
            payload={}, status=TransmissionStatus.SUCCESS,
        )
        resp = client.get(
            f"/api/v1/estimates/{data_b['est'].id}/transmissions/",
            **{WS_HEADER: str(data_a["ws"].id)},
        )
        assert resp.status_code == 200
        assert len(resp.data) == 0


# ---------------------------------------------------------------------------
# 8. LLMUsage isolation
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestLLMUsageIsolation:
    def test_usage_records_correct_workspace(self, data_a, data_b, settings):
        settings.ISMETA_LLM_MODE = "mock"
        from apps.llm.service import LLMService

        svc = LLMService(workspace_id=str(data_a["ws"].id), task_type="matching")
        svc.complete_sync(messages=[{"role": "user", "content": "test"}])

        usage_a = LLMUsage.objects.filter(workspace_id=data_a["ws"].id)
        usage_b = LLMUsage.objects.filter(workspace_id=data_b["ws"].id)
        assert usage_a.count() == 1
        assert usage_b.count() == 0


# ---------------------------------------------------------------------------
# 9. Excel export isolation
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestExcelExportIsolation:
    def test_export_foreign_estimate_404(self, client, data_a, data_b):
        resp = client.get(
            f"/api/v1/estimates/{data_b['est'].id}/export/xlsx/",
            **{WS_HEADER: str(data_a["ws"].id)},
        )
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# 10. create-version isolation
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestCreateVersionIsolation:
    def test_version_keeps_workspace(self, client, data_a, data_b):
        resp = client.post(
            f"/api/v1/estimates/{data_a['est'].id}/create-version/",
            **{WS_HEADER: str(data_a["ws"].id)},
        )
        assert resp.status_code == 201
        new_id = resp.data["id"]
        new_est = Estimate.objects.get(id=new_id)
        assert new_est.workspace_id == data_a["ws"].id

        # ws_b не видит новую версию
        resp_b = client.get(f"/api/v1/estimates/{new_id}/", **{WS_HEADER: str(data_b["ws"].id)})
        assert resp_b.status_code == 404


# ---------------------------------------------------------------------------
# 11. Soft delete isolation
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestSoftDeleteIsolation:
    def test_deleted_items_dont_affect_other_ws(self, client, data_a, data_b):
        """Soft-deleted items в ws_a не уменьшают count ws_b."""
        count_b_before = EstimateItem.objects.filter(workspace_id=data_b["ws"].id).count()

        # Soft delete item в ws_a
        client.delete(
            f"/api/v1/items/{data_a['item'].id}/",
            HTTP_IF_MATCH=str(data_a["item"].version),
            **{WS_HEADER: str(data_a["ws"].id)},
        )

        count_b_after = EstimateItem.objects.filter(workspace_id=data_b["ws"].id).count()
        assert count_b_after == count_b_before


# ---------------------------------------------------------------------------
# 12. Snapshot workspace_id filter
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestSnapshotWorkspaceFilter:
    def test_snapshot_filtered_by_workspace(self, data_a, data_b):
        """SnapshotTransmission фильтруется по workspace_id."""
        SnapshotTransmission.objects.create(
            estimate=data_a["est"], workspace=data_a["ws"], payload={},
        )
        SnapshotTransmission.objects.create(
            estimate=data_b["est"], workspace=data_b["ws"], payload={},
        )

        qs_a = SnapshotTransmission.objects.filter(workspace_id=data_a["ws"].id)
        qs_b = SnapshotTransmission.objects.filter(workspace_id=data_b["ws"].id)
        assert qs_a.count() == 1
        assert qs_b.count() == 1
        assert qs_a.first().estimate_id == data_a["est"].id
