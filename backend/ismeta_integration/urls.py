"""URL-конфиг ISMeta integration (E12 + E14)."""

from django.urls import path

from . import views

urlpatterns = [
    # E12: Snapshot receiver
    path("ismeta/snapshots/", views.receive_snapshot, name="ismeta-snapshot-create"),
    path("ismeta/snapshots/list/", views.list_snapshots, name="ismeta-snapshot-list"),
    # E14: JWT issuer (under erp-auth prefix — подключается отдельно в urls.py)
]

# Отдельные URL для JWT (подключаются под /api/erp-auth/v1/)
jwt_urlpatterns = [
    path("ismeta/issue-jwt", views.issue_jwt_view, name="ismeta-issue-jwt"),
    path("ismeta/refresh", views.refresh_jwt_view, name="ismeta-refresh-jwt"),
]
