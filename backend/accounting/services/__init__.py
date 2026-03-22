"""Accounting services package."""

# Re-export для обратной совместимости:
# from accounting.services import find_duplicate_groups, merge_counterparties
from .counterparty_service import (
    find_duplicate_groups,
    merge_counterparties,
    normalize_name,
    name_similarity,
)
from .analytics_service import AnalyticsService
