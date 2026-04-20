"""OpenAI Vision provider (gpt-4o-mini)."""

import httpx

from ..config import settings
from .base import BaseLLMProvider


class OpenAIVisionProvider(BaseLLMProvider):
    def __init__(self):
        self.api_key = settings.openai_api_key
        self.model = settings.llm_model

    def vision_complete(self, image_b64: str, prompt: str) -> str:
        with httpx.Client(timeout=60.0) as client:
            resp = client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.model,
                    "messages": [
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": prompt},
                                {
                                    "type": "image_url",
                                    "image_url": {"url": f"data:image/png;base64,{image_b64}"},
                                },
                            ],
                        }
                    ],
                    "max_tokens": 4000,
                },
            )
            resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]
