"""Wave 12: lowercase slug карточек моделей.

- Schema: ACModel.legacy_slug (CharField, blank, db_index) — для 301-редиректа
  со старого URL.
- Data: для каждой модели генерируем новый lowercase slug 'brand-series-inner-outer'.
  Старый slug сохраняется в legacy_slug (если изменился). Совпадение со
  старым — пропуск (идемпотентно).

⚠ ПЕРЕД ПРИМЕНЕНИЕМ НА ПРОДЕ — backup БД (необратимая data-миграция).
"""
from __future__ import annotations

import re

from django.db import migrations, models
from django.utils.text import slugify


def _new_slug(model) -> str:
    """Inline-копия generate_lowercase_slug — миграция self-contained.

    transliterate здесь не используем (по согласованию с PO в BRIEF):
    27 проD-моделей — латинскими брендами/моделями, кириллица не ожидается.
    Если попадётся — slug «провалится» в укороченный, и редактор пересоздаст
    его руками через админку.
    """
    parts = [
        model.brand.name if model.brand_id else "",
        model.series or "",
        model.inner_unit or "",
        model.outer_unit or "",
    ]
    raw = "-".join(p for p in parts if p)
    s = slugify(raw, allow_unicode=False).replace("_", "-")
    return re.sub(r"-+", "-", s).strip("-")


def regenerate_slugs(apps, schema_editor):
    """Старый slug → legacy_slug, новый lowercase — в slug."""
    ACModel = apps.get_model("ac_catalog", "ACModel")

    seen: set[str] = set()
    renamed = 0
    skipped = 0

    for m in ACModel.objects.select_related("brand").all():
        new = _new_slug(m)
        if not new:
            skipped += 1
            continue
        # Коллизия (две модели одного бренда+серии без outer_unit и т.п.) →
        # суффикс -id, чтобы не уронить unique constraint.
        if new in seen:
            new = f"{new}-{m.id}"
        seen.add(new)

        if new == m.slug:
            # Идемпотентность: повторный прогон миграции не трогает slugs,
            # уже находящиеся в lowercase-формате.
            continue

        m.legacy_slug = m.slug or ""
        m.slug = new
        m.save(update_fields=["slug", "legacy_slug"])
        renamed += 1

    print(
        f"\n  [data-migration] Wave 12 lowercase slug: renamed={renamed}, "
        f"skipped(empty parts)={skipped}"
    )


def reverse_regenerate(apps, schema_editor):
    """Откат: legacy_slug → slug, legacy_slug очищается."""
    ACModel = apps.get_model("ac_catalog", "ACModel")
    restored = 0
    for m in ACModel.objects.exclude(legacy_slug="").all():
        m.slug = m.legacy_slug
        m.legacy_slug = ""
        m.save(update_fields=["slug", "legacy_slug"])
        restored += 1
    print(f"\n  [data-migration] Reverted {restored} slugs to legacy values")


class Migration(migrations.Migration):

    dependencies = [
        ("ac_catalog", "0005_clear_ionizer_type_values"),
    ]

    operations = [
        migrations.AddField(
            model_name="acmodel",
            name="legacy_slug",
            field=models.CharField(
                blank=True,
                db_index=True,
                default="",
                help_text=(
                    "Старый slug (Wave 11 формат: UPPERCASE+underscore). "
                    "Сохраняется при переходе на lowercase в Wave 12 для "
                    "301-редиректа на новый канонический URL. Используется в "
                    "by-slug view как fallback."
                ),
                max_length=255,
                verbose_name="Legacy slug",
            ),
        ),
        # Django 4.2 после AddField(default='') делает DROP DEFAULT —
        # COPY/dump-загрузки без колонки legacy_slug ловят NotNullViolation.
        # Восстанавливаем DB-level default '' (db_default появится в Django 5+).
        migrations.RunSQL(
            sql=(
                "ALTER TABLE ac_catalog_acmodel "
                "ALTER COLUMN legacy_slug SET DEFAULT '';"
            ),
            reverse_sql=(
                "ALTER TABLE ac_catalog_acmodel "
                "ALTER COLUMN legacy_slug DROP DEFAULT;"
            ),
        ),
        migrations.RunPython(regenerate_slugs, reverse_regenerate),
    ]
