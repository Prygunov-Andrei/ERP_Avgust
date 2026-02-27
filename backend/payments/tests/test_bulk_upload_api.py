"""
Тесты API endpoints для массовой загрузки счетов.
"""
import pytest
from io import BytesIO
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile

from payments.models import Invoice, BulkImportSession


BASE_URL = '/api/v1/invoices/'


@pytest.mark.django_db
class TestBulkUploadEndpoint:
    def test_bulk_upload_creates_session(self, authenticated_client):
        files = [
            SimpleUploadedFile('invoice1.pdf', b'%PDF-1.4 dummy', content_type='application/pdf'),
            SimpleUploadedFile('invoice2.pdf', b'%PDF-1.4 dummy2', content_type='application/pdf'),
        ]

        with patch('supply.tasks.recognize_invoice.delay') as mock_task, \
             patch('supply.tasks.finalize_bulk_import.apply_async'):
            response = authenticated_client.post(
                f'{BASE_URL}bulk-upload/',
                {'files': files},
                format='multipart',
            )

        assert response.status_code == 201
        data = response.json()
        assert 'session_id' in data
        assert data['total_files'] == 2
        assert data['status'] == 'processing'

    def test_bulk_upload_creates_invoices(self, authenticated_client):
        files = [
            SimpleUploadedFile('inv1.pdf', b'%PDF', content_type='application/pdf'),
            SimpleUploadedFile('inv2.xlsx', b'PK\x03\x04', content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
        ]

        with patch('supply.tasks.recognize_invoice.delay'), \
             patch('supply.tasks.finalize_bulk_import.apply_async'):
            response = authenticated_client.post(
                f'{BASE_URL}bulk-upload/',
                {'files': files},
                format='multipart',
            )

        session_id = response.json()['session_id']
        invoices = Invoice.objects.filter(bulk_session_id=session_id)
        assert invoices.count() == 2
        assert all(i.status == Invoice.Status.RECOGNITION for i in invoices)
        assert all(i.source == Invoice.Source.BULK_IMPORT for i in invoices)

    def test_bulk_upload_no_files_returns_400(self, authenticated_client):
        response = authenticated_client.post(
            f'{BASE_URL}bulk-upload/',
            {},
            format='multipart',
        )
        assert response.status_code == 400

    def test_bulk_upload_skips_unsupported_formats(self, authenticated_client):
        files = [
            SimpleUploadedFile('good.pdf', b'%PDF', content_type='application/pdf'),
            SimpleUploadedFile('bad.doc', b'doc content', content_type='application/msword'),
        ]

        with patch('supply.tasks.recognize_invoice.delay'), \
             patch('supply.tasks.finalize_bulk_import.apply_async'):
            response = authenticated_client.post(
                f'{BASE_URL}bulk-upload/',
                {'files': files},
                format='multipart',
            )

        assert response.status_code == 201
        session_id = response.json()['session_id']
        # Only 1 invoice created (PDF), .doc skipped
        invoices = Invoice.objects.filter(bulk_session_id=session_id)
        assert invoices.count() == 1

    def test_bulk_upload_requires_auth(self, api_client):
        files = [
            SimpleUploadedFile('test.pdf', b'%PDF', content_type='application/pdf'),
        ]
        response = api_client.post(
            f'{BASE_URL}bulk-upload/',
            {'files': files},
            format='multipart',
        )
        assert response.status_code == 401


@pytest.mark.django_db
class TestBulkSessionStatusEndpoint:
    def test_session_status_returns_data(self, authenticated_client, admin_user):
        session = BulkImportSession.objects.create(
            total_files=5,
            processed_files=3,
            successful=2,
            failed=1,
            created_by=admin_user,
        )

        response = authenticated_client.get(
            f'{BASE_URL}bulk-sessions/{session.id}/'
        )
        assert response.status_code == 200
        data = response.json()
        assert data['id'] == session.id
        assert data['total_files'] == 5
        assert data['processed_files'] == 3
        assert data['successful'] == 2
        assert data['failed'] == 1

    def test_session_not_found_returns_404(self, authenticated_client):
        response = authenticated_client.get(
            f'{BASE_URL}bulk-sessions/99999/'
        )
        assert response.status_code == 404

    def test_session_includes_invoices(self, authenticated_client, admin_user):
        session = BulkImportSession.objects.create(
            total_files=1,
            created_by=admin_user,
        )
        Invoice.objects.create(
            invoice_type=Invoice.InvoiceType.SUPPLIER,
            status=Invoice.Status.REVIEW,
            invoice_number='TEST-001',
            bulk_session=session,
        )

        response = authenticated_client.get(
            f'{BASE_URL}bulk-sessions/{session.id}/'
        )
        data = response.json()
        assert len(data['invoices']) == 1
