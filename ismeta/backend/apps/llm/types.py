"""Типы для LLM gateway."""

from dataclasses import dataclass, field


@dataclass
class ToolCall:
    """Вызов инструмента LLM."""

    name: str
    arguments: dict


@dataclass
class LLMResponse:
    """Ответ LLM-провайдера."""

    content: str
    tool_calls: list[ToolCall] | None
    tokens_in: int
    tokens_out: int
    model: str
    latency_ms: int
