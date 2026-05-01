"""Публичные URL hvac_ismeta — подключаются в /api/hvac/ismeta/.

Маршруты строятся вручную (не через DRF router), потому что ТЗ требует:
    GET  /api/hvac/ismeta/options
    POST /api/hvac/ismeta/parse
    GET  /api/hvac/ismeta/jobs/<id>/progress
    GET  /api/hvac/ismeta/jobs/<id>/result
    GET  /api/hvac/ismeta/jobs/<id>/excel
    POST /api/hvac/ismeta/feedback

DRF DefaultRouter сделал бы /<id>/progress/ — нам нужно /jobs/<id>/progress/.
"""
from django.urls import path

from .public_views import IsmetaPublicViewSet

# Привязка action-методов к ViewSet — стандартный pattern DRF без роутера.
options_view = IsmetaPublicViewSet.as_view({"get": "options_list"})
parse_view = IsmetaPublicViewSet.as_view({"post": "parse"})
progress_view = IsmetaPublicViewSet.as_view({"get": "progress"})
result_view = IsmetaPublicViewSet.as_view({"get": "result"})
excel_view = IsmetaPublicViewSet.as_view({"get": "excel"})
feedback_view = IsmetaPublicViewSet.as_view({"post": "feedback"})


urlpatterns = [
    path("options", options_view, name="ismeta-public-options"),
    path("parse", parse_view, name="ismeta-public-parse"),
    path("jobs/<uuid:pk>/progress", progress_view, name="ismeta-public-progress"),
    path("jobs/<uuid:pk>/result", result_view, name="ismeta-public-result"),
    path("jobs/<uuid:pk>/excel", excel_view, name="ismeta-public-excel"),
    path("feedback", feedback_view, name="ismeta-public-feedback"),
]
