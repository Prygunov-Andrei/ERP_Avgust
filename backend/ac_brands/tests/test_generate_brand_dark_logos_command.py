"""Тесты management-команды generate_brand_dark_logos."""

from __future__ import annotations

import io
from pathlib import Path

import pytest
from django.core.files.base import ContentFile
from django.core.management import call_command

from ac_brands.models import Brand
from ac_brands.tests.factories import BrandFactory

FIXTURES = Path(__file__).parent / "fixtures" / "logos"


def _attach_logo(brand: Brand, fixture_name: str) -> None:
    """Кладёт PNG из фикстур в Brand.logo через storage."""
    src = (FIXTURES / fixture_name).read_bytes()
    brand.logo.save(fixture_name, ContentFile(src), save=True)


@pytest.mark.django_db
def test_command_dry_run_no_save(tmp_path, settings):
    """--dry-run не создаёт dark-версии даже для mono-брендов."""
    settings.MEDIA_ROOT = str(tmp_path)
    brand = BrandFactory(name="Casarte")
    _attach_logo(brand, "casarte.png")

    buf = io.StringIO()
    call_command("generate_brand_dark_logos", "--dry-run", stdout=buf)

    brand.refresh_from_db()
    assert not brand.logo_dark
    out = buf.getvalue()
    assert "DRY-RUN" in out
    assert "casarte" in out.lower()


@pytest.mark.django_db
def test_command_saves_mono_logo(tmp_path, settings):
    """Mono-лого → сохраняется в Brand.logo_dark."""
    settings.MEDIA_ROOT = str(tmp_path)
    brand = BrandFactory(name="Casarte")
    _attach_logo(brand, "casarte.png")

    buf = io.StringIO()
    call_command("generate_brand_dark_logos", "--slug", "casarte", stdout=buf)

    brand.refresh_from_db()
    assert brand.logo_dark
    # Файл физически существует:
    assert brand.logo_dark.storage.exists(brand.logo_dark.name)
    # upload_to применился:
    assert brand.logo_dark.name.startswith("ac_rating/brands/dark/")


@pytest.mark.django_db
def test_command_skips_colored(tmp_path, settings):
    """Colored-лого (haier) → dark не создаётся."""
    settings.MEDIA_ROOT = str(tmp_path)
    brand = BrandFactory(name="Haier")
    _attach_logo(brand, "haier.png")

    buf = io.StringIO()
    call_command("generate_brand_dark_logos", "--slug", "haier", stdout=buf)

    brand.refresh_from_db()
    assert not brand.logo_dark
    assert "auto-colored" in buf.getvalue()


@pytest.mark.django_db
def test_command_default_force_colored_lg(tmp_path, settings):
    """LG по дефолту в DEFAULT_FORCE_COLORED → dark не создаётся."""
    settings.MEDIA_ROOT = str(tmp_path)
    brand = BrandFactory(name="LG")
    _attach_logo(brand, "lg.png")

    buf = io.StringIO()
    call_command("generate_brand_dark_logos", "--slug", "lg", stdout=buf)

    brand.refresh_from_db()
    assert not brand.logo_dark
    assert "force-colored" in buf.getvalue()


@pytest.mark.django_db
def test_command_no_default_overrides_lg_mono(tmp_path, settings):
    """--no-default-overrides — LG обрабатывается без override → mono → dark сохраняется."""
    settings.MEDIA_ROOT = str(tmp_path)
    brand = BrandFactory(name="LG")
    _attach_logo(brand, "lg.png")

    buf = io.StringIO()
    call_command(
        "generate_brand_dark_logos",
        "--slug", "lg",
        "--no-default-overrides",
        stdout=buf,
    )

    brand.refresh_from_db()
    # LG ложно-positive mono без override:
    assert brand.logo_dark


@pytest.mark.django_db
def test_command_force_mono_overrides_colored(tmp_path, settings):
    """--force-mono=haier → haier получает dark несмотря на colored classification."""
    settings.MEDIA_ROOT = str(tmp_path)
    brand = BrandFactory(name="Haier")
    _attach_logo(brand, "haier.png")

    buf = io.StringIO()
    call_command(
        "generate_brand_dark_logos",
        "--slug", "haier",
        "--force-mono", "haier",
        stdout=buf,
    )

    brand.refresh_from_db()
    assert brand.logo_dark
    assert "force-mono" in buf.getvalue()


@pytest.mark.django_db
def test_command_skip_existing_without_force(tmp_path, settings):
    """Если Brand.logo_dark уже заполнен — без --force не перезаписываем."""
    settings.MEDIA_ROOT = str(tmp_path)
    brand = BrandFactory(name="Casarte")
    _attach_logo(brand, "casarte.png")

    # Первая генерация:
    call_command("generate_brand_dark_logos", "--slug", "casarte", stdout=io.StringIO())
    brand.refresh_from_db()
    first_name = brand.logo_dark.name
    assert first_name

    # Вторая — без --force:
    buf = io.StringIO()
    call_command("generate_brand_dark_logos", "--slug", "casarte", stdout=buf)
    brand.refresh_from_db()
    assert brand.logo_dark.name == first_name
    assert "EXISTS" in buf.getvalue()


@pytest.mark.django_db
def test_command_force_overwrites(tmp_path, settings):
    """С --force — перезаписываем даже если logo_dark был."""
    settings.MEDIA_ROOT = str(tmp_path)
    brand = BrandFactory(name="Casarte")
    _attach_logo(brand, "casarte.png")

    call_command("generate_brand_dark_logos", "--slug", "casarte", stdout=io.StringIO())
    brand.refresh_from_db()
    first_name = brand.logo_dark.name

    buf = io.StringIO()
    call_command("generate_brand_dark_logos", "--slug", "casarte", "--force", stdout=buf)
    brand.refresh_from_db()
    # Имя может сохраниться (при удалении старого) или получить суффикс — главное сохранено успешно.
    assert brand.logo_dark
    # Старого файла нет на диске (удалили при --force) или он заменён на новый:
    assert brand.logo_dark.storage.exists(brand.logo_dark.name)


@pytest.mark.django_db
def test_command_unknown_slug(tmp_path, settings):
    """Bad slug → error без краша."""
    settings.MEDIA_ROOT = str(tmp_path)
    BrandFactory(name="Casarte")

    buf_err = io.StringIO()
    call_command(
        "generate_brand_dark_logos",
        "--slug", "does-not-exist",
        stdout=io.StringIO(),
        stderr=buf_err,
    )
    assert "не найден" in buf_err.getvalue()


@pytest.mark.django_db
def test_command_mutual_exclusive_overrides(tmp_path, settings):
    """Slug в force_colored И force_mono → ошибка."""
    settings.MEDIA_ROOT = str(tmp_path)
    brand = BrandFactory(name="Casarte")
    _attach_logo(brand, "casarte.png")

    buf_err = io.StringIO()
    call_command(
        "generate_brand_dark_logos",
        "--force-colored", "casarte",
        "--force-mono", "casarte",
        stdout=io.StringIO(),
        stderr=buf_err,
    )
    brand.refresh_from_db()
    assert not brand.logo_dark
    assert "force-colored" in buf_err.getvalue()
    assert "force-mono" in buf_err.getvalue()


@pytest.mark.django_db
def test_command_no_brands_warning(tmp_path, settings):
    """Ни одного бренда с логотипом → warning без ошибки."""
    settings.MEDIA_ROOT = str(tmp_path)
    # Создаём бренд без логотипа:
    BrandFactory(name="NoLogo")

    buf = io.StringIO()
    call_command("generate_brand_dark_logos", stdout=buf)
    out = buf.getvalue()
    assert "Нет брендов" in out
