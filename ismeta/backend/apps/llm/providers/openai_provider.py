"""OpenAI provider через httpx (без SDK — меньше зависимостей)."""

import json
import time

import httpx
from django.conf import settings

from apps.llm.types import LLMResponse, ToolCall

from .base import AbstractProvider

OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"


class OpenAIProvider(AbstractProvider):
    def __init__(self):
        self.api_key = getattr(settings, "OPENAI_API_KEY", "")

    def complete(
        self,
        messages: list[dict],
        model: str,
        max_tokens: int = 2000,
        tools: list[dict] | None = None,
    ) -> LLMResponse:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        body: dict = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
        }
        if tools:
            body["tools"] = tools

        start = time.monotonic()
        with httpx.Client(timeout=60.0) as client:
            resp = client.post(OPENAI_API_URL, json=body, headers=headers)
            resp.raise_for_status()

        latency_ms = int((time.monotonic() - start) * 1000)
        data = resp.json()
        choice = data["choices"][0]
        usage = data.get("usage", {})

        # Parse tool calls
        tool_calls = None
        if choice["message"].get("tool_calls"):
            tool_calls = [
                ToolCall(
                    name=tc["function"]["name"],
                    arguments=json.loads(tc["function"]["arguments"]),
                )
                for tc in choice["message"]["tool_calls"]
            ]

        tokens_in = usage.get("prompt_tokens", 0)
        tokens_out = usage.get("completion_tokens", 0)

        return LLMResponse(
            content=choice["message"].get("content", "") or "",
            tool_calls=tool_calls,
            tokens_in=tokens_in,
            tokens_out=tokens_out,
            model=model,
            latency_ms=latency_ms,
        )
