"""REST API тесты NewsCategory (CRUD + bulk-update-category + save-sync).

Endpoint смонтирован через hvac_bridge.public_urls (тот же паттерн, что и
news-authors):
- /api/v1/hvac/public/news-categories/
- /api/v1/hvac/public/news/bulk-update-category/
"""
from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from news.models import NewsCategory, NewsPost


User = get_user_model()

LIST_URL = "/api/v1/hvac/public/news-categories/"
BULK_URL = "/api/v1/hvac/public/news/bulk-update-category/"


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def staff_user(db):
    return User.objects.create_user(
        username="staff-cat",
        email="staff-cat@test.com",
        password="testpass123",
        is_staff=True,
    )


@pytest.fixture
def regular_user(db):
    return User.objects.create_user(
        username="regular-cat",
        email="regular-cat@test.com",
        password="testpass123",
    )


@pytest.fixture
def staff_client(client, staff_user):
    client.force_authenticate(user=staff_user)
    return client


# ============================================================================
# CRUD — staff
# ============================================================================


@pytest.mark.django_db
def test_list_returns_seeded_categories_as_plain_array(staff_client):
    """GET list отдаёт 200 + не обёрнут в пагинацию + содержит 8 seed-категорий."""
    resp = staff_client.get(LIST_URL)
    assert resp.status_code == 200

    body = resp.json()
    assert isinstance(body, list), f"Ожидаем list, получили {type(body).__name__}"

    slugs = {item["slug"] for item in body}
    # 8 seed slug'ов из data-migration 0028_seed_news_categories.
    expected = {"business", "industry", "market", "regulation",
                "review", "guide", "brands", "other"}
    assert expected.issubset(slugs)

    first = body[0]
    assert set(first.keys()) == {"slug", "name", "order", "is_active"}


@pytest.mark.django_db
def test_create_category(staff_client):
    """POST создаёт новый раздел и возвращает 201."""
    resp = staff_client.post(LIST_URL, {
        "slug": "interviews",
        "name": "Интервью",
        "order": 90,
        "is_active": True,
    }, format="json")
    assert resp.status_code == 201, resp.content
    assert resp.json()["slug"] == "interviews"
    assert NewsCategory.objects.filter(slug="interviews").exists()


@pytest.mark.django_db
def test_patch_updates_name_and_order(staff_client):
    """PATCH редактирует name/order (slug immutable — игнорируется)."""
    resp = staff_client.patch(f"{LIST_URL}business/", {
        "name": "Бизнес-новости",
        "order": 5,
        "slug": "hacked",  # должен быть проигнорирован
    }, format="json")
    assert resp.status_code == 200, resp.content
    body = resp.json()
    assert body["name"] == "Бизнес-новости"
    assert body["order"] == 5
    assert body["slug"] == "business"  # slug не сменился


@pytest.mark.django_db
def test_delete_is_soft(staff_client):
    """DELETE — soft: is_active=False, запись не удаляется."""
    resp = staff_client.delete(f"{LIST_URL}market/")
    assert resp.status_code == 204

    obj = NewsCategory.objects.get(slug="market")
    assert obj.is_active is False


@pytest.mark.django_db
def test_delete_already_inactive_is_idempotent(staff_client):
    """Повторный DELETE уже неактивной категории — 204, без падения."""
    NewsCategory.objects.filter(slug="market").update(is_active=False)

    resp = staff_client.delete(f"{LIST_URL}market/?is_active=all")
    assert resp.status_code == 204


@pytest.mark.django_db
def test_list_default_excludes_inactive(staff_client):
    """По умолчанию неактивные категории скрыты."""
    NewsCategory.objects.filter(slug="market").update(is_active=False)

    resp = staff_client.get(LIST_URL)
    assert resp.status_code == 200
    slugs = {item["slug"] for item in resp.json()}
    assert "market" not in slugs
    assert "business" in slugs


@pytest.mark.django_db
def test_list_is_active_all_returns_both(staff_client):
    """?is_active=all — активные + неактивные."""
    NewsCategory.objects.filter(slug="market").update(is_active=False)

    resp = staff_client.get(f"{LIST_URL}?is_active=all")
    slugs = {item["slug"] for item in resp.json()}
    assert "market" in slugs and "business" in slugs


# ============================================================================
# Permissions
# ============================================================================


@pytest.mark.django_db
def test_anonymous_forbidden_on_list(client):
    assert client.get(LIST_URL).status_code in (401, 403)


@pytest.mark.django_db
def test_anonymous_forbidden_on_create(client):
    resp = client.post(LIST_URL, {"slug": "x", "name": "X"}, format="json")
    assert resp.status_code in (401, 403)


@pytest.mark.django_db
def test_non_staff_forbidden(client, regular_user):
    client.force_authenticate(user=regular_user)
    assert client.get(LIST_URL).status_code == 403
    assert client.post(LIST_URL, {"slug": "x", "name": "X"}, format="json").status_code == 403
    assert client.delete(f"{LIST_URL}business/").status_code == 403


# ============================================================================
# Bulk update category
# ============================================================================


@pytest.mark.django_db
def test_bulk_update_moves_posts_to_new_category(staff_client):
    p1 = NewsPost.objects.create(title="t1", body="b", category="business")
    p2 = NewsPost.objects.create(title="t2", body="b", category="business")
    NewsPost.objects.create(title="t3", body="b", category="industry")  # не в списке

    resp = staff_client.patch(BULK_URL, {
        "ids": [p1.id, p2.id],
        "category_slug": "market",
    }, format="json")
    assert resp.status_code == 200, resp.content
    assert resp.json() == {"updated": 2}

    p1.refresh_from_db()
    p2.refresh_from_db()
    assert p1.category == "market" and p1.category_ref_id == "market"
    assert p2.category == "market" and p2.category_ref_id == "market"


@pytest.mark.django_db
def test_bulk_update_empty_ids_returns_400(staff_client):
    resp = staff_client.patch(BULK_URL, {"ids": [], "category_slug": "market"}, format="json")
    assert resp.status_code == 400
    assert "ids" in resp.json()["error"]


@pytest.mark.django_db
def test_bulk_update_missing_slug_returns_400(staff_client):
    resp = staff_client.patch(BULK_URL, {"ids": [1]}, format="json")
    assert resp.status_code == 400


@pytest.mark.django_db
def test_bulk_update_unknown_slug_returns_400(staff_client):
    p = NewsPost.objects.create(title="t", body="b", category="business")
    resp = staff_client.patch(BULK_URL, {
        "ids": [p.id],
        "category_slug": "does-not-exist",
    }, format="json")
    assert resp.status_code == 400


@pytest.mark.django_db
def test_bulk_update_inactive_slug_returns_400(staff_client):
    NewsCategory.objects.filter(slug="market").update(is_active=False)
    p = NewsPost.objects.create(title="t", body="b", category="business")
    resp = staff_client.patch(BULK_URL, {
        "ids": [p.id],
        "category_slug": "market",
    }, format="json")
    assert resp.status_code == 400


@pytest.mark.django_db
def test_bulk_update_requires_staff(client, regular_user):
    client.force_authenticate(user=regular_user)
    resp = client.patch(BULK_URL, {"ids": [1], "category_slug": "market"}, format="json")
    assert resp.status_code == 403


# ============================================================================
# Save-sync: CharField category <-> FK category_ref
# ============================================================================


@pytest.mark.django_db
def test_save_backfills_category_ref_from_charfield():
    """Создание поста с category='business' без category_ref → после save()
    category_ref_id='business' (FK подтянут автоматически)."""
    post = NewsPost.objects.create(title="t", body="b", category="business")
    assert post.category_ref_id == "business"


@pytest.mark.django_db
def test_save_syncs_charfield_from_category_ref():
    """Изменение category_ref → после save() category совпадает со slug."""
    industry = NewsCategory.objects.get(slug="industry")
    post = NewsPost.objects.create(title="t", body="b", category="business")
    assert post.category == "business"

    post.category_ref = industry
    post.save()
    post.refresh_from_db()
    assert post.category == "industry"
    assert post.category_ref_id == "industry"


@pytest.mark.django_db
def test_save_update_fields_without_category_does_not_touch_sync():
    """save(update_fields=['star_rating']) не должен трогать category/category_ref,
    даже если они рассинхронизированы в памяти (узкие update_fields — защита от
    стирания чужих полей через sync)."""
    post = NewsPost.objects.create(title="t", body="b", category="business")
    # Искусственно разваливаем объект в памяти — имитируем случай, когда кто-то
    # модифицирует поле в памяти, но save'ит с update_fields только звёзды.
    post.category = "industry"  # в памяти — но не трогаем category_ref
    post.star_rating = 4
    post.save(update_fields=["star_rating"])
    post.refresh_from_db()
    # category в БД не сменился — save(update_fields) не тронул sync.
    assert post.category == "business"
    assert post.star_rating == 4


# ============================================================================
# NewsPost serializer — category_object
# ============================================================================


@pytest.mark.django_db
def test_newspost_serializer_exposes_category_object():
    """NewsPostSerializer добавляет category_object (lite shape FK) рядом
    с существующим category (slug-строка)."""
    from news.serializers import NewsPostSerializer

    post = NewsPost.objects.create(title="t", body="b", category="market")
    data = NewsPostSerializer(post).data

    assert data["category"] == "market"
    assert data["category_object"] is not None
    assert data["category_object"]["slug"] == "market"
    assert data["category_object"]["name"] == "Рынок"
