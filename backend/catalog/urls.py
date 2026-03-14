from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CategoryViewSet, ProductViewSet, SupplierCatalogViewSet

router = DefaultRouter()
router.register(r'categories', CategoryViewSet, basename='category')
router.register(r'products', ProductViewSet, basename='product')
router.register(r'supplier-catalogs', SupplierCatalogViewSet, basename='supplier-catalog')

urlpatterns = [
    path('catalog/', include(router.urls)),
]
