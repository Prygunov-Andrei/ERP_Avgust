"""Тесты markup service — каскадные наценки."""

from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model

from apps.estimate.models import Estimate, EstimateItem, EstimateSection
from apps.estimate.services.estimate_service import EstimateService
from apps.estimate.services.markup_service import (
    recalc_after_markup_change,
    recalc_estimate_totals,
    recalc_item_totals,
    resolve_material_sale_price,
    resolve_work_sale_price,
)
from apps.workspace.models import Workspace

User = get_user_model()


@pytest.fixture()
def ws():
    return Workspace.objects.create(name="WS-Markup", slug="ws-markup")


@pytest.fixture()
def estimate(ws):
    return Estimate.objects.create(
        workspace=ws,
        name="Markup test",
        default_material_markup={"type": "percent", "value": 30},
        default_work_markup={"type": "percent", "value": 300},
    )


@pytest.fixture()
def section(estimate, ws):
    return EstimateSection.objects.create(
        estimate=estimate, workspace=ws, name="Sec", sort_order=1
    )


@pytest.mark.django_db
class TestResolvePrice:
    def test_percent_markup(self):
        result = resolve_material_sale_price(
            Decimal("1000"), None, None, {"type": "percent", "value": 30}
        )
        assert result == Decimal("1300.00")

    def test_fixed_price_markup(self):
        result = resolve_material_sale_price(
            Decimal("1000"), {"type": "fixed_price", "value": 1500}, None, {"type": "percent", "value": 30}
        )
        assert result == Decimal("1500.00")

    def test_fixed_amount_markup(self):
        result = resolve_work_sale_price(
            Decimal("500"), {"type": "fixed_amount", "value": 200}, None, None
        )
        assert result == Decimal("700.00")

    def test_cascade_item_overrides_section(self):
        result = resolve_material_sale_price(
            Decimal("1000"),
            {"type": "percent", "value": 50},
            {"type": "percent", "value": 20},
            {"type": "percent", "value": 30},
        )
        assert result == Decimal("1500.00")

    def test_cascade_section_overrides_estimate(self):
        result = resolve_material_sale_price(
            Decimal("1000"),
            None,
            {"type": "percent", "value": 20},
            {"type": "percent", "value": 30},
        )
        assert result == Decimal("1200.00")

    def test_null_inherits_from_estimate(self):
        result = resolve_material_sale_price(
            Decimal("1000"), None, None, {"type": "percent", "value": 30}
        )
        assert result == Decimal("1300.00")

    def test_zero_purchase_returns_zero(self):
        result = resolve_material_sale_price(
            Decimal("0"), None, None, {"type": "percent", "value": 30}
        )
        assert result == Decimal("0")


@pytest.mark.django_db
class TestRecalcItemTotals:
    def test_recalc_item_totals(self, section, estimate):
        data = {
            "quantity": 10,
            "equipment_price": 100,
            "material_price": 200,
            "work_price": 50,
            "material_markup": None,
            "work_markup": None,
        }
        totals = recalc_item_totals(data, section, estimate)
        assert totals["equipment_total"] == Decimal("1000.00")
        assert totals["material_total"] == Decimal("2600.00")  # 200*1.3*10
        assert totals["work_total"] == Decimal("2000.00")  # 50*4*10
        assert totals["total"] == Decimal("5600.00")


@pytest.mark.django_db
class TestRecalcEstimateTotals:
    def test_recalc_estimate_totals(self, estimate, section, ws):
        EstimateService.create_item(section, estimate, ws.id, {
            "name": "Item 1", "quantity": 2,
            "equipment_price": 100, "material_price": 200, "work_price": 50,
        })
        EstimateService.create_item(section, estimate, ws.id, {
            "name": "Item 2", "quantity": 3,
            "equipment_price": 50, "material_price": 100, "work_price": 30,
        })
        estimate.refresh_from_db()
        assert estimate.total_equipment == Decimal("350.00")
        assert estimate.total_amount > 0


@pytest.mark.django_db
class TestRecalcAfterMarkupChange:
    def test_recalc_updates_items_without_own_markup(self, estimate, section, ws):
        item = EstimateService.create_item(section, estimate, ws.id, {
            "name": "Кабель", "quantity": 10, "material_price": 100, "work_price": 50,
        })
        old_total = EstimateItem.all_objects.get(id=item.id).material_total

        # Изменяем наценку на уровне сметы
        estimate.default_material_markup = {"type": "percent", "value": 50}
        estimate.save()
        recalc_after_markup_change(estimate.id, ws.id, scope="estimate")

        new_total = EstimateItem.all_objects.get(id=item.id).material_total
        assert new_total > old_total
