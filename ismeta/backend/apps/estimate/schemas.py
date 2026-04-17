"""Pydantic-схемы для JSONB-полей Estimate/Section/Item (CONTRIBUTING §10.1)."""

from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field


class MarkupConfig(BaseModel):
    """Наценка: процент, фиксированная цена, фиксированная сумма."""

    type: Literal["percent", "fixed_price", "fixed_amount"]
    value: Decimal = Field(..., ge=0)
    note: str | None = None


class TechSpecs(BaseModel):
    """ТТХ позиции — whitelist полей (CONTRIBUTING §10.1)."""

    manufacturer: str | None = None
    model: str | None = None
    power_kw: Decimal | None = None
    weight_kg: Decimal | None = None
    dimensions: str | None = None
