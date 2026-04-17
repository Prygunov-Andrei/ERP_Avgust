"""MatchingService — start/progress/apply для matching sessions."""

import json
import uuid

from django.db import connection

from apps.estimate.models import EstimateItem

from .grouping import find_groups
from .pipeline import run_pipeline
from .types import MatchResult


class MatchingService:
    @staticmethod
    def start_session(estimate_id: str, workspace_id: str) -> dict:
        """Запустить matching. Возвращает результаты сразу (синхронно для E5.1)."""
        items = list(
            EstimateItem.objects.filter(
                estimate_id=estimate_id, workspace_id=workspace_id
            ).order_by("sort_order")
        )

        if not items:
            return {"session_id": str(uuid.uuid4()), "total_items": 0, "groups": 0, "results": []}

        groups = find_groups(items)

        results = []
        for group in groups:
            result = run_pipeline(group, workspace_id, estimate_id)
            group.result = result
            results.append({
                "group_name": group.normalized_name,
                "unit": group.unit,
                "item_count": len(group.item_ids),
                "item_ids": group.item_ids,
                "match": {
                    "work_name": result.work_name,
                    "work_unit": result.work_unit,
                    "work_price": str(result.work_price),
                    "confidence": str(result.confidence),
                    "source": result.source,
                    "reasoning": result.reasoning,
                },
            })

        session_id = str(uuid.uuid4())
        return {
            "session_id": session_id,
            "total_items": len(items),
            "groups": len(groups),
            "results": results,
        }

    @staticmethod
    def apply_results(results: list[dict], workspace_id: str) -> int:
        """Применить результаты: обновить work_price, match_source на items."""
        updated = 0
        for r in results:
            match = r.get("match", {})
            if match.get("source") == "unmatched":
                continue
            for item_id in r.get("item_ids", []):
                with connection.cursor() as cur:
                    cur.execute(
                        """
                        UPDATE estimate_item
                        SET work_price = %s,
                            match_source = %s,
                            version = version + 1,
                            updated_at = NOW()
                        WHERE id = %s AND workspace_id = %s AND is_deleted = FALSE
                        """,
                        [match["work_price"], match["source"], item_id, workspace_id],
                    )
                    updated += cur.rowcount
        return updated
