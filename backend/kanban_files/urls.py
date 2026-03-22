from django.urls import path

from .views import FileInitView, FileFinalizeView, FileDownloadURLView


urlpatterns = [
    path('files/init/', FileInitView.as_view(), name='kanban-file-init'),
    path('files/finalize/', FileFinalizeView.as_view(), name='kanban-file-finalize'),
    path('files/<uuid:file_id>/download_url/', FileDownloadURLView.as_view(), name='kanban-file-download-url'),
]

