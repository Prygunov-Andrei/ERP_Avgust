"""Snapshot builder — собирает payload для ERP по формату 02-api-contracts.md §2.1."""

from django.db import connection

from apps.estimate.models import Estimate, EstimateSection


def build_snapshot(estimate_id, workspace_id) -> dict:
    """Собрать полный snapshot сметы для передачи в ERP."""
    estimate = Estimate.objects.get(id=estimate_id, workspace_id=workspace_id)
    sections = EstimateSection.objects.filter(estimate=estimate).order_by("sort_order")

    sections_data = []
    for section in sections:
        items_data = []
        with connection.cursor() as cur:
            cur.execute(
                """
                SELECT id, row_id, sort_order, name, unit, quantity,
                       equipment_price, material_price, work_price,
                       equipment_total, material_total, work_total, total,
                       match_source, is_key_equipment, man_hours
                FROM estimate_item
                WHERE section_id = %s AND estimate_id = %s
                      AND workspace_id = %s AND is_deleted = FALSE
                ORDER BY sort_order
                """,
                [section.id, estimate_id, workspace_id],
            )
            for row in cur.fetchall():
                items_data.append({
                    "external_id": str(row[0]),
                    "row_id": str(row[1]),
                    "sort_order": row[2],
                    "name": row[3],
                    "unit": row[4],
                    "quantity": str(row[5]),
                    "equipment_price": str(row[6]),
                    "material_price": str(row[7]),
                    "work_price": str(row[8]),
                    "equipment_total": str(row[9]),
                    "material_total": str(row[10]),
                    "work_total": str(row[11]),
                    "total": str(row[12]),
                    "match_source": row[13],
                    "is_key_equipment": row[14],
                    "man_hours": str(row[15]),
                })

        sections_data.append({
            "external_id": str(section.id),
            "name": section.name,
            "sort_order": section.sort_order,
            "material_markup": section.material_markup,
            "work_markup": section.work_markup,
            "items": items_data,
        })

    return {
        "ismeta_version_id": str(estimate.id),
        "workspace_id": str(workspace_id),
        "estimate": {
            "name": estimate.name,
            "folder_name": estimate.folder_name,
            "version_number": estimate.version_number,
            "status": estimate.status,
            "total_equipment": str(estimate.total_equipment),
            "total_materials": str(estimate.total_materials),
            "total_works": str(estimate.total_works),
            "total_amount": str(estimate.total_amount),
            "man_hours": str(estimate.man_hours),
            "profitability_percent": str(estimate.profitability_percent),
        },
        "sections": sections_data,
    }
