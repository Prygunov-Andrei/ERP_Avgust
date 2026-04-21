"""
Тесты для llm_services/services/ — DocumentParser, ExcelInvoiceParser.

SpecificationParser удалён в E28 (ISMeta перешла на Recognition Service).
DocumentParser остаётся временно: (1) используется в parse_invoice view
(ERP frontend InvoiceUploader); (2) fallback для PNG/JPG в InvoiceService.
"""
import json
import hashlib
from datetime import timedelta
from unittest.mock import patch, MagicMock, PropertyMock

import pytest
from django.test import TestCase
from django.utils import timezone

from llm_services.services.document_parser import (
    DocumentParser,
    PENDING_TIMEOUT_MINUTES,
    MAX_PARSE_ATTEMPTS,
)
from llm_services.services.entity_matcher import CounterpartyMatcher, LegalEntityMatcher
from llm_services.services.exceptions import RateLimitError
from llm_services.services.excel_parser import ExcelInvoiceParser


# ============================================================================
# DocumentParser
# ============================================================================


class DocumentParserGetFileTypeTest(TestCase):
    """Тесты _get_file_type."""

    def setUp(self):
        # Мокаем всё чтобы __init__ не лез в БД
        with patch.object(DocumentParser, '__init__', lambda self: None):
            self.parser = DocumentParser.__new__(DocumentParser)

    def test_pdf_extension(self):
        self.assertEqual(self.parser._get_file_type('invoice.pdf'), 'pdf')

    def test_png_extension(self):
        self.assertEqual(self.parser._get_file_type('scan.png'), 'png')

    def test_jpg_extension(self):
        self.assertEqual(self.parser._get_file_type('photo.jpg'), 'jpg')

    def test_jpeg_extension(self):
        self.assertEqual(self.parser._get_file_type('photo.JPEG'), 'jpg')

    def test_unknown_extension_defaults_to_pdf(self):
        self.assertEqual(self.parser._get_file_type('document.docx'), 'pdf')


class DocumentParserParseWithRetriesTest(TestCase):
    """Тесты _parse_with_retries."""

    def setUp(self):
        with patch.object(DocumentParser, '__init__', lambda self: None):
            self.parser = DocumentParser.__new__(DocumentParser)
            self.parser.provider = MagicMock()
            self.parser.MAX_RETRIES = 2

    def test_success_first_try(self):
        mock_result = (MagicMock(), 100)
        self.parser.provider.parse_invoice.return_value = mock_result

        result = self.parser._parse_with_retries(b'content', 'pdf')
        self.assertEqual(result, mock_result)
        self.assertEqual(self.parser.provider.parse_invoice.call_count, 1)

    def test_retry_on_generic_error(self):
        """Ретрай при обычной ошибке, успех на второй попытке."""
        mock_result = (MagicMock(), 200)
        self.parser.provider.parse_invoice.side_effect = [
            ValueError("parse error"),
            mock_result,
        ]

        result = self.parser._parse_with_retries(b'content', 'pdf')
        self.assertEqual(result, mock_result)
        self.assertEqual(self.parser.provider.parse_invoice.call_count, 2)

    def test_rate_limit_raises_immediately(self):
        """429 / rate limit — сразу RateLimitError, без ретрая."""
        self.parser.provider.parse_invoice.side_effect = Exception("429 rate limit exceeded")

        with self.assertRaises(RateLimitError):
            self.parser._parse_with_retries(b'content', 'pdf')

        self.assertEqual(self.parser.provider.parse_invoice.call_count, 1)

    def test_exhausted_retries_raises_last_error(self):
        """Все попытки исчерпаны — бросает последнюю ошибку."""
        self.parser.provider.parse_invoice.side_effect = ValueError("persistent error")

        with self.assertRaises(ValueError):
            self.parser._parse_with_retries(b'content', 'pdf')

        self.assertEqual(self.parser.provider.parse_invoice.call_count, 3)  # 1 + 2 retries


class DocumentParserBuildResponseTest(TestCase):
    """Тесты _build_response."""

    def setUp(self):
        with patch.object(DocumentParser, '__init__', lambda self: None):
            self.parser = DocumentParser.__new__(DocumentParser)
            self.parser.counterparty_matcher = MagicMock()
            self.parser.legal_entity_matcher = MagicMock()
            self.parser.product_matcher = MagicMock()
            self.parser.CONFIDENCE_THRESHOLD = 0.7

    def test_build_response_success(self):
        parsed_doc = MagicMock()
        parsed_doc.parsed_data = {
            'vendor': {'name': 'Vendor', 'inn': '1234567890'},
            'buyer': {'name': 'Buyer', 'inn': '0987654321'},
            'items': [{'name': 'Item 1'}],
        }
        parsed_doc.confidence_score = 0.9

        self.parser.counterparty_matcher.match.return_value = {
            'match_type': 'exact', 'counterparty': MagicMock(), 'suggestions': [],
        }
        self.parser.legal_entity_matcher.match.return_value = {
            'match_type': 'exact', 'legal_entity': MagicMock(), 'error': None,
        }
        self.parser.product_matcher.find_similar.return_value = []

        result = self.parser._build_response(parsed_doc)

        self.assertTrue(result['success'])
        self.assertIsNotNone(result['data'])
        self.assertIsNotNone(result['matches'])
        self.assertIsNone(result['error'])

    def test_build_response_low_confidence_warning(self):
        """Низкая уверенность — warning в ответе."""
        parsed_doc = MagicMock()
        parsed_doc.parsed_data = {
            'vendor': {'name': 'V', 'inn': ''},
            'buyer': {'name': 'B', 'inn': ''},
            'items': [],
        }
        parsed_doc.confidence_score = 0.4

        self.parser.counterparty_matcher.match.return_value = {
            'match_type': 'not_found', 'counterparty': None, 'suggestions': [],
        }
        self.parser.legal_entity_matcher.match.return_value = {
            'match_type': 'not_found', 'legal_entity': None, 'error': 'Не найдено',
        }

        result = self.parser._build_response(parsed_doc)

        self.assertTrue(result['success'])
        self.assertTrue(any('уверенность' in w.lower() or 'Низкая' in w for w in result['warnings']))

    def test_build_response_vendor_similar_warning(self):
        """Vendor match_type=similar — warning."""
        parsed_doc = MagicMock()
        parsed_doc.parsed_data = {
            'vendor': {'name': 'V', 'inn': ''},
            'buyer': {'name': 'B', 'inn': '1111'},
            'items': [],
        }
        parsed_doc.confidence_score = 0.9

        self.parser.counterparty_matcher.match.return_value = {
            'match_type': 'similar', 'counterparty': None, 'suggestions': [{'name': 'V2'}],
        }
        self.parser.legal_entity_matcher.match.return_value = {
            'match_type': 'exact', 'legal_entity': MagicMock(), 'error': None,
        }

        result = self.parser._build_response(parsed_doc)
        self.assertTrue(any('неточно' in w for w in result['warnings']))


# ============================================================================
# ExcelInvoiceParser — _parse_response, get_file_hash
# ============================================================================


class ExcelInvoiceParserTest(TestCase):
    """Тесты ExcelInvoiceParser."""

    def test_parse_response_valid_json(self):
        raw = json.dumps({
            'vendor': {'name': 'OOO Test', 'inn': '1234567890'},
            'buyer': {'name': 'OOO Buyer', 'inn': '0987654321'},
            'invoice': {'number': 'INV-001', 'date': '2024-01-15'},
            'totals': {'amount_gross': '15000.00', 'vat_amount': '2500.00'},
            'items': [{'name': 'Товар', 'quantity': '1', 'unit': 'шт', 'price_per_unit': '15000.00'}],
            'confidence': 0.95,
        })
        result = ExcelInvoiceParser._parse_response(raw)
        self.assertEqual(result.vendor.name, 'OOO Test')
        self.assertEqual(result.confidence, 0.95)

    def test_parse_response_markdown_wrapped(self):
        inner = json.dumps({
            'vendor': {'name': 'V', 'inn': '1111111111'},
            'buyer': {'name': 'B', 'inn': '2222222222'},
            'invoice': {'number': '1', 'date': '2024-01-01'},
            'totals': {'amount_gross': '100.00'},
            'items': [],
            'confidence': 0.8,
        })
        raw = f'```json\n{inner}\n```'
        result = ExcelInvoiceParser._parse_response(raw)
        self.assertEqual(result.vendor.name, 'V')

    def test_parse_response_invalid_json_raises(self):
        with self.assertRaises(json.JSONDecodeError):
            ExcelInvoiceParser._parse_response("NOT VALID JSON")

    def test_get_file_hash(self):
        parser = ExcelInvoiceParser.__new__(ExcelInvoiceParser)
        content = b'test content'
        expected = hashlib.sha256(content).hexdigest()
        self.assertEqual(parser.get_file_hash(content), expected)

    def test_get_file_hash_different_content(self):
        parser = ExcelInvoiceParser.__new__(ExcelInvoiceParser)
        hash1 = parser.get_file_hash(b'content A')
        hash2 = parser.get_file_hash(b'content B')
        self.assertNotEqual(hash1, hash2)
