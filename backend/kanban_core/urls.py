from rest_framework.routers import DefaultRouter

from kanban_core.views import BoardViewSet, ColumnViewSet, CardViewSet, AttachmentViewSet


router = DefaultRouter()
router.register(r'boards', BoardViewSet, basename='kanban-board')
router.register(r'columns', ColumnViewSet, basename='kanban-column')
router.register(r'cards', CardViewSet, basename='kanban-card')
router.register(r'attachments', AttachmentViewSet, basename='kanban-attachment')

urlpatterns = router.urls

