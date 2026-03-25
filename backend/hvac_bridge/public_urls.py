from django.urls import include, path
from rest_framework_simplejwt.views import TokenRefreshView

from core.auth_views import ERPTokenObtainPairView

from .auth_views import HvacMeView, HvacRegistrationView


urlpatterns = [
    path('auth/users/', HvacRegistrationView.as_view(), name='hvac-register'),
    path('auth/users/me/', HvacMeView.as_view(), name='hvac-me'),
    path('auth/jwt/create/', ERPTokenObtainPairView.as_view(), name='hvac-token-obtain-pair'),
    path('auth/jwt/refresh/', TokenRefreshView.as_view(), name='hvac-token-refresh'),
    path('references/', include('references.urls')),
    path('', include('news.urls')),
    path('', include('feedback.urls')),
]
