"""Matching pipeline — orchestrator: tiers по очереди, стоп на confident."""

import logging
from decimal import Decimal

from .tiers import ALL_TIERS
from .types import ItemGroup, MatchResult

logger = logging.getLogger(__name__)

CONFIDENCE_THRESHOLD = Decimal("0.5")


def run_pipeline(group: ItemGroup, workspace_id: str, estimate_id: str) -> MatchResult:
    """Прогнать group через все tiers. Остановиться на первом с confidence >= threshold."""
    for tier in ALL_TIERS:
        result = tier.match(group, workspace_id, estimate_id)
        if result and result.confidence >= CONFIDENCE_THRESHOLD:
            logger.info(
                "Match found: tier=%s name='%s' → '%s' (conf=%.2f)",
                tier.name, group.normalized_name, result.work_name, result.confidence,
            )
            return result

    return MatchResult(
        source="unmatched",
        confidence=Decimal("0"),
        reasoning="Все tiers не нашли подходящую работу",
    )
