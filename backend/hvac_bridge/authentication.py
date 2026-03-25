from rest_framework.authentication import BaseAuthentication
from django.conf import settings


class ServiceUser:
    is_authenticated = True
    is_staff = True
    is_active = True
    pk = 0
    id = 0
    username = 'erp-service'
    email = 'erp@service.local'
    first_name = 'ERP'
    last_name = 'Service'

    def __str__(self):
        return self.username

    def save(self, *args, **kwargs):
        pass


class ServiceTokenAuthentication(BaseAuthentication):
    keyword = 'ServiceToken'

    def authenticate(self, request):
        token = getattr(settings, 'ERP_SERVICE_TOKEN', '').strip()
        if not token:
            return None

        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith(f'{self.keyword} '):
            return None

        provided_token = auth_header[len(f'{self.keyword} '):].strip()
        if provided_token == token:
            return (ServiceUser(), None)

        return None

    def authenticate_header(self, request):
        return self.keyword
