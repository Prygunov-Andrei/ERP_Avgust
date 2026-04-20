"""POST /v1/parse/{spec,invoice,quote} — PDF parsing endpoints."""

import asyncio
import logging
from typing import Any, cast

from fastapi import APIRouter, Depends, File, Request, UploadFile
from pydantic import BaseModel

from ..auth import verify_api_key
from ..config import settings
from ..providers.base import BaseLLMProvider
from ..schemas.invoice import InvoiceParseResponse
from ..schemas.quote import QuoteParseResponse
from ..schemas.spec import SpecParseResponse
from ..services.invoice_parser import InvoiceParser
from ..services.quote_parser import QuoteParser
from ..services.spec_parser import SpecParser
from .errors import (
    FileTooLargeError,
    InvalidFileError,
    LLMUnavailableError,
    ParseFailedError,
    UnsupportedMediaTypeError,
)

logger = logging.getLogger(__name__)

router = APIRouter()


def get_provider(request: Request) -> BaseLLMProvider:
    provider = getattr(request.app.state, "provider", None)
    if provider is None:
        raise RuntimeError("LLM provider not initialized — lifespan not run")
    return provider  # type: ignore[no-any-return]


async def _read_pdf(file: UploadFile) -> tuple[bytes, str]:
    """Validate upload and return (content, filename). Raises §5 errors."""
    filename = file.filename or "document.pdf"
    content_type = (file.content_type or "").lower()

    if content_type and content_type != "application/pdf":
        raise UnsupportedMediaTypeError(
            detail=f"expected application/pdf, got {content_type}"
        )
    if not filename.lower().endswith(".pdf") and not content_type:
        raise UnsupportedMediaTypeError(detail="file must be .pdf")

    content = await file.read()

    if not content:
        raise InvalidFileError(detail="empty file")
    if len(content) > settings.max_file_size_mb * 1024 * 1024:
        raise FileTooLargeError(limit_mb=settings.max_file_size_mb)
    if not content.startswith(b"%PDF"):
        raise UnsupportedMediaTypeError(detail="not a valid PDF (magic bytes)")

    return content, filename


async def _run_with_timeout(
    parser: Any, content: bytes, filename: str, log_prefix: str
) -> BaseModel:
    """Run parser.parse under settings.parse_timeout_seconds. Translate errors to §5."""
    try:
        result: BaseModel = await asyncio.wait_for(
            parser.parse(content, filename=filename),
            timeout=settings.parse_timeout_seconds,
        )
        return cast(BaseModel, result)
    except TimeoutError:
        state = parser.state
        logger.warning(
            f"{log_prefix} timeout",
            extra={
                "doc_filename": filename,
                "timeout_sec": settings.parse_timeout_seconds,
                "pages_total": getattr(state, "pages_total", 0),
                "pages_processed": getattr(state, "pages_processed", 0),
                "items_count": len(getattr(state, "items", []) or []),
            },
        )
        return cast(BaseModel, parser.build_partial())
    except LLMUnavailableError:
        raise
    except ValueError as e:
        raise ParseFailedError(detail=str(e)) from e


def _log_done(kind: str, filename: str, result: BaseModel) -> None:
    data = result.model_dump()
    logger.info(
        f"{kind}_parse done",
        extra={
            "doc_filename": filename,
            "status": data.get("status"),
            "pages_total": (data.get("pages_stats") or {}).get("total", 0),
            "pages_processed": (data.get("pages_stats") or {}).get("processed", 0),
            "items_count": len(data.get("items") or []),
        },
    )


@router.post("/v1/parse/spec", response_model=SpecParseResponse)
async def parse_spec(
    file: UploadFile = File(...),
    _auth: None = Depends(verify_api_key),
    provider: BaseLLMProvider = Depends(get_provider),
) -> SpecParseResponse:
    content, filename = await _read_pdf(file)
    parser = SpecParser(provider)
    result = await _run_with_timeout(parser, content, filename, "spec_parse")
    assert isinstance(result, SpecParseResponse)
    _log_done("spec", filename, result)
    return result


@router.post("/v1/parse/invoice", response_model=InvoiceParseResponse)
async def parse_invoice(
    file: UploadFile = File(...),
    _auth: None = Depends(verify_api_key),
    provider: BaseLLMProvider = Depends(get_provider),
) -> InvoiceParseResponse:
    content, filename = await _read_pdf(file)
    parser = InvoiceParser(provider)
    result = await _run_with_timeout(parser, content, filename, "invoice_parse")
    assert isinstance(result, InvoiceParseResponse)
    _log_done("invoice", filename, result)
    return result


@router.post("/v1/parse/quote", response_model=QuoteParseResponse)
async def parse_quote(
    file: UploadFile = File(...),
    _auth: None = Depends(verify_api_key),
    provider: BaseLLMProvider = Depends(get_provider),
) -> QuoteParseResponse:
    content, filename = await _read_pdf(file)
    parser = QuoteParser(provider)
    result = await _run_with_timeout(parser, content, filename, "quote_parse")
    assert isinstance(result, QuoteParseResponse)
    _log_done("quote", filename, result)
    return result
