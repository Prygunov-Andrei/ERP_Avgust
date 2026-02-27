"""
Тесты для InvoiceViewSet (API endpoints).
"""
import pytest
from datetime import date, timedelta
from decimal import Decimal

from payments.models import Invoice, InvoiceEvent, ExpenseCategory
from accounting.models import LegalEntity, Account, Counterparty, TaxSystem
from objects.models import Object


# =============================================================================
# Вспомогательные фикстуры
# =============================================================================

@pytest.fixture
def tax_system(db):
    return TaxSystem.objects.create(code='osn_view', name='ОСН', is_active=True)


@pytest.fixture
def legal_entity(tax_system):
    return LegalEntity.objects.create(
        name='Тест ЮЛ Views',
        short_name='ТЮВ',
        inn='1111111111',
        tax_system=tax_system,
        is_active=True,
    )


@pytest.fixture
def account(legal_entity):
    return Account.objects.create(
        legal_entity=legal_entity,
        name='Тестовый счёт views',
        number='40702810099999',
        is_active=True,
    )


@pytest.fixture
def counterparty(db):
    return Counterparty.objects.create(
        name='Поставщик Views',
        inn='2222222222',
        type=Counterparty.Type.VENDOR,
        legal_form=Counterparty.LegalForm.OOO,
        is_active=True,
    )


@pytest.fixture
def category(db):
    return ExpenseCategory.objects.create(
        name='Категория Views',
        code='cat_views',
        is_active=True,
    )


@pytest.fixture
def obj(db):
    return Object.objects.create(name='Объект Views')


@pytest.fixture
def invoice_data(counterparty, obj, account, legal_entity, category):
    """Словарь для POST-запроса создания Invoice."""
    return {
        'invoice_number': 'INV-API-001',
        'invoice_date': str(date.today()),
        'due_date': str(date.today() + timedelta(days=14)),
        'counterparty': counterparty.pk,
        'object': obj.pk,
        'account': account.pk,
        'legal_entity': legal_entity.pk,
        'category': category.pk,
        'amount_gross': '100000.00',
        'amount_net': '83333.33',
        'vat_amount': '16666.67',
        'description': 'Тест создание через API',
    }


@pytest.fixture
def invoice_in_review(counterparty, obj, account, legal_entity, category):
    """Invoice в статусе REVIEW (готов к verify)."""
    return Invoice.objects.create(
        source=Invoice.Source.MANUAL,
        status=Invoice.Status.REVIEW,
        invoice_number='REV-001',
        invoice_date=date.today(),
        due_date=date.today() + timedelta(days=14),
        counterparty=counterparty,
        object=obj,
        account=account,
        legal_entity=legal_entity,
        category=category,
        amount_gross=Decimal('25000.00'),
    )


@pytest.fixture
def invoice_verified(
    counterparty, obj, account, legal_entity, category,
):
    """Invoice в статусе VERIFIED (готов к submit_to_registry)."""
    return Invoice.objects.create(
        source=Invoice.Source.MANUAL,
        status=Invoice.Status.VERIFIED,
        invoice_number='VER-001',
        invoice_date=date.today(),
        due_date=date.today() + timedelta(days=14),
        counterparty=counterparty,
        object=obj,
        account=account,
        legal_entity=legal_entity,
        category=category,
        amount_gross=Decimal('30000.00'),
    )


@pytest.fixture
def invoice_in_registry(counterparty, obj, account, legal_entity, category):
    """Invoice в статусе IN_REGISTRY (готов к approve/reject/reschedule)."""
    return Invoice.objects.create(
        source=Invoice.Source.MANUAL,
        status=Invoice.Status.IN_REGISTRY,
        invoice_number='REG-001',
        invoice_date=date.today(),
        due_date=date.today() + timedelta(days=14),
        counterparty=counterparty,
        object=obj,
        account=account,
        legal_entity=legal_entity,
        category=category,
        amount_gross=Decimal('75000.00'),
    )


BASE_URL = '/api/v1/invoices/'


# =============================================================================
# Список
# =============================================================================

@pytest.mark.django_db
class TestInvoiceList:

    def test_list_returns_200(self, authenticated_client):
        response = authenticated_client.get(BASE_URL)
        assert response.status_code == 200

    def test_list_contains_invoices(self, authenticated_client, invoice_in_review):
        response = authenticated_client.get(BASE_URL)
        assert response.status_code == 200
        ids = [item['id'] for item in response.data['results']]
        assert invoice_in_review.pk in ids

    def test_list_pagination(self, authenticated_client, counterparty, category):
        for i in range(3):
            Invoice.objects.create(
                invoice_number=f'PAG-{i}',
                counterparty=counterparty,
                category=category,
            )
        response = authenticated_client.get(BASE_URL)
        assert response.status_code == 200
        assert 'results' in response.data


# =============================================================================
# Создание
# =============================================================================

@pytest.mark.django_db
class TestInvoiceCreate:

    def test_create_manual_invoice(self, authenticated_client, invoice_data):
        response = authenticated_client.post(BASE_URL, invoice_data, format='json')
        assert response.status_code == 201
        inv = Invoice.objects.get(pk=response.data['id'])
        assert inv.source == Invoice.Source.MANUAL
        assert inv.status == Invoice.Status.RECOGNITION
        assert inv.invoice_number == 'INV-API-001'

    def test_create_sets_created_by(self, authenticated_client, invoice_data, admin_user):
        response = authenticated_client.post(BASE_URL, invoice_data, format='json')
        assert response.status_code == 201
        inv = Invoice.objects.get(pk=response.data['id'])
        assert inv.created_by == admin_user

    def test_create_generates_event(self, authenticated_client, invoice_data):
        response = authenticated_client.post(BASE_URL, invoice_data, format='json')
        inv = Invoice.objects.get(pk=response.data['id'])
        assert inv.events.filter(event_type=InvoiceEvent.EventType.CREATED).exists()

    def test_create_minimal(self, authenticated_client, counterparty, category):
        """Создание с минимальным набором полей."""
        data = {
            'counterparty': counterparty.pk,
            'category': category.pk,
            'amount_gross': '5000.00',
            'description': 'Минимальный',
        }
        response = authenticated_client.post(BASE_URL, data, format='json')
        assert response.status_code == 201


# =============================================================================
# Получение детали
# =============================================================================

@pytest.mark.django_db
class TestInvoiceRetrieve:

    def test_retrieve_existing_invoice(self, authenticated_client, invoice_in_review):
        url = f'{BASE_URL}{invoice_in_review.pk}/'
        response = authenticated_client.get(url)
        assert response.status_code == 200
        assert response.data['id'] == invoice_in_review.pk
        assert response.data['invoice_number'] == 'REV-001'

    def test_retrieve_includes_nested(self, authenticated_client, invoice_in_review):
        url = f'{BASE_URL}{invoice_in_review.pk}/'
        response = authenticated_client.get(url)
        assert 'items' in response.data
        assert 'events' in response.data

    def test_retrieve_nonexistent_returns_404(self, authenticated_client):
        response = authenticated_client.get(f'{BASE_URL}999999/')
        assert response.status_code == 404


# =============================================================================
# submit_to_registry
# =============================================================================

@pytest.mark.django_db
class TestVerify:

    def test_verify_review_to_verified(
        self, authenticated_client, invoice_in_review,
    ):
        url = f'{BASE_URL}{invoice_in_review.pk}/verify/'
        resp = authenticated_client.post(url)
        assert resp.status_code == 200
        invoice_in_review.refresh_from_db()
        assert invoice_in_review.status == Invoice.Status.VERIFIED
        assert invoice_in_review.reviewed_by is not None
        assert invoice_in_review.reviewed_at is not None

    def test_verify_without_counterparty_400(
        self, authenticated_client, category,
    ):
        inv = Invoice.objects.create(
            status=Invoice.Status.REVIEW,
            amount_gross=Decimal('1000'),
            category=category,
        )
        url = f'{BASE_URL}{inv.pk}/verify/'
        resp = authenticated_client.post(url)
        assert resp.status_code == 400

    def test_verify_without_amount_400(
        self, authenticated_client, counterparty,
    ):
        inv = Invoice.objects.create(
            status=Invoice.Status.REVIEW,
            counterparty=counterparty,
        )
        url = f'{BASE_URL}{inv.pk}/verify/'
        resp = authenticated_client.post(url)
        assert resp.status_code == 400

    def test_verify_wrong_status_400(
        self, authenticated_client, invoice_in_registry,
    ):
        url = (
            f'{BASE_URL}{invoice_in_registry.pk}/verify/'
        )
        resp = authenticated_client.post(url)
        assert resp.status_code == 400

    def test_verify_creates_event(
        self, authenticated_client, invoice_in_review,
    ):
        url = f'{BASE_URL}{invoice_in_review.pk}/verify/'
        authenticated_client.post(url)
        assert invoice_in_review.events.filter(
            event_type=InvoiceEvent.EventType.REVIEWED,
        ).exists()


@pytest.mark.django_db
class TestSubmitToRegistry:

    def test_submit_verified_to_registry(
        self, authenticated_client, invoice_verified,
    ):
        url = (
            f'{BASE_URL}'
            f'{invoice_verified.pk}/submit_to_registry/'
        )
        resp = authenticated_client.post(url)
        assert resp.status_code == 200
        invoice_verified.refresh_from_db()
        assert (
            invoice_verified.status
            == Invoice.Status.IN_REGISTRY
        )

    def test_submit_review_returns_400(
        self, authenticated_client, invoice_in_review,
    ):
        """REVIEW can't go directly to registry."""
        url = (
            f'{BASE_URL}'
            f'{invoice_in_review.pk}/submit_to_registry/'
        )
        resp = authenticated_client.post(url)
        assert resp.status_code == 400

    def test_submit_wrong_status_400(
        self, authenticated_client, invoice_in_registry,
    ):
        url = (
            f'{BASE_URL}'
            f'{invoice_in_registry.pk}/submit_to_registry/'
        )
        resp = authenticated_client.post(url)
        assert resp.status_code == 400


# =============================================================================
# approve
# =============================================================================

@pytest.mark.django_db
class TestApprove:

    def test_approve_in_registry(self, authenticated_client, invoice_in_registry):
        url = f'{BASE_URL}{invoice_in_registry.pk}/approve/'
        response = authenticated_client.post(url, {'comment': 'Одобрено'}, format='json')
        assert response.status_code == 200
        invoice_in_registry.refresh_from_db()
        assert invoice_in_registry.status == Invoice.Status.APPROVED
        assert invoice_in_registry.approved_by is not None
        assert invoice_in_registry.approved_at is not None

    def test_approve_wrong_status_returns_400(self, authenticated_client, invoice_in_review):
        url = f'{BASE_URL}{invoice_in_review.pk}/approve/'
        response = authenticated_client.post(url, {}, format='json')
        assert response.status_code == 400


# =============================================================================
# reject
# =============================================================================

@pytest.mark.django_db
class TestReject:

    def test_reject_with_comment(self, authenticated_client, invoice_in_registry):
        url = f'{BASE_URL}{invoice_in_registry.pk}/reject/'
        response = authenticated_client.post(url, {'comment': 'Завышенная цена'}, format='json')
        assert response.status_code == 200
        invoice_in_registry.refresh_from_db()
        assert invoice_in_registry.status == Invoice.Status.CANCELLED
        assert invoice_in_registry.comment == 'Завышенная цена'

    def test_reject_without_comment_returns_400(self, authenticated_client, invoice_in_registry):
        url = f'{BASE_URL}{invoice_in_registry.pk}/reject/'
        response = authenticated_client.post(url, {'comment': ''}, format='json')
        assert response.status_code == 400

    def test_reject_no_body_returns_400(self, authenticated_client, invoice_in_registry):
        url = f'{BASE_URL}{invoice_in_registry.pk}/reject/'
        response = authenticated_client.post(url, {}, format='json')
        assert response.status_code == 400

    def test_reject_wrong_status_returns_400(self, authenticated_client, invoice_in_review):
        url = f'{BASE_URL}{invoice_in_review.pk}/reject/'
        response = authenticated_client.post(url, {'comment': 'Нет'}, format='json')
        assert response.status_code == 400


# =============================================================================
# reschedule
# =============================================================================

@pytest.mark.django_db
class TestReschedule:

    def test_reschedule_with_date_and_comment(self, authenticated_client, invoice_in_registry):
        new_date = str(date.today() + timedelta(days=30))
        url = f'{BASE_URL}{invoice_in_registry.pk}/reschedule/'
        response = authenticated_client.post(
            url,
            {'new_date': new_date, 'comment': 'Перенос на месяц'},
            format='json',
        )
        assert response.status_code == 200
        invoice_in_registry.refresh_from_db()
        assert str(invoice_in_registry.due_date) == new_date

    def test_reschedule_without_date_returns_400(self, authenticated_client, invoice_in_registry):
        url = f'{BASE_URL}{invoice_in_registry.pk}/reschedule/'
        response = authenticated_client.post(url, {'comment': 'Перенос'}, format='json')
        assert response.status_code == 400

    def test_reschedule_without_comment_returns_400(self, authenticated_client, invoice_in_registry):
        new_date = str(date.today() + timedelta(days=30))
        url = f'{BASE_URL}{invoice_in_registry.pk}/reschedule/'
        response = authenticated_client.post(url, {'new_date': new_date}, format='json')
        assert response.status_code == 400

    def test_reschedule_wrong_status_returns_400(self, authenticated_client, invoice_in_review):
        url = f'{BASE_URL}{invoice_in_review.pk}/reschedule/'
        response = authenticated_client.post(
            url,
            {'new_date': str(date.today() + timedelta(days=7)), 'comment': 'Перенос'},
            format='json',
        )
        assert response.status_code == 400


# =============================================================================
# status__in filter
# =============================================================================

@pytest.mark.django_db
class TestStatusInFilter:

    def test_filter_single_status(
        self, authenticated_client,
        invoice_in_review, invoice_in_registry,
    ):
        resp = authenticated_client.get(
            f'{BASE_URL}?status__in=review',
        )
        assert resp.status_code == 200
        ids = [r['id'] for r in resp.data['results']]
        assert invoice_in_review.pk in ids
        assert invoice_in_registry.pk not in ids

    def test_filter_multiple_statuses(
        self, authenticated_client,
        invoice_in_registry, invoice_verified,
    ):
        resp = authenticated_client.get(
            f'{BASE_URL}?status__in=in_registry,verified',
        )
        assert resp.status_code == 200
        ids = [r['id'] for r in resp.data['results']]
        assert invoice_in_registry.pk in ids
        assert invoice_verified.pk in ids

    def test_filter_excludes_other(
        self, authenticated_client,
        invoice_in_review, invoice_in_registry,
    ):
        resp = authenticated_client.get(
            f'{BASE_URL}?status__in=paid',
        )
        assert resp.status_code == 200
        ids = [r['id'] for r in resp.data['results']]
        assert invoice_in_review.pk not in ids
        assert invoice_in_registry.pk not in ids


# =============================================================================
# dashboard
# =============================================================================

@pytest.mark.django_db
class TestDashboard:

    def test_dashboard_returns_200(self, authenticated_client):
        response = authenticated_client.get(f'{BASE_URL}dashboard/')
        assert response.status_code == 200

    def test_dashboard_structure(self, authenticated_client):
        response = authenticated_client.get(f'{BASE_URL}dashboard/')
        data = response.data
        assert 'account_balances' in data
        assert 'registry_summary' in data
        assert 'by_object' in data
        assert 'by_category' in data

    def test_dashboard_registry_summary_keys(self, authenticated_client):
        response = authenticated_client.get(f'{BASE_URL}dashboard/')
        summary = response.data['registry_summary']
        expected_keys = {
            'total_amount', 'total_count',
            'overdue_amount', 'overdue_count',
            'today_amount', 'today_count',
            'this_week_amount', 'this_week_count',
            'this_month_amount', 'this_month_count',
        }
        assert expected_keys == set(summary.keys())


# =============================================================================
# Аутентификация
# =============================================================================

@pytest.mark.django_db
class TestInvoiceAuth:

    def test_unauthenticated_list_returns_401(self, api_client):
        response = api_client.get(BASE_URL)
        assert response.status_code == 401

    def test_unauthenticated_create_returns_401(self, api_client):
        response = api_client.post(BASE_URL, {}, format='json')
        assert response.status_code == 401

    def test_unauthenticated_action_returns_401(self, api_client, invoice_in_registry):
        url = f'{BASE_URL}{invoice_in_registry.pk}/approve/'
        response = api_client.post(url, {}, format='json')
        assert response.status_code == 401

    def test_unauthenticated_dashboard_returns_401(self, api_client):
        response = api_client.get(f'{BASE_URL}dashboard/')
        assert response.status_code == 401
