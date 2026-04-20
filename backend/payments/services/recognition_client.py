"""Recognition Service HTTP client for ERP payments.

Синхронный (Django sync-код). Для ISMeta есть асинхронный аналог
в `ismeta/backend/apps/integration/recognition_client.py` — API/коды ошибок
совпадают, но Django settings и httpx.Client используются свои, без общей
зависимости чтобы не тащить пакет между двумя Django-проектами.

Контракт: recognition/README.md, specs/15-recognition-api.md.
"""

from __future__ import annotations

import logging
from datetime import date as Date
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any

import httpx
from django.conf import settings

from llm_services.schemas import (
    BuyerInfo,
    InvoiceInfo,
    InvoiceItem,
    ParsedInvoice,
    TotalsInfo,
    VendorInfo,
)

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT_SECONDS = 310.0  # server timeout 300s + network slack


class RecognitionClientError(Exception):
    """Normalized error raised on any non-2xx / transport failure."""

    def __init__(
        self,
        code: str,
        detail: str = "",
        *,
        status_code: int | None = None,
        extra: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(f"{code}: {detail}" if detail else code)
        self.code = code
        self.detail = detail
        self.status_code = status_code
        self.extra = extra or {}


class RecognitionClient:
    """Sync HTTP client for the Recognition Service."""

    def __init__(
        self,
        base_url: str | None = None,
        api_key: str | None = None,
        timeout: float = DEFAULT_TIMEOUT_SECONDS,
    ) -> None:
        resolved_url = base_url or str(
            getattr(settings, "RECOGNITION_URL", "http://recognition:8003") or ""
        )
        self.base_url = resolved_url.rstrip("/")
        self.api_key = api_key or str(getattr(settings, "RECOGNITION_API_KEY", "") or "")
        self.timeout = timeout

    # ------------------------------------------------------------------
    # Endpoints — return raw dicts by contract.
    # ------------------------------------------------------------------

    def parse_spec(self, pdf_bytes: bytes, filename: str) -> dict[str, Any]:
        return self._post("/v1/parse/spec", pdf_bytes, filename)

    def parse_invoice(self, pdf_bytes: bytes, filename: str) -> dict[str, Any]:
        return self._post("/v1/parse/invoice", pdf_bytes, filename)

    def parse_quote(self, pdf_bytes: bytes, filename: str) -> dict[str, Any]:
        return self._post("/v1/parse/quote", pdf_bytes, filename)

    def healthz(self) -> dict[str, Any]:
        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.get(f"{self.base_url}/v1/healthz")
                resp.raise_for_status()
        except httpx.HTTPError as e:
            raise RecognitionClientError(
                "network_error", f"healthz unreachable: {e}"
            ) from e
        data = resp.json()
        if not isinstance(data, dict):
            raise RecognitionClientError("invalid_response", "healthz not dict")
        return data

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _post(self, path: str, pdf_bytes: bytes, filename: str) -> dict[str, Any]:
        url = f"{self.base_url}{path}"
        headers: dict[str, str] = {"X-API-Key": self.api_key}
        files = {"file": (filename, pdf_bytes, "application/pdf")}

        try:
            with httpx.Client(timeout=self.timeout) as client:
                resp = client.post(url, headers=headers, files=files)
        except httpx.TimeoutException as e:
            logger.warning("recognition timeout: %s %s", path, e)
            raise RecognitionClientError(
                "network_timeout", f"recognition timeout on {path}"
            ) from e
        except httpx.HTTPError as e:
            logger.warning("recognition transport: %s %s", path, e)
            raise RecognitionClientError(
                "network_error", f"recognition transport: {e}"
            ) from e

        if resp.status_code == 200:
            data = resp.json()
            if not isinstance(data, dict):
                raise RecognitionClientError(
                    "invalid_response",
                    f"expected JSON object, got {type(data).__name__}",
                    status_code=200,
                )
            return data

        body: dict[str, Any] = {}
        try:
            parsed = resp.json()
            if isinstance(parsed, dict):
                body = parsed
        except ValueError:
            pass

        code = str(body.get("error") or f"http_{resp.status_code}")
        detail = str(body.get("detail") or resp.text[:200])
        extra = {k: v for k, v in body.items() if k not in ("error", "detail")}
        logger.warning(
            "recognition error: path=%s status=%s code=%s",
            path,
            resp.status_code,
            code,
        )
        raise RecognitionClientError(code, detail, status_code=resp.status_code, extra=extra)


# ----------------------------------------------------------------------
# Adapter: Recognition /v1/parse/invoice response → legacy ParsedInvoice
# ----------------------------------------------------------------------


def response_to_parsed_invoice(response: dict[str, Any]) -> ParsedInvoice:
    """Map Recognition response (§2) → legacy ParsedInvoice used by payments.

    Raises ValueError when required fields (invoice number/date, vendor inn)
    are missing — тот же контракт, что старый DocumentParser.parse_invoice.
    """
    supplier = response.get("supplier") or {}
    meta = response.get("invoice_meta") or {}
    items_raw = response.get("items") or []

    vendor_name = str(supplier.get("name", "")).strip()
    vendor_inn = str(supplier.get("inn", "")).strip()
    if not vendor_name and not vendor_inn:
        raise ValueError("Recognition не вернул поставщика")
    vendor = VendorInfo(
        name=vendor_name or "Не распознан",
        inn=vendor_inn or "",
        kpp=str(supplier.get("kpp") or "") or None,
    )

    number = str(meta.get("number", "")).strip()
    date_str = str(meta.get("date", "")).strip()
    parsed_date = _parse_iso_date(date_str)
    if not number or parsed_date is None:
        raise ValueError(
            f"Не распознаны обязательные поля счёта: "
            f"number={number!r}, date={date_str!r}"
        )

    invoice = InvoiceInfo(number=number, date=parsed_date)

    amount_gross = _to_decimal(meta.get("total_amount"), Decimal("0")) or Decimal("0")
    totals = TotalsInfo(
        amount_gross=amount_gross,
        vat_amount=(
            _to_decimal(meta.get("vat_amount"), None)
            if meta.get("vat_amount") is not None
            else None
        ),
    )

    items: list[InvoiceItem] = []
    for raw in items_raw:
        if not isinstance(raw, dict):
            continue
        name = str(raw.get("name", "")).strip()
        if not name:
            continue
        items.append(
            InvoiceItem(
                name=name,
                quantity=_to_decimal(raw.get("quantity"), None),
                unit=str(raw.get("unit") or "") or None,
                price_per_unit=_to_decimal(raw.get("price_unit"), None),
            )
        )

    return ParsedInvoice(
        vendor=vendor,
        buyer=BuyerInfo(name="", inn=""),  # recognition не извлекает покупателя (это наша компания)
        invoice=invoice,
        totals=totals,
        items=items,
        confidence=compute_confidence(response),
    )


def compute_confidence(response: dict[str, Any]) -> float:
    """Эвристика уверенности на основе Recognition response.

    Шкала [0.0, 1.0]:
    - status=done → base 0.9, partial → 0.55, error → 0.0
    - бонусы за supplier.inn (+0.05), invoice_meta.number (+0.03), items>0 (+0.02)
    - штраф за каждую ошибку страницы (-0.05, но не более -0.2)
    """
    status = response.get("status")
    if status == "done":
        score = 0.9
    elif status == "partial":
        score = 0.55
    else:
        score = 0.0

    supplier = response.get("supplier") or {}
    meta = response.get("invoice_meta") or {}
    items = response.get("items") or []
    errors = response.get("errors") or []

    if supplier.get("inn"):
        score += 0.05
    if meta.get("number"):
        score += 0.03
    if items:
        score += 0.02
    score -= min(0.2, len(errors) * 0.05)

    return round(max(0.0, min(1.0, score)), 2)


def _to_decimal(value: Any, default: Decimal | None) -> Decimal | None:
    if value is None or value == "":
        return default
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return default


def _parse_iso_date(value: str) -> Date | None:
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None
