"""Markup service — каскадные наценки ISMeta.

Спека: ismeta/docs/estimates/markup-architecture.md
Каскад: строка → раздел → смета. null = наследовать.
"""

import math
from decimal import Decimal, ROUND_HALF_UP

from django.db import connection

from apps.estimate.models import Estimate, EstimateItem, EstimateSection
from apps.estimate.schemas import MarkupConfig

TWO_PLACES = Decimal("0.01")


def _apply_markup(purchase: Decimal, markup_dict: dict | None) -> Decimal:
    """Применить MarkupConfig к закупочной цене. Возвращает продажную."""
    if not markup_dict or not purchase:
        return Decimal("0")
    config = MarkupConfig.model_validate(markup_dict)
    match config.type:
        case "percent":
            return (purchase * (1 + config.value / 100)).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
        case "fixed_price":
            return config.value.quantize(TWO_PLACES)
        case "fixed_amount":
            return (purchase + config.value).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def _resolve_markup(item_markup, section_markup, estimate_markup):
    """Каскад: item → section → estimate. null = наследовать."""
    return item_markup or section_markup or estimate_markup


def resolve_material_sale_price(
    purchase: Decimal,
    item_markup: dict | None,
    section_markup: dict | None,
    estimate_markup: dict | None,
) -> Decimal:
    markup = _resolve_markup(item_markup, section_markup, estimate_markup)
    return _apply_markup(purchase, markup)


def resolve_work_sale_price(
    purchase: Decimal,
    item_markup: dict | None,
    section_markup: dict | None,
    estimate_markup: dict | None,
) -> Decimal:
    markup = _resolve_markup(item_markup, section_markup, estimate_markup)
    return _apply_markup(purchase, markup)


def recalc_item_totals(item_data: dict, section, estimate) -> dict:
    """Пересчитать totals одной строки. Возвращает dict с computed полями."""
    qty = Decimal(str(item_data.get("quantity", 0)))
    eq_price = Decimal(str(item_data.get("equipment_price", 0)))
    mat_price = Decimal(str(item_data.get("material_price", 0)))
    work_price = Decimal(str(item_data.get("work_price", 0)))

    equipment_total = (eq_price * qty).quantize(TWO_PLACES)

    mat_sale = resolve_material_sale_price(
        mat_price,
        item_data.get("material_markup"),
        section.material_markup if section else None,
        estimate.default_material_markup,
    )
    material_total = (mat_sale * qty).quantize(TWO_PLACES)

    work_sale = resolve_work_sale_price(
        work_price,
        item_data.get("work_markup"),
        section.work_markup if section else None,
        estimate.default_work_markup,
    )
    work_total = (work_sale * qty).quantize(TWO_PLACES)

    total = equipment_total + material_total + work_total

    return {
        "equipment_total": equipment_total,
        "material_total": material_total,
        "work_total": work_total,
        "total": total,
    }


def recalc_estimate_totals(estimate_id, workspace_id):
    """Пересчитать агрегаты Estimate из всех строк."""
    with connection.cursor() as cur:
        cur.execute(
            """
            SELECT
                COALESCE(SUM(equipment_total), 0),
                COALESCE(SUM(material_total), 0),
                COALESCE(SUM(work_total), 0),
                COALESCE(SUM(equipment_total + material_total + work_total), 0),
                COALESCE(SUM(man_hours), 0)
            FROM estimate_item
            WHERE estimate_id = %s AND workspace_id = %s AND is_deleted = FALSE
            """,
            [estimate_id, workspace_id],
        )
        row = cur.fetchone()

    total_eq, total_mat, total_work, total_amount, man_hours = row

    # Profitability
    with connection.cursor() as cur:
        cur.execute(
            """
            SELECT COALESCE(SUM(
                equipment_price * quantity + material_price * quantity + work_price * quantity
            ), 0)
            FROM estimate_item
            WHERE estimate_id = %s AND workspace_id = %s AND is_deleted = FALSE
            """,
            [estimate_id, workspace_id],
        )
        total_purchase = cur.fetchone()[0]

    profitability = Decimal("0")
    if total_purchase and total_purchase > 0:
        profitability = ((total_amount - total_purchase) / total_purchase * 100).quantize(TWO_PLACES)

    Estimate.objects.filter(id=estimate_id).update(
        total_equipment=total_eq,
        total_materials=total_mat,
        total_works=total_work,
        total_amount=total_amount,
        man_hours=man_hours,
        profitability_percent=profitability,
    )


def recalc_after_markup_change(estimate_id, workspace_id, scope="estimate"):
    """Пересчитать строки после смены наценки. scope='estimate' или 'section:{id}'."""
    estimate = Estimate.objects.get(id=estimate_id)

    if scope == "estimate":
        sections = EstimateSection.objects.filter(estimate=estimate)
    elif scope.startswith("section:"):
        section_id = scope.split(":")[1]
        sections = EstimateSection.objects.filter(id=section_id)
    else:
        return

    for section in sections:
        items = EstimateItem.objects.filter(
            section=section, estimate_id=estimate_id, workspace_id=workspace_id
        )
        for item in items:
            # Пересчитываем только строки БЕЗ собственной наценки
            item_mat_markup = item.material_markup
            item_work_markup = item.work_markup

            mat_sale = resolve_material_sale_price(
                item.material_price,
                item_mat_markup,
                section.material_markup,
                estimate.default_material_markup,
            )
            work_sale = resolve_work_sale_price(
                item.work_price,
                item_work_markup,
                section.work_markup,
                estimate.default_work_markup,
            )
            eq_total = (item.equipment_price * item.quantity).quantize(TWO_PLACES)
            mat_total = (mat_sale * item.quantity).quantize(TWO_PLACES)
            work_total = (work_sale * item.quantity).quantize(TWO_PLACES)
            total = eq_total + mat_total + work_total

            with connection.cursor() as cur:
                cur.execute(
                    """
                    UPDATE estimate_item
                    SET equipment_total = %s, material_total = %s, work_total = %s, total = %s, updated_at = NOW()
                    WHERE id = %s AND workspace_id = %s
                    """,
                    [eq_total, mat_total, work_total, total, item.id, workspace_id],
                )

    recalc_estimate_totals(estimate_id, workspace_id)
