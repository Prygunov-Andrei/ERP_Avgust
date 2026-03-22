from rest_framework.routers import DefaultRouter

from kanban_rules.views import RuleViewSet


router = DefaultRouter()
router.register(r'rules', RuleViewSet, basename='kanban-rule')

urlpatterns = router.urls

