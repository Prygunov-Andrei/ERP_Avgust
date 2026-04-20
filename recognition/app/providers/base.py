"""Base LLM provider interface."""

from abc import ABC, abstractmethod


class BaseLLMProvider(ABC):
    @abstractmethod
    async def vision_complete(self, image_b64: str, prompt: str) -> str:
        """Send image + prompt to LLM Vision, return text response."""
        ...

    async def aclose(self) -> None:  # pragma: no cover - default no-op
        return None
