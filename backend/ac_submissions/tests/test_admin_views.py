"""Тесты админского API модерации заявок (/api/hvac/rating/submissions/).

Ф8C: permissions, list/retrieve/PATCH (status + admin_notes + brand),
DELETE, запрещённые методы (POST/PUT), bulk-update, конверсия в ACModel.
"""
from __future__ import annotations

import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from ac_brands.models import Brand
from ac_brands.tests.factories import BrandFactory
from ac_catalog.models import ACModel
from ac_submissions.models import ACSubmission
from ac_submissions.tests.factories import (
    ACSubmissionFactory,
    SubmissionPhotoFactory,
)
from personnel.models import Employee, default_erp_permissions


@pytest.fixture
def anon_client():
    return APIClient()


@pytest.fixture
def staff_client(db):
    user = User.objects.create_user(
        username="sub_staff", password="x", is_staff=True,
    )
    client = APIClient()
    refresh = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
    return client


@pytest.fixture
def regular_client(db):
    user = User.objects.create_user(username="sub_reg", password="x")
    Employee.objects.create(
        full_name="Reg", user=user, erp_permissions=default_erp_permissions(),
    )
    client = APIClient()
    refresh = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
    return client


def _items(body):
    return body if isinstance(body, list) else body["results"]


# ── Permissions ──────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_anonymous_submissions_list_401(anon_client):
    resp = anon_client.get("/api/hvac/rating/submissions/")
    assert resp.status_code == 401


@pytest.mark.django_db
def test_regular_user_submissions_list_403(regular_client):
    resp = regular_client.get("/api/hvac/rating/submissions/")
    assert resp.status_code == 403


@pytest.mark.django_db
def test_staff_submissions_list_200(staff_client):
    ACSubmissionFactory()
    resp = staff_client.get("/api/hvac/rating/submissions/")
    assert resp.status_code == 200
    assert len(_items(resp.json())) >= 1


# ── List denormalization ──────────────────────────────────────────────────


@pytest.mark.django_db
def test_list_returns_denormalized_fields(staff_client):
    brand = BrandFactory(name="MyBrand")
    sub = ACSubmissionFactory(brand=brand, inner_unit="ABC-12")
    SubmissionPhotoFactory(submission=sub, order=0)
    SubmissionPhotoFactory(submission=sub, order=1)

    resp = staff_client.get("/api/hvac/rating/submissions/")
    assert resp.status_code == 200
    items = _items(resp.json())
    target = next(s for s in items if s["id"] == sub.id)
    assert target["brand_name"] == "MyBrand"
    assert target["photos_count"] == 2
    assert target["primary_photo_url"]  # non-empty URL
    assert target["converted_model_id"] is None


@pytest.mark.django_db
def test_list_brand_name_falls_back_to_custom(staff_client):
    sub = ACSubmissionFactory(brand=None, custom_brand_name="UnknownCo")
    resp = staff_client.get("/api/hvac/rating/submissions/")
    assert resp.status_code == 200
    items = _items(resp.json())
    target = next(s for s in items if s["id"] == sub.id)
    assert target["brand_name"] == "UnknownCo"


# ── Filters ─────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_filter_status_pending(staff_client):
    ACSubmissionFactory(status=ACSubmission.Status.PENDING, inner_unit="P-only")
    ACSubmissionFactory(status=ACSubmission.Status.APPROVED, inner_unit="A-only")

    resp = staff_client.get("/api/hvac/rating/submissions/?status=pending")
    assert resp.status_code == 200
    units = {s["inner_unit"] for s in _items(resp.json())}
    assert "P-only" in units
    assert "A-only" not in units


@pytest.mark.django_db
def test_filter_has_brand_false_returns_only_custom_brand(staff_client):
    ACSubmissionFactory(brand=None, custom_brand_name="NoFK", inner_unit="no-fk")
    ACSubmissionFactory(inner_unit="with-fk")

    resp = staff_client.get("/api/hvac/rating/submissions/?has_brand=false")
    assert resp.status_code == 200
    units = {s["inner_unit"] for s in _items(resp.json())}
    assert "no-fk" in units
    assert "with-fk" not in units


@pytest.mark.django_db
def test_filter_has_brand_true_returns_only_with_fk(staff_client):
    ACSubmissionFactory(brand=None, custom_brand_name="NoFK", inner_unit="no-fk")
    ACSubmissionFactory(inner_unit="with-fk")

    resp = staff_client.get("/api/hvac/rating/submissions/?has_brand=true")
    assert resp.status_code == 200
    units = {s["inner_unit"] for s in _items(resp.json())}
    assert "with-fk" in units
    assert "no-fk" not in units


@pytest.mark.django_db
def test_filter_by_brand_id(staff_client):
    b1 = BrandFactory(name="B1")
    b2 = BrandFactory(name="B2")
    ACSubmissionFactory(brand=b1, inner_unit="for-1")
    ACSubmissionFactory(brand=b2, inner_unit="for-2")

    resp = staff_client.get(f"/api/hvac/rating/submissions/?brand={b1.id}")
    assert resp.status_code == 200
    units = {s["inner_unit"] for s in _items(resp.json())}
    assert units == {"for-1"}


@pytest.mark.django_db
def test_search_by_email(staff_client):
    ACSubmissionFactory(submitter_email="match@example.com", inner_unit="srch-yes")
    ACSubmissionFactory(submitter_email="other@example.com", inner_unit="srch-no")

    resp = staff_client.get("/api/hvac/rating/submissions/?search=match@")
    assert resp.status_code == 200
    units = {s["inner_unit"] for s in _items(resp.json())}
    assert "srch-yes" in units
    assert "srch-no" not in units


# ── Retrieve / nested photos ────────────────────────────────────────────


@pytest.mark.django_db
def test_retrieve_includes_nested_photos(staff_client):
    sub = ACSubmissionFactory()
    SubmissionPhotoFactory(submission=sub, order=0)
    SubmissionPhotoFactory(submission=sub, order=1)

    resp = staff_client.get(f"/api/hvac/rating/submissions/{sub.id}/")
    assert resp.status_code == 200, resp.json()
    body = resp.json()
    assert "photos" in body
    assert len(body["photos"]) == 2
    assert all("image_url" in p for p in body["photos"])


# ── PATCH writable / read-only ──────────────────────────────────────────


@pytest.mark.django_db
def test_patch_status_to_approved(staff_client):
    sub = ACSubmissionFactory(status=ACSubmission.Status.PENDING)
    resp = staff_client.patch(
        f"/api/hvac/rating/submissions/{sub.id}/",
        {"status": ACSubmission.Status.APPROVED},
        format="json",
    )
    assert resp.status_code == 200, resp.json()
    sub.refresh_from_db()
    assert sub.status == ACSubmission.Status.APPROVED


@pytest.mark.django_db
def test_patch_admin_notes(staff_client):
    sub = ACSubmissionFactory()
    resp = staff_client.patch(
        f"/api/hvac/rating/submissions/{sub.id}/",
        {"admin_notes": "Спам, удалить"},
        format="json",
    )
    assert resp.status_code == 200, resp.json()
    sub.refresh_from_db()
    assert sub.admin_notes == "Спам, удалить"


@pytest.mark.django_db
def test_patch_brand_fk(staff_client):
    sub = ACSubmissionFactory(brand=None, custom_brand_name="UnknownCo")
    new_brand = BrandFactory(name="LinkedBrand")
    resp = staff_client.patch(
        f"/api/hvac/rating/submissions/{sub.id}/",
        {"brand": new_brand.id},
        format="json",
    )
    assert resp.status_code == 200, resp.json()
    sub.refresh_from_db()
    assert sub.brand_id == new_brand.id


@pytest.mark.django_db
def test_patch_inner_unit_is_readonly(staff_client):
    sub = ACSubmissionFactory(inner_unit="оригинал")
    resp = staff_client.patch(
        f"/api/hvac/rating/submissions/{sub.id}/",
        {"inner_unit": "взлом", "submitter_email": "hacker@example.com"},
        format="json",
    )
    assert resp.status_code == 200, resp.json()
    sub.refresh_from_db()
    assert sub.inner_unit == "оригинал"
    assert sub.submitter_email != "hacker@example.com"


@pytest.mark.django_db
def test_post_not_allowed(staff_client):
    resp = staff_client.post(
        "/api/hvac/rating/submissions/",
        {"inner_unit": "x"},
        format="json",
    )
    assert resp.status_code == 405


@pytest.mark.django_db
def test_put_not_allowed(staff_client):
    sub = ACSubmissionFactory()
    resp = staff_client.put(
        f"/api/hvac/rating/submissions/{sub.id}/",
        {"status": ACSubmission.Status.APPROVED},
        format="json",
    )
    assert resp.status_code == 405


@pytest.mark.django_db
def test_delete_submission(staff_client):
    sub = ACSubmissionFactory()
    resp = staff_client.delete(f"/api/hvac/rating/submissions/{sub.id}/")
    assert resp.status_code == 204
    assert not ACSubmission.objects.filter(pk=sub.id).exists()


# ── Convert to ACModel ──────────────────────────────────────────────────


@pytest.mark.django_db
def test_convert_happy_path(staff_client):
    brand = BrandFactory(name="ConvBrand")
    sub = ACSubmissionFactory(brand=brand, status=ACSubmission.Status.PENDING)

    resp = staff_client.post(
        f"/api/hvac/rating/submissions/{sub.id}/convert-to-acmodel/",
        {},
        format="json",
    )
    assert resp.status_code == 201, resp.json()
    body = resp.json()

    sub.refresh_from_db()
    assert sub.status == ACSubmission.Status.APPROVED
    assert sub.converted_model_id is not None

    assert body["submission_id"] == sub.id
    assert body["created_model_id"] == sub.converted_model_id
    assert body["created_model_slug"]
    assert body["created_brand"] is False
    assert body["redirect_to"] == f"/hvac-rating/models/edit/{sub.converted_model_id}/"

    assert ACModel.objects.filter(pk=sub.converted_model_id).exists()


@pytest.mark.django_db
def test_convert_with_custom_brand_creates_new_brand(staff_client):
    sub = ACSubmissionFactory(
        brand=None, custom_brand_name="БрендИзЗаявки",
        status=ACSubmission.Status.PENDING,
    )
    assert not Brand.objects.filter(name="БрендИзЗаявки").exists()

    resp = staff_client.post(
        f"/api/hvac/rating/submissions/{sub.id}/convert-to-acmodel/",
        {},
        format="json",
    )
    assert resp.status_code == 201, resp.json()
    body = resp.json()
    assert body["created_brand"] is True

    sub.refresh_from_db()
    assert sub.converted_model_id is not None
    assert Brand.objects.filter(name="БрендИзЗаявки").exists()
    assert sub.converted_model.brand.name == "БрендИзЗаявки"


@pytest.mark.django_db
def test_convert_already_converted_returns_400(staff_client):
    existing_brand = BrandFactory()
    sub = ACSubmissionFactory(brand=existing_brand)

    # Первая конверсия — успех.
    r1 = staff_client.post(
        f"/api/hvac/rating/submissions/{sub.id}/convert-to-acmodel/",
        {}, format="json",
    )
    assert r1.status_code == 201

    # Вторая — 400.
    r2 = staff_client.post(
        f"/api/hvac/rating/submissions/{sub.id}/convert-to-acmodel/",
        {}, format="json",
    )
    assert r2.status_code == 400
    assert "уже сконвертирована" in r2.json()["detail"]


@pytest.mark.django_db
def test_convert_without_any_brand_returns_400(staff_client):
    sub = ACSubmissionFactory(brand=None, custom_brand_name="")
    resp = staff_client.post(
        f"/api/hvac/rating/submissions/{sub.id}/convert-to-acmodel/",
        {}, format="json",
    )
    assert resp.status_code == 400
    sub.refresh_from_db()
    assert sub.converted_model_id is None


@pytest.mark.django_db
def test_convert_anonymous_401(anon_client):
    sub = ACSubmissionFactory()
    resp = anon_client.post(
        f"/api/hvac/rating/submissions/{sub.id}/convert-to-acmodel/",
        {}, format="json",
    )
    assert resp.status_code == 401


@pytest.mark.django_db
def test_convert_regular_user_403(regular_client):
    sub = ACSubmissionFactory()
    resp = regular_client.post(
        f"/api/hvac/rating/submissions/{sub.id}/convert-to-acmodel/",
        {}, format="json",
    )
    assert resp.status_code == 403


# ── Bulk update ─────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_bulk_update_happy_path(staff_client):
    s1 = ACSubmissionFactory(status=ACSubmission.Status.PENDING)
    s2 = ACSubmissionFactory(status=ACSubmission.Status.PENDING)
    s3 = ACSubmissionFactory(status=ACSubmission.Status.PENDING)

    resp = staff_client.post(
        "/api/hvac/rating/submissions/bulk-update/",
        {"submission_ids": [s1.id, s2.id, s3.id], "status": "rejected"},
        format="json",
    )
    assert resp.status_code == 200, resp.json()
    body = resp.json()
    assert body["updated"] == 3
    assert body["errors"] == []
    for s in (s1, s2, s3):
        s.refresh_from_db()
        assert s.status == ACSubmission.Status.REJECTED


@pytest.mark.django_db
def test_bulk_update_invalid_status_400(staff_client):
    s = ACSubmissionFactory()
    resp = staff_client.post(
        "/api/hvac/rating/submissions/bulk-update/",
        {"submission_ids": [s.id], "status": "garbage"},
        format="json",
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_bulk_update_invalid_submission_ids_not_list_400(staff_client):
    resp = staff_client.post(
        "/api/hvac/rating/submissions/bulk-update/",
        {"submission_ids": "1,2,3", "status": "approved"},
        format="json",
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_bulk_update_submission_ids_with_strings_400(staff_client):
    resp = staff_client.post(
        "/api/hvac/rating/submissions/bulk-update/",
        {"submission_ids": ["1", "2"], "status": "approved"},
        format="json",
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_bulk_update_anonymous_401(anon_client):
    resp = anon_client.post(
        "/api/hvac/rating/submissions/bulk-update/",
        {"submission_ids": [1], "status": "approved"},
        format="json",
    )
    assert resp.status_code == 401


@pytest.mark.django_db
def test_bulk_update_regular_user_403(regular_client):
    resp = regular_client.post(
        "/api/hvac/rating/submissions/bulk-update/",
        {"submission_ids": [1], "status": "approved"},
        format="json",
    )
    assert resp.status_code == 403
