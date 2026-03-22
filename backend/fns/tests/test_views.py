"""Tests for fns.views — FNSSuggestView, FNSEnrichView, FNSQuickCheckView, FNSStatsView."""

from unittest.mock import MagicMock, patch

import pytest
from django.test import override_settings

from fns.services import FNSClientError


def _url(name):
    """Lazy reverse to avoid import-time URL resolution issues."""
    from django.urls import reverse
    return reverse(name)


# ===================================================================
# FNSSuggestView
# ===================================================================

@pytest.mark.django_db
class TestFNSSuggestView:
    """GET /api/v1/fns/suggest/?q=..."""

    def test_short_query_returns_empty(self, authenticated_client):
        resp = authenticated_client.get(_url('fns-suggest'), {'q': 'ab'})
        assert resp.status_code == 200
        assert resp.data['results'] == []
        assert resp.data['total'] == 0

    def test_empty_query_returns_empty(self, authenticated_client):
        resp = authenticated_client.get(_url('fns-suggest'))
        assert resp.status_code == 200
        assert resp.data['results'] == []

    @override_settings(FNS_API_KEY='')
    def test_no_api_key_returns_empty_from_local(self, authenticated_client):
        """If no local results and no API key, returns empty list."""
        resp = authenticated_client.get(_url('fns-suggest'), {'q': 'test query'})
        assert resp.status_code == 200
        assert resp.data['source'] == 'local'
        assert resp.data['total'] == 0

    @override_settings(FNS_API_KEY='test-key')
    @patch('fns.views.FNSClient')
    def test_fns_api_called_when_no_local(self, mock_client_cls, authenticated_client):
        mock_instance = MagicMock()
        mock_instance.search.return_value = {
            'items': [{
                'ЮЛ': {
                    'ИНН': '7707083893',
                    'НаимПолнЮЛ': 'ООО Тест',
                    'КодОКОПФ': '12300',
                }
            }]
        }
        mock_client_cls.return_value = mock_instance
        mock_client_cls.parse_search_results.return_value = [{
            'inn': '7707083893',
            'name': 'ООО Тест',
            'short_name': '',
            'kpp': '',
            'ogrn': '',
            'address': '',
            'legal_form': 'ooo',
            'status': '',
            'registration_date': '',
        }]

        resp = authenticated_client.get(_url('fns-suggest'), {'q': 'Тест Компания'})
        assert resp.status_code == 200
        assert resp.data['source'] == 'fns'

    @override_settings(FNS_API_KEY='test-key')
    @patch('fns.views.FNSClient')
    def test_fns_api_error_returns_empty(self, mock_client_cls, authenticated_client):
        mock_instance = MagicMock()
        mock_instance.search.side_effect = FNSClientError('Connection error')
        mock_client_cls.return_value = mock_instance

        resp = authenticated_client.get(_url('fns-suggest'), {'q': 'Тест Компания'})
        assert resp.status_code == 200
        assert resp.data['source'] == 'local'
        assert 'error' in resp.data

    def test_requires_authentication(self, api_client):
        resp = api_client.get(_url('fns-suggest'), {'q': 'test'})
        assert resp.status_code == 401


# ===================================================================
# FNSEnrichView
# ===================================================================

@pytest.mark.django_db
class TestFNSEnrichView:
    """GET /api/v1/fns/enrich/?inn=..."""

    def test_invalid_inn_returns_400(self, authenticated_client):
        resp = authenticated_client.get(_url('fns-enrich'), {'inn': 'abc'})
        assert resp.status_code == 400

    def test_short_inn_returns_400(self, authenticated_client):
        resp = authenticated_client.get(_url('fns-enrich'), {'inn': '12345'})
        assert resp.status_code == 400

    def test_missing_inn_returns_400(self, authenticated_client):
        resp = authenticated_client.get(_url('fns-enrich'))
        assert resp.status_code == 400

    @override_settings(FNS_API_KEY='')
    def test_no_api_key_returns_503(self, authenticated_client):
        resp = authenticated_client.get(_url('fns-enrich'), {'inn': '1234567890'})
        assert resp.status_code == 503

    @override_settings(FNS_API_KEY='test-key')
    @patch('fns.views.FNSClient')
    def test_successful_enrich(self, mock_client_cls, authenticated_client):
        mock_instance = MagicMock()
        mock_instance.get_egr.return_value = {'items': [{'ЮЛ': {'ИНН': '7707083893'}}]}
        mock_client_cls.return_value = mock_instance
        mock_client_cls.parse_egr_requisites.return_value = {
            'inn': '7707083893',
            'name': 'ООО Тест',
            'short_name': '',
            'kpp': '770701001',
            'ogrn': '',
            'address': '',
            'legal_form': 'ooo',
            'status': '',
            'registration_date': '',
            'director': '',
            'okved': '',
            'okved_name': '',
            'capital': '',
            'contact_info': '',
        }

        resp = authenticated_client.get(_url('fns-enrich'), {'inn': '7707083893'})
        assert resp.status_code == 200
        assert resp.data['inn'] == '7707083893'

    @override_settings(FNS_API_KEY='test-key')
    @patch('fns.views.FNSClient')
    def test_company_not_found_returns_404(self, mock_client_cls, authenticated_client):
        mock_instance = MagicMock()
        mock_instance.get_egr.return_value = {'items': []}
        mock_client_cls.return_value = mock_instance
        mock_client_cls.parse_egr_requisites.return_value = {}

        resp = authenticated_client.get(_url('fns-enrich'), {'inn': '7707083893'})
        assert resp.status_code == 404


# ===================================================================
# FNSQuickCheckView
# ===================================================================

@pytest.mark.django_db
class TestFNSQuickCheckView:
    """POST /api/v1/fns/quick-check/"""

    def test_invalid_inn_returns_400(self, authenticated_client):
        resp = authenticated_client.post(_url('fns-quick-check'), {'inn': 'abc'}, format='json')
        assert resp.status_code == 400

    def test_missing_inn_returns_400(self, authenticated_client):
        resp = authenticated_client.post(_url('fns-quick-check'), {}, format='json')
        assert resp.status_code == 400

    @override_settings(FNS_API_KEY='')
    def test_no_api_key_returns_503(self, authenticated_client):
        resp = authenticated_client.post(_url('fns-quick-check'), {'inn': '1234567890'}, format='json')
        assert resp.status_code == 503

    @override_settings(FNS_API_KEY='test-key')
    @patch('fns.views.FNSClient')
    def test_successful_check(self, mock_client_cls, authenticated_client):
        mock_instance = MagicMock()
        mock_instance.get_check.return_value = {
            'items': [{'ЮЛ': {'Позитив': {}, 'Негатив': {}}}]
        }
        mock_client_cls.return_value = mock_instance
        mock_client_cls.parse_check_summary.return_value = {
            'positive': [],
            'negative': [],
            'positive_count': 0,
            'negative_count': 0,
            'risk_level': 'low',
        }

        resp = authenticated_client.post(_url('fns-quick-check'), {'inn': '1234567890'}, format='json')
        assert resp.status_code == 200
        assert resp.data['inn'] == '1234567890'
        assert 'summary' in resp.data


# ===================================================================
# FNSStatsView
# ===================================================================

@pytest.mark.django_db
class TestFNSStatsView:
    """GET /api/v1/fns/stats/"""

    @override_settings(FNS_API_KEY='')
    def test_not_configured(self, authenticated_client):
        resp = authenticated_client.get(_url('fns-stats'))
        assert resp.status_code == 200
        assert resp.data['is_configured'] is False

    @override_settings(FNS_API_KEY='test-key')
    @patch('fns.views.FNSClient')
    def test_configured_success(self, mock_client_cls, authenticated_client):
        mock_instance = MagicMock()
        mock_instance.get_stats.return_value = {'items': [{'Статус': 'FREE'}]}
        mock_client_cls.return_value = mock_instance
        mock_client_cls.parse_stats.return_value = {
            'status': 'FREE',
            'start_date': '',
            'end_date': '',
            'methods': [],
        }

        resp = authenticated_client.get(_url('fns-stats'))
        assert resp.status_code == 200
        assert resp.data['is_configured'] is True


# ===================================================================
# FNS Serializers (basic validation)
# ===================================================================

class TestFNSReportCreateSerializer:
    """Test FNSReportCreateSerializer validation."""

    def test_valid_data(self):
        from fns.serializers import FNSReportCreateSerializer

        data = {'counterparty_id': 1, 'report_types': ['check', 'egr']}
        s = FNSReportCreateSerializer(data=data)
        assert s.is_valid(), s.errors

    def test_invalid_report_type(self):
        from fns.serializers import FNSReportCreateSerializer

        data = {'counterparty_id': 1, 'report_types': ['invalid']}
        s = FNSReportCreateSerializer(data=data)
        assert not s.is_valid()

    def test_empty_report_types(self):
        from fns.serializers import FNSReportCreateSerializer

        data = {'counterparty_id': 1, 'report_types': []}
        s = FNSReportCreateSerializer(data=data)
        assert not s.is_valid()

    def test_too_many_report_types(self):
        from fns.serializers import FNSReportCreateSerializer

        data = {'counterparty_id': 1, 'report_types': ['check', 'egr', 'bo', 'check']}
        s = FNSReportCreateSerializer(data=data)
        assert not s.is_valid()
