from rest_framework.permissions import BasePermission
from django.conf import settings


class IsServiceToken(BasePermission):
    """
    Простая сервисная аутентификация по shared secret.

    Поддерживает оба переходных контракта:
      X-Service-Token: <ERP_SERVICE_TOKEN>
      Authorization: ServiceToken <ERP_SERVICE_TOKEN>
    """

    keyword = 'ServiceToken'

    def _extract_token(self, request):
        provided = request.headers.get('X-Service-Token', '')
        if provided:
            return provided

        authorization = request.headers.get('Authorization', '')
        prefix = f'{self.keyword} '
        if authorization.startswith(prefix):
            return authorization[len(prefix):].strip()

        return ''

    def has_permission(self, request, view):
        expected = getattr(settings, 'ERP_SERVICE_TOKEN', '')
        if not expected:
            return False
        provided = self._extract_token(request)
        return bool(provided) and provided == expected

