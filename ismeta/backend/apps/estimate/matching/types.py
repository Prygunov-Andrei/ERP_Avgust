"""Типы для matching pipeline."""

from dataclasses import dataclass, field
from decimal import Decimal


@dataclass
class MatchResult:
    """Результат подбора работы для одной позиции/группы."""

    work_name: str = ""
    work_unit: str = ""
    work_price: Decimal = Decimal("0")
    confidence: Decimal = Decimal("0")
    source: str = "unmatched"  # default, history, pricelist, knowledge, category, fuzzy, llm, web
    reasoning: str = ""
    man_hours: Decimal = Decimal("0")


@dataclass
class ItemGroup:
    """Группа одинаковых позиций (normalized name + unit)."""

    normalized_name: str
    unit: str
    item_ids: list[str] = field(default_factory=list)
    result: MatchResult | None = None
