"""Management-команда генерации dark-версий бренд-логотипов.

См. ac-rating/tz/polish-2-dark-logos.md и сервис
backend/ac_brands/services/dark_logo_generator.py.

Примеры:
    # Все бренды (без LG — overridden как colored):
    python manage.py generate_brand_dark_logos --force-colored lg

    # Один бренд:
    python manage.py generate_brand_dark_logos --slug daikin

    # Dry-run классификации без сохранения:
    python manage.py generate_brand_dark_logos --dry-run

    # Перезаписать существующие dark-версии:
    python manage.py generate_brand_dark_logos --force
"""

from __future__ import annotations

import os

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.utils.text import slugify

from ac_brands.models import Brand
from ac_brands.services.dark_logo_generator import (
    classify_logo,
    generate_dark_logo,
)

# Дефолтный override: LG — красный круг слабой насыщенности ловится как mono.
DEFAULT_FORCE_COLORED = {"lg"}


def _brand_slug(brand: Brand) -> str:
    """Slug для сравнения с --force-colored/--force-mono."""
    return slugify(brand.name) or brand.name.lower()


class Command(BaseCommand):
    help = (
        "Генерирует dark-версию Brand.logo для .dark-темы (Pillow, детерминированно). "
        "Monochromatic лого (чёрный текст) → recolor в белый. Цветные — skip."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--slug",
            help="Обработать один бренд по slug (slugify(name)).",
        )
        parser.add_argument(
            "--force-colored",
            default="",
            help=(
                "CSV-список slug'ов: не генерировать dark (оставить оригинал). "
                f"Default override: {','.join(sorted(DEFAULT_FORCE_COLORED))}."
            ),
        )
        parser.add_argument(
            "--force-mono",
            default="",
            help="CSV-список slug'ов: форсированно recolor в white (override ложно-colored).",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Перезаписать существующие Brand.logo_dark.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Не сохранять. Только напечатать classification table.",
        )
        parser.add_argument(
            "--no-default-overrides",
            action="store_true",
            help=(
                "Отключить DEFAULT_FORCE_COLORED (lg). Полезно если хочется "
                "протестировать generator на brand-е lg без override."
            ),
        )

    def _parse_csv(self, raw: str) -> set[str]:
        return {s.strip().lower() for s in (raw or "").split(",") if s.strip()}

    def handle(self, *args, **opts):
        dry = opts["dry_run"]
        force = opts["force"]

        force_colored = self._parse_csv(opts["force_colored"])
        if not opts["no_default_overrides"]:
            force_colored |= DEFAULT_FORCE_COLORED
        force_mono = self._parse_csv(opts["force_mono"])

        overlap = force_colored & force_mono
        if overlap:
            self.stderr.write(
                self.style.ERROR(
                    f"Slug'и в обоих списках (force-colored и force-mono): {sorted(overlap)}"
                )
            )
            return

        qs = Brand.objects.filter(is_active=True).exclude(logo="")
        if opts.get("slug"):
            want_slug = opts["slug"].strip().lower()
            qs = [b for b in qs if _brand_slug(b) == want_slug]
            if not qs:
                self.stderr.write(self.style.ERROR(f"Бренд со slug={want_slug!r} не найден."))
                return
        total = len(qs) if isinstance(qs, list) else qs.count()

        if total == 0:
            self.stdout.write(self.style.WARNING("Нет брендов с логотипами для обработки."))
            return

        header = f"{'slug':20s} | {'name':25s} | {'mono?':6s} | {'stdev':>6s} | {'pixels':>7s} | {'action':18s} | {'saved':6s}"
        sep = "-" * len(header)
        self.stdout.write(header)
        self.stdout.write(sep)

        ok = 0
        skipped = 0
        failed = 0
        for brand in qs:
            slug = _brand_slug(brand)
            storage = brand.logo.storage
            path = brand.logo.name

            try:
                with storage.open(path, "rb") as f:
                    src_bytes = f.read()
            except Exception as exc:
                self.stderr.write(self.style.ERROR(f"  READ-FAIL {brand.name}: {exc}"))
                failed += 1
                continue

            try:
                info = classify_logo(src_bytes)
            except Exception as exc:
                self.stderr.write(self.style.ERROR(f"  CLASSIFY-FAIL {brand.name}: {exc}"))
                failed += 1
                continue

            # Решаем action.
            if slug in force_colored:
                action = "force-colored"
                dark_bytes = None
            elif slug in force_mono:
                action = "force-mono"
                try:
                    dark_bytes = generate_dark_logo(src_bytes, force_mono=True)
                except Exception as exc:
                    self.stderr.write(self.style.ERROR(f"  GEN-FAIL {brand.name}: {exc}"))
                    failed += 1
                    continue
            else:
                try:
                    dark_bytes = generate_dark_logo(src_bytes)
                except Exception as exc:
                    self.stderr.write(self.style.ERROR(f"  GEN-FAIL {brand.name}: {exc}"))
                    failed += 1
                    continue
                action = "auto-mono" if dark_bytes else "auto-colored"

            mono_str = "yes" if info["mono"] else "no"
            stdev_str = f"{info['mean_stdev']:.2f}"
            pixels_str = str(info["opaque_pixels"])

            if dark_bytes is None:
                row = (
                    f"{slug:20s} | {brand.name:25s} | {mono_str:6s} | {stdev_str:>6s} | "
                    f"{pixels_str:>7s} | {action:18s} | {'—':6s}"
                )
                self.stdout.write(row)
                skipped += 1
                continue

            if dry:
                row = (
                    f"{slug:20s} | {brand.name:25s} | {mono_str:6s} | {stdev_str:>6s} | "
                    f"{pixels_str:>7s} | {action:18s} | {'DRY':6s}"
                )
                self.stdout.write(row)
                ok += 1
                continue

            if brand.logo_dark and not force:
                row = (
                    f"{slug:20s} | {brand.name:25s} | {mono_str:6s} | {stdev_str:>6s} | "
                    f"{pixels_str:>7s} | {action:18s} | {'EXISTS':6s}"
                )
                self.stdout.write(row)
                skipped += 1
                continue

            # Сохраняем dark-версию: upload_to + имя файла = slug.png.
            ext = ".png"
            dark_name = f"ac_rating/brands/dark/{slug or 'brand'}{ext}"
            dark_storage = brand.logo_dark.storage

            if brand.logo_dark and force:
                try:
                    old_name = brand.logo_dark.name
                    if old_name and dark_storage.exists(old_name):
                        dark_storage.delete(old_name)
                except Exception as exc:
                    # Не критично — просто залогируем.
                    self.stderr.write(
                        self.style.WARNING(f"  OLD-DELETE {brand.name}: {exc}")
                    )

            saved_name = dark_storage.save(dark_name, ContentFile(dark_bytes))
            brand.logo_dark = saved_name
            brand.save(update_fields=["logo_dark"])

            row = (
                f"{slug:20s} | {brand.name:25s} | {mono_str:6s} | {stdev_str:>6s} | "
                f"{pixels_str:>7s} | {action:18s} | {'OK':6s}"
            )
            self.stdout.write(row)
            ok += 1

        self.stdout.write(sep)
        summary = f"Обработано: OK={ok}, skipped={skipped}, failed={failed}, total={total}."
        if dry:
            summary = "[DRY-RUN] " + summary
        self.stdout.write(self.style.SUCCESS(summary))
