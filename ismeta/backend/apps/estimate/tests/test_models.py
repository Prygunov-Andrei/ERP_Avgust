"""Тесты моделей Estimate, EstimateSection, EstimateItem."""

from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.db import connection

from apps.estimate.models import (
    Estimate,
    EstimateItem,
    EstimateSection,
    EstimateStatus,
    MatchSource,
    ProcurementStatus,
)
from apps.estimate.schemas import MarkupConfig
from apps.workspace.models import Workspace

User = get_user_model()


@pytest.fixture()
def ws_a():
    return Workspace.objects.create(name="WS-A", slug="ws-a-est")


@pytest.fixture()
def ws_b():
    return Workspace.objects.create(name="WS-B", slug="ws-b-est")


@pytest.fixture()
def estimate_a(ws_a):
    return Estimate.objects.create(
        workspace=ws_a,
        name="Вентиляция корпус А",
        default_material_markup={"type": "percent", "value": 30},
        default_work_markup={"type": "percent", "value": 300},
    )


@pytest.fixture()
def section_a(estimate_a, ws_a):
    return EstimateSection.objects.create(
        estimate=estimate_a, workspace=ws_a, name="Воздуховоды", sort_order=1
    )


def _create_item(section, estimate, workspace, name="Вентилятор", **kwargs):
    """Вставка через raw SQL (managed=False)."""
    import uuid

    item_id = uuid.uuid4()
    row_id = uuid.uuid4()
    defaults = {
        "unit": "шт",
        "quantity": 1,
        "equipment_price": 0,
        "material_price": 0,
        "work_price": 0,
        "equipment_total": 0,
        "material_total": 0,
        "work_total": 0,
        "total": 0,
        "version": 1,
        "match_source": "unmatched",
        "tech_specs": "{}",
        "custom_data": "{}",
        "is_deleted": False,
        "is_key_equipment": False,
        "procurement_status": "none",
        "man_hours": 0,
        "sort_order": 0,
    }
    defaults.update(kwargs)
    with connection.cursor() as cur:
        cur.execute(
            """
            INSERT INTO estimate_item (
                id, section_id, estimate_id, workspace_id, row_id,
                sort_order, name, unit, quantity,
                equipment_price, material_price, work_price,
                equipment_total, material_total, work_total, total,
                version, match_source, tech_specs, custom_data,
                is_deleted, is_key_equipment, procurement_status, man_hours
            ) VALUES (
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s::jsonb, %s::jsonb,
                %s, %s, %s, %s
            )
            """,
            [
                item_id,
                section.id,
                estimate.id,
                workspace.id,
                row_id,
                defaults["sort_order"],
                name,
                defaults["unit"],
                defaults["quantity"],
                defaults["equipment_price"],
                defaults["material_price"],
                defaults["work_price"],
                defaults["equipment_total"],
                defaults["material_total"],
                defaults["work_total"],
                defaults["total"],
                defaults["version"],
                defaults["match_source"],
                defaults["tech_specs"],
                defaults["custom_data"],
                defaults["is_deleted"],
                defaults["is_key_equipment"],
                defaults["procurement_status"],
                defaults["man_hours"],
            ],
        )
    return EstimateItem.all_objects.get(id=item_id)


@pytest.mark.django_db
class TestEstimate:
    def test_create_estimate(self, ws_a):
        est = Estimate.objects.create(workspace=ws_a, name="Тест")
        assert est.status == EstimateStatus.DRAFT
        assert est.version_number == 1
        assert est.version == 1
        assert est.total_amount == 0

    def test_create_with_sections_and_items(self, estimate_a, section_a, ws_a):
        item = _create_item(section_a, estimate_a, ws_a, name="Кабель UTP")
        assert item.name == "Кабель UTP"
        assert EstimateItem.objects.filter(estimate=estimate_a).count() == 1

    def test_markup_validation(self, ws_a):
        est = Estimate(
            workspace=ws_a,
            name="Тест markup",
            default_material_markup={"type": "percent", "value": 30},
        )
        est.full_clean()

        est_bad = Estimate(
            workspace=ws_a,
            name="Тест bad",
            default_material_markup={"type": "invalid", "value": -5},
        )
        with pytest.raises(Exception):
            est_bad.full_clean()

    def test_version_chain(self, ws_a):
        v1 = Estimate.objects.create(workspace=ws_a, name="Смета v1", version_number=1)
        v2 = Estimate.objects.create(
            workspace=ws_a, name="Смета v2", version_number=2, parent_version=v1
        )
        assert v2.parent_version == v1
        assert v2.version_number == 2
        assert v1.child_versions.first() == v2


@pytest.mark.django_db
class TestOptimisticLock:
    def test_optimistic_lock_conflict(self, estimate_a):
        """Update с wrong version → 0 rows affected."""
        rows = Estimate.objects.filter(id=estimate_a.id, version=estimate_a.version).update(
            name="Обновлённая", version=estimate_a.version + 1
        )
        assert rows == 1

        rows_stale = Estimate.objects.filter(id=estimate_a.id, version=estimate_a.version).update(
            name="Устаревшая", version=estimate_a.version + 1
        )
        assert rows_stale == 0


@pytest.mark.django_db
class TestSoftDelete:
    def test_soft_delete(self, estimate_a, section_a, ws_a):
        item = _create_item(section_a, estimate_a, ws_a, name="Видимый")
        deleted = _create_item(section_a, estimate_a, ws_a, name="Удалённый", is_deleted=True)

        assert EstimateItem.objects.count() == 1
        assert EstimateItem.objects.first().name == "Видимый"
        assert EstimateItem.all_objects.count() == 2


@pytest.mark.django_db
class TestMultiTenancyIsolation:
    def test_workspace_isolation(self, ws_a, ws_b):
        est_a = Estimate.objects.create(workspace=ws_a, name="Смета A")
        est_b = Estimate.objects.create(workspace=ws_b, name="Смета B")

        qs_a = Estimate.objects.filter(workspace=ws_a)
        assert qs_a.count() == 1
        assert qs_a.first().name == "Смета A"

        qs_b = Estimate.objects.filter(workspace=ws_b)
        assert qs_b.count() == 1
        assert qs_b.first().name == "Смета B"


@pytest.mark.django_db
class TestKeyEquipment:
    def test_key_equipment_flag(self, estimate_a, section_a, ws_a):
        item = _create_item(
            section_a,
            estimate_a,
            ws_a,
            name="Чиллер Daikin",
            is_key_equipment=True,
            procurement_status="requested",
        )
        assert item.is_key_equipment is True
        assert item.procurement_status == "requested"

        regular = _create_item(section_a, estimate_a, ws_a, name="Крепёж")
        assert regular.is_key_equipment is False
        assert regular.procurement_status == "none"
