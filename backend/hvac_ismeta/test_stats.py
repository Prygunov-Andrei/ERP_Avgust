"""F8-06: тесты admin stats view (/admin/hvac_ismeta/ismetajob/stats/)."""
from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.test import Client
from django.urls import reverse
from django.utils import timezone

from .models import IsmetaJob


User = get_user_model()


@pytest.fixture
def superuser(db):
    return User.objects.create_superuser(
        username="admin", email="a@b.test", password="pwd12345"
    )


@pytest.fixture
def client_admin(superuser):
    c = Client()
    c.force_login(superuser)
    return c


def _make_job(**overrides) -> IsmetaJob:
    now = timezone.now()
    defaults = dict(
        session_key="sess-x",
        ip_address="127.0.0.1",
        pdf_filename="spec.pdf",
        pdf_storage_path="/tmp/spec.pdf",
        pdf_size_bytes=1024,
        pipeline="td17g",
        llm_profile_id=1,
        status=IsmetaJob.STATUS_DONE,
        pages_total=3,
        pages_processed=3,
        items_count=2,
        cost_usd=Decimal("0.05"),
        started_at=now - timedelta(seconds=120),
        completed_at=now,
    )
    defaults.update(overrides)
    job = IsmetaJob.objects.create(**defaults)
    if "created_at" in overrides:
        IsmetaJob.objects.filter(id=job.id).update(created_at=overrides["created_at"])
        job.refresh_from_db()
    return job


def test_stats_view_requires_admin(db, client):
    """Anonymous → редирект на login."""
    url = reverse("admin:hvac_ismeta_ismetajob_stats")
    resp = client.get(url)
    assert resp.status_code in (302, 301)
    assert "/login/" in resp.url or "login" in resp.url.lower()


def test_stats_view_renders_for_admin(client_admin, db):
    """Superuser получает 200 + название «Статистика»."""
    _make_job(status=IsmetaJob.STATUS_DONE)
    _make_job(status=IsmetaJob.STATUS_ERROR, error_message="boom")
    resp = client_admin.get(reverse("admin:hvac_ismeta_ismetajob_stats"))
    assert resp.status_code == 200
    body = resp.content.decode("utf-8")
    assert "Статистика" in body
    assert "td17g" in body  # pipeline distribution
    assert "boom" in body  # last errors


def test_stats_view_aggregates_by_period(client_admin, db):
    """Job из 10 дней назад НЕ должен попасть в today / 7d, но должен — в 30d."""
    old = timezone.now() - timedelta(days=10)
    _make_job(created_at=old, started_at=old - timedelta(seconds=60),
              completed_at=old, status=IsmetaJob.STATUS_DONE,
              cost_usd=Decimal("0.10"))
    fresh = timezone.now() - timedelta(hours=1)
    _make_job(created_at=fresh, started_at=fresh - timedelta(seconds=30),
              completed_at=fresh, status=IsmetaJob.STATUS_DONE,
              cost_usd=Decimal("0.01"))

    resp = client_admin.get(reverse("admin:hvac_ismeta_ismetajob_stats"))
    assert resp.status_code == 200
    ctx = resp.context
    assert ctx["stats_by_period"]["today"]["total"] == 1
    assert ctx["stats_by_period"]["last_7d"]["total"] == 1
    assert ctx["stats_by_period"]["last_30d"]["total"] == 2


def test_stats_view_pipeline_distribution(client_admin, db):
    _make_job(pipeline="td17g")
    _make_job(pipeline="td17g")
    _make_job(pipeline="main")
    resp = client_admin.get(reverse("admin:hvac_ismeta_ismetajob_stats"))
    pipeline_dist = {row["pipeline"]: row["count"] for row in resp.context["pipeline_dist"]}
    assert pipeline_dist == {"td17g": 2, "main": 1}


def test_stats_view_recent_errors_limited(client_admin, db):
    for i in range(25):
        _make_job(status=IsmetaJob.STATUS_ERROR, error_message=f"err-{i}")
    resp = client_admin.get(reverse("admin:hvac_ismeta_ismetajob_stats"))
    assert len(resp.context["recent_errors"]) == 20
