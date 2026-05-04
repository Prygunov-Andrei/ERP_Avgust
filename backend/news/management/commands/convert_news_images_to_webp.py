"""Статическая конверсия PNG/JPG картинок новостей в WebP.

Проходит по всем NewsPost (HTML-поля во всех языковых вариантах
modeltranslation), NewsDuplicateGroup.merged_body, NewsAuthor.avatar,
NewsMedia.file (image), MediaUpload.file. Для каждого PNG/JPG файла на
диске создаёт WebP-вариант рядом и обновляет ссылки в БД.

Идемпотентно: повторный запуск пропускает уже сконвертированные файлы.
Оригинальные PNG/JPG не удаляются (rollback safety).

Запуск:
    python manage.py convert_news_images_to_webp                  # dry-run
    python manage.py convert_news_images_to_webp --execute        # реально
    python manage.py convert_news_images_to_webp --limit 5        # на N постов
    python manage.py convert_news_images_to_webp --execute --force-reconvert
"""
from __future__ import annotations

import os
import re
from collections import defaultdict
from dataclasses import dataclass, field
from urllib.parse import unquote

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction

from PIL import Image

from news.models import (
    MediaUpload,
    NewsAuthor,
    NewsDuplicateGroup,
    NewsMedia,
    NewsPost,
)


# Single-language NewsPost HTML-поля (без modeltranslation).
HTML_FIELDS_SINGLE = ("lede", "rating_explanation")
# Поля с modeltranslation — реальные имена `body_ru`, `body_en`, ...
HTML_FIELDS_TRANSLATED = ("body",)
LANGS = ("ru", "en", "de", "pt")
# NewsDuplicateGroup-поля.
HTML_FIELDS_DUP_GROUP = ("merged_body",)

CONVERTIBLE_EXTS = (".png", ".jpg", ".jpeg")
SKIP_EXTS = (".webp", ".svg", ".gif")
WEBP_QUALITY = 82
WEBP_METHOD = 6

# Регулярка: ловит inline `src/href="..."` и CSS `url(...)` для PNG/JPG/JPEG
# (только конвертируемые расширения — webp/gif/svg намеренно пропускаются).
_URL_BODY = (
    r'(?:https?://[^"\'() ]*?)?'
    r'/(?:media|hvac-media)/[^"\'() ]+\.(?:png|jpe?g)'
)
ATTR_PATTERN = re.compile(
    r'(?P<attr>(?:src|href)\s*=\s*)(?P<quote>["\'])(?P<url>'
    + _URL_BODY
    + r')(?P=quote)',
    re.IGNORECASE,
)
CSS_URL_PATTERN = re.compile(
    r'(?P<prefix>url\()(?P<url>' + _URL_BODY + r')(?P<suffix>\))',
    re.IGNORECASE,
)


def _all_post_html_fields() -> tuple[str, ...]:
    """Возвращает физические имена HTML-полей NewsPost: `body_ru`, `body_en`, ..., `lede`, `rating_explanation`."""
    translated = tuple(f"{f}_{lang}" for f in HTML_FIELDS_TRANSLATED for lang in LANGS)
    return translated + HTML_FIELDS_SINGLE


def _to_webp_url(url: str) -> str:
    """`/media/news/foo.png` → `/media/news/foo.webp` (case-insensitive по расширению)."""
    base, _ext = os.path.splitext(url)
    return f"{base}.webp"


def _to_webp_storage_name(name: str) -> str:
    base, _ext = os.path.splitext(name)
    return f"{base}.webp"


def _resolve_local_path(url_or_storage: str) -> str | None:
    """URL или storage name → абсолютный путь под MEDIA_ROOT.

    URL: `/media/foo`, `/hvac-media/foo`, `https://host/media/foo` → MEDIA_ROOT/foo.
    Storage name (NewsMedia.file.name) — возвращаем MEDIA_ROOT + name.
    """
    if not url_or_storage:
        return None
    media_root = str(settings.MEDIA_ROOT)
    # URL формы.
    m = re.match(r"^(?:https?://[^/]+)?(/[^?#]+)$", url_or_storage)
    if m:
        path = unquote(m.group(1))
        for prefix in ("/media/", "/hvac-media/"):
            if path.startswith(prefix):
                return os.path.join(media_root, path[len(prefix):])
    # Storage name (без leading slash).
    if not url_or_storage.startswith("/"):
        return os.path.join(media_root, url_or_storage)
    return None


def _has_convertible_ext(path_or_url: str) -> bool:
    return os.path.splitext(path_or_url.lower())[1] in CONVERTIBLE_EXTS


def _replace_in_html(text: str, eligible_urls: set[str]) -> tuple[str, int]:
    """Заменяет PNG/JPG URL'ы на .webp вариант для тех url'ов, которые в `eligible_urls`.

    `eligible_urls` — набор URL strings из исходного HTML, для которых файл
    сконвертирован (или будет сконвертирован — в dry-run считаем все собранные).
    Возвращает (новый_текст, количество_замен).
    """
    if not text:
        return text, 0
    count = 0

    def _sub_attr(m: re.Match) -> str:
        nonlocal count
        url = m.group("url")
        if url not in eligible_urls:
            return m.group(0)
        count += 1
        return f'{m.group("attr")}{m.group("quote")}{_to_webp_url(url)}{m.group("quote")}'

    def _sub_css(m: re.Match) -> str:
        nonlocal count
        url = m.group("url")
        if url not in eligible_urls:
            return m.group(0)
        count += 1
        return f'{m.group("prefix")}{_to_webp_url(url)}{m.group("suffix")}'

    text = ATTR_PATTERN.sub(_sub_attr, text)
    text = CSS_URL_PATTERN.sub(_sub_css, text)
    return text, count


def _collect_urls_from_html(text: str) -> list[str]:
    if not text:
        return []
    out: list[str] = []
    for m in ATTR_PATTERN.finditer(text):
        out.append(m.group("url"))
    for m in CSS_URL_PATTERN.finditer(text):
        out.append(m.group("url"))
    return out


@dataclass
class ConvertStats:
    found_files: set[str] = field(default_factory=set)        # абсолютные пути
    already_webp_on_disk: set[str] = field(default_factory=set)
    converted_files: set[str] = field(default_factory=set)
    failed_files: list[tuple[str, str]] = field(default_factory=list)  # (path, error)
    missing_files: set[str] = field(default_factory=set)
    skipped_non_convertible: set[str] = field(default_factory=set)
    bytes_before: int = 0
    bytes_after: int = 0
    posts_seen: int = 0
    posts_with_changes: int = 0
    html_replacements: int = 0
    file_field_updates: int = 0


class Command(BaseCommand):
    help = (
        "Конвертирует PNG/JPG картинок новостей в WebP и обновляет ссылки в БД. "
        "По умолчанию dry-run; --execute для реальной работы."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--execute", action="store_true",
            help="Реально писать на диск и в БД (без флага — dry-run).",
        )
        parser.add_argument(
            "--limit", type=int, default=None,
            help="Лимит количества обрабатываемых NewsPost (по pub_date desc). Тестовый прогон.",
        )
        parser.add_argument(
            "--force-reconvert", action="store_true",
            help="Перезаписывать существующие .webp (не пропускать).",
        )

    # ------------------------------------------------------------------
    def handle(self, *args, **opts):
        execute: bool = opts["execute"]
        limit: int | None = opts.get("limit")
        force: bool = opts["force_reconvert"]

        if not execute:
            self.stdout.write(self.style.WARNING(
                "DRY RUN — без --execute диск и БД не меняются"
            ))

        stats = ConvertStats()

        # Pass 1: собираем referenced пути с диска и URL→path mapping.
        url_to_abs, post_url_index, dup_url_index = self._collect_references(stats, limit)
        author_files, news_media_files, media_upload_files = self._collect_file_field_paths(stats)

        # Pass 2: конвертируем файлы (или симулируем для dry-run).
        all_abs_paths = (
            set(url_to_abs.values())
            | set(author_files.values())
            | set(news_media_files.values())
            | set(media_upload_files.values())
        )
        converted_set = self._convert_files(all_abs_paths, stats, execute, force)

        # Pass 3: обновляем БД (URL'ы и file fields) для успешно обеспеченных webp.
        if execute:
            with transaction.atomic():
                self._apply_html_updates(post_url_index, dup_url_index, url_to_abs,
                                          converted_set, stats, execute=True)
                self._apply_file_field_updates(
                    author_files, news_media_files, media_upload_files,
                    converted_set, stats, execute=True,
                )
        else:
            self._apply_html_updates(post_url_index, dup_url_index, url_to_abs,
                                      converted_set, stats, execute=False)
            self._apply_file_field_updates(
                author_files, news_media_files, media_upload_files,
                converted_set, stats, execute=False,
            )

        self._print_report(stats, execute, limit)

    # ------------------------------------------------------------------
    # Сбор референсов
    # ------------------------------------------------------------------
    def _collect_references(self, stats: ConvertStats, limit: int | None):
        """Собирает URL'ы из HTML-полей NewsPost и NewsDuplicateGroup.

        Возвращает:
            url_to_abs:       {original_url -> abs_disk_path}
            post_url_index:   {post_id -> {field_name -> [urls]}}
            dup_url_index:    {dup_group_id -> {field_name -> [urls]}}
        """
        url_to_abs: dict[str, str] = {}
        post_url_index: dict[int, dict[str, list[str]]] = defaultdict(dict)
        dup_url_index: dict[int, dict[str, list[str]]] = defaultdict(dict)

        post_qs = NewsPost.objects.all().order_by("-pub_date")
        if limit:
            post_qs = post_qs[:limit]

        seen_dup_groups: set[int] = set()

        for post in post_qs.iterator():
            stats.posts_seen += 1
            for field_name in _all_post_html_fields():
                value = getattr(post, field_name, None) or ""
                urls = _collect_urls_from_html(value)
                if not urls:
                    continue
                post_url_index[post.id][field_name] = urls
                for url in urls:
                    if url in url_to_abs:
                        continue
                    abs_path = _resolve_local_path(url)
                    if abs_path:
                        url_to_abs[url] = abs_path

            if post.duplicate_group_id and post.duplicate_group_id not in seen_dup_groups:
                seen_dup_groups.add(post.duplicate_group_id)
                try:
                    dg = post.duplicate_group
                except NewsDuplicateGroup.DoesNotExist:
                    dg = None
                if dg:
                    for field_name in HTML_FIELDS_DUP_GROUP:
                        value = getattr(dg, field_name, None) or ""
                        urls = _collect_urls_from_html(value)
                        if not urls:
                            continue
                        dup_url_index[dg.id][field_name] = urls
                        for url in urls:
                            if url in url_to_abs:
                                continue
                            abs_path = _resolve_local_path(url)
                            if abs_path:
                                url_to_abs[url] = abs_path

        return url_to_abs, post_url_index, dup_url_index

    def _collect_file_field_paths(self, stats: ConvertStats):
        """Собирает file-field references → абсолютные пути.

        Возвращает три mapping'а: author_id→abs_path, news_media_id→abs_path,
        media_upload_id→abs_path. Только если файл с конвертируемым расширением.
        """
        author_files: dict[int, str] = {}
        for author in NewsAuthor.objects.exclude(avatar="").exclude(avatar__isnull=True):
            name = author.avatar.name if author.avatar else ""
            if name and _has_convertible_ext(name):
                abs_path = _resolve_local_path(name)
                if abs_path:
                    author_files[author.id] = abs_path

        news_media_files: dict[int, str] = {}
        for nm in NewsMedia.objects.filter(media_type="image").iterator():
            name = nm.file.name if nm.file else ""
            if name and _has_convertible_ext(name):
                abs_path = _resolve_local_path(name)
                if abs_path:
                    news_media_files[nm.id] = abs_path

        media_upload_files: dict[int, str] = {}
        for mu in MediaUpload.objects.filter(media_type="image").iterator():
            name = mu.file.name if mu.file else ""
            if name and _has_convertible_ext(name):
                abs_path = _resolve_local_path(name)
                if abs_path:
                    media_upload_files[mu.id] = abs_path

        return author_files, news_media_files, media_upload_files

    # ------------------------------------------------------------------
    # Конверсия файлов
    # ------------------------------------------------------------------
    def _convert_files(
        self,
        abs_paths: set[str],
        stats: ConvertStats,
        execute: bool,
        force: bool,
    ) -> set[str]:
        """Конвертирует или симулирует конверсию.

        Возвращает множество абсолютных путей, для которых .webp вариант
        либо уже на диске, либо был успешно создан в этом run'е.
        Для dry-run возвращает «теоретически конвертируемые» — те, у которых
        исходный PNG/JPG читаем Pillow'ом.
        """
        ensured_webp: set[str] = set()

        for abs_path in sorted(abs_paths):
            ext = os.path.splitext(abs_path.lower())[1]
            if ext not in CONVERTIBLE_EXTS:
                stats.skipped_non_convertible.add(abs_path)
                continue
            if not os.path.isfile(abs_path):
                stats.missing_files.add(abs_path)
                continue

            stats.found_files.add(abs_path)
            target = _to_webp_storage_name(abs_path)

            if os.path.isfile(target) and not force:
                stats.already_webp_on_disk.add(abs_path)
                ensured_webp.add(abs_path)
                # Учитываем размеры даже для уже-WebP — для отчёта.
                try:
                    stats.bytes_before += os.path.getsize(abs_path)
                    stats.bytes_after += os.path.getsize(target)
                except OSError:
                    pass
                continue

            if not execute:
                # Dry-run: проверим что Pillow может прочитать (без записи).
                try:
                    with Image.open(abs_path) as im:
                        im.verify()
                    ensured_webp.add(abs_path)
                    stats.bytes_before += os.path.getsize(abs_path)
                    # Грубая оценка post-convert size — 1/8 от оригинала (типичный gain).
                    stats.bytes_after += os.path.getsize(abs_path) // 8
                except Exception as exc:
                    stats.failed_files.append((abs_path, f"verify: {exc}"))
                continue

            try:
                self._encode_webp(abs_path, target)
                stats.converted_files.add(abs_path)
                ensured_webp.add(abs_path)
                stats.bytes_before += os.path.getsize(abs_path)
                stats.bytes_after += os.path.getsize(target)
            except Exception as exc:
                stats.failed_files.append((abs_path, str(exc)))

        return ensured_webp

    @staticmethod
    def _encode_webp(src_path: str, dst_path: str) -> None:
        """Кодирует одну картинку в WebP, сохраняя альфу для PNG."""
        with Image.open(src_path) as im:
            im.load()
            mode = im.mode
            save_kwargs = {
                "format": "WEBP",
                "quality": WEBP_QUALITY,
                "method": WEBP_METHOD,
            }
            if mode in ("RGBA", "LA"):
                # Сохраняем альфу.
                save_kwargs["lossless"] = False
                im.save(dst_path, **save_kwargs)
            elif mode == "P" and "transparency" in im.info:
                im.convert("RGBA").save(dst_path, **save_kwargs)
            else:
                if mode not in ("RGB", "L"):
                    im = im.convert("RGB")
                im.save(dst_path, **save_kwargs)

    # ------------------------------------------------------------------
    # Обновление БД
    # ------------------------------------------------------------------
    def _apply_html_updates(
        self,
        post_url_index: dict[int, dict[str, list[str]]],
        dup_url_index: dict[int, dict[str, list[str]]],
        url_to_abs: dict[str, str],
        ensured_webp: set[str],
        stats: ConvertStats,
        execute: bool,
    ) -> None:
        """Обновляет HTML-поля NewsPost и NewsDuplicateGroup."""
        # Eligible URL-ы — те, чей abs_path сконвертирован/уже WebP.
        eligible_urls: set[str] = {
            url for url, ap in url_to_abs.items() if ap in ensured_webp
        }

        # NewsPost
        post_ids = list(post_url_index.keys())
        for post in NewsPost.objects.filter(id__in=post_ids).iterator():
            updates: dict[str, str] = {}
            for field_name in _all_post_html_fields():
                value = getattr(post, field_name, None) or ""
                if not value:
                    continue
                new_value, count = _replace_in_html(value, eligible_urls)
                if count > 0:
                    updates[field_name] = new_value
                    stats.html_replacements += count
            if updates:
                stats.posts_with_changes += 1
                if execute:
                    for fname, fval in updates.items():
                        setattr(post, fname, fval)
                    post.save(update_fields=list(updates.keys()))

        # NewsDuplicateGroup
        dup_ids = list(dup_url_index.keys())
        if dup_ids:
            for dg in NewsDuplicateGroup.objects.filter(id__in=dup_ids).iterator():
                updates = {}
                for field_name in HTML_FIELDS_DUP_GROUP:
                    value = getattr(dg, field_name, None) or ""
                    if not value:
                        continue
                    new_value, count = _replace_in_html(value, eligible_urls)
                    if count > 0:
                        updates[field_name] = new_value
                        stats.html_replacements += count
                if updates and execute:
                    for fname, fval in updates.items():
                        setattr(dg, fname, fval)
                    dg.save(update_fields=list(updates.keys()))

    def _apply_file_field_updates(
        self,
        author_files: dict[int, str],
        news_media_files: dict[int, str],
        media_upload_files: dict[int, str],
        ensured_webp: set[str],
        stats: ConvertStats,
        execute: bool,
    ) -> None:
        """Обновляет имена FileField/ImageField на .webp вариант (только string update, без delete)."""

        def _update(model_cls, mapping: dict[int, str], field_name: str) -> None:
            ids = [
                obj_id for obj_id, abs_path in mapping.items()
                if abs_path in ensured_webp
            ]
            if not ids:
                return
            for obj in model_cls.objects.filter(id__in=ids).iterator():
                file_field = getattr(obj, field_name)
                old_name = file_field.name if file_field else ""
                if not old_name:
                    continue
                new_name = _to_webp_storage_name(old_name)
                if new_name == old_name:
                    continue
                stats.file_field_updates += 1
                if execute:
                    file_field.name = new_name
                    obj.save(update_fields=[field_name])

        _update(NewsAuthor, author_files, "avatar")
        _update(NewsMedia, news_media_files, "file")
        _update(MediaUpload, media_upload_files, "file")

    # ------------------------------------------------------------------
    # Отчёт
    # ------------------------------------------------------------------
    def _print_report(self, stats: ConvertStats, execute: bool, limit: int | None) -> None:
        mb = lambda n: f"{n / (1024 * 1024):.2f} MB"
        gain_mb = (stats.bytes_before - stats.bytes_after) / (1024 * 1024)
        gain_pct = (
            100 * (stats.bytes_before - stats.bytes_after) / stats.bytes_before
            if stats.bytes_before
            else 0.0
        )

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("--- ИТОГО ---"))
        self.stdout.write(f"  Режим: {'EXECUTE' if execute else 'DRY-RUN'}"
                          f"{f', limit={limit}' if limit else ''}")
        self.stdout.write(f"  NewsPost просмотрено: {stats.posts_seen}")
        self.stdout.write(f"  NewsPost с заменами URL: {stats.posts_with_changes}")
        self.stdout.write(f"  HTML-замен URL всего: {stats.html_replacements}")
        self.stdout.write(f"  FileField/ImageField обновлений: {stats.file_field_updates}")
        self.stdout.write("")
        self.stdout.write(f"  Найдено PNG/JPG на диске: {len(stats.found_files)}")
        self.stdout.write(f"  Уже было .webp рядом: {len(stats.already_webp_on_disk)}")
        self.stdout.write(f"  Сконвертировано в этом run'е: {len(stats.converted_files)}")
        self.stdout.write(f"  Отсутствуют на диске: {len(stats.missing_files)}")
        self.stdout.write(f"  Ошибок при кодировании: {len(stats.failed_files)}")
        self.stdout.write(f"  Пропущено (svg/gif/webp): {len(stats.skipped_non_convertible)}")
        self.stdout.write("")
        self.stdout.write(f"  Размер до:    {mb(stats.bytes_before)}")
        self.stdout.write(f"  Размер после: {mb(stats.bytes_after)}")
        self.stdout.write(
            f"  Экономия:     {gain_mb:+.2f} MB ({gain_pct:.1f}%)"
        )
        if stats.failed_files:
            self.stdout.write("")
            self.stdout.write(self.style.ERROR("Ошибки:"))
            for path, err in stats.failed_files[:20]:
                self.stdout.write(f"  ! {path}: {err}")
            if len(stats.failed_files) > 20:
                self.stdout.write(f"  ... и ещё {len(stats.failed_files) - 20}")
        if stats.missing_files:
            self.stdout.write("")
            self.stdout.write(self.style.WARNING("Отсутствуют на диске (top 10):"))
            for path in sorted(stats.missing_files)[:10]:
                self.stdout.write(f"  ? {path}")
            if len(stats.missing_files) > 10:
                self.stdout.write(f"  ... и ещё {len(stats.missing_files) - 10}")
        if not execute:
            self.stdout.write("")
            self.stdout.write("Запусти с --execute для реальной конверсии и обновления БД.")
