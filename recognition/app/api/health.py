"""Health check endpoint — no auth required."""

from fastapi import APIRouter

router = APIRouter()


@router.get("/v1/healthz")
async def healthz():
    return {"status": "ok", "service": "recognition"}
