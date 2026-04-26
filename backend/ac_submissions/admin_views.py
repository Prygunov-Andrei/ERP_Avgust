"""Админский API модерации заявок (/api/hvac/rating/submissions/).

Ф8C:
  - `SubmissionAdminViewSet` — list/retrieve/PATCH/DELETE. POST/PUT
    запрещены: заявки создаются только публично, а модератор
    редактирует ограниченный набор полей (status, admin_notes, brand).
  - `SubmissionConvertView` — `POST /submissions/{id}/convert-to-acmodel/`
    обёртка над `services.convert_submission_to_acmodel`.
  - `SubmissionBulkUpdateView` — `POST /submissions/bulk-update/` для
    массового переключения статуса (без конверсии).
"""
from __future__ import annotations

import logging

from django.shortcuts import get_object_or_404
from rest_framework import filters, mixins, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from hvac_bridge.permissions import IsHvacAdminProxyAllowed

from .admin_serializers import (
    AdminSubmissionDetailSerializer,
    AdminSubmissionListSerializer,
)
from .models import ACSubmission
from .services import convert_submission_to_acmodel

logger = logging.getLogger(__name__)


class SubmissionAdminViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """list/retrieve/PATCH/DELETE заявок. Поддерживает фильтры:
      - `status=pending|approved|rejected`
      - `brand=<id>`
      - `has_brand=true|false` — заявки с привязанным брендом vs только
        custom_brand_name (модератор фильтрует «без бренда» чтобы привязать)
      - `search=<q>` — `inner_unit`, `outer_unit`, `series`,
        `submitter_email`, `custom_brand_name`
      - `ordering=<field>` — `created_at`, `status` (default `-created_at`)
    """

    permission_classes = [IsHvacAdminProxyAllowed]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        "inner_unit",
        "outer_unit",
        "series",
        "submitter_email",
        "custom_brand_name",
    ]
    ordering_fields = ["created_at", "status"]
    ordering = ["-created_at"]
    http_method_names = ["get", "patch", "delete", "head", "options"]

    def get_serializer_class(self):
        if self.action == "list":
            return AdminSubmissionListSerializer
        return AdminSubmissionDetailSerializer

    def get_queryset(self):
        qs = (
            ACSubmission.objects
            .select_related("brand", "converted_model")
            .prefetch_related("photos")
        )
        params = self.request.query_params

        status_param = params.get("status")
        if status_param in dict(ACSubmission.Status.choices):
            qs = qs.filter(status=status_param)

        brand_id = params.get("brand")
        if brand_id and str(brand_id).isdigit():
            qs = qs.filter(brand_id=int(brand_id))

        has_brand = params.get("has_brand")
        if has_brand == "true":
            qs = qs.filter(brand__isnull=False)
        elif has_brand == "false":
            qs = qs.filter(brand__isnull=True)

        return qs


class SubmissionConvertView(APIView):
    """`POST /submissions/{pk}/convert-to-acmodel/`.

    Обёртка над `services.convert_submission_to_acmodel`. Сервис сам
    создаёт `ACModel`, копирует raw_values и проставляет
    `submission.converted_model` + `status=approved`.
    """

    permission_classes = [IsHvacAdminProxyAllowed]

    def post(self, request, pk):
        submission = get_object_or_404(ACSubmission, pk=pk)

        if submission.converted_model_id:
            return Response(
                {
                    "detail": (
                        "Заявка уже сконвертирована в модель "
                        f"#{submission.converted_model_id}."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not submission.brand_id and not submission.custom_brand_name:
            return Response(
                {
                    "detail": (
                        "Невозможно сконвертировать заявку без бренда: "
                        "ни `brand`, ни `custom_brand_name` не заданы."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        created_brand = bool(
            not submission.brand_id and submission.custom_brand_name,
        )

        try:
            ac_model = convert_submission_to_acmodel(submission)
        except Exception as exc:
            logger.exception(
                "convert_submission_to_acmodel failed for submission %s", pk,
            )
            return Response(
                {"detail": f"Ошибка конверсии: {exc}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {
                "submission_id": submission.id,
                "created_model_id": ac_model.id,
                "created_model_slug": ac_model.slug,
                "created_brand": created_brand,
                "redirect_to": f"/hvac-rating/models/edit/{ac_model.id}/",
            },
            status=status.HTTP_201_CREATED,
        )


class SubmissionBulkUpdateView(APIView):
    """`POST /submissions/bulk-update/` — массово переключить статус.

    Body: `{"submission_ids": [1, 2, 3], "status": "rejected"}`.
    Ответ: `{"updated": <int>, "errors": []}`.

    Конверсию `bulk-update` НЕ запускает — для этого есть
    `convert-to-acmodel/` per-submission.
    """

    permission_classes = [IsHvacAdminProxyAllowed]

    def post(self, request):
        submission_ids = request.data.get("submission_ids")
        new_status = request.data.get("status")

        if not isinstance(submission_ids, list) or not all(
            isinstance(i, int) and not isinstance(i, bool) for i in submission_ids
        ):
            return Response(
                {"detail": "submission_ids должен быть списком целых чисел."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        valid_statuses = [c[0] for c in ACSubmission.Status.choices]
        if new_status not in valid_statuses:
            return Response(
                {"detail": f"status должен быть один из {valid_statuses}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        updated = ACSubmission.objects.filter(
            id__in=submission_ids,
        ).update(status=new_status)
        return Response(
            {"updated": updated, "errors": []},
            status=status.HTTP_200_OK,
        )
