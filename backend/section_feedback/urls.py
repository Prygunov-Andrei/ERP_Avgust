from rest_framework.routers import DefaultRouter

from .views import SectionFeedbackViewSet, FeedbackReplyAttachmentView

router = DefaultRouter()
router.register(r'section-feedback', SectionFeedbackViewSet, basename='section-feedback')
router.register(r'section-feedback/replies', FeedbackReplyAttachmentView, basename='feedback-reply-attachment')

urlpatterns = router.urls
