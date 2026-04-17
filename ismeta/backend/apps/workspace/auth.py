"""JWT authentication для ISMeta — валидирует токены выданные ERP (E14)."""

import logging

import jwt
from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework import authentication, exceptions

logger = logging.getLogger(__name__)

User = get_user_model()


def _get_jwt_secret() -> str:
    return getattr(settings, "ISMETA_JWT_SECRET", "ismeta-jwt-dev-secret")


class ERPJwtAuthentication(authentication.BaseAuthentication):
    """Проверяет Bearer JWT, выданный ERP через /api/erp-auth/v1/ismeta/issue-jwt.

    Payload: {"sub": "user_id", "workspace_id": "...", "iss": "erp-avgust", "exp": ...}
    """

    keyword = "Bearer"

    def authenticate(self, request):
        auth_header = request.META.get("HTTP_AUTHORIZATION", "")
        if not auth_header.startswith(f"{self.keyword} "):
            return None

        token = auth_header[len(self.keyword) + 1 :]
        try:
            payload = jwt.decode(token, _get_jwt_secret(), algorithms=["HS256"])
        except jwt.ExpiredSignatureError:
            raise exceptions.AuthenticationFailed("JWT expired")
        except jwt.InvalidTokenError as e:
            raise exceptions.AuthenticationFailed(f"Invalid JWT: {e}")

        user_id = payload.get("sub")
        workspace_id = payload.get("workspace_id")

        if not user_id:
            raise exceptions.AuthenticationFailed("JWT missing 'sub' claim")

        # Найти или создать пользователя (первый логин через ISMeta)
        user, _ = User.objects.get_or_create(
            username=f"ismeta-{user_id}",
            defaults={"is_active": True},
        )

        # Прокинуть workspace_id в request для WorkspaceFilterBackend
        request.META["HTTP_X_WORKSPACE_ID"] = workspace_id or ""

        return (user, payload)
