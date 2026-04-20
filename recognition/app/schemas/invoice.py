"""Pydantic schemas for /v1/parse/invoice (per specs §2)."""

from pydantic import BaseModel, Field

from .spec import PagesStats


class InvoiceItem(BaseModel):
    name: str
    model_name: str = ""
    brand: str = ""
    unit: str = "шт"
    quantity: float = 1.0
    price_unit: float = 0.0
    price_total: float = 0.0
    currency: str = "RUB"
    vat_rate: int | None = None
    page_number: int = 0
    sort_order: int = 0


class SupplierInfo(BaseModel):
    name: str = ""
    inn: str = ""
    kpp: str = ""
    bank_account: str = ""
    bik: str = ""
    correspondent_account: str = ""


class InvoiceMeta(BaseModel):
    number: str = ""
    date: str = ""
    total_amount: float = 0.0
    vat_amount: float = 0.0
    currency: str = "RUB"


class InvoiceParseResponse(BaseModel):
    status: str = "done"  # done | partial | error
    items: list[InvoiceItem] = Field(default_factory=list)
    supplier: SupplierInfo = Field(default_factory=SupplierInfo)
    invoice_meta: InvoiceMeta = Field(default_factory=InvoiceMeta)
    errors: list[str] = Field(default_factory=list)
    pages_stats: PagesStats = Field(default_factory=PagesStats)
