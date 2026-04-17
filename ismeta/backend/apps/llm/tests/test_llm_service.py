"""Тесты LLM gateway (E16)."""

import json
import uuid
from decimal import Decimal
from pathlib import Path
from unittest.mock import patch

import pytest
from django.test import override_settings

from apps.llm.models import LLMUsage
from apps.llm.providers.mock_provider import MockProvider
from apps.llm.service import LLMService, _calc_cost
from apps.llm.types import LLMResponse, ToolCall


WORKSPACE_ID = str(uuid.uuid4())


@pytest.mark.django_db
class TestLLMServiceMock:
    @pytest.fixture(autouse=True)
    def _mock_mode(self, settings):
        settings.ISMETA_LLM_MODE = "mock"
    def test_mock_complete_returns_response(self):
        svc = LLMService(workspace_id=WORKSPACE_ID, task_type="matching")
        resp = svc.complete_sync(messages=[{"role": "user", "content": "test"}])
        assert isinstance(resp, LLMResponse)
        assert resp.content == "Mock response"
        assert resp.tokens_in == 100
        assert resp.tokens_out == 50

    def test_usage_recorded(self):
        svc = LLMService(workspace_id=WORKSPACE_ID, task_type="matching")
        svc.complete_sync(messages=[{"role": "user", "content": "test"}])
        assert LLMUsage.objects.count() == 1
        usage = LLMUsage.objects.first()
        assert usage.task_type == "matching"
        assert usage.workspace_id == uuid.UUID(WORKSPACE_ID)
        assert usage.tokens_in == 100
        assert usage.tokens_out == 50

    def test_usage_with_estimate_id(self):
        est_id = str(uuid.uuid4())
        svc = LLMService(workspace_id=WORKSPACE_ID, task_type="validation", estimate_id=est_id)
        svc.complete_sync(messages=[{"role": "user", "content": "validate"}])
        usage = LLMUsage.objects.first()
        assert str(usage.estimate_id) == est_id

    def test_tool_calls_parsing(self):
        tool_calls = [ToolCall(name="get_item", arguments={"item_id": "abc"})]
        mock = MockProvider(content="Found it", tool_calls=tool_calls)

        svc = LLMService(workspace_id=WORKSPACE_ID, task_type="chat")
        svc._provider = mock
        resp = svc.complete_sync(
            messages=[{"role": "user", "content": "find"}],
            tools=[{"type": "function", "function": {"name": "get_item"}}],
        )
        assert resp.tool_calls is not None
        assert len(resp.tool_calls) == 1
        assert resp.tool_calls[0].name == "get_item"
        assert resp.tool_calls[0].arguments == {"item_id": "abc"}

    def test_cost_calculation(self):
        cost = _calc_cost("gpt-4o-mini", tokens_in=1000, tokens_out=500)
        # in: 1000 * 0.15 / 1M = 0.00015, out: 500 * 0.60 / 1M = 0.0003
        expected = Decimal("0.000450")
        assert cost == expected

    def test_cost_unknown_model_uses_default(self):
        cost = _calc_cost("unknown-model", tokens_in=1000, tokens_out=500)
        # in: 1000 * 5.0 / 1M = 0.005, out: 500 * 15.0 / 1M = 0.0075
        expected = Decimal("0.012500")
        assert cost == expected

    @override_settings(ISMETA_LLM_MODE="real")
    def test_unknown_provider_raises(self):
        with pytest.raises(ValueError, match="Unknown LLM provider"):
            LLMService(workspace_id=WORKSPACE_ID, task_type="matching")
            # Override config to unknown provider
            svc = LLMService.__new__(LLMService)
            svc.workspace_id = WORKSPACE_ID
            svc.task_type = "matching"
            svc._config = {"provider": "unknown", "model": "x", "max_tokens": 100}
            from apps.llm.service import _get_provider
            _get_provider("unknown")


@pytest.mark.django_db
class TestCassetteProvider:
    def test_cassette_replay(self, tmp_path):
        cassette_data = {
            "content": "Cassette response",
            "tool_calls": None,
            "tokens_in": 200,
            "tokens_out": 100,
            "model": "gpt-4o-mini",
            "latency_ms": 500,
        }
        from apps.llm.providers.cassette_provider import CassetteProvider
        provider = CassetteProvider()
        provider.cassette_dir = tmp_path

        messages = [{"role": "user", "content": "test cassette"}]
        key = provider._cassette_key(messages, "gpt-4o-mini")
        cassette_file = tmp_path / f"{key}.json"
        cassette_file.write_text(json.dumps(cassette_data))

        resp = provider.complete(messages=messages, model="gpt-4o-mini")
        assert resp.content == "Cassette response"
        assert resp.tokens_in == 200

    def test_cassette_missing_raises(self, tmp_path):
        from apps.llm.providers.cassette_provider import CassetteProvider
        provider = CassetteProvider()
        provider.cassette_dir = tmp_path

        with pytest.raises(FileNotFoundError, match="Cassette not found"):
            provider.complete(messages=[{"role": "user", "content": "missing"}], model="gpt-4o")
