"""Pydantic schemas for /v1/parse/quote (per specs §3)."""

from pydantic import BaseModel, Field

from .invoice import InvoiceItem
from .spec import PagesStats


class QuoteItem(InvoiceItem):
    tech_specs: str = ""
    lead_time_days: int | None = None
    warranty_months: int | None = None


class QuoteSupplier(BaseModel):
    """КП часто без банковских реквизитов — только name и опционально ИНН."""

    name: str = ""
    inn: str = ""


class QuoteMeta(BaseModel):
    number: str = ""
    date: str = ""
    valid_until: str = ""
    currency: str = "RUB"
    total_amount: float = 0.0


class QuoteParseResponse(BaseModel):
    status: str = "done"
    items: list[QuoteItem] = Field(default_factory=list)
    supplier: QuoteSupplier = Field(default_factory=QuoteSupplier)
    quote_meta: QuoteMeta = Field(default_factory=QuoteMeta)
    errors: list[str] = Field(default_factory=list)
    pages_stats: PagesStats = Field(default_factory=PagesStats)
