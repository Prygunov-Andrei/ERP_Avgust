"""URL-конфиг Estimate CRUD API (E4.1)."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .matching_views import match_works, match_works_apply, match_works_progress
from .views import EstimateItemViewSet, EstimateSectionViewSet, EstimateViewSet

router = DefaultRouter()
router.register(r"estimates", EstimateViewSet, basename="estimate")
router.register(r"sections", EstimateSectionViewSet, basename="section")

urlpatterns = [
    path("", include(router.urls)),
    # Nested sections under estimate
    path(
        "estimates/<uuid:estimate_pk>/sections/",
        EstimateSectionViewSet.as_view({"get": "list", "post": "create"}),
        name="estimate-sections",
    ),
    # Nested items under estimate
    path(
        "estimates/<uuid:estimate_pk>/items/",
        EstimateItemViewSet.as_view({"get": "list", "post": "create"}),
        name="estimate-items",
    ),
    # Standalone item PATCH/DELETE
    path(
        "items/<uuid:pk>/",
        EstimateItemViewSet.as_view({"patch": "partial_update", "delete": "destroy"}),
        name="item-detail",
    ),
    # Matching (E5.1)
    path("estimates/<uuid:estimate_pk>/match-works/", match_works, name="match-works"),
    path("estimates/<uuid:estimate_pk>/match-works/<str:session_id>/", match_works_progress, name="match-works-progress"),
    path("estimates/<uuid:estimate_pk>/match-works/<str:session_id>/apply/", match_works_apply, name="match-works-apply"),
]
