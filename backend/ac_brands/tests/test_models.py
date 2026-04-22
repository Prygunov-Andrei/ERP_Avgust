"""Unit-тесты для моделей ac_brands."""
from __future__ import annotations

import pytest

from ac_brands.tests.factories import BrandFactory, BrandOriginClassFactory


@pytest.mark.django_db
def test_brand_str():
    brand = BrandFactory(name="Daikin")
    assert str(brand) == "Daikin"


@pytest.mark.django_db
def test_brand_origin_class_str():
    origin = BrandOriginClassFactory(origin_type="Japan", fallback_score=80.5)
    assert str(origin) == "Japan (80.5)"


@pytest.mark.django_db
def test_brand_origin_class_fk_set_null():
    origin = BrandOriginClassFactory()
    brand = BrandFactory(origin_class=origin)
    origin.delete()
    brand.refresh_from_db()
    assert brand.origin_class is None


@pytest.mark.django_db
def test_brand_logo_dark_nullable():
    """logo_dark — nullable ImageField, default пусто."""
    brand = BrandFactory(name="TestBrand")
    # Прилетает "null" из БД; через ImageField это falsy:
    assert not brand.logo_dark
    # Проверяем прямой доступ к имени файла:
    assert not brand.logo_dark.name or brand.logo_dark.name == ""


@pytest.mark.django_db
def test_brand_logo_and_logo_dark_independent():
    """Можно иметь logo и не иметь logo_dark (и наоборот — для тестов)."""
    brand = BrandFactory(name="Test2")
    brand.refresh_from_db()
    assert not brand.logo_dark
    # После установки только logo_dark:
    from django.core.files.base import ContentFile
    brand.logo_dark.save("dummy.png", ContentFile(b"\x89PNG\r\n\x1a\n"), save=True)
    brand.refresh_from_db()
    assert brand.logo_dark
    assert not brand.logo
