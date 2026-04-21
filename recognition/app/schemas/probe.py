"""Pydantic schemas for /v1/probe — PDF inspection before full parsing."""

from pydantic import BaseModel


class ProbeResponse(BaseModel):
    pages_total: int
    has_text_layer: bool
    text_chars_total: int
    estimated_seconds: int
