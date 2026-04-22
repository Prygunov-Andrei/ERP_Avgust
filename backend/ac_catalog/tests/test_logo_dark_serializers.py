"""Тесты что logo_dark присутствует в BrandSerializer/ACModelListSerializer."""

from __future__ import annotations

from pathlib import Path

import pytest
from django.core.files.base import ContentFile

from ac_brands.tests.factories import BrandFactory
from ac_catalog.serializers import (
    ACModelDetailSerializer,
    ACModelListSerializer,
    BrandSerializer,
)
from ac_catalog.tests.factories import PublishedACModelFactory

FIXTURES = Path(__file__).parent.parent.parent / "ac_brands/tests/fixtures/logos"


@pytest.mark.django_db
def test_brand_serializer_includes_logo_dark_empty(tmp_path, settings):
    settings.MEDIA_ROOT = str(tmp_path)
    brand = BrandFactory(name="Sony")
    data = BrandSerializer(brand).data
    assert "logo_dark" in data
    assert data["logo_dark"] == ""


@pytest.mark.django_db
def test_brand_serializer_includes_logo_dark_populated(tmp_path, settings):
    settings.MEDIA_ROOT = str(tmp_path)
    brand = BrandFactory(name="Casarte")
    brand.logo_dark.save(
        "casarte-dark.png",
        ContentFile((FIXTURES / "casarte.png").read_bytes()),
        save=True,
    )
    data = BrandSerializer(brand).data
    assert data["logo_dark"]
    # URL содержит кеш-бустер ?v=<mtime>:
    assert "?v=" in data["logo_dark"]


@pytest.mark.django_db
def test_ac_model_list_serializer_has_brand_logo_dark(tmp_path, settings):
    settings.MEDIA_ROOT = str(tmp_path)
    brand = BrandFactory(name="Casarte")
    brand.logo_dark.save(
        "casarte-dark.png",
        ContentFile((FIXTURES / "casarte.png").read_bytes()),
        save=True,
    )
    model = PublishedACModelFactory(brand=brand)

    data = ACModelListSerializer(model).data
    assert "brand_logo" in data
    assert "brand_logo_dark" in data
    assert data["brand_logo_dark"]
    assert "?v=" in data["brand_logo_dark"]


@pytest.mark.django_db
def test_ac_model_list_serializer_brand_logo_dark_empty(tmp_path, settings):
    settings.MEDIA_ROOT = str(tmp_path)
    brand = BrandFactory(name="Haier")
    model = PublishedACModelFactory(brand=brand)

    data = ACModelListSerializer(model).data
    assert data["brand_logo_dark"] == ""


@pytest.mark.django_db
def test_ac_model_detail_serializer_brand_has_logo_dark(tmp_path, settings):
    """ACModelDetailSerializer вкладывает BrandSerializer → logo_dark automaticamente."""
    settings.MEDIA_ROOT = str(tmp_path)
    brand = BrandFactory(name="Casarte")
    brand.logo_dark.save(
        "casarte-dark.png",
        ContentFile((FIXTURES / "casarte.png").read_bytes()),
        save=True,
    )
    model = PublishedACModelFactory(brand=brand)

    data = ACModelDetailSerializer(model).data
    assert "brand" in data
    assert "logo_dark" in data["brand"]
    assert data["brand"]["logo_dark"]
