"""ChatSession + ChatMessage — история разговора с LLM-агентом."""

import uuid

from django.db import models

from apps.estimate.models import Estimate
from apps.workspace.models import Workspace


class ChatSession(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    estimate = models.ForeignKey(Estimate, on_delete=models.CASCADE, related_name="chat_sessions")
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "chat_session"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Chat {self.id} for {self.estimate.name}"


class MessageRole(models.TextChoices):
    USER = "user"
    ASSISTANT = "assistant"
    TOOL = "tool"


class ChatMessage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(ChatSession, on_delete=models.CASCADE, related_name="messages")
    role = models.CharField(max_length=16, choices=MessageRole.choices)
    content = models.TextField()
    tool_calls = models.JSONField(null=True, blank=True)
    tool_results = models.JSONField(null=True, blank=True)
    tokens_in = models.IntegerField(default=0)
    tokens_out = models.IntegerField(default=0)
    cost_usd = models.DecimalField(max_digits=10, decimal_places=6, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "chat_message"
        ordering = ["created_at"]

    def __str__(self) -> str:
        return f"{self.role}: {self.content[:50]}"
