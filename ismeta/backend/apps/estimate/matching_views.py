"""API views для matching pipeline (E5.1)."""

from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .matching.service import MatchingService


def _get_workspace_id(request):
    return request.META.get("HTTP_X_WORKSPACE_ID") or request.query_params.get("workspace_id")


@api_view(["POST"])
def match_works(request, estimate_pk):
    """POST /api/v1/estimates/{id}/match-works/ — запустить matching."""
    workspace_id = _get_workspace_id(request)
    if not workspace_id:
        return Response({"workspace_id": "Required"}, status=status.HTTP_400_BAD_REQUEST)

    result = MatchingService.start_session(str(estimate_pk), workspace_id)
    return Response(result, status=status.HTTP_200_OK)


@api_view(["GET"])
def match_works_progress(request, estimate_pk, session_id):
    """GET .../match-works/{session_id}/ — прогресс (E5.1: синхронный, возвращает done)."""
    return Response({"session_id": session_id, "status": "done"})


@api_view(["POST"])
def match_works_apply(request, estimate_pk, session_id):
    """POST .../match-works/{session_id}/apply/ — применить результаты."""
    workspace_id = _get_workspace_id(request)
    if not workspace_id:
        return Response({"workspace_id": "Required"}, status=status.HTTP_400_BAD_REQUEST)

    results = request.data.get("results", [])
    updated = MatchingService.apply_results(results, workspace_id)
    return Response({"updated": updated}, status=status.HTTP_200_OK)
