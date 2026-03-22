"""Tests for finans_assistant project — URL resolution, settings correctness."""

import pytest
from django.test import SimpleTestCase, override_settings
from django.urls import reverse, resolve, NoReverseMatch


# ===================================================================
# URL Resolution — core endpoints
# ===================================================================

class TestURLResolution(SimpleTestCase):
    """Verify that key URL patterns are resolvable."""

    def test_health_check(self):
        url = reverse('health-check')
        assert url == '/api/v1/health/'

    def test_token_obtain(self):
        url = reverse('token_obtain_pair')
        assert '/auth/login/' in url

    def test_token_refresh(self):
        url = reverse('token_refresh')
        assert '/auth/refresh/' in url

    def test_token_verify(self):
        url = reverse('token_verify')
        assert '/auth/verify/' in url

    def test_api_root(self):
        url = reverse('api-root')
        assert '/api/v1/' in url

    def test_swagger_ui(self):
        url = reverse('swagger-ui')
        assert '/api/docs/' in url

    def test_redoc(self):
        url = reverse('redoc')
        assert '/api/redoc/' in url

    def test_schema(self):
        url = reverse('schema')
        assert '/api/schema/' in url

    def test_cbr_rates(self):
        url = reverse('cbr-rates')
        assert '/cbr-rates/' in url


# ===================================================================
# URL Resolution — router-registered viewsets
# ===================================================================

class TestRouterURLResolution(SimpleTestCase):
    """Verify that router-registered ViewSet URLs are resolvable."""

    def test_objects_list(self):
        url = reverse('object-list')
        assert '/objects/' in url

    def test_contracts_list(self):
        url = reverse('contract-list')
        assert '/contracts/' in url

    def test_payments_list(self):
        url = reverse('payment-list')
        assert '/payments/' in url

    def test_users_list(self):
        url = reverse('user-list')
        assert '/users/' in url

    def test_notifications_list(self):
        url = reverse('notification-list')
        assert '/notifications/' in url

    def test_invoices_list(self):
        url = reverse('invoice-list')
        assert '/invoices/' in url

    def test_acts_list(self):
        url = reverse('act-list')
        assert '/acts/' in url


# ===================================================================
# URL Resolution — app-included urls
# ===================================================================

class TestAppIncludedURLs(SimpleTestCase):
    """Verify that app-specific URL includes resolve correctly."""

    def test_fns_suggest(self):
        url = reverse('fns-suggest')
        assert '/fns/suggest/' in url

    def test_fns_enrich(self):
        url = reverse('fns-enrich')
        assert '/fns/enrich/' in url

    def test_banking_webhook(self):
        url = reverse('tochka-webhook')
        assert '/banking/webhook/tochka/' in url

    def test_banking_oauth_callback(self):
        url = reverse('tochka-oauth-callback')
        assert '/banking/oauth/tochka/callback/' in url

    def test_bitrix_webhook(self):
        url = reverse('bitrix-webhook')
        assert '/supply/webhook/bitrix/' in url

    def test_supply_requests_list(self):
        url = reverse('supply-request-list')
        assert '/supply-requests/' in url

    def test_bank_connections_list(self):
        url = reverse('bank-connection-list')
        assert '/bank-connections/' in url

    def test_bank_payment_orders_list(self):
        url = reverse('bank-payment-order-list')
        assert '/bank-payment-orders/' in url


# ===================================================================
# Settings sanity checks
# ===================================================================

class TestSettingsConfiguration(SimpleTestCase):
    """Verify critical settings are properly loaded."""

    def test_root_urlconf(self):
        from django.conf import settings
        assert settings.ROOT_URLCONF == 'finans_assistant.urls'

    def test_installed_apps_contains_core_apps(self):
        from django.conf import settings
        required_apps = [
            'core', 'objects', 'contracts', 'payments',
            'accounting', 'fns', 'banking', 'supply',
        ]
        for app in required_apps:
            assert app in settings.INSTALLED_APPS, f'{app} not in INSTALLED_APPS'

    def test_installed_apps_contains_drf(self):
        from django.conf import settings
        assert 'rest_framework' in settings.INSTALLED_APPS
        assert 'rest_framework_simplejwt' in settings.INSTALLED_APPS

    def test_installed_apps_contains_kanban(self):
        from django.conf import settings
        kanban_apps = [
            'kanban_core', 'kanban_commercial', 'kanban_supply',
            'kanban_warehouse', 'kanban_object_tasks', 'kanban_rules', 'kanban_files',
        ]
        for app in kanban_apps:
            assert app in settings.INSTALLED_APPS, f'{app} not in INSTALLED_APPS'

    def test_rest_framework_default_auth(self):
        from django.conf import settings
        auth_classes = settings.REST_FRAMEWORK['DEFAULT_AUTHENTICATION_CLASSES']
        assert any('JWT' in cls for cls in auth_classes)

    def test_jwt_algorithm_set(self):
        from django.conf import settings
        assert settings.SIMPLE_JWT['ALGORITHM'] in ('HS256', 'RS256')

    def test_database_engine_is_postgresql(self):
        from django.conf import settings
        assert 'postgresql' in settings.DATABASES['default']['ENGINE']

    def test_default_auto_field(self):
        from django.conf import settings
        assert settings.DEFAULT_AUTO_FIELD == 'django.db.models.BigAutoField'

    def test_celery_settings_exist(self):
        from django.conf import settings
        assert hasattr(settings, 'CELERY_BROKER_URL')
        assert hasattr(settings, 'CELERY_RESULT_BACKEND')
        assert settings.CELERY_TASK_SERIALIZER == 'json'

    def test_cors_settings(self):
        from django.conf import settings
        assert hasattr(settings, 'CORS_ALLOW_CREDENTIALS')
        assert settings.CORS_ALLOW_CREDENTIALS is True

    def test_fns_api_key_setting_exists(self):
        from django.conf import settings
        assert hasattr(settings, 'FNS_API_KEY')

    def test_bank_encryption_key_setting_exists(self):
        from django.conf import settings
        assert hasattr(settings, 'BANK_ENCRYPTION_KEY')
