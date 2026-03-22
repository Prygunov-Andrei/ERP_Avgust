from rest_framework.routers import DefaultRouter

from kanban_supply.views import SupplyCaseViewSet, InvoiceRefViewSet, DeliveryBatchViewSet


router = DefaultRouter()
router.register(r'supply/cases', SupplyCaseViewSet, basename='supply-case')
router.register(r'supply/invoice_refs', InvoiceRefViewSet, basename='supply-invoice-ref')
router.register(r'supply/deliveries', DeliveryBatchViewSet, basename='supply-delivery-batch')

urlpatterns = router.urls

