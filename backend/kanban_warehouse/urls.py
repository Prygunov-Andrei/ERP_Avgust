from rest_framework.routers import DefaultRouter

from kanban_warehouse.views import StockLocationViewSet, StockMoveViewSet


router = DefaultRouter()
router.register(r'warehouse/locations', StockLocationViewSet, basename='warehouse-location')
router.register(r'warehouse/moves', StockMoveViewSet, basename='warehouse-move')

urlpatterns = router.urls

