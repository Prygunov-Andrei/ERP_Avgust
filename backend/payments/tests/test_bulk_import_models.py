"""
Тесты моделей BulkImportSession и Invoice.bulk_session FK.
"""
import pytest
from django.contrib.auth.models import User

from payments.models import BulkImportSession, Invoice


@pytest.mark.django_db
class TestBulkImportSession:
    def test_create_session_defaults(self):
        session = BulkImportSession.objects.create(total_files=5)
        assert session.status == BulkImportSession.Status.PROCESSING
        assert session.total_files == 5
        assert session.processed_files == 0
        assert session.successful == 0
        assert session.failed == 0
        assert session.skipped_duplicate == 0
        assert session.errors == []

    def test_create_session_with_user(self, admin_user):
        session = BulkImportSession.objects.create(
            created_by=admin_user,
            total_files=3,
        )
        assert session.created_by == admin_user

    def test_status_transition_to_completed(self):
        session = BulkImportSession.objects.create(total_files=2)
        session.status = BulkImportSession.Status.COMPLETED
        session.save(update_fields=['status'])
        session.refresh_from_db()
        assert session.status == BulkImportSession.Status.COMPLETED

    def test_status_transition_to_completed_with_errors(self):
        session = BulkImportSession.objects.create(
            total_files=3, failed=1,
        )
        session.status = BulkImportSession.Status.COMPLETED_WITH_ERRORS
        session.save(update_fields=['status'])
        session.refresh_from_db()
        assert session.status == BulkImportSession.Status.COMPLETED_WITH_ERRORS

    def test_errors_json_field(self):
        session = BulkImportSession.objects.create(total_files=1)
        session.errors = ['File1.pdf: parse error', 'File2.xlsx: timeout']
        session.save(update_fields=['errors'])
        session.refresh_from_db()
        assert len(session.errors) == 2
        assert 'File1.pdf' in session.errors[0]

    def test_str_representation(self):
        session = BulkImportSession.objects.create(
            total_files=5, processed_files=3,
        )
        assert 'Импорт' in str(session)
        assert '3/5' in str(session)


@pytest.mark.django_db
class TestInvoiceBulkSessionFK:
    def test_invoice_without_bulk_session(self):
        invoice = Invoice.objects.create(
            invoice_type=Invoice.InvoiceType.SUPPLIER,
            status=Invoice.Status.RECOGNITION,
        )
        assert invoice.bulk_session is None

    def test_invoice_with_bulk_session(self):
        session = BulkImportSession.objects.create(total_files=1)
        invoice = Invoice.objects.create(
            invoice_type=Invoice.InvoiceType.SUPPLIER,
            status=Invoice.Status.RECOGNITION,
            bulk_session=session,
        )
        assert invoice.bulk_session == session
        assert session.invoices.count() == 1

    def test_invoice_source_bulk_import(self):
        invoice = Invoice.objects.create(
            source=Invoice.Source.BULK_IMPORT,
            invoice_type=Invoice.InvoiceType.SUPPLIER,
        )
        assert invoice.source == 'bulk_import'
        assert invoice.get_source_display() == 'Массовый импорт'

    def test_session_deletion_sets_null(self):
        session = BulkImportSession.objects.create(total_files=1)
        invoice = Invoice.objects.create(
            invoice_type=Invoice.InvoiceType.SUPPLIER,
            bulk_session=session,
        )
        session.delete()
        invoice.refresh_from_db()
        assert invoice.bulk_session is None
