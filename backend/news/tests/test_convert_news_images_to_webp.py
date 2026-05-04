"""Тесты для management команды `convert_news_images_to_webp`."""
from __future__ import annotations

import io
import os
from io import StringIO

import pytest
from django.core.files.base import ContentFile
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from PIL import Image

from news.models import (
    MediaUpload,
    NewsAuthor,
    NewsDuplicateGroup,
    NewsMedia,
    NewsPost,
)
from news.tests.factories import NewsAuthorFactory, NewsPostFactory


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


def _png_bytes(size_px: int = 16, alpha: bool = False) -> bytes:
    """Маленькая PNG в памяти. Если alpha=True — RGBA с прозрачностью."""
    buf = io.BytesIO()
    if alpha:
        img = Image.new("RGBA", (size_px, size_px), (255, 0, 0, 128))
    else:
        img = Image.new("RGB", (size_px, size_px), "white")
    img.save(buf, format="PNG")
    return buf.getvalue()


def _jpg_bytes(size_px: int = 16) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (size_px, size_px), "blue").save(buf, format="JPEG")
    return buf.getvalue()


@pytest.fixture(autouse=True)
def isolated_media_root(tmp_path, settings):
    """Изоляция MEDIA_ROOT в tmp_path для каждого теста (паттерн pytest-xdist)."""
    settings.MEDIA_ROOT = str(tmp_path)
    return str(tmp_path)


def _write_to_media(rel_path: str, content: bytes) -> str:
    """Записывает байты по относительному пути под MEDIA_ROOT, возвращает абс. путь."""
    from django.conf import settings as dj_settings

    abs_path = os.path.join(str(dj_settings.MEDIA_ROOT), rel_path)
    os.makedirs(os.path.dirname(abs_path), exist_ok=True)
    with open(abs_path, "wb") as fh:
        fh.write(content)
    return abs_path


def _admin_user():
    from django.contrib.auth.models import User

    return User.objects.create_superuser(
        username="t-webp", password="x", email="t-webp@t.t",
    )


# ---------------------------------------------------------------------------
# Тесты
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestDryRun:
    def test_dry_run_does_not_touch_disk_or_db(self):
        rel = "news/dry/foo.png"
        png_path = _write_to_media(rel, _png_bytes())
        post = NewsPostFactory(body=f'<p><img src="/media/{rel}" alt="x"></p>')
        original_body = post.body

        out = StringIO()
        call_command("convert_news_images_to_webp", stdout=out)

        # WebP не создан.
        webp_target = os.path.splitext(png_path)[0] + ".webp"
        assert not os.path.exists(webp_target), "dry-run не должен писать на диск"
        # Оригинал PNG на месте.
        assert os.path.isfile(png_path)
        # БД не обновлена.
        post.refresh_from_db()
        assert post.body == original_body
        # В отчёте — найден 1 файл, посчитана экономия.
        report = out.getvalue()
        assert "DRY RUN" in report
        assert "Найдено PNG/JPG на диске: 1" in report


@pytest.mark.django_db
class TestExecute:
    def test_execute_creates_webp_and_keeps_original(self):
        rel = "news/x/photo.png"
        png_path = _write_to_media(rel, _png_bytes())
        NewsPostFactory(body=f'<p><img src="/media/{rel}"></p>')

        call_command("convert_news_images_to_webp", "--execute", stdout=StringIO())

        webp_target = os.path.splitext(png_path)[0] + ".webp"
        assert os.path.isfile(webp_target), "WebP должен быть создан рядом"
        assert os.path.isfile(png_path), "оригинальный PNG не должен удаляться"
        # Sanity: WebP открывается и это валидный image.
        with Image.open(webp_target) as im:
            assert im.format == "WEBP"

    def test_body_url_replaced_in_all_languages(self):
        rel = "news/lang/banner.png"
        _write_to_media(rel, _png_bytes())
        post = NewsPostFactory(
            body=f'<p>RU <img src="/media/{rel}"></p>',
            body_en=f'<p>EN <img src="/media/{rel}"></p>',
            body_de=f'<p>DE <img src="/media/{rel}"></p>',
            body_pt=f'<p>PT <img src="/media/{rel}"></p>',
            lede=f'<p>LEDE <img src="/media/{rel}"></p>',
            rating_explanation=f'<img src="/media/{rel}">',
        )

        call_command("convert_news_images_to_webp", "--execute", stdout=StringIO())

        post.refresh_from_db()
        webp_url = f"/media/news/lang/banner.webp"
        for field_name in ("body_ru", "body_en", "body_de", "body_pt", "lede", "rating_explanation"):
            value = getattr(post, field_name)
            assert webp_url in value, f"{field_name} не получил .webp URL: {value!r}"
            assert "banner.png" not in value, f"{field_name} ещё содержит .png: {value!r}"

    def test_idempotent_skips_existing_webp_on_disk(self):
        # Кейс: .webp уже лежит на диске (от предыдущего run-а), но в HTML
        # ссылка ещё на .png — команда должна обновить URL и НЕ перекодировать.
        rel = "news/idem/img.png"
        png_path = _write_to_media(rel, _png_bytes())
        webp_target = os.path.splitext(png_path)[0] + ".webp"
        # Симулируем существующий .webp с известным контентом-маркером.
        with open(webp_target, "wb") as fh:
            fh.write(b"sentinel-not-real-webp")
        sentinel_mtime = os.path.getmtime(webp_target)

        post = NewsPostFactory(body=f'<p><img src="/media/{rel}"></p>')

        out = StringIO()
        call_command("convert_news_images_to_webp", "--execute", stdout=out)

        # .webp не перекодирован — sentinel сохранился.
        with open(webp_target, "rb") as fh:
            assert fh.read() == b"sentinel-not-real-webp"
        assert os.path.getmtime(webp_target) == sentinel_mtime, \
            "повторный запуск без --force-reconvert не должен перезаписывать .webp"
        # URL в БД всё равно обновился на .webp.
        post.refresh_from_db()
        assert "/media/news/idem/img.webp" in post.body
        report = out.getvalue()
        assert "Уже было .webp рядом: 1" in report

    def test_force_reconvert_overwrites_existing_webp(self):
        rel = "news/force/x.png"
        png_path = _write_to_media(rel, _png_bytes())
        webp_target = os.path.splitext(png_path)[0] + ".webp"
        # Положим «чужой» .webp файл.
        os.makedirs(os.path.dirname(webp_target), exist_ok=True)
        with open(webp_target, "wb") as fh:
            fh.write(b"sentinel")

        NewsPostFactory(body=f'<p><img src="/media/{rel}"></p>')
        call_command(
            "convert_news_images_to_webp", "--execute", "--force-reconvert",
            stdout=StringIO(),
        )

        with open(webp_target, "rb") as fh:
            data = fh.read()
        assert data != b"sentinel", "--force-reconvert должен перезаписать .webp"
        assert data.startswith(b"RIFF"), "должен быть валидный WebP RIFF-header"


@pytest.mark.django_db
class TestExtensionFiltering:
    def test_does_not_touch_svg_gif_webp_in_html(self):
        # SVG/GIF/WebP — не конвертируем и не трогаем URL'ы.
        body = (
            '<img src="/media/news/x/icon.svg">'
            '<img src="/media/news/y/anim.gif">'
            '<img src="/media/news/z/already.webp">'
        )
        post = NewsPostFactory(body=body)

        call_command("convert_news_images_to_webp", "--execute", stdout=StringIO())

        post.refresh_from_db()
        assert post.body == body, "SVG/GIF/WebP URL'ы должны остаться без изменений"

    def test_handles_jpg_jpeg(self):
        rel_jpg = "news/ext/photo.jpg"
        rel_jpeg = "news/ext/photo2.jpeg"
        _write_to_media(rel_jpg, _jpg_bytes())
        _write_to_media(rel_jpeg, _jpg_bytes())
        post = NewsPostFactory(
            body=(
                f'<img src="/media/{rel_jpg}">'
                f'<img src="/media/{rel_jpeg}">'
            ),
        )

        call_command("convert_news_images_to_webp", "--execute", stdout=StringIO())

        post.refresh_from_db()
        assert "/media/news/ext/photo.webp" in post.body
        assert "/media/news/ext/photo2.webp" in post.body
        assert ".jpg" not in post.body
        assert ".jpeg" not in post.body


@pytest.mark.django_db
class TestPngWithAlpha:
    def test_png_with_alpha_preserved_as_webp(self):
        rel = "news/alpha/transparent.png"
        png_path = _write_to_media(rel, _png_bytes(alpha=True))
        NewsPostFactory(body=f'<img src="/media/{rel}">')

        call_command("convert_news_images_to_webp", "--execute", stdout=StringIO())

        webp_target = os.path.splitext(png_path)[0] + ".webp"
        assert os.path.isfile(webp_target)
        with Image.open(webp_target) as im:
            # WebP с альфой → mode 'RGBA' либо есть alpha-channel.
            assert im.mode in ("RGBA", "RGB"), f"unexpected mode {im.mode}"
            # Если RGBA — pixel должен иметь alpha != 255.
            if im.mode == "RGBA":
                pixel = im.getpixel((0, 0))
                assert pixel[3] != 255, "альфа должна сохраниться"


@pytest.mark.django_db
class TestFileFieldUpdates:
    def test_news_author_avatar_updated_to_webp(self, isolated_media_root):
        author = NewsAuthorFactory(
            avatar=SimpleUploadedFile("ava.png", _png_bytes()),
        )
        old_name = author.avatar.name
        assert old_name.endswith(".png")
        # Файл уже физически на диске благодаря FileField.
        abs_path = os.path.join(isolated_media_root, old_name)
        assert os.path.isfile(abs_path)

        call_command("convert_news_images_to_webp", "--execute", stdout=StringIO())

        author.refresh_from_db()
        assert author.avatar.name.endswith(".webp"), \
            f"avatar не обновился: {author.avatar.name}"
        # Оригинал на диске.
        assert os.path.isfile(abs_path)
        # WebP-вариант на диске.
        assert os.path.isfile(os.path.splitext(abs_path)[0] + ".webp")

    def test_news_media_image_updated(self, isolated_media_root):
        post = NewsPostFactory(body="")
        nm = NewsMedia.objects.create(
            news_post=post,
            file=SimpleUploadedFile("media.png", _png_bytes()),
            media_type="image",
            original_name="media.png",
        )
        old_name = nm.file.name
        assert old_name.endswith(".png")

        call_command("convert_news_images_to_webp", "--execute", stdout=StringIO())

        nm.refresh_from_db()
        assert nm.file.name.endswith(".webp")

    def test_news_media_video_not_touched(self, isolated_media_root):
        # Видео-файлы не должны попадать в выборку (media_type='image' filter).
        post = NewsPostFactory(body="")
        # Сэмплим .mp4 байты — Pillow его не откроет, но в конверсию он попасть не должен.
        nm = NewsMedia.objects.create(
            news_post=post,
            file=SimpleUploadedFile("v.png", b"not-really-png"),  # имя .png но media_type='video'
            media_type="video",
            original_name="v.png",
        )
        old_name = nm.file.name

        call_command("convert_news_images_to_webp", "--execute", stdout=StringIO())

        nm.refresh_from_db()
        assert nm.file.name == old_name, \
            "video media_type не должен трогаться (PNG-расширение его не делает image)"


@pytest.mark.django_db
class TestDuplicateGroupMergedBody:
    def test_merged_body_url_replaced(self):
        rel = "news/dupgr/photo.png"
        _write_to_media(rel, _png_bytes())
        dg = NewsDuplicateGroup.objects.create(
            merged_title="Title",
            merged_body=f'<p><img src="/media/{rel}"></p>',
        )
        NewsPostFactory(duplicate_group=dg, body="")

        call_command("convert_news_images_to_webp", "--execute", stdout=StringIO())

        dg.refresh_from_db()
        assert "/media/news/dupgr/photo.webp" in dg.merged_body
        assert ".png" not in dg.merged_body


@pytest.mark.django_db
class TestLimit:
    def test_limit_applies_to_post_iteration(self):
        # 3 поста, каждый ссылается на свой PNG. limit=1 → конвертируется 1 файл.
        from django.utils import timezone
        from datetime import timedelta

        for i in range(3):
            rel = f"news/lim/p{i}.png"
            _write_to_media(rel, _png_bytes())
            NewsPostFactory(
                body=f'<img src="/media/{rel}">',
                pub_date=timezone.now() - timedelta(days=i),
            )

        out = StringIO()
        call_command(
            "convert_news_images_to_webp", "--execute", "--limit", "1",
            stdout=out,
        )

        report = out.getvalue()
        assert "NewsPost просмотрено: 1" in report, report


@pytest.mark.django_db
class TestMissingFileGracefulDegrade:
    def test_url_without_file_on_disk_does_not_crash_or_replace(self):
        # URL ссылается на отсутствующий файл — команда должна не падать
        # и не делать URL replacement (.webp файла нет → ссылка превратилась бы в 404).
        post = NewsPostFactory(
            body='<img src="/media/news/ghost/missing.png">',
        )
        original = post.body

        out = StringIO()
        call_command("convert_news_images_to_webp", "--execute", stdout=out)

        post.refresh_from_db()
        assert post.body == original, \
            "URL не должен меняться когда исходный файл отсутствует на диске"
        report = out.getvalue()
        assert "Отсутствуют на диске:" in report or "Найдено PNG/JPG на диске: 0" in report
