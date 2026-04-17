"""Abstract base для LLM-провайдеров."""

from abc import ABC, abstractmethod

from apps.llm.types import LLMResponse


class AbstractProvider(ABC):
    """Интерфейс LLM-провайдера."""

    @abstractmethod
    def complete(
        self,
        messages: list[dict],
        model: str,
        max_tokens: int = 2000,
        tools: list[dict] | None = None,
    ) -> LLMResponse:
        """Синхронный вызов LLM."""
        ...
