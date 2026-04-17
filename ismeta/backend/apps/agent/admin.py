from django.contrib import admin

from .models import ChatMessage, ChatSession


@admin.register(ChatSession)
class ChatSessionAdmin(admin.ModelAdmin):
    list_display = ("id", "estimate", "workspace", "created_at")
    raw_id_fields = ("estimate", "workspace")


@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display = ("id", "session", "role", "tokens_in", "tokens_out", "cost_usd", "created_at")
    list_filter = ("role",)
