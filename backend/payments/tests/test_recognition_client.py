"""Tests for ERP payments RecognitionClient + response adapter."""

from decimal import Decimal

import httpx
import pytest
import respx

from payments.services.recognition_client import (
    RecognitionClient,
    RecognitionClientError,
    compute_confidence,
    response_to_parsed_invoice,
)

BASE_URL = "http://recognition-test:8003"
API_KEY = "test-key"


@pytest.fixture
def client() -> RecognitionClient:
    return RecognitionClient(base_url=BASE_URL, api_key=API_KEY, timeout=5.0)


INVOICE_OK = {
    "status": "done",
    "items": [
        {
            "name": "Кабель ВВГнг 3x2.5",
            "model_name": "",
            "brand": "",
            "unit": "м",
            "quantity": 200.0,
            "price_unit": 85.0,
            "price_total": 17000.0,
            "currency": "RUB",
            "vat_rate": 20,
            "page_number": 1,
            "sort_order": 0,
        }
    ],
    "supplier": {
        "name": "ООО Электрокабель",
        "inn": "7700000000",
        "kpp": "770001001",
        "bank_account": "",
        "bik": "",
        "correspondent_account": "",
    },
    "invoice_meta": {
        "number": "С-00123",
        "date": "2026-04-18",
        "total_amount": 17000.0,
        "vat_amount": 2833.33,
        "currency": "RUB",
    },
    "errors": [],
    "pages_stats": {"total": 1, "processed": 1, "skipped": 0, "error": 0},
}


class TestClientHTTP:
    def test_happy_path_invoice(self, client):
        with respx.mock() as mock:
            mock.post(f"{BASE_URL}/v1/parse/invoice").mock(
                return_value=httpx.Response(200, json=INVOICE_OK)
            )
            result = client.parse_invoice(b"%PDF-1.4", "x.pdf")
            assert result["supplier"]["inn"] == "7700000000"
            assert result["invoice_meta"]["number"] == "С-00123"

    def test_401_invalid_api_key(self, client):
        with respx.mock() as mock:
            mock.post(f"{BASE_URL}/v1/parse/invoice").mock(
                return_value=httpx.Response(401, json={"error": "invalid_api_key"})
            )
            with pytest.raises(RecognitionClientError) as exc:
                client.parse_invoice(b"%PDF", "x.pdf")
            assert exc.value.code == "invalid_api_key"
            assert exc.value.status_code == 401

    def test_502_llm_unavailable_preserves_retry_after(self, client):
        with respx.mock() as mock:
            mock.post(f"{BASE_URL}/v1/parse/invoice").mock(
                return_value=httpx.Response(
                    502, json={"error": "llm_unavailable", "retry_after_sec": 42}
                )
            )
            with pytest.raises(RecognitionClientError) as exc:
                client.parse_invoice(b"%PDF", "x.pdf")
            assert exc.value.code == "llm_unavailable"
            assert exc.value.extra["retry_after_sec"] == 42

    def test_timeout_maps_to_network_timeout(self, client):
        with respx.mock() as mock:
            mock.post(f"{BASE_URL}/v1/parse/invoice").mock(
                side_effect=httpx.ReadTimeout("slow")
            )
            with pytest.raises(RecognitionClientError) as exc:
                client.parse_invoice(b"%PDF", "x.pdf")
            assert exc.value.code == "network_timeout"

    def test_spec_and_quote_endpoints(self, client):
        with respx.mock() as mock:
            mock.post(f"{BASE_URL}/v1/parse/spec").mock(
                return_value=httpx.Response(
                    200, json={"status": "done", "items": [], "errors": [],
                               "pages_stats": {"total": 1, "processed": 1,
                                               "skipped": 0, "error": 0}}
                )
            )
            mock.post(f"{BASE_URL}/v1/parse/quote").mock(
                return_value=httpx.Response(
                    200, json={"status": "done", "items": [],
                               "supplier": {"name": "", "inn": ""},
                               "quote_meta": {"number": "", "date": "",
                                              "valid_until": "", "currency": "RUB",
                                              "total_amount": 0.0},
                               "errors": [],
                               "pages_stats": {"total": 1, "processed": 1,
                                               "skipped": 0, "error": 0}}
                )
            )
            s = client.parse_spec(b"%PDF", "s.pdf")
            q = client.parse_quote(b"%PDF", "q.pdf")
            assert s["status"] == "done"
            assert q["status"] == "done"


class TestResponseAdapter:
    def test_happy_mapping(self):
        pi = response_to_parsed_invoice(INVOICE_OK)
        assert pi.vendor.name == "ООО Электрокабель"
        assert pi.vendor.inn == "7700000000"
        assert pi.vendor.kpp == "770001001"
        assert pi.invoice.number == "С-00123"
        assert str(pi.invoice.date) == "2026-04-18"
        assert pi.totals.amount_gross == Decimal("17000.0")
        assert pi.totals.vat_amount == Decimal("2833.33")
        assert len(pi.items) == 1
        assert pi.items[0].name.startswith("Кабель")
        assert pi.items[0].quantity == Decimal("200.0")
        assert pi.items[0].price_per_unit == Decimal("85.0")
        assert pi.items[0].unit == "м"
        assert 0.9 <= pi.confidence <= 1.0

    def test_missing_number_raises(self):
        bad = dict(INVOICE_OK)
        bad["invoice_meta"] = {**INVOICE_OK["invoice_meta"], "number": ""}
        with pytest.raises(ValueError):
            response_to_parsed_invoice(bad)

    def test_missing_date_raises(self):
        bad = dict(INVOICE_OK)
        bad["invoice_meta"] = {**INVOICE_OK["invoice_meta"], "date": ""}
        with pytest.raises(ValueError):
            response_to_parsed_invoice(bad)

    def test_missing_supplier_raises(self):
        bad = dict(INVOICE_OK)
        bad["supplier"] = {"name": "", "inn": "", "kpp": "", "bank_account": "",
                           "bik": "", "correspondent_account": ""}
        with pytest.raises(ValueError):
            response_to_parsed_invoice(bad)

    def test_skip_items_without_name(self):
        data = dict(INVOICE_OK)
        data["items"] = [
            {"name": "", "quantity": 1, "price_unit": 0, "price_total": 0,
             "unit": "шт"},
            {"name": "Валидная позиция", "quantity": 3, "price_unit": 100,
             "price_total": 300, "unit": "шт"},
        ]
        pi = response_to_parsed_invoice(data)
        assert len(pi.items) == 1
        assert pi.items[0].name == "Валидная позиция"

    def test_confidence_scale(self):
        assert compute_confidence({"status": "done", "supplier": {"inn": "7"},
                                    "invoice_meta": {"number": "1"},
                                    "items": [{"name": "x"}], "errors": []}) == 1.0
        assert compute_confidence({"status": "partial", "supplier": {},
                                    "invoice_meta": {}, "items": [],
                                    "errors": ["x"]}) == 0.5
        assert compute_confidence({"status": "error", "supplier": {},
                                    "invoice_meta": {}, "items": [],
                                    "errors": ["x", "y"]}) == 0.0

    def test_vat_amount_optional(self):
        data = dict(INVOICE_OK)
        data["invoice_meta"] = {**INVOICE_OK["invoice_meta"], "vat_amount": None}
        pi = response_to_parsed_invoice(data)
        assert pi.totals.vat_amount is None
