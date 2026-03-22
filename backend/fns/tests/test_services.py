"""Tests for fns.services — FNSClient, parsing, caching, utilities."""

import hashlib
from datetime import timedelta
from unittest.mock import MagicMock, patch, PropertyMock

import httpx
import pytest
from django.test import SimpleTestCase, override_settings
from django.utils import timezone

from fns.services import (
    CACHE_TTL,
    FNSClient,
    FNSClientError,
)


# ===================================================================
# FNSClient.__init__
# ===================================================================

class TestFNSClientInit(SimpleTestCase):

    @override_settings(FNS_API_KEY='test-key-123')
    def test_init_success(self):
        client = FNSClient()
        assert client.api_key == 'test-key-123'

    @override_settings(FNS_API_KEY='')
    def test_init_raises_without_key(self):
        with pytest.raises(FNSClientError, match='FNS_API_KEY не настроен'):
            FNSClient()


# ===================================================================
# _get_cache_key
# ===================================================================

class TestGetCacheKey(SimpleTestCase):

    @override_settings(FNS_API_KEY='key')
    def test_cache_key_deterministic(self):
        client = FNSClient()
        key1 = client._get_cache_key('search', {'q': 'test'})
        key2 = client._get_cache_key('search', {'q': 'test'})
        assert key1 == key2

    @override_settings(FNS_API_KEY='key')
    def test_cache_key_different_params(self):
        client = FNSClient()
        key1 = client._get_cache_key('search', {'q': 'one'})
        key2 = client._get_cache_key('search', {'q': 'two'})
        assert key1 != key2

    @override_settings(FNS_API_KEY='key')
    def test_cache_key_is_sha256_hex(self):
        client = FNSClient()
        key = client._get_cache_key('egr', {'req': '1234567890'})
        assert len(key) == 64  # SHA-256 hex digest length


# ===================================================================
# _request (mocked HTTP)
# ===================================================================

class TestFNSClientRequest(SimpleTestCase):

    @override_settings(FNS_API_KEY='key')
    @patch.object(FNSClient, '_get_cached', return_value=None)
    @patch.object(FNSClient, '_set_cache')
    @patch('fns.services.httpx.Client')
    def test_successful_request(self, mock_httpx_cls, mock_set_cache, mock_get_cached):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {'items': []}
        mock_response.raise_for_status = MagicMock()

        mock_client_instance = MagicMock()
        mock_client_instance.__enter__ = MagicMock(return_value=mock_client_instance)
        mock_client_instance.__exit__ = MagicMock(return_value=False)
        mock_client_instance.get.return_value = mock_response
        mock_httpx_cls.return_value = mock_client_instance

        client = FNSClient()
        result = client._request('search', {'q': 'test'})

        assert result == {'items': []}
        mock_set_cache.assert_called_once()

    @override_settings(FNS_API_KEY='key')
    @patch.object(FNSClient, '_get_cached', return_value={'items': ['cached']})
    def test_returns_cached_data(self, mock_get_cached):
        client = FNSClient()
        result = client._request('search', {'q': 'test'}, use_cache=True)
        assert result == {'items': ['cached']}

    @override_settings(FNS_API_KEY='key')
    @patch.object(FNSClient, '_get_cached', return_value=None)
    @patch('fns.services.httpx.Client')
    def test_timeout_raises_error(self, mock_httpx_cls, mock_get_cached):
        mock_client_instance = MagicMock()
        mock_client_instance.__enter__ = MagicMock(return_value=mock_client_instance)
        mock_client_instance.__exit__ = MagicMock(return_value=False)
        mock_client_instance.get.side_effect = httpx.TimeoutException('timeout')
        mock_httpx_cls.return_value = mock_client_instance

        client = FNSClient()
        with pytest.raises(FNSClientError, match='Таймаут'):
            client._request('search', {'q': 'test'})

    @override_settings(FNS_API_KEY='key')
    @patch.object(FNSClient, '_get_cached', return_value=None)
    @patch('fns.services.httpx.Client')
    def test_403_raises_access_denied(self, mock_httpx_cls, mock_get_cached):
        mock_response = MagicMock()
        mock_response.status_code = 403
        mock_response.text = 'Forbidden'
        mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            'Forbidden', request=MagicMock(), response=mock_response,
        )

        mock_client_instance = MagicMock()
        mock_client_instance.__enter__ = MagicMock(return_value=mock_client_instance)
        mock_client_instance.__exit__ = MagicMock(return_value=False)
        mock_client_instance.get.return_value = mock_response
        mock_httpx_cls.return_value = mock_client_instance

        client = FNSClient()
        with pytest.raises(FNSClientError, match='доступ запрещён'):
            client._request('search', {'q': 'test'})


# ===================================================================
# Public methods delegation
# ===================================================================

class TestFNSClientPublicMethods(SimpleTestCase):

    @override_settings(FNS_API_KEY='key')
    @patch.object(FNSClient, '_request', return_value={'items': []})
    def test_search(self, mock_req):
        client = FNSClient()
        result = client.search('test query', page=2)
        mock_req.assert_called_once_with('search', {'q': 'test query', 'page': 2})
        assert result == {'items': []}

    @override_settings(FNS_API_KEY='key')
    @patch.object(FNSClient, '_request', return_value={'items': []})
    def test_autocomplete(self, mock_req):
        client = FNSClient()
        client.autocomplete('Авг')
        mock_req.assert_called_once_with('ac', {'q': 'Авг'})

    @override_settings(FNS_API_KEY='key')
    @patch.object(FNSClient, '_request', return_value={'items': []})
    def test_get_egr(self, mock_req):
        client = FNSClient()
        client.get_egr('1234567890')
        mock_req.assert_called_once_with('egr', {'req': '1234567890'})

    @override_settings(FNS_API_KEY='key')
    @patch.object(FNSClient, '_request', return_value={'items': []})
    def test_get_check(self, mock_req):
        client = FNSClient()
        client.get_check('1234567890')
        mock_req.assert_called_once_with('check', {'req': '1234567890'})

    @override_settings(FNS_API_KEY='key')
    @patch.object(FNSClient, '_request', return_value={'items': []})
    def test_get_bo(self, mock_req):
        client = FNSClient()
        client.get_bo('1234567890')
        mock_req.assert_called_once_with('bo', {'req': '1234567890'})

    @override_settings(FNS_API_KEY='key')
    @patch.object(FNSClient, '_request', return_value={'items': []})
    def test_get_multinfo(self, mock_req):
        client = FNSClient()
        inns = ['111', '222', '333']
        client.get_multinfo(inns)
        mock_req.assert_called_once_with('multinfo', {'req': '111,222,333'})

    @override_settings(FNS_API_KEY='key')
    @patch.object(FNSClient, '_request', return_value={'items': []})
    def test_get_multinfo_limit_100(self, mock_req):
        client = FNSClient()
        inns = [str(i) for i in range(200)]
        client.get_multinfo(inns)
        # Should only send first 100
        call_args = mock_req.call_args[0]
        assert len(call_args[1]['req'].split(',')) == 100


# ===================================================================
# _detect_legal_form
# ===================================================================

class TestDetectLegalForm(SimpleTestCase):

    def test_okopf_code_ooo(self):
        result = FNSClient._detect_legal_form(
            item={}, inn='1234567890', full_name='', okopf_code='12300',
        )
        assert result == 'ooo'

    def test_okopf_code_ip(self):
        result = FNSClient._detect_legal_form(
            item={}, inn='1234567890', full_name='', okopf_code='50102',
        )
        assert result == 'ip'

    def test_okopf_text_ip(self):
        result = FNSClient._detect_legal_form(
            item={}, inn='1234567890', full_name='',
            okopf_name='Индивидуальные предприниматели',
        )
        assert result == 'ip'

    def test_okopf_text_ooo(self):
        result = FNSClient._detect_legal_form(
            item={}, inn='1234567890', full_name='',
            okopf_name='Общества с ограниченной ответственностью',
        )
        assert result == 'ooo'

    def test_ip_key_in_item(self):
        result = FNSClient._detect_legal_form(
            item={'ИП': {'ФИО': 'Иванов'}}, inn='1234567890', full_name='',
        )
        assert result == 'ip'

    def test_inn_12_digits_ip(self):
        result = FNSClient._detect_legal_form(
            item={}, inn='123456789012', full_name='',
        )
        assert result == 'ip'

    def test_full_name_ip(self):
        result = FNSClient._detect_legal_form(
            item={}, inn='1234567890',
            full_name='Индивидуальный предприниматель Иванов Иван Иванович',
        )
        assert result == 'ip'

    def test_fallback_ooo(self):
        result = FNSClient._detect_legal_form(
            item={}, inn='1234567890', full_name='НЕЧТО НЕПОНЯТНОЕ',
        )
        assert result == 'ooo'


# ===================================================================
# _extract_contacts
# ===================================================================

class TestExtractContacts(SimpleTestCase):

    def test_phones_list(self):
        result = FNSClient._extract_contacts({'Телефон': ['+7495111', '+7495222']})
        assert 'Тел: +7495111, +7495222' == result

    def test_phones_string(self):
        result = FNSClient._extract_contacts({'Телефон': '+7495111'})
        assert 'Тел: +7495111' == result

    def test_emails_and_site(self):
        result = FNSClient._extract_contacts({
            'e-mail': ['a@b.c'],
            'Сайт': ['example.com'],
        })
        assert 'Email: a@b.c' in result
        assert 'Сайт: example.com' in result

    def test_not_dict_returns_empty(self):
        assert FNSClient._extract_contacts(None) == ''
        assert FNSClient._extract_contacts('some string') == ''

    def test_empty_dict_returns_empty(self):
        assert FNSClient._extract_contacts({}) == ''


# ===================================================================
# _extract_address
# ===================================================================

class TestExtractAddress(SimpleTestCase):

    def test_string_address(self):
        addr = '123456, г. Москва, ул. Ленина, д. 1'
        assert FNSClient._extract_address(addr) == addr

    def test_dict_with_adres_poln(self):
        addr_dict = {'АдресПолн': 'обл. Московская, г. Балашиха'}
        assert FNSClient._extract_address(addr_dict) == 'обл. Московская, г. Балашиха'

    def test_dict_with_fias(self):
        addr_dict = {'АдресПолнФИАС': 'обл. Московская, г. Балашиха'}
        assert FNSClient._extract_address(addr_dict) == 'обл. Московская, г. Балашиха'

    def test_dict_parts(self):
        addr_dict = {'Индекс': '143000', 'Город': 'Москва', 'Улица': 'Ленина'}
        result = FNSClient._extract_address(addr_dict)
        assert '143000' in result
        assert 'Москва' in result
        assert 'Ленина' in result

    def test_none_returns_empty(self):
        assert FNSClient._extract_address(None) == ''

    def test_empty_dict(self):
        assert FNSClient._extract_address({}) == ''


# ===================================================================
# parse_egr_requisites
# ===================================================================

class TestParseEgrRequisites(SimpleTestCase):

    def test_parse_ul(self):
        raw = {
            'items': [{
                'ЮЛ': {
                    'ИНН': '7707083893',
                    'ОГРН': '1027700132195',
                    'НаимПолнЮЛ': 'ООО "ТЕСТОВАЯ КОМПАНИЯ"',
                    'НаимСокрЮЛ': 'ООО "ТЕСТКОМП"',
                    'КПП': '770701001',
                    'АдресПолн': 'г. Москва, ул. Тестовая, д. 1',
                    'Руководитель': {'ФИО': 'Иванов Иван Иванович'},
                    'ОснВидДеят': {'Код': '62.01', 'Текст': 'Разработка ПО'},
                    'УставКап': 10000,
                    'КодОКОПФ': '12300',
                    'Статус': 'Действующее',
                    'ДатаРег': '01.01.2020',
                }
            }]
        }
        result = FNSClient.parse_egr_requisites(raw)
        assert result['inn'] == '7707083893'
        assert result['ogrn'] == '1027700132195'
        assert result['name'] == 'ООО "ТЕСТОВАЯ КОМПАНИЯ"'
        assert result['short_name'] == 'ООО "ТЕСТКОМП"'
        assert result['kpp'] == '770701001'
        assert result['director'] == 'Иванов Иван Иванович'
        assert result['legal_form'] == 'ooo'
        assert result['okved'] == '62.01'
        assert result['capital'] == '10000'

    def test_parse_ip(self):
        raw = {
            'items': [{
                'ИП': {
                    'ИННФЛ': '123456789012',
                    'ОГРНИП': '123456789012345',
                    'ФИОПолн': 'Петров Петр Петрович',
                }
            }]
        }
        result = FNSClient.parse_egr_requisites(raw)
        assert result['inn'] == '123456789012'
        assert result['legal_form'] == 'ip'
        assert result['name'] == 'Петров Петр Петрович'

    def test_empty_items(self):
        assert FNSClient.parse_egr_requisites({'items': []}) == {}
        assert FNSClient.parse_egr_requisites({}) == {}


# ===================================================================
# parse_search_results
# ===================================================================

class TestParseSearchResults(SimpleTestCase):

    def test_parse_multiple_results(self):
        raw = {
            'items': [
                {'ЮЛ': {'ИНН': '111', 'НаимПолнЮЛ': 'ООО Альфа', 'КодОКОПФ': '12300'}},
                {'ИП': {'ИННФЛ': '222222222222', 'ФИОПолн': 'Иванов И.И.'}},
            ]
        }
        results = FNSClient.parse_search_results(raw)
        assert len(results) == 2
        assert results[0]['inn'] == '111'
        assert results[0]['name'] == 'ООО Альфа'
        assert results[1]['inn'] == '222222222222'
        assert results[1]['legal_form'] == 'ip'

    def test_empty_items(self):
        assert FNSClient.parse_search_results({}) == []
        assert FNSClient.parse_search_results({'items': []}) == []


# ===================================================================
# parse_check_summary
# ===================================================================

class TestParseCheckSummary(SimpleTestCase):

    def test_low_risk(self):
        raw = {
            'items': [{
                'ЮЛ': {
                    'Позитив': {'Лицензии': 'Есть', 'МСП': 'Включён'},
                    'Негатив': {},
                }
            }]
        }
        result = FNSClient.parse_check_summary(raw)
        assert result['risk_level'] == 'low'
        assert result['positive_count'] == 2
        assert result['negative_count'] == 0

    def test_medium_risk(self):
        raw = {
            'items': [{
                'ЮЛ': {
                    'Позитив': {},
                    'Негатив': {'МассовыйАдрес': 'Да'},
                }
            }]
        }
        result = FNSClient.parse_check_summary(raw)
        assert result['risk_level'] == 'medium'
        assert result['negative_count'] == 1

    def test_high_risk(self):
        raw = {
            'items': [{
                'ЮЛ': {
                    'Позитив': {},
                    'Негатив': {
                        'МассовыйАдрес': 'Да',
                        'Дисквалификация': 'Да',
                        'БлокировкаСчетов': 'Да',
                    },
                }
            }]
        }
        result = FNSClient.parse_check_summary(raw)
        assert result['risk_level'] == 'high'
        assert result['negative_count'] == 3

    def test_empty_items_returns_unknown(self):
        result = FNSClient.parse_check_summary({'items': []})
        assert result['risk_level'] == 'unknown'

    def test_nested_items_structure(self):
        """API-FNS sometimes wraps data in an extra items layer."""
        raw = {
            'items': [{
                'items': [{
                    'ЮЛ': {
                        'Позитив': {'Лицензии': 'Есть'},
                        'Негатив': {},
                    }
                }]
            }]
        }
        result = FNSClient.parse_check_summary(raw)
        assert result['positive_count'] == 1
        assert result['risk_level'] == 'low'


# ===================================================================
# parse_stats
# ===================================================================

class TestParseStats(SimpleTestCase):

    def test_parse_stats(self):
        raw = {
            'items': [{
                'Статус': 'FREE',
                'ДатаНач': '01.01.2026',
                'ДатаКон': '31.12.2026',
                'ПоискЛимит': 1000,
                'ПоискИсп': 50,
                'ЕГРЮЛЛимит': 500,
                'ЕГРЮЛИсп': 10,
            }]
        }
        result = FNSClient.parse_stats(raw)
        assert result['status'] == 'FREE'
        assert result['start_date'] == '01.01.2026'
        assert len(result['methods']) == 2
        search_method = next(m for m in result['methods'] if m['name'] == 'search')
        assert search_method['limit'] == 1000
        assert search_method['used'] == 50
        assert search_method['remaining'] == 950

    def test_empty_items(self):
        result = FNSClient.parse_stats({'items': []})
        assert result['status'] == 'UNKNOWN'
        assert result['methods'] == []


# ===================================================================
# CACHE_TTL
# ===================================================================

class TestCacheTTL(SimpleTestCase):

    def test_known_endpoints_have_ttl(self):
        assert 'search' in CACHE_TTL
        assert 'egr' in CACHE_TTL
        assert 'check' in CACHE_TTL
        assert 'bo' in CACHE_TTL
        assert 'stat' in CACHE_TTL

    def test_bo_has_longest_ttl(self):
        assert CACHE_TTL['bo'] > CACHE_TTL['search']
