import pytest
from django.core.management import call_command
from django.contrib.auth.models import User
from django.utils import timezone
import json

from news.models import NewsPost
from personnel.models import Employee, default_erp_permissions
from references.models import NewsResource


def _make_user(*, is_staff: bool = False, marketing_level: str = 'none') -> User:
    user = User.objects.create_user(
        username=f'user_{User.objects.count()}',
        password='pass12345',
    )
    user.is_staff = is_staff
    user.save(update_fields=['is_staff'])

    perms = default_erp_permissions()
    perms['marketing'] = marketing_level
    Employee.objects.create(
        full_name='HVAC Operator',
        user=user,
        erp_permissions=perms,
    )
    return user


@pytest.mark.django_db
def test_hvac_public_route_serves_news_from_backend(api_client):
    NewsPost.objects.create(
        title='Unified backend news',
        body='Body',
        status='published',
        pub_date=timezone.now(),
    )

    response = api_client.get('/api/v1/hvac/public/news/?page=1')

    assert response.status_code == 200
    assert response.data['count'] == 1
    assert response.data['results'][0]['title'] == 'Unified backend news'


@pytest.mark.django_db
def test_hvac_admin_proxy_denies_user_without_marketing_access(api_client):
    user = _make_user(marketing_level='none')
    api_client.force_login(user)

    response = api_client.get('/api/v1/hvac/admin/references/newsresource/discover-news-info/')

    assert response.status_code == 403


@pytest.mark.django_db
def test_hvac_admin_proxy_allows_marketing_editor(api_client):
    user = _make_user(marketing_level='edit')
    api_client.force_login(user)
    NewsResource.objects.create(name='Resource', url='https://example.com')

    response = api_client.get('/api/v1/hvac/admin/references/newsresource/discover-news-info/')
    assert response.status_code == 200
    assert 'total_resources' in response.json()


@pytest.mark.django_db
def test_hvac_admin_proxy_allows_staff_without_employee_permissions(api_client):
    user = User.objects.create_user(username='staff_user', password='pass12345', is_staff=True)
    api_client.force_login(user)

    response = api_client.get('/api/v1/hvac/admin/references/newsresource/discover-news-info/')

    assert response.status_code == 200


@pytest.mark.django_db
def test_hvac_api_smoke_command_runs():
    call_command('hvac_api_smoke')


@pytest.mark.django_db
def test_hvac_media_manifest_exports_missing_file(tmp_path):
    NewsPost.objects.create(
        title='Manifest news',
        body='Body',
        status='published',
        pub_date=timezone.now(),
        source_file='news/archives/missing-source.zip',
    )

    output_path = tmp_path / 'manifest.json'
    call_command('hvac_media_manifest', output=str(output_path))

    payload = json.loads(output_path.read_text(encoding='utf-8'))
    assert payload['total_entries'] == 1
    assert payload['missing_entries'] == 1
    assert payload['entries'][0]['relative_path'] == 'news/archives/missing-source.zip'
