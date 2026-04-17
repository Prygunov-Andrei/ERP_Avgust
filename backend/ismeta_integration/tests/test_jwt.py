"""Тесты E14: JWT issuer для ISMeta."""

import time
import uuid

import jwt
import pytest
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

MASTER_TOKEN = "test-master-token"
JWT_SECRET = "test-jwt-secret"


@override_settings(
    ISMETA_MASTER_TOKEN=MASTER_TOKEN,
    ISMETA_JWT_SECRET=JWT_SECRET,
    ISMETA_JWT_EXPIRY_SECONDS=3600,
)
class TestJwtIssuer(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.workspace_id = str(uuid.uuid4())
        self.user_id = "user-42"

    def test_issue_jwt(self):
        resp = self.client.post(
            "/api/erp-auth/v1/ismeta/issue-jwt",
            {
                "master_token": MASTER_TOKEN,
                "workspace_id": self.workspace_id,
                "user_id": self.user_id,
            },
            format="json",
        )
        assert resp.status_code == 200
        assert "access_token" in resp.data
        assert "expires_at" in resp.data

        # Декодируем и проверяем payload
        payload = jwt.decode(resp.data["access_token"], JWT_SECRET, algorithms=["HS256"])
        assert payload["sub"] == self.user_id
        assert payload["workspace_id"] == self.workspace_id
        assert payload["iss"] == "erp-avgust"

    def test_wrong_master_token_401(self):
        resp = self.client.post(
            "/api/erp-auth/v1/ismeta/issue-jwt",
            {
                "master_token": "wrong-token",
                "workspace_id": self.workspace_id,
                "user_id": self.user_id,
            },
            format="json",
        )
        assert resp.status_code == 401

    def test_refresh_jwt(self):
        # Issue
        resp = self.client.post(
            "/api/erp-auth/v1/ismeta/issue-jwt",
            {
                "master_token": MASTER_TOKEN,
                "workspace_id": self.workspace_id,
                "user_id": self.user_id,
            },
            format="json",
        )
        token = resp.data["access_token"]

        # Refresh
        resp2 = self.client.post(
            "/api/erp-auth/v1/ismeta/refresh",
            {"access_token": token},
            format="json",
        )
        assert resp2.status_code == 200
        assert "access_token" in resp2.data
        # Токен может совпасть если iat/exp те же (в пределах 1 сек).
        # Проверяем что refresh вернул валидный JWT.
        refreshed = jwt.decode(resp2.data["access_token"], JWT_SECRET, algorithms=["HS256"])
        assert refreshed["sub"] == self.user_id

    def test_refresh_expired_token(self):
        """Refresh должен работать даже с expired токеном (подпись ок)."""
        # Создаём expired токен вручную
        payload = {
            "sub": self.user_id,
            "workspace_id": self.workspace_id,
            "iss": "erp-avgust",
            "iat": int(time.time()) - 7200,
            "exp": int(time.time()) - 3600,  # expired 1 час назад
        }
        expired_token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")

        resp = self.client.post(
            "/api/erp-auth/v1/ismeta/refresh",
            {"access_token": expired_token},
            format="json",
        )
        assert resp.status_code == 200
        assert "access_token" in resp.data
