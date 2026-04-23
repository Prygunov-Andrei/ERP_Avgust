"""Views для Estimate CRUD API (E4.1, specs/02-api-contracts.md §1.2–1.4)."""

import json

from django.db import connection
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.estimate.models import Estimate, EstimateItem, EstimateSection, SnapshotTransmission
from apps.estimate.serializers import (
    EstimateCreateSerializer,
    EstimateDetailSerializer,
    EstimateItemCreateSerializer,
    EstimateItemSerializer,
    EstimateListSerializer,
    EstimateSectionSerializer,
)
from apps.estimate.services.estimate_service import EstimateService, OptimisticLockError
from apps.estimate.services.markup_service import recalc_after_markup_change
from apps.estimate.excel.exporter import export_estimate_xlsx
from apps.workspace.filters import WorkspaceFilterBackend


def _get_workspace_id(request):
    return request.META.get("HTTP_X_WORKSPACE_ID") or request.query_params.get("workspace_id")


def _check_version(request):
    """Извлечь version из If-Match header."""
    if_match = request.META.get("HTTP_IF_MATCH")
    if not if_match:
        return None
    try:
        return int(if_match)
    except (ValueError, TypeError):
        return None


def _conflict_response(detail: str):
    return Response(
        {
            "type": "https://ismeta.example.com/errors/conflict",
            "title": "Conflict",
            "status": 409,
            "detail": detail,
        },
        status=status.HTTP_409_CONFLICT,
    )


# ---------------------------------------------------------------------------
# EstimateViewSet
# ---------------------------------------------------------------------------


class EstimateViewSet(viewsets.ModelViewSet):
    queryset = Estimate.objects.all()
    filter_backends = [WorkspaceFilterBackend]
    pagination_class = None

    def get_queryset(self):
        qs = super().get_queryset()
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    def get_serializer_class(self):
        if self.action == "list":
            return EstimateListSerializer
        if self.action == "create":
            return EstimateCreateSerializer
        return EstimateDetailSerializer

    def create(self, request, *args, **kwargs):
        ser = EstimateCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        workspace_id = _get_workspace_id(request)
        instance = ser.save(
            workspace_id=workspace_id,
            created_by=request.user if request.user.is_authenticated else None,
        )
        return Response(EstimateDetailSerializer(instance).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        try:
            return super().update(request, *args, **kwargs)
        except OptimisticLockError as e:
            return _conflict_response(str(e))

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.status = "archived"
        instance.save(update_fields=["status", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    def perform_update(self, serializer):
        instance = self.get_object()
        # ADR-0007: переданная смета — read-only
        if instance.status == "transmitted":
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Переданная в ERP смета недоступна для редактирования (ADR-0007).")
        version = _check_version(self.request)
        if version is not None and instance.version != version:
            raise OptimisticLockError("Estimate version conflict")
        updated = serializer.save(version=instance.version + 1)
        # Если изменились markup-дефолты — пересчитать строки
        changed = set(serializer.validated_data.keys())
        if changed & {"default_material_markup", "default_work_markup"}:
            workspace_id = _get_workspace_id(self.request)
            recalc_after_markup_change(updated.id, workspace_id, scope="estimate")

    @action(detail=True, methods=["post"], url_path="create-version")
    def create_version(self, request, pk=None):
        estimate = self.get_object()
        workspace_id = _get_workspace_id(request)
        new_est = EstimateService.create_version(estimate, workspace_id)
        serializer = EstimateDetailSerializer(new_est)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="export/xlsx")
    def export_xlsx(self, request, pk=None):
        from django.http import HttpResponse
        estimate = self.get_object()
        workspace_id = _get_workspace_id(request)
        output = export_estimate_xlsx(estimate.id, workspace_id)
        response = HttpResponse(
            output.read(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = f'attachment; filename="estimate-{estimate.id}.xlsx"'
        return response

    @action(detail=True, methods=["post"], url_path="transmit")
    def transmit(self, request, pk=None):
        """POST /api/v1/estimates/{id}/transmit/ — передать в ERP."""
        from apps.estimate.services.transmission_service import (
            AlreadyTransmittedError,
            TransmissionService,
        )

        workspace_id = _get_workspace_id(request)
        try:
            t = TransmissionService.transmit(str(pk), workspace_id)
            return Response(
                {"id": str(t.id), "status": t.status, "attempts": t.attempts},
                status=status.HTTP_200_OK if t.status == "success" else status.HTTP_202_ACCEPTED,
            )
        except AlreadyTransmittedError as e:
            return Response(
                {"detail": str(e)},
                status=status.HTTP_403_FORBIDDEN,
            )

    @action(detail=True, methods=["get"], url_path="transmissions")
    def transmissions(self, request, pk=None):
        """GET /api/v1/estimates/{id}/transmissions/ — список попыток."""
        workspace_id = _get_workspace_id(request)
        qs = SnapshotTransmission.objects.filter(
            estimate_id=pk, workspace_id=workspace_id
        )
        data = [
            {
                "id": str(t.id),
                "status": t.status,
                "attempts": t.attempts,
                "error_message": t.error_message,
                "created_at": t.created_at.isoformat() if t.created_at else None,
                "sent_at": t.sent_at.isoformat() if t.sent_at else None,
            }
            for t in qs
        ]
        return Response(data)


# ---------------------------------------------------------------------------
# SectionViewSet (nested under estimate + standalone for PATCH/DELETE)
# ---------------------------------------------------------------------------


class EstimateSectionViewSet(viewsets.ModelViewSet):
    serializer_class = EstimateSectionSerializer
    filter_backends = [WorkspaceFilterBackend]
    pagination_class = None

    def get_queryset(self):
        estimate_id = self.kwargs.get("estimate_pk")
        if estimate_id:
            return EstimateSection.objects.filter(estimate_id=estimate_id)
        return EstimateSection.objects.all()

    def perform_create(self, serializer):
        estimate_id = self.kwargs["estimate_pk"]
        workspace_id = _get_workspace_id(self.request)
        estimate = Estimate.objects.get(id=estimate_id, workspace_id=workspace_id)
        serializer.save(estimate=estimate, workspace_id=workspace_id)

    def perform_update(self, serializer):
        version = _check_version(self.request)
        instance = self.get_object()
        if version is not None and instance.version != version:
            raise OptimisticLockError("Section version conflict")
        serializer.save(version=instance.version + 1)

    def update(self, request, *args, **kwargs):
        try:
            return super().update(request, *args, **kwargs)
        except OptimisticLockError as e:
            return _conflict_response(str(e))

    def destroy(self, request, *args, **kwargs):
        """Safety net: запретить DELETE секции с живыми items.

        Без этого guard любой баг в перед-DELETE логике (например
        забытый PATCH section_id на items) каскадно удалял items через
        FK on_delete=CASCADE (QA-CYCLE заход 1/10, data-loss #58).

        Для осознанного удаления с items — использовать ?force=true.
        """
        instance = self.get_object()
        force = request.query_params.get("force", "").lower() in ("true", "1")
        if not force:
            items_count = EstimateItem.objects.filter(
                section_id=instance.id, is_deleted=False
            ).count()
            if items_count > 0:
                return Response(
                    {
                        "detail": (
                            f"Раздел содержит {items_count} "
                            "строк(и). Переместите их или подтвердите "
                            "удаление через force=true."
                        ),
                        "items_count": items_count,
                    },
                    status=status.HTTP_409_CONFLICT,
                )
        return super().destroy(request, *args, **kwargs)


# ---------------------------------------------------------------------------
# ItemViewSet (nested under estimate + standalone for PATCH/DELETE)
# ---------------------------------------------------------------------------


class EstimateItemViewSet(viewsets.ViewSet):
    """EstimateItem через service layer (managed=False)."""

    filter_backends = [WorkspaceFilterBackend]

    def list(self, request, estimate_pk=None):
        workspace_id = _get_workspace_id(request)
        if not workspace_id:
            return Response(
                {"workspace_id": "Required"}, status=status.HTTP_400_BAD_REQUEST
            )
        section_id = request.query_params.get("section_id")
        qs = EstimateItem.objects.filter(estimate_id=estimate_pk, workspace_id=workspace_id)
        if section_id:
            qs = qs.filter(section_id=section_id)
        serializer = EstimateItemSerializer(qs, many=True)
        return Response(serializer.data)

    def create(self, request, estimate_pk=None):
        workspace_id = _get_workspace_id(request)
        if not workspace_id:
            return Response(
                {"workspace_id": "Required"}, status=status.HTTP_400_BAD_REQUEST
            )
        ser = EstimateItemCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        section = EstimateSection.objects.get(
            id=data.pop("section_id"), estimate_id=estimate_pk, workspace_id=workspace_id
        )
        estimate = Estimate.objects.get(id=estimate_pk, workspace_id=workspace_id)

        item = EstimateService.create_item(section, estimate, workspace_id, data)
        return Response(EstimateItemSerializer(item).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, pk=None):
        workspace_id = _get_workspace_id(request)
        if not workspace_id:
            return Response(
                {"workspace_id": "Required"}, status=status.HTTP_400_BAD_REQUEST
            )
        version = _check_version(request)
        if version is None:
            return Response(
                {"detail": "If-Match header required for item update"},
                status=status.HTTP_428_PRECONDITION_REQUIRED,
            )
        try:
            data = dict(request.data)
            for jfield in ("tech_specs", "custom_data", "material_markup", "work_markup"):
                val = data.get(jfield)
                if val and not isinstance(val, str):
                    data[jfield] = json.dumps(val)

            item = EstimateService.update_item(pk, workspace_id, version, data)
            response = Response(EstimateItemSerializer(item).data)
            response["ETag"] = str(item.version)
            return response
        except OptimisticLockError as e:
            return _conflict_response(str(e))

    def destroy(self, request, pk=None):
        workspace_id = _get_workspace_id(request)
        if not workspace_id:
            return Response(
                {"workspace_id": "Required"}, status=status.HTTP_400_BAD_REQUEST
            )
        version = _check_version(request)
        if version is None:
            return Response(
                {"detail": "If-Match header required for item delete"},
                status=status.HTTP_428_PRECONDITION_REQUIRED,
            )
        try:
            EstimateService.soft_delete_item(pk, workspace_id, version)
            return Response(status=status.HTTP_204_NO_CONTENT)
        except OptimisticLockError as e:
            return _conflict_response(str(e))
