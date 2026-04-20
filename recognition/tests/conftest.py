"""Shared fixtures for recognition tests."""

import os

import pytest
from fastapi.testclient import TestClient

# Set test API key before importing app
os.environ["RECOGNITION_API_KEY"] = "test-key"
os.environ["OPENAI_API_KEY"] = "sk-test"

from app.main import app  # noqa: E402


@pytest.fixture()
def client():
    return TestClient(app)


@pytest.fixture()
def auth_headers():
    return {"X-API-Key": "test-key"}
