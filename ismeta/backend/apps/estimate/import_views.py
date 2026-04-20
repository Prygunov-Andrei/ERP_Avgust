"""Import views (E7)."""

from rest_framework import status
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response

from .excel.importer import import_estimate_xlsx


def _get_workspace_id(request):
    return request.META.get("HTTP_X_WORKSPACE_ID") or request.query_params.get("workspace_id")


@api_view(["POST"])
@parser_classes([MultiPartParser])
def import_excel(request, estimate_pk):
    """POST /api/v1/estimates/{id}/import/excel/ — multipart upload .xlsx."""
    workspace_id = _get_workspace_id(request)
    if not workspace_id:
        return Response({"workspace_id": "Required"}, status=status.HTTP_400_BAD_REQUEST)

    file = request.FILES.get("file")
    if not file:
        return Response({"file": "Required"}, status=status.HTTP_400_BAD_REQUEST)

    if not file.name.endswith((".xlsx", ".xls")):
        return Response({"file": "Только .xlsx файлы"}, status=status.HTTP_400_BAD_REQUEST)

    result = import_estimate_xlsx(str(estimate_pk), workspace_id, file)

    if result.created == 0 and result.updated == 0 and result.errors:
        return Response(
            {"created": 0, "updated": 0, "errors": result.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )

    return Response(
        {"created": result.created, "updated": result.updated, "errors": result.errors},
        status=status.HTTP_200_OK,
    )
