"""Base LLM provider interface."""

from abc import ABC, abstractmethod


class BaseLLMProvider(ABC):
    @abstractmethod
    def vision_complete(self, image_b64: str, prompt: str) -> str:
        """Send image + prompt to LLM Vision, return text response."""
        ...
