"""Test POST /v1/parse/spec — happy path, partial, negatives, errors per §5."""

import io
import json

import fitz
import pytest

from app.api.parse import get_provider
from app.main import app
from app.providers.base import BaseLLMProvider
from app.services.spec_parser import SpecParser


def _make_real_pdf(pages: int = 2) -> bytes:
    doc = fitz.open()
    for i in range(pages):
        page = doc.new_page()
        page.insert_text((72, 72), f"Page {i + 1}: Equipment list")
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


class MockProvider(BaseLLMProvider):
    """Async mock LLM provider."""

    def __init__(self, classify_response=None, extract_response=None, fail_on_page=None):
        self._classify = classify_response or json.dumps(
            {"type": "specification", "section_name": "Вентиляция"}
        )
        self._extract = extract_response or json.dumps(
            {
                "items": [
                    {
                        "name": "Вентилятор канальный WNK 100",
                        "model_name": "WNK 100/1",
                        "brand": "Корф",
                        "unit": "шт",
                        "quantity": 10,
                    },
                    {
                        "name": "Воздуховод прямоугольный 200x200",
                        "unit": "м.п.",
                        "quantity": 850,
                    },
                ]
            }
        )
        self._fail_on_page = fail_on_page
        self._call_count = 0

    async def vision_complete(self, image_b64: str, prompt: str) -> str:  # noqa: ARG002
        self._call_count += 1
        if self._fail_on_page is not None and self._call_count == self._fail_on_page:
            raise ValueError("LLM timeout on this page")
        if "Определи тип" in prompt:
            return self._classify
        return self._extract


class TestSpecParserUnit:
    @pytest.mark.asyncio
    async def test_happy_path(self):
        provider = MockProvider()
        parser = SpecParser(provider)
        pdf = _make_real_pdf(2)
        result = await parser.parse(pdf, "test.pdf")

        assert result.status == "done"
        assert len(result.items) >= 2
        assert result.pages_stats.total == 2
        assert result.pages_stats.processed == 2
        assert result.errors == []
        assert result.items[0].section_name == "Вентиляция"
        assert result.items[0].page_number == 1
        assert result.items[0].sort_order == 1

    @pytest.mark.asyncio
    async def test_partial_success(self):
        provider = MockProvider(fail_on_page=2)
        parser = SpecParser(provider)
        pdf = _make_real_pdf(2)
        result = await parser.parse(pdf, "test.pdf")

        assert result.status == "partial"
        assert len(result.errors) >= 1
        assert len(result.items) >= 1

    @pytest.mark.asyncio
    async def test_deduplication(self):
        extract_resp = json.dumps(
            {
                "items": [
                    {
                        "name": "Кабель UTP",
                        "model_name": "Cat.6",
                        "brand": "Belden",
                        "unit": "м",
                        "quantity": 10,
                    },
                ]
            }
        )
        provider = MockProvider(extract_response=extract_resp)
        parser = SpecParser(provider)
        pdf = _make_real_pdf(3)
        result = await parser.parse(pdf, "test.pdf")

        cables = [i for i in result.items if "Кабель" in i.name]
        assert len(cables) == 1
        assert cables[0].quantity == 30.0

    @pytest.mark.asyncio
    async def test_drawing_pages_skipped(self):
        classify_resp = json.dumps({"type": "drawing", "section_name": ""})
        provider = MockProvider(classify_response=classify_resp)
        parser = SpecParser(provider)
        pdf = _make_real_pdf(3)
        result = await parser.parse(pdf, "test.pdf")

        assert result.status == "done"
        assert result.items == []
        assert result.pages_stats.skipped == 3

    @pytest.mark.asyncio
    async def test_build_partial_snapshot(self):
        provider = MockProvider()
        parser = SpecParser(provider)
        parser.state.pages_total = 5
        parser.state.pages_processed = 2
        snapshot = parser.build_partial()
        assert snapshot.status == "partial"
        assert "timeout" in snapshot.errors[-1]


class TestParseSpecEndpoint:
    def test_non_pdf_415(self, client, auth_headers):
        resp = client.post(
            "/v1/parse/spec",
            files={"file": ("test.txt", io.BytesIO(b"not a pdf"), "text/plain")},
            headers=auth_headers,
        )
        assert resp.status_code == 415
        assert resp.json()["error"] == "unsupported_media_type"

    def test_missing_file_400(self, client, auth_headers):
        resp = client.post("/v1/parse/spec", headers=auth_headers)
        assert resp.status_code == 400
        assert resp.json()["error"] == "invalid_file"

    def test_empty_pdf_400(self, client, auth_headers):
        resp = client.post(
            "/v1/parse/spec",
            files={"file": ("empty.pdf", io.BytesIO(b""), "application/pdf")},
            headers=auth_headers,
        )
        assert resp.status_code == 400
        assert resp.json()["error"] == "invalid_file"

    def test_large_file_413(self, client, auth_headers):
        from app.config import settings

        payload = b"%PDF-1.4\n" + b"\0" * (settings.max_file_size_mb * 1024 * 1024 + 1)
        resp = client.post(
            "/v1/parse/spec",
            files={"file": ("big.pdf", io.BytesIO(payload), "application/pdf")},
            headers=auth_headers,
        )
        assert resp.status_code == 413
        body = resp.json()
        assert body["error"] == "file_too_large"
        assert body["limit_mb"] == settings.max_file_size_mb

    def test_bad_pdf_magic_415(self, client, auth_headers):
        resp = client.post(
            "/v1/parse/spec",
            files={"file": ("test.pdf", io.BytesIO(b"NOT-A-PDF"), "application/pdf")},
            headers=auth_headers,
        )
        assert resp.status_code == 415

    def test_real_pdf_mock_llm(self, client, auth_headers):
        mock = MockProvider()
        app.dependency_overrides[get_provider] = lambda: mock
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
        assert all("page_number" in it for it in data["items"])

    def test_errors_only_status_error(self, client, auth_headers):
        """Extract always fails → status=error, 200 response, errors populated."""

        class BadExtractProvider(BaseLLMProvider):
            async def vision_complete(self, image_b64, prompt):  # noqa: ARG002
                if "Определи тип" in prompt:
                    return json.dumps({"type": "specification", "section_name": ""})
                return "this is not json"

            async def aclose(self):
                return None

        app.dependency_overrides[get_provider] = lambda: BadExtractProvider()
        pdf = _make_real_pdf(1)
        resp = client.post(
            "/v1/parse/spec",
            files={"file": ("spec.pdf", io.BytesIO(pdf), "application/pdf")},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "error"
        assert body["errors"]
