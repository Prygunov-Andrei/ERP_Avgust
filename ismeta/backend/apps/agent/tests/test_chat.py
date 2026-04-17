"""Тесты chat endpoint + tools (E8.1)."""

import json
import uuid

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.agent.models import ChatMessage, ChatSession
from apps.agent.tools import execute_tool
from apps.estimate.matching.knowledge import ProductKnowledge
from apps.estimate.models import Estimate, EstimateSection
from apps.estimate.services.estimate_service import EstimateService
from apps.llm.providers.mock_provider import MockProvider
from apps.llm.types import ToolCall
from apps.workspace.models import Workspace

User = get_user_model()

WS_HEADER = "HTTP_X_WORKSPACE_ID"


@pytest.fixture()
def ws():
    return Workspace.objects.create(name="WS-Chat", slug="ws-chat")


@pytest.fixture()
def user():
    return User.objects.create_user(username="chat-user", password="pass")


@pytest.fixture()
def client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@pytest.fixture()
def estimate(ws, user):
    return Estimate.objects.create(
        workspace=ws, name="Chat test",
        default_material_markup={"type": "percent", "value": 30},
        default_work_markup={"type": "percent", "value": 300},
        created_by=user,
    )


@pytest.fixture()
def section(estimate, ws):
    return EstimateSection.objects.create(
        estimate=estimate, workspace=ws, name="Вентиляция", sort_order=1,
    )


@pytest.fixture()
def items(section, estimate, ws):
    return [
        EstimateService.create_item(section, estimate, ws.id, {
            "name": "Вентилятор крышный", "unit": "шт", "quantity": 2,
            "equipment_price": 85000, "material_price": 0, "work_price": 12000,
        }),
    ]


@pytest.fixture()
def knowledge(ws):
    return ProductKnowledge.objects.create(
        workspace_id=ws.id, pattern="вентилятор+крышный",
        work_name="Монтаж вентилятора", work_unit="шт", work_price=12000,
    )


@pytest.mark.django_db
class TestChatEndpoint:
    @pytest.fixture(autouse=True)
    def _mock_llm(self, settings):
        settings.ISMETA_LLM_MODE = "mock"

    def test_chat_creates_session(self, client, estimate, items, ws):
        resp = client.post(
            f"/api/v1/estimates/{estimate.id}/chat/messages/",
            {"content": "Привет, проверь смету"},
            format="json",
            **{WS_HEADER: str(ws.id)},
        )
        assert resp.status_code == 200
        assert "session_id" in resp.data
        assert "content" in resp.data
        assert ChatSession.objects.filter(workspace_id=ws.id).count() == 1

    def test_chat_persists_messages(self, client, estimate, items, ws):
        client.post(
            f"/api/v1/estimates/{estimate.id}/chat/messages/",
            {"content": "Вопрос 1"},
            format="json",
            **{WS_HEADER: str(ws.id)},
        )
        client.post(
            f"/api/v1/estimates/{estimate.id}/chat/messages/",
            {"content": "Вопрос 2"},
            format="json",
            **{WS_HEADER: str(ws.id)},
        )
        session = ChatSession.objects.get(estimate=estimate, workspace_id=ws.id)
        msgs = ChatMessage.objects.filter(session=session)
        # 2 user + 2 assistant = 4
        assert msgs.count() == 4
        assert msgs.filter(role="user").count() == 2
        assert msgs.filter(role="assistant").count() == 2

    def test_chat_history(self, client, estimate, items, ws):
        client.post(
            f"/api/v1/estimates/{estimate.id}/chat/messages/",
            {"content": "Тест истории"},
            format="json",
            **{WS_HEADER: str(ws.id)},
        )
        resp = client.get(
            f"/api/v1/estimates/{estimate.id}/chat/history/",
            **{WS_HEADER: str(ws.id)},
        )
        assert resp.status_code == 200
        assert len(resp.data) >= 2

    def test_chat_returns_cost(self, client, estimate, items, ws):
        resp = client.post(
            f"/api/v1/estimates/{estimate.id}/chat/messages/",
            {"content": "Сколько стоит?"},
            format="json",
            **{WS_HEADER: str(ws.id)},
        )
        assert resp.status_code == 200
        assert "cost_usd" in resp.data
        assert "tokens_in" in resp.data


@pytest.mark.django_db
class TestTools:
    def test_get_items(self, estimate, items, ws):
        result = execute_tool("get_items", {"estimate_id": str(estimate.id)}, str(ws.id), str(estimate.id))
        assert result["count"] == 1
        assert result["items"][0]["name"] == "Вентилятор крышный"

    def test_find_alternatives(self, ws, knowledge):
        result = execute_tool("find_alternatives", {"item_name": "вентилятор крышный"}, str(ws.id), "est-1")
        assert result["count"] >= 1
        assert result["alternatives"][0]["work_name"] == "Монтаж вентилятора"

    def test_get_item_detail(self, items, ws, estimate):
        result = execute_tool("get_item_detail", {"item_id": str(items[0].id)}, str(ws.id), str(estimate.id))
        assert result["name"] == "Вентилятор крышный"
        assert "equipment_price" in result

    def test_unknown_tool(self, ws, estimate):
        result = execute_tool("nonexistent", {}, str(ws.id), str(estimate.id))
        assert "error" in result
