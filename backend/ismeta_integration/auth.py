"""ISMeta service-to-service auth: master token + JWT issuer."""

import time

import jwt
from django.conf import settings
from rest_framework import authentication, exceptions


def get_ismeta_master_token():
    return getattr(settings, "ISMETA_MASTER_TOKEN", "")


def get_jwt_secret():
    return getattr(settings, "ISMETA_JWT_SECRET", "ismeta-jwt-dev-secret")


def get_jwt_expiry():
    return getattr(settings, "ISMETA_JWT_EXPIRY_SECONDS", 3600)


def issue_jwt(user_id: str, workspace_id: str) -> dict:
    """Генерирует JWT для ISMeta пользователя."""
    now = int(time.time())
    exp = now + get_jwt_expiry()
    payload = {
        "sub": user_id,
        "workspace_id": workspace_id,
        "iss": "erp-avgust",
        "iat": now,
        "exp": exp,
    }
    token = jwt.encode(payload, get_jwt_secret(), algorithm="HS256")
    return {"access_token": token, "expires_at": exp}


def verify_jwt(token: str) -> dict:
    """Проверяет JWT. Для refresh — verify=False (expired ok)."""
    return jwt.decode(token, get_jwt_secret(), algorithms=["HS256"])


def refresh_jwt(token: str) -> dict:
    """Refresh: проверяем подпись (без exp), выдаём новый."""
    payload = jwt.decode(
        token, get_jwt_secret(), algorithms=["HS256"], options={"verify_exp": False}
    )
    return issue_jwt(payload["sub"], payload["workspace_id"])


class IsmetaMasterTokenAuth(authentication.BaseAuthentication):
    """Аутентификация через master_token для service-to-service."""

    def authenticate(self, request):
        auth = request.META.get("HTTP_AUTHORIZATION", "")
        if not auth.startswith("Bearer "):
            return None
        token = auth[7:]
        master = get_ismeta_master_token()
        if not master or token != master:
            raise exceptions.AuthenticationFailed("Invalid ISMeta master token")
        # Возвращаем None user, т.к. это service auth
        return (None, "ismeta-service")
