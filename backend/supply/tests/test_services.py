"""Tests for supply.services — TitleParser, BitrixAPIClient, DealProcessor."""

import time
from unittest.mock import MagicMock, patch, PropertyMock

import httpx
import pytest
from django.test import SimpleTestCase

from supply.services.bitrix_client import BitrixAPIClient, BitrixAPIError
from supply.services.title_parser import parse_deal_title, ParsedTitle


# ===================================================================
# TitleParser
# ===================================================================

class TestParseDealTitle(SimpleTestCase):

    def test_standard_format(self):
        result = parse_deal_title('115 Озёры ЖК-расходка (диски)')
        assert result.contract_number == '115'
        assert result.object_name == 'Озёры ЖК'

    def test_simple_number_and_name(self):
        result = parse_deal_title('42 Клиника на Арбате')
        assert result.contract_number == '42'
        assert result.object_name == 'Клиника на Арбате'

    def test_with_invoice_number(self):
        result = parse_deal_title('115 Озёры ЖК - расходка (диски). Все Инструменты ( сч.2602-421014-33318 )')
        assert result.contract_number == '115'
        assert result.object_name == 'Озёры ЖК'

    def test_empty_title(self):
        result = parse_deal_title('')
        assert result.contract_number is None
        assert result.object_name is None
        assert result.raw_title == ''

    def test_none_title(self):
        result = parse_deal_title(None)
        assert result.contract_number is None
        assert result.object_name is None

    def test_whitespace_only(self):
        result = parse_deal_title('   ')
        assert result.contract_number is None
        assert result.object_name is None

    def test_no_number(self):
        result = parse_deal_title('Клиника на Арбате - материалы')
        assert result.object_name == 'Клиника на Арбате'

    def test_number_not_at_start(self):
        """When no leading number, fallback searches for any number."""
        result = parse_deal_title('Объект номер 42 - материалы')
        assert result.contract_number == '42'

    def test_short_object_name_filtered(self):
        """Object names shorter than 3 chars are filtered out."""
        result = parse_deal_title('115 ЖК-расходка')
        # 'ЖК' is only 2 chars, should be None
        assert result.contract_number == '115'

    def test_raw_title_preserved(self):
        title = '  123 Тестовый объект  '
        result = parse_deal_title(title)
        assert result.raw_title == '123 Тестовый объект'


# ===================================================================
# BitrixAPIClient — rate limiting and _call
# ===================================================================

class TestBitrixAPIClientRateLimit(SimpleTestCase):

    def test_rate_limit_enforced(self):
        client = BitrixAPIClient(webhook_url='https://test.bitrix24.ru/rest/1/abc/')
        client._last_request_time = time.time()
        start = time.time()
        client._rate_limit()
        elapsed = time.time() - start
        # Should have waited ~0.5s (1/2 requests per second)
        assert elapsed >= 0.3  # Allow some margin


class TestBitrixAPIClientCall(SimpleTestCase):

    @patch('supply.services.bitrix_client.httpx.Client')
    def test_successful_call(self, mock_httpx_cls):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {'result': {'ID': '123', 'TITLE': 'Deal'}}

        mock_client_instance = MagicMock()
        mock_client_instance.__enter__ = MagicMock(return_value=mock_client_instance)
        mock_client_instance.__exit__ = MagicMock(return_value=False)
        mock_client_instance.post.return_value = mock_response
        mock_httpx_cls.return_value = mock_client_instance

        client = BitrixAPIClient(webhook_url='https://test.bitrix24.ru/rest/1/abc/')
        client._last_request_time = 0  # skip rate limit
        result = client._call('crm.deal.get', {'ID': 123})
        assert result['result']['ID'] == '123'

    @patch('supply.services.bitrix_client.httpx.Client')
    def test_error_in_response_body(self, mock_httpx_cls):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'error': 'NOT_FOUND',
            'error_description': 'Deal not found',
        }

        mock_client_instance = MagicMock()
        mock_client_instance.__enter__ = MagicMock(return_value=mock_client_instance)
        mock_client_instance.__exit__ = MagicMock(return_value=False)
        mock_client_instance.post.return_value = mock_response
        mock_httpx_cls.return_value = mock_client_instance

        client = BitrixAPIClient(webhook_url='https://test.bitrix24.ru/rest/1/abc/')
        client._last_request_time = 0
        with pytest.raises(BitrixAPIError, match='NOT_FOUND'):
            client._call('crm.deal.get', {'ID': 999})

    @patch('supply.services.bitrix_client.httpx.Client')
    def test_http_error(self, mock_httpx_cls):
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.text = 'Internal Server Error'

        mock_client_instance = MagicMock()
        mock_client_instance.__enter__ = MagicMock(return_value=mock_client_instance)
        mock_client_instance.__exit__ = MagicMock(return_value=False)
        mock_client_instance.post.return_value = mock_response
        mock_httpx_cls.return_value = mock_client_instance

        client = BitrixAPIClient(webhook_url='https://test.bitrix24.ru/rest/1/abc/')
        client._last_request_time = 0
        with pytest.raises(BitrixAPIError, match='HTTP 500'):
            client._call('crm.deal.get', {'ID': 123})


class TestBitrixAPIClientMethods(SimpleTestCase):

    @patch.object(BitrixAPIClient, '_call')
    def test_get_deal(self, mock_call):
        mock_call.return_value = {'result': {'ID': '42', 'TITLE': 'Test Deal'}}
        client = BitrixAPIClient(webhook_url='https://test.bitrix24.ru/rest/1/abc/')
        result = client.get_deal(42)
        mock_call.assert_called_once_with('crm.deal.get', {'ID': 42})
        assert result['ID'] == '42'

    @patch.object(BitrixAPIClient, '_call')
    def test_get_deal_comments_pagination(self, mock_call):
        """Test that pagination is handled correctly."""
        mock_call.side_effect = [
            {'result': [{'ID': '1'}, {'ID': '2'}], 'next': 2},
            {'result': [{'ID': '3'}]},
        ]
        client = BitrixAPIClient(webhook_url='https://test.bitrix24.ru/rest/1/abc/')
        result = client.get_deal_comments(42)
        assert len(result) == 3
        assert mock_call.call_count == 2

    @patch.object(BitrixAPIClient, '_call')
    def test_test_connection_success(self, mock_call):
        mock_call.return_value = {'result': []}
        client = BitrixAPIClient(webhook_url='https://test.bitrix24.ru/rest/1/abc/')
        assert client.test_connection() is True

    @patch.object(BitrixAPIClient, '_call')
    def test_test_connection_failure(self, mock_call):
        mock_call.side_effect = BitrixAPIError('error')
        client = BitrixAPIClient(webhook_url='https://test.bitrix24.ru/rest/1/abc/')
        assert client.test_connection() is False


# ===================================================================
# DealProcessor helpers (without DB)
# ===================================================================

class TestDealProcessorHelpers(SimpleTestCase):

    def _make_processor(self):
        from supply.services.deal_processor import DealProcessor
        mock_integration = MagicMock()
        mock_integration.webhook_url = 'https://test.bitrix24.ru/rest/1/abc/'
        mock_integration.target_stage_id = 'C1:WON'
        mock_integration.contract_field_mapping = ''
        mock_integration.object_field_mapping = ''
        return DealProcessor(mock_integration)

    def test_split_comments_request(self):
        processor = self._make_processor()
        comments = [
            {'COMMENT': 'Это запрос на материалы', 'FILES': []},
            {'COMMENT': 'Счёт от поставщика', 'FILES': [{'name': 'invoice.pdf'}]},
            {'COMMENT': 'Комментарий без файлов', 'FILES': []},
        ]
        request_comments, invoice_comments = processor._split_comments(comments)
        assert len(request_comments) == 1
        assert len(invoice_comments) == 1
        assert 'запрос' in request_comments[0]['COMMENT'].lower()

    def test_split_comments_empty(self):
        processor = self._make_processor()
        request_comments, invoice_comments = processor._split_comments([])
        assert request_comments == []
        assert invoice_comments == []

    def test_has_pdf_files_true(self):
        processor = self._make_processor()
        comment = {'FILES': [{'name': 'invoice.pdf'}]}
        assert processor._has_pdf_files(comment) is True

    def test_has_pdf_files_false(self):
        processor = self._make_processor()
        comment = {'FILES': [{'name': 'document.docx'}]}
        assert processor._has_pdf_files(comment) is False

    def test_has_pdf_files_no_files_key(self):
        processor = self._make_processor()
        comment = {}
        assert processor._has_pdf_files(comment) is False

    def test_extract_request_text(self):
        processor = self._make_processor()
        comments = [
            {'COMMENT': 'Первый запрос'},
            {'COMMENT': 'Дополнение к запросу'},
        ]
        result = processor._extract_request_text(comments)
        assert 'Первый запрос' in result
        assert 'Дополнение к запросу' in result

    def test_parse_amount_valid(self):
        from supply.services.deal_processor import DealProcessor
        assert DealProcessor._parse_amount('12345.67') == 12345.67
        assert DealProcessor._parse_amount(100) == 100.0

    def test_parse_amount_none(self):
        from supply.services.deal_processor import DealProcessor
        assert DealProcessor._parse_amount(None) is None

    def test_parse_amount_invalid(self):
        from supply.services.deal_processor import DealProcessor
        assert DealProcessor._parse_amount('not-a-number') is None
