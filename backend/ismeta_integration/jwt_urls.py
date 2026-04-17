"""JWT URL-конфиг (подключается под /api/erp-auth/v1/)."""

from django.urls import path

from . import views

urlpatterns = [
    path("ismeta/issue-jwt", views.issue_jwt_view, name="ismeta-issue-jwt"),
    path("ismeta/refresh", views.refresh_jwt_view, name="ismeta-refresh-jwt"),
]
