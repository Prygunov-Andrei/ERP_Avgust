"""POST /v1/parse/spec — PDF specification parsing."""

import logging

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from ..auth import verify_api_key
from ..config import settings
from ..providers.openai_vision import OpenAIVisionProvider
from ..schemas.spec import SpecParseResponse
from ..services.spec_parser import SpecParser

logger = logging.getLogger(__name__)

router = APIRouter()


def get_provider():
    return OpenAIVisionProvider()


@router.post("/v1/parse/spec", response_model=SpecParseResponse)
async def parse_spec(
    file: UploadFile = File(...),
    _auth: None = Depends(verify_api_key),
):
    """Parse PDF specification → structured items via LLM Vision."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=415, detail={"error": "Only PDF files accepted"})

    content = await file.read()

    if len(content) > settings.max_file_size_mb * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail={"error": f"File too large. Max {settings.max_file_size_mb} MB"},
        )

    if not content.startswith(b"%PDF"):
        raise HTTPException(status_code=415, detail={"error": "Invalid PDF file"})

    provider = get_provider()
    parser = SpecParser(provider)

    try:
        result = parser.parse(content, filename=file.filename or "document.pdf")
    except Exception as e:
        logger.exception("Parse error: %s", e)
        raise HTTPException(status_code=500, detail={"error": f"Parse failed: {e}"}) from e

    return result
