"""X-API-Key authentication."""

from fastapi import HTTPException, Request


def verify_api_key(request: Request) -> None:
    """Validate X-API-Key header against config."""
    from .config import settings

    key = request.headers.get("X-API-Key", "")
    if not key or key != settings.recognition_api_key:
        raise HTTPException(status_code=401, detail={"error": "invalid_api_key"})
