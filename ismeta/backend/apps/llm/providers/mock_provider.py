"""Mock provider для тестов."""

from apps.llm.types import LLMResponse, ToolCall

from .base import AbstractProvider


class MockProvider(AbstractProvider):
    """Возвращает фиксированный ответ. Настраивается через конструктор."""

    def __init__(
        self,
        content: str = "Mock response",
        tool_calls: list[ToolCall] | None = None,
        tokens_in: int = 100,
        tokens_out: int = 50,
        latency_ms: int = 10,
    ):
        self._content = content
        self._tool_calls = tool_calls
        self._tokens_in = tokens_in
        self._tokens_out = tokens_out
        self._latency_ms = latency_ms

    def complete(
        self,
        messages: list[dict],
        model: str,
        max_tokens: int = 2000,
        tools: list[dict] | None = None,
    ) -> LLMResponse:
        return LLMResponse(
            content=self._content,
            tool_calls=self._tool_calls,
            tokens_in=self._tokens_in,
            tokens_out=self._tokens_out,
            model=model,
            latency_ms=self._latency_ms,
        )
