"""Test POST /v1/parse/spec — happy path, partial, negatives."""

import io
import json
from unittest.mock import patch

import fitz

from app.services.spec_parser import SpecParser


def _make_real_pdf(pages: int = 2) -> bytes:
    """Create a minimal valid PDF with N pages."""
    doc = fitz.open()
    for i in range(pages):
        page = doc.new_page()
        page.insert_text((72, 72), f"Page {i + 1}: Equipment list")
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


class MockProvider:
    """Mock LLM provider returning predefined responses."""

    def __init__(self, classify_response=None, extract_response=None, fail_on_page=None):
        self._classify = classify_response or json.dumps({"type": "specification", "section_name": "Вентиляция"})
        self._extract = extract_response or json.dumps({
            "items": [
                {"name": "Вентилятор канальный WNK 100", "model_name": "WNK 100/1", "brand": "Корф", "unit": "шт", "quantity": 10},
                {"name": "Воздуховод прямоугольный 200x200", "unit": "м.п.", "quantity": 850},
            ]
        })
        self._fail_on_page = fail_on_page
        self._call_count = 0

    def vision_complete(self, image_b64: str, prompt: str) -> str:
        self._call_count += 1
        if self._fail_on_page is not None and self._call_count == self._fail_on_page:
            raise ValueError("LLM timeout on this page")
        if "Определи тип" in prompt:
            return self._classify
        return self._extract


class TestSpecParserUnit:
    def test_happy_path(self):
        provider = MockProvider()
        parser = SpecParser(provider)
        pdf = _make_real_pdf(2)
        result = parser.parse(pdf, "test.pdf")

        assert result.status == "done"
        assert len(result.items) >= 2  # deduplicated
        assert result.pages_stats.total == 2
        assert result.pages_stats.processed == 2
        assert result.errors == []
        assert result.items[0].section_name == "Вентиляция"

    def test_partial_success(self):
        """One page fails → status=partial, items from other pages preserved."""
        provider = MockProvider(fail_on_page=2)  # 2nd call = extract on page 0
        parser = SpecParser(provider)
        pdf = _make_real_pdf(2)
        result = parser.parse(pdf, "test.pdf")

        assert result.status == "partial"
        assert len(result.errors) >= 1
        assert len(result.items) >= 1  # page 1 items survived

    def test_deduplication(self):
        """Three identical items → one with quantity=30."""
        extract_resp = json.dumps({
            "items": [
                {"name": "Кабель UTP", "model_name": "Cat.6", "brand": "Belden", "unit": "м", "quantity": 10},
            ]
        })
        provider = MockProvider(extract_response=extract_resp)
        parser = SpecParser(provider)
        pdf = _make_real_pdf(3)
        result = parser.parse(pdf, "test.pdf")

        cable_items = [i for i in result.items if "Кабель" in i.name]
        assert len(cable_items) == 1
        assert cable_items[0].quantity == 30.0

    def test_drawing_pages_skipped(self):
        classify_resp = json.dumps({"type": "drawing", "section_name": ""})
        provider = MockProvider(classify_response=classify_resp)
        parser = SpecParser(provider)
        pdf = _make_real_pdf(3)
        result = parser.parse(pdf, "test.pdf")

        assert result.status == "done"
        assert len(result.items) == 0
        assert result.pages_stats.skipped == 3


class TestParseSpecEndpoint:
    def test_non_pdf_415(self, client, auth_headers):
        resp = client.post(
            "/v1/parse/spec",
            files={"file": ("test.txt", io.BytesIO(b"not a pdf"), "text/plain")},
            headers=auth_headers,
        )
        assert resp.status_code == 415

    def test_missing_file_422(self, client, auth_headers):
        resp = client.post("/v1/parse/spec", headers=auth_headers)
        assert resp.status_code == 422

    @patch("app.api.parse.get_provider")
    def test_real_pdf_mock_llm(self, mock_get_provider, client, auth_headers):
        mock_get_provider.return_value = MockProvider()
        pdf = _make_real_pdf(2)

        resp = client.post(
            "/v1/parse/spec",
            files={"file": ("spec.pdf", io.BytesIO(pdf), "application/pdf")},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "done"
        assert len(data["items"]) >= 2
        assert data["pages_stats"]["total"] == 2
