"""Сервисы каталога рейтинга кондиционеров (без HTTP-привязки)."""

from ac_catalog.services.criteria_rows import ensure_all_criteria_rows
from ac_catalog.services.import_template import generate_import_template_xlsx

__all__ = [
    "ensure_all_criteria_rows",
    "generate_import_template_xlsx",
]
