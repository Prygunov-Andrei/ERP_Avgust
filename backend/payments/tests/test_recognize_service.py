"""
Тесты InvoiceService.recognize() — единого pipeline распознавания.
"""
import pytest
from decimal import Decimal
from unittest.mock import patch

import httpx
import respx
from django.core.files.base import ContentFile

from payments.models import Invoice, InvoiceEvent, InvoiceItem, BulkImportSession
from payments.services import InvoiceService


# ---------------------------------------------------------------
# Фикстуры
# ---------------------------------------------------------------

def _make_parsed_invoice(**overrides):
    """Создаёт mock ParsedInvoice."""
    from llm_services.schemas import (
        ParsedInvoice, VendorInfo, BuyerInfo, InvoiceInfo,
        TotalsInfo, InvoiceItem as InvoiceItemSchema,
    )

    defaults = dict(
        vendor=VendorInfo(name='ООО Поставщик', inn='7707083893', kpp='770701001'),
        buyer=BuyerInfo(name='ООО Покупатель', inn='7727563778'),
        invoice=InvoiceInfo(number='СЧ-001', date='2025-03-15'),
        totals=TotalsInfo(amount_gross=Decimal('12000.00'), vat_amount=Decimal('2000.00')),
        items=[
            InvoiceItemSchema(
                name='Цемент М500', quantity=Decimal('10'),
                unit='шт', price_per_unit=Decimal('1200.00'),
            ),
        ],
        confidence=0.95,
    )
    defaults.update(overrides)
    return ParsedInvoice(**defaults)


def _create_invoice(status=Invoice.Status.RECOGNITION, **kwargs):
    """Создаёт Invoice + прикрепляет PDF-файл."""
    invoice = Invoice.objects.create(
        invoice_type=Invoice.InvoiceType.SUPPLIER,
        status=status,
        source=Invoice.Source.MANUAL,
        **kwargs,
    )
    invoice.invoice_file.save(
        'test_invoice.pdf',
        ContentFile(b'%PDF-1.4 dummy content'),
        save=True,
    )
    return invoice


@pytest.fixture
def mock_parse_invoice():
    """Мокает _parse_invoice_file и _save_parsed_document для тестов без реального LLM."""
    parsed = _make_parsed_invoice()
    with patch.object(
        InvoiceService, '_parse_invoice_file',
        return_value=(parsed, 1500),
    ) as m, patch.object(
        InvoiceService, '_save_parsed_document',
        return_value=None,
    ):
        m.parsed = parsed
        yield m


@pytest.fixture
def mock_categorize():
    with patch.object(InvoiceService, '_categorize_products') as m:
        yield m


# ---------------------------------------------------------------
# Тесты
# ---------------------------------------------------------------

@pytest.mark.django_db
class TestRecognizePipeline:
    def test_recognize_pdf_invoice(self, mock_parse_invoice, mock_categorize):
        invoice = _create_invoice()
        InvoiceService.recognize(invoice.id)

        invoice.refresh_from_db()
        assert invoice.status == Invoice.Status.REVIEW
        assert invoice.invoice_number == 'СЧ-001'
        assert invoice.amount_gross == Decimal('12000.00')
        assert invoice.vat_amount == Decimal('2000.00')
        assert invoice.recognition_confidence == 0.95

    def test_recognize_creates_invoice_items(self, mock_parse_invoice, mock_categorize):
        invoice = _create_invoice()
        InvoiceService.recognize(invoice.id)

        items = InvoiceItem.objects.filter(invoice=invoice)
        assert items.count() == 1
        assert items.first().raw_name == 'Цемент М500'
        assert items.first().quantity == Decimal('10')

    def test_recognize_skips_non_recognition_status(self, mock_parse_invoice):
        invoice = _create_invoice(status=Invoice.Status.REVIEW)
        InvoiceService.recognize(invoice.id)
        # Не должно ничего произойти
        assert not mock_parse_invoice.called

    def test_recognize_creates_event(self, mock_parse_invoice, mock_categorize):
        invoice = _create_invoice()
        InvoiceService.recognize(invoice.id)

        events = InvoiceEvent.objects.filter(invoice=invoice)
        assert events.count() >= 1
        assert any('LLM распознавание' in e.comment for e in events)

    def test_recognize_error_moves_to_review(self):
        """При ошибке парсинга — Invoice всё равно переходит в REVIEW."""
        invoice = _create_invoice()

        with patch.object(
            InvoiceService, '_parse_invoice_file',
            side_effect=ValueError('Ошибка парсинга'),
        ):
            InvoiceService.recognize(invoice.id)

        invoice.refresh_from_db()
        assert invoice.status == Invoice.Status.REVIEW
        events = InvoiceEvent.objects.filter(invoice=invoice)
        assert any('Ошибка распознавания' in e.comment for e in events)

    def test_recognize_without_file_errors(self):
        """Без файла — ошибка, но статус всё равно REVIEW."""
        invoice = Invoice.objects.create(
            invoice_type=Invoice.InvoiceType.SUPPLIER,
            status=Invoice.Status.RECOGNITION,
        )
        InvoiceService.recognize(invoice.id)

        invoice.refresh_from_db()
        assert invoice.status == Invoice.Status.REVIEW


@pytest.mark.django_db
class TestAutoCounterparty:
    def test_auto_creates_counterparty(self, mock_parse_invoice, mock_categorize):
        invoice = _create_invoice()
        InvoiceService.recognize(invoice.id, auto_counterparty=True)

        invoice.refresh_from_db()
        assert invoice.counterparty is not None
        assert invoice.counterparty.inn == '7707083893'
        assert invoice.counterparty.name == 'ООО Поставщик'

    def test_no_auto_create_by_default(self, mock_parse_invoice, mock_categorize):
        invoice = _create_invoice()
        InvoiceService.recognize(invoice.id, auto_counterparty=False)

        invoice.refresh_from_db()
        assert invoice.counterparty is None

    def test_matches_existing_counterparty(self, mock_parse_invoice, mock_categorize):
        from accounting.models import Counterparty
        cp = Counterparty.objects.create(
            name='Existing Vendor',
            type=Counterparty.Type.VENDOR,
            legal_form=Counterparty.LegalForm.OOO,
            inn='7707083893',
        )

        invoice = _create_invoice()
        InvoiceService.recognize(invoice.id)

        invoice.refresh_from_db()
        assert invoice.counterparty == cp


@pytest.mark.django_db
class TestBusinessDuplicate:
    def test_detects_business_duplicate(self, mock_parse_invoice, mock_categorize):
        """Дубликат по номеру + сумме + ИНН → предупреждение, items НЕ создаются."""
        from accounting.models import Counterparty
        # Контрагент с тем же ИНН, что вернёт mock LLM
        cp = Counterparty.objects.create(
            name='ООО Поставщик',
            type=Counterparty.Type.VENDOR,
            legal_form=Counterparty.LegalForm.OOO,
            inn='7707083893',
        )
        # Существующий счёт с тем же номером, суммой и контрагентом
        Invoice.objects.create(
            invoice_type=Invoice.InvoiceType.SUPPLIER,
            status=Invoice.Status.REVIEW,
            invoice_number='СЧ-001',
            amount_gross=Decimal('12000.00'),
            counterparty=cp,
        )

        invoice = _create_invoice()
        InvoiceService.recognize(invoice.id)

        invoice.refresh_from_db()
        assert invoice.status == Invoice.Status.REVIEW
        # Items не должны быть созданы для дубликата
        assert InvoiceItem.objects.filter(invoice=invoice).count() == 0
        # Событие с предупреждением
        events = InvoiceEvent.objects.filter(invoice=invoice)
        assert any('дубликат' in e.comment.lower() for e in events)

    def test_no_duplicate_different_number(self, mock_parse_invoice, mock_categorize):
        """Разные номера — дубликат НЕ найден, items создаются."""
        Invoice.objects.create(
            invoice_type=Invoice.InvoiceType.SUPPLIER,
            status=Invoice.Status.REVIEW,
            invoice_number='ДРУГОЙ-001',
            amount_gross=Decimal('12000.00'),
        )

        invoice = _create_invoice()
        InvoiceService.recognize(invoice.id)

        assert InvoiceItem.objects.filter(invoice=invoice).count() == 1

    def test_cancelled_not_treated_as_duplicate(self, mock_parse_invoice, mock_categorize):
        """Отменённый счёт не считается дубликатом."""
        Invoice.objects.create(
            invoice_type=Invoice.InvoiceType.SUPPLIER,
            status=Invoice.Status.CANCELLED,
            invoice_number='СЧ-001',
            amount_gross=Decimal('12000.00'),
        )

        invoice = _create_invoice()
        InvoiceService.recognize(invoice.id)

        # Items должны быть созданы — дубликат не обнаружен
        assert InvoiceItem.objects.filter(invoice=invoice).count() == 1


@pytest.mark.django_db
class TestBulkSessionUpdate:
    def test_updates_bulk_session_on_success(self, mock_parse_invoice, mock_categorize):
        session = BulkImportSession.objects.create(total_files=3)
        invoice = _create_invoice(bulk_session=session)

        InvoiceService.recognize(invoice.id)

        session.refresh_from_db()
        assert session.processed_files == 1
        assert session.successful == 1
        assert session.failed == 0

    def test_updates_bulk_session_on_error(self):
        session = BulkImportSession.objects.create(total_files=3)
        invoice = _create_invoice(bulk_session=session)

        with patch.object(
            InvoiceService, '_parse_invoice_file',
            side_effect=ValueError('Test error'),
        ):
            InvoiceService.recognize(invoice.id)

        session.refresh_from_db()
        assert session.processed_files == 1
        assert session.failed == 1
        assert len(session.errors) == 1
        assert 'Test error' in session.errors[0]


@pytest.mark.django_db
class TestRecognitionServiceIntegration:
    """E2E: реальный invoice_service → RecognitionClient → HTTP (respx mock).

    Проверяет интеграционный путь PDF — без патча _parse_invoice_file.
    """

    RECOGNITION_URL = "http://recognition:8003"

    @pytest.fixture(autouse=True)
    def _configure_recognition(self, settings):
        settings.RECOGNITION_URL = self.RECOGNITION_URL
        settings.RECOGNITION_API_KEY = "dev-recognition-key-change-me"

    @pytest.fixture
    def mock_save(self):
        with patch.object(
            InvoiceService, '_save_parsed_document', return_value=None,
        ):
            yield

    def test_pdf_goes_through_recognition_http(self, mock_save, mock_categorize):
        invoice = _create_invoice()
        recognition_response = {
            "status": "done",
            "items": [
                {"name": "Цемент М500", "model_name": "", "brand": "",
                 "unit": "шт", "quantity": 10.0, "price_unit": 1200.0,
                 "price_total": 12000.0, "currency": "RUB", "vat_rate": 20,
                 "page_number": 1, "sort_order": 0}
            ],
            "supplier": {
                "name": "ООО Поставщик", "inn": "7707083893", "kpp": "770701001",
                "bank_account": "", "bik": "", "correspondent_account": "",
            },
            "invoice_meta": {
                "number": "СЧ-001", "date": "2025-03-15",
                "total_amount": 12000.0, "vat_amount": 2000.0, "currency": "RUB",
            },
            "errors": [],
            "pages_stats": {"total": 1, "processed": 1, "skipped": 0, "error": 0},
        }
        with respx.mock() as mock:
            mock.post(f"{self.RECOGNITION_URL}/v1/parse/invoice").mock(
                return_value=httpx.Response(200, json=recognition_response)
            )
            InvoiceService.recognize(invoice.id)

        invoice.refresh_from_db()
        assert invoice.status == Invoice.Status.REVIEW
        assert invoice.invoice_number == "СЧ-001"
        assert invoice.amount_gross == Decimal("12000.0")
        assert invoice.vat_amount == Decimal("2000.0")
        items = InvoiceItem.objects.filter(invoice=invoice)
        assert items.count() == 1
        assert items.first().raw_name == "Цемент М500"

    def test_recognition_401_moves_to_review_with_event(self, mock_save):
        invoice = _create_invoice()
        with respx.mock() as mock:
            mock.post(f"{self.RECOGNITION_URL}/v1/parse/invoice").mock(
                return_value=httpx.Response(401, json={"error": "invalid_api_key"})
            )
            InvoiceService.recognize(invoice.id)

        invoice.refresh_from_db()
        assert invoice.status == Invoice.Status.REVIEW
        events = InvoiceEvent.objects.filter(invoice=invoice)
        assert any('invalid_api_key' in (e.comment or '') for e in events)
