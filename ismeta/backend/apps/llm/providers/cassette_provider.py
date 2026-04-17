"""Cassette provider — replay записанных LLM-ответов из JSON файлов."""

import hashlib
import json
from pathlib import Path

from django.conf import settings

from apps.llm.types import LLMResponse, ToolCall

from .base import AbstractProvider


class CassetteProvider(AbstractProvider):
    """Воспроизводит записанные ответы из data/cassettes/."""

    def __init__(self):
        self.cassette_dir = Path(
            getattr(settings, "ISMETA_CASSETTE_DIR", Path(settings.BASE_DIR) / "data" / "cassettes")
        )

    def _cassette_key(self, messages: list[dict], model: str) -> str:
        """SHA256 от messages+model для lookup."""
        data = json.dumps({"messages": messages, "model": model}, sort_keys=True, default=str)
        return hashlib.sha256(data.encode()).hexdigest()[:16]

    def complete(
        self,
        messages: list[dict],
        model: str,
        max_tokens: int = 2000,
        tools: list[dict] | None = None,
    ) -> LLMResponse:
        key = self._cassette_key(messages, model)
        cassette_file = self.cassette_dir / f"{key}.json"

        if not cassette_file.exists():
            raise FileNotFoundError(
                f"Cassette not found: {cassette_file}. "
                f"Run with LLM_MODE=real to record, then copy response to {cassette_file}"
            )

        with open(cassette_file) as f:
            data = json.load(f)

        tool_calls = None
        if data.get("tool_calls"):
            tool_calls = [ToolCall(name=tc["name"], arguments=tc["arguments"]) for tc in data["tool_calls"]]

        return LLMResponse(
            content=data.get("content", ""),
            tool_calls=tool_calls,
            tokens_in=data.get("tokens_in", 0),
            tokens_out=data.get("tokens_out", 0),
            model=data.get("model", model),
            latency_ms=data.get("latency_ms", 0),
        )
