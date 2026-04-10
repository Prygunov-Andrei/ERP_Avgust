"""
proposals/services/ — бизнес-логика для ТКП и МП.

Реэкспорт из _legacy.py для обратной совместимости с views.py.
"""
from ._legacy import (  # noqa: F401
    record_tkp_creation,
    handle_tkp_status_change,
    add_estimates_to_tkp,
    remove_estimates_from_tkp,
    create_mp_from_tkp,
    mark_mp_telegram_published,
)
from .tkp_excel_generator import TKPExcelGenerator  # noqa: F401
