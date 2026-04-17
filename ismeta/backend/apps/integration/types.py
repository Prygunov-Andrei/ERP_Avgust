"""Типы для ERP catalog client."""

from dataclasses import dataclass
from decimal import Decimal


@dataclass
class WorkItem:
    id: str
    name: str
    unit: str
    price: Decimal
    section_code: str = ""
    grade: int = 0
    hours: Decimal = Decimal("0")


@dataclass
class PriceItem:
    work_id: str
    work_name: str
    unit: str
    price: Decimal
    grade: int = 0
    hours: Decimal = Decimal("0")
