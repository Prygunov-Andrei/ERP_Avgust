"""URL-конфиг LLM Agent (E8.1)."""

from django.urls import path

from . import views

urlpatterns = [
    path(
        "estimates/<uuid:estimate_pk>/validate/",
        views.validate_estimate,
        name="estimate-validate",
    ),
    path(
        "estimates/<uuid:estimate_pk>/chat/messages/",
        views.chat_message,
        name="chat-message",
    ),
    path(
        "estimates/<uuid:estimate_pk>/chat/history/",
        views.chat_history,
        name="chat-history",
    ),
]
