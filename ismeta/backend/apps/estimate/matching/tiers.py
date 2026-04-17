"""8 tier'ов matching pipeline."""

import json
from decimal import Decimal
from difflib import SequenceMatcher

from django.db import connection

from apps.llm.service import LLMService

from .knowledge import ProductKnowledge
from .types import ItemGroup, MatchResult

CONFIDENCE_THRESHOLD = Decimal("0.5")


class BaseTier:
    """Базовый tier. Возвращает MatchResult или None (не нашёл)."""

    name: str = "base"

    def match(self, group: ItemGroup, workspace_id: str, estimate_id: str) -> MatchResult | None:
        return None


class DefaultTier(BaseTier):
    """Tier 1: точное совпадение в прайс-листе. Stub в E5.1."""

    name = "default"

    def match(self, group, workspace_id, estimate_id):
        return None  # Stub — прайс-лист появится в E5.2/E13


class HistoryTier(BaseTier):
    """Tier 2: прошлые подборы этого workspace."""

    name = "history"

    def match(self, group, workspace_id, estimate_id):
        with connection.cursor() as cur:
            cur.execute(
                """
                SELECT name, work_price, match_source, unit
                FROM estimate_item
                WHERE workspace_id = %s
                  AND match_source NOT IN ('unmatched', 'manual')
                  AND is_deleted = FALSE
                  AND LOWER(name) = %s
                ORDER BY updated_at DESC
                LIMIT 1
                """,
                [workspace_id, group.normalized_name],
            )
            row = cur.fetchone()

        if row:
            return MatchResult(
                work_name=f"Работа по «{row[0]}»",
                work_unit=row[3] or group.unit,
                work_price=Decimal(str(row[1])) if row[1] else Decimal("0"),
                confidence=Decimal("0.90"),
                source="history",
                reasoning=f"Прошлый подбор: {row[2]}",
            )
        return None


class PricelistTier(BaseTier):
    """Tier 3: прайс-лист монтажа. Stub в E5.1."""

    name = "pricelist"

    def match(self, group, workspace_id, estimate_id):
        return None  # Stub — интеграция с ERP pricelist в E5.2


class KnowledgeTier(BaseTier):
    """Tier 4: ProductKnowledge rules."""

    name = "knowledge"

    def match(self, group, workspace_id, estimate_id):
        rules = ProductKnowledge.objects.filter(workspace_id=workspace_id, is_active=True)
        for rule in rules:
            if rule.matches(group.normalized_name):
                return MatchResult(
                    work_name=rule.work_name,
                    work_unit=rule.work_unit,
                    work_price=rule.work_price,
                    confidence=rule.confidence,
                    source="knowledge",
                    reasoning=f"ProductKnowledge: {rule.pattern}",
                )
        return None


class CategoryTier(BaseTier):
    """Tier 5: категория оборудования. Stub."""

    name = "category"

    def match(self, group, workspace_id, estimate_id):
        return None


class FuzzyTier(BaseTier):
    """Tier 6: нечёткий поиск по ProductKnowledge patterns."""

    name = "fuzzy"
    MIN_RATIO = 0.6

    def match(self, group, workspace_id, estimate_id):
        rules = ProductKnowledge.objects.filter(workspace_id=workspace_id, is_active=True)
        best_match = None
        best_ratio = 0.0

        for rule in rules:
            pattern_lower = rule.pattern.lower().replace("+", " ")
            ratio = SequenceMatcher(None, group.normalized_name, pattern_lower).ratio()
            if ratio > best_ratio and ratio >= self.MIN_RATIO:
                best_ratio = ratio
                best_match = rule

        if best_match:
            return MatchResult(
                work_name=best_match.work_name,
                work_unit=best_match.work_unit,
                work_price=best_match.work_price,
                confidence=Decimal(str(round(best_ratio * 0.8, 2))),
                source="fuzzy",
                reasoning=f"Fuzzy match: {best_match.pattern} (ratio={best_ratio:.2f})",
            )
        return None


class LLMTier(BaseTier):
    """Tier 7: LLM-подбор через LLMService."""

    name = "llm"

    def match(self, group, workspace_id, estimate_id):
        svc = LLMService(
            workspace_id=workspace_id, task_type="matching", estimate_id=estimate_id
        )
        messages = [
            {
                "role": "system",
                "content": (
                    "Ты — эксперт по подбору монтажных работ для ОВиК/СС оборудования. "
                    "По названию позиции определи подходящую работу, единицу измерения и "
                    "примерную стоимость. Ответь JSON: "
                    '{"work_name": "...", "work_unit": "шт", "work_price": 0, "reasoning": "..."}'
                ),
            },
            {"role": "user", "content": f"Позиция: {group.normalized_name} ({group.unit})"},
        ]

        try:
            resp = svc.complete_sync(messages=messages)
            data = json.loads(resp.content)
            return MatchResult(
                work_name=data.get("work_name", ""),
                work_unit=data.get("work_unit", group.unit),
                work_price=Decimal(str(data.get("work_price", 0))),
                confidence=Decimal("0.70"),
                source="llm",
                reasoning=data.get("reasoning", "LLM suggestion"),
            )
        except Exception:
            return None


class WebTier(BaseTier):
    """Tier 8: web search. Stub — этап 2."""

    name = "web"

    def match(self, group, workspace_id, estimate_id):
        return None


# Порядок tiers
ALL_TIERS = [
    DefaultTier(),
    HistoryTier(),
    PricelistTier(),
    KnowledgeTier(),
    CategoryTier(),
    FuzzyTier(),
    LLMTier(),
    WebTier(),
]
