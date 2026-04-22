"""Тесты Brand admin — dark-логотипы (превью + bulk action)."""

from __future__ import annotations

from pathlib import Path

import pytest
from django.contrib import admin as admin_site
from django.core.files.base import ContentFile

from ac_brands.admin import BrandAdmin
from ac_brands.models import Brand
from ac_brands.tests.factories import BrandFactory

FIXTURES = Path(__file__).parent / "fixtures" / "logos"


@pytest.fixture
def brand_admin():
    return BrandAdmin(Brand, admin_site.site)


@pytest.mark.django_db
def test_logo_dark_preview_empty(brand_admin):
    """Без logo_dark → превью возвращает "—"."""
    brand = BrandFactory(name="Sony")
    assert brand_admin.logo_dark_preview(brand) == "—"


@pytest.mark.django_db
def test_logo_dark_preview_large_empty(brand_admin):
    brand = BrandFactory(name="Sony")
    out = brand_admin.logo_dark_preview_large(brand)
    assert "Нет dark-версии" in out


@pytest.mark.django_db
def test_logo_dark_preview_with_file(brand_admin, tmp_path, settings):
    settings.MEDIA_ROOT = str(tmp_path)
    brand = BrandFactory(name="Casarte")
    src = (FIXTURES / "casarte.png").read_bytes()
    brand.logo_dark.save("casarte-dark.png", ContentFile(src), save=True)

    out = brand_admin.logo_dark_preview(brand)
    assert "<img" in out
    assert brand.logo_dark.url in out
    # Dark-превью рендерится на тёмном фоне (иначе белый текст не видно):
    assert "background:#222" in out


@pytest.mark.django_db
def test_generate_dark_logos_action(brand_admin, tmp_path, settings, rf):
    settings.MEDIA_ROOT = str(tmp_path)

    # Два бренда с логотипами:
    casarte = BrandFactory(name="Casarte")
    casarte.logo.save("casarte.png", ContentFile((FIXTURES / "casarte.png").read_bytes()), save=True)

    haier = BrandFactory(name="Haier")
    haier.logo.save("haier.png", ContentFile((FIXTURES / "haier.png").read_bytes()), save=True)

    request = rf.get("/admin/")
    # messages framework требует middleware; подменяем message_user в рамках теста:
    messages = []

    def fake_message_user(req, msg, level=None, **kwargs):
        messages.append((msg, level))

    brand_admin.message_user = fake_message_user

    qs = Brand.objects.filter(pk__in=[casarte.pk, haier.pk])
    brand_admin.generate_dark_logos_action(request, qs)

    casarte.refresh_from_db()
    haier.refresh_from_db()
    # Casarte mono → dark создан:
    assert casarte.logo_dark
    # Haier colored → dark пустой:
    assert not haier.logo_dark
    # Сообщение admin-у:
    assert any("сохранено=1" in str(m[0]) for m in messages)
    assert any("пропущено (colored)=1" in str(m[0]) for m in messages)
