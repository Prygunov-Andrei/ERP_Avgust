"""Views для ISMeta integration: snapshot receiver + JWT issuer."""

from rest_framework import serializers, status
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .auth import get_ismeta_master_token, issue_jwt, refresh_jwt
from .models import IsmetaSnapshot, SnapshotStatus


def _check_master_token(request):
    """Проверить Bearer master_token. Возвращает None если ок, Response если нет."""
    auth = request.META.get("HTTP_AUTHORIZATION", "")
    if not auth.startswith("Bearer "):
        return Response({"detail": "Authorization header required"}, status=status.HTTP_401_UNAUTHORIZED)
    token = auth[7:]
    master = get_ismeta_master_token()
    if not master or token != master:
        return Response({"detail": "Invalid ISMeta master token"}, status=status.HTTP_401_UNAUTHORIZED)
    return None


# ---------------------------------------------------------------------------
# E12: Snapshot receiver
# ---------------------------------------------------------------------------


class SnapshotCreateSerializer(serializers.Serializer):
    ismeta_version_id = serializers.UUIDField()
    workspace_id = serializers.UUIDField()
    estimate = serializers.DictField()
    sections = serializers.ListField(child=serializers.DictField(), required=False, default=list)


class SnapshotListSerializer(serializers.ModelSerializer):
    class Meta:
        model = IsmetaSnapshot
        fields = ["id", "idempotency_key", "workspace_id", "ismeta_version_id", "status", "created_at"]


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def receive_snapshot(request):
    """POST /api/v1/ismeta/snapshots/ — приём snapshot из ISMeta."""
    auth_err = _check_master_token(request)
    if auth_err:
        return auth_err

    idem_key = request.META.get("HTTP_IDEMPOTENCY_KEY")
    if not idem_key:
        return Response({"detail": "Idempotency-Key header required"}, status=status.HTTP_400_BAD_REQUEST)

    existing = IsmetaSnapshot.objects.filter(idempotency_key=idem_key).first()
    if existing:
        return Response(
            {"id": str(existing.id), "status": existing.status, "created": False},
            status=status.HTTP_409_CONFLICT,
        )

    ser = SnapshotCreateSerializer(data=request.data)
    ser.is_valid(raise_exception=True)

    snapshot = IsmetaSnapshot.objects.create(
        idempotency_key=idem_key,
        workspace_id=ser.validated_data["workspace_id"],
        ismeta_version_id=ser.validated_data["ismeta_version_id"],
        payload=request.data,
        status=SnapshotStatus.RECEIVED,
    )

    return Response(
        {"id": str(snapshot.id), "status": snapshot.status, "created": True},
        status=status.HTTP_201_CREATED,
    )


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def list_snapshots(request):
    """GET /api/v1/ismeta/snapshots/ — список snapshot'ов."""
    auth_err = _check_master_token(request)
    if auth_err:
        return auth_err

    qs = IsmetaSnapshot.objects.all()
    workspace_id = request.query_params.get("workspace_id")
    if workspace_id:
        qs = qs.filter(workspace_id=workspace_id)
    ser = SnapshotListSerializer(qs[:100], many=True)
    return Response(ser.data)


# ---------------------------------------------------------------------------
# E14: JWT issuer
# ---------------------------------------------------------------------------


class IssueJwtSerializer(serializers.Serializer):
    master_token = serializers.CharField()
    workspace_id = serializers.CharField()
    user_id = serializers.CharField()


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def issue_jwt_view(request):
    """POST /api/erp-auth/v1/ismeta/issue-jwt — выдача JWT для ISMeta."""
    ser = IssueJwtSerializer(data=request.data)
    ser.is_valid(raise_exception=True)

    master = get_ismeta_master_token()
    if not master or ser.validated_data["master_token"] != master:
        return Response({"detail": "Invalid master token"}, status=status.HTTP_401_UNAUTHORIZED)

    result = issue_jwt(
        user_id=ser.validated_data["user_id"],
        workspace_id=ser.validated_data["workspace_id"],
    )
    return Response(result, status=status.HTTP_200_OK)


class RefreshJwtSerializer(serializers.Serializer):
    access_token = serializers.CharField()


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def refresh_jwt_view(request):
    """POST /api/erp-auth/v1/ismeta/refresh — refresh JWT."""
    ser = RefreshJwtSerializer(data=request.data)
    ser.is_valid(raise_exception=True)

    try:
        result = refresh_jwt(ser.validated_data["access_token"])
        return Response(result, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({"detail": f"Invalid token: {e}"}, status=status.HTTP_401_UNAUTHORIZED)
