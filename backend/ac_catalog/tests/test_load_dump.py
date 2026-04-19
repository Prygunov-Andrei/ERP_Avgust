"""Тесты management команды load_ac_rating_dump.

Synthetic-дамп строится в памяти/tmpfile. Реальный дамп Максима не
коммитится в репо — для smoke-теста на нём см. ac-rating/reports/05.
"""
from __future__ import annotations

import textwrap
from io import StringIO

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from ac_brands.models import Brand, BrandOriginClass
from ac_catalog.management.commands.load_ac_rating_dump import (
    USER_FK_COLUMNS,
    parse_dump,
)
from ac_catalog.models import ACModel, ModelRawValue
from ac_methodology.models import (
    Criterion,
    MethodologyCriterion,
    MethodologyVersion,
)


# ── Synthetic dump помощники ──────────────────────────────────────────


def _copy_block(table: str, columns: str, rows: list[str]) -> str:
    """Сборка одного COPY-блока в pg_dump-формате."""
    body = "\n".join(rows)
    if rows:
        body += "\n"
    return f"COPY public.{table} ({columns}) FROM stdin;\n{body}\\.\n"


def _full_synthetic_dump() -> str:
    """Минимальный валидный дамп: 1 origin, 1 brand, 1 equipment, 1 methodology,
    1 criterion, 1 mc, 1 acmodel, 1 raw_value (numeric, чтобы recalc дал ненулевой).

    + один пустой COPY (calculation_run) и один skip-блок (auth_user) для
    проверки соответствующих веток парсера/команды.
    """
    blocks = [
        # skip
        _copy_block(
            "auth_user",
            "id, password, last_login, is_superuser, username, first_name, "
            "last_name, email, is_staff, is_active, date_joined",
            [
                "1\tpbkdf2$x\t\\N\tt\tmaxim\t\t\t\\N\tt\tt\t2025-01-01 00:00:00+00",
            ],
        ),
        # origin → 1 row
        _copy_block(
            "brands_brandoriginclass",
            "id, created_at, updated_at, origin_type, fallback_score",
            [
                "10\t2025-01-01 00:00:00+00\t2025-01-01 00:00:00+00\tjapanese\t90",
            ],
        ),
        # brand → 1 row, references origin 10
        _copy_block(
            "brands_brand",
            "id, created_at, updated_at, name, logo, is_active, "
            "sales_start_year_ru, origin_class_id",
            [
                "20\t2025-01-01 00:00:00+00\t2025-01-01 00:00:00+00\tDaikin\t\tt\t2000\t10",
            ],
        ),
        _copy_block(
            "catalog_equipmenttype",
            "id, name",
            ["30\tСплит-система"],
        ),
        # methodology → активная
        _copy_block(
            "methodology_methodologyversion",
            "id, created_at, updated_at, version, name, description, is_active, "
            "needs_recalculation, tab_description_custom, tab_description_index, "
            "tab_description_quiet",
            [
                "40\t2025-01-01 00:00:00+00\t2025-01-01 00:00:00+00\t1.0\tАвгуст\t\tt\tf\t\t\t",
            ],
        ),
        # criterion (numeric)
        _copy_block(
            "methodology_criterion",
            "id, created_at, updated_at, code, name_ru, name_en, name_de, name_pt, "
            "description_ru, description_en, description_de, description_pt, "
            "unit, value_type, is_active, photo",
            [
                "50\t2025-01-01 00:00:00+00\t2025-01-01 00:00:00+00\tnoise\tШум\t\t\t\t\t\t\t\tдБ\tnumeric\tt\t",
            ],
        ),
        # methodology_criterion: weight=100, min=20, max=40, median=30
        _copy_block(
            "methodology_methodologycriterion",
            "id, created_at, updated_at, scoring_type, weight, min_value, "
            "median_value, max_value, is_inverted, median_by_capacity, "
            "custom_scale_json, formula_json, is_required_lab, "
            "is_required_checklist, is_required_catalog, use_in_lab, "
            "use_in_checklist, use_in_catalog, region_scope, is_public, "
            "display_order, is_active, criterion_id, methodology_id",
            [
                "60\t2025-01-01 00:00:00+00\t2025-01-01 00:00:00+00\t"
                "min_median_max\t100\t20\t30\t40\tf\t\\N\t\\N\t\\N\t"
                "f\tf\tf\tt\tt\tt\tglobal\tt\t1\tt\t50\t40",
            ],
        ),
        # acmodel
        _copy_block(
            "catalog_acmodel",
            "id, created_at, updated_at, series, inner_unit, outer_unit, "
            "nominal_capacity, publish_status, total_index, youtube_url, "
            "rutube_url, vk_url, brand_id, equipment_type_id, cons_text, "
            "price, pros_text, slug, is_ad, ad_position",
            [
                "70\t2025-01-01 00:00:00+00\t2025-01-01 00:00:00+00\t\t"
                "MODEL-X\tOUTER-X\t2500\tpublished\t0\t\t\t\t20\t30\t\t"
                "\\N\t\tDaikin-MODEL-X-OUTER-X\tf\t\\N",
            ],
        ),
        # raw_value: значение шума 30 → score=50 → total_index=50.0
        _copy_block(
            "catalog_modelrawvalue",
            "id, created_at, updated_at, raw_value, numeric_value, source, "
            "source_url, comment, verification_status, lab_status, "
            "approved_by_id, criterion_id, entered_by_id, model_id, "
            "compressor_model, criterion_code",
            [
                "80\t2025-01-01 00:00:00+00\t2025-01-01 00:00:00+00\t30\t30\t\t\t\t"
                "catalog\tnot_measured\t999\t50\t999\t70\t\tnoise",
            ],
        ),
        # scoring_calculationrun: пустой
        _copy_block(
            "scoring_calculationrun",
            "id, started_at, finished_at, status, models_processed, "
            "error_message, methodology_id, triggered_by_id",
            [],
        ),
    ]
    return "-- HEADER --\n\\restrict abc123\n\n" + "\n".join(blocks)


# ── parse_dump ────────────────────────────────────────────────────────


def test_parse_dump_picks_only_mapped_tables():
    blocks = parse_dump(_full_synthetic_dump())
    sources = [b.source_table for b in blocks]
    # auth_user пропущен; все остальные — наши ac_*-кандидаты.
    assert "auth_user" not in sources
    # Порядок строго LOAD_ORDER.
    assert sources == [
        "brands_brandoriginclass",
        "brands_brand",
        "catalog_equipmenttype",
        "methodology_methodologyversion",
        "methodology_criterion",
        "methodology_methodologycriterion",
        "catalog_acmodel",
        "catalog_modelrawvalue",
        "scoring_calculationrun",
    ]


def test_parse_dump_renames_target_tables():
    blocks = parse_dump(_full_synthetic_dump())
    by_source = {b.source_table: b.target_table for b in blocks}
    assert by_source["brands_brand"] == "ac_brands_brand"
    assert by_source["catalog_acmodel"] == "ac_catalog_acmodel"
    assert by_source["scoring_calculationrun"] == "ac_scoring_calculationrun"


def test_parse_dump_replaces_user_fk_with_null_marker():
    """approved_by_id и entered_by_id должны стать `\\N` в строке."""
    blocks = parse_dump(_full_synthetic_dump())
    rv_block = next(b for b in blocks if b.source_table == "catalog_modelrawvalue")
    # В исходной строке стояло 999/999 (пользователь Максима), теперь \N.
    assert rv_block.user_fk_indices  # не пусто
    parts = rv_block.rows[0].split("\t")
    for idx in rv_block.user_fk_indices:
        assert parts[idx] == r"\N", (
            f"Колонка {rv_block.columns[idx]} не обнулена"
        )


def test_parse_dump_handles_empty_copy_block():
    """Пустой COPY (`FROM stdin;\\n\\.\\n`) распознаётся, row_count=0."""
    blocks = parse_dump(_full_synthetic_dump())
    run_block = next(b for b in blocks if b.source_table == "scoring_calculationrun")
    assert run_block.row_count == 0
    assert run_block.rows == []


def test_user_fk_columns_constant_covers_all_three():
    assert USER_FK_COLUMNS == frozenset({
        "triggered_by_id", "entered_by_id", "approved_by_id",
    })


# ── Команда: dry-run / safety / load / truncate / recalculate ─────────


@pytest.fixture
def dump_path(tmp_path):
    p = tmp_path / "synthetic.sql"
    p.write_text(_full_synthetic_dump(), encoding="utf-8")
    return p


@pytest.mark.django_db
def test_command_dry_run_writes_nothing(dump_path):
    out = StringIO()
    call_command("load_ac_rating_dump", str(dump_path), "--dry-run", stdout=out)
    body = out.getvalue()
    assert "Dry-run: ничего не записано" in body
    assert "ac_brands_brand" in body
    assert Brand.objects.count() == 0


@pytest.mark.django_db
def test_command_requires_yes_i_am_sure_for_real_run(dump_path):
    out = StringIO()
    call_command("load_ac_rating_dump", str(dump_path), stdout=out)
    body = out.getvalue()
    assert "yes-i-am-sure" in body
    assert Brand.objects.count() == 0


@pytest.mark.django_db
def test_command_full_load_creates_objects(dump_path):
    call_command(
        "load_ac_rating_dump", str(dump_path),
        "--truncate", "--yes-i-am-sure",
        stdout=StringIO(),
    )
    assert BrandOriginClass.objects.filter(origin_type="japanese").exists()
    brand = Brand.objects.get(name="Daikin")
    assert brand.pk == 20
    assert brand.sales_start_year_ru == 2000
    ac = ACModel.objects.get(inner_unit="MODEL-X")
    assert ac.brand_id == 20
    assert ac.publish_status == ACModel.PublishStatus.PUBLISHED
    rv = ModelRawValue.objects.get(model=ac, criterion__code="noise")
    assert rv.raw_value == "30"
    # FK-обнуление user-полей сработало.
    assert rv.entered_by_id is None
    assert rv.approved_by_id is None


@pytest.mark.django_db
def test_command_refuses_load_into_non_empty_db_without_truncate(dump_path):
    # 1) Загрузили
    call_command(
        "load_ac_rating_dump", str(dump_path),
        "--truncate", "--yes-i-am-sure",
        stdout=StringIO(),
    )
    # 2) Повторный запуск без --truncate → CommandError
    with pytest.raises(CommandError, match="уже содержат данные"):
        call_command(
            "load_ac_rating_dump", str(dump_path), "--yes-i-am-sure",
            stdout=StringIO(),
        )


@pytest.mark.django_db
def test_command_truncate_idempotent_reload(dump_path):
    # Первый раз — создание.
    call_command(
        "load_ac_rating_dump", str(dump_path),
        "--truncate", "--yes-i-am-sure",
        stdout=StringIO(),
    )
    cnt_after_first = ACModel.objects.count()
    # Второй раз с --truncate — count остаётся прежним (id переиспользуются
    # из дампа благодаря RESTART IDENTITY + COPY с явными id).
    call_command(
        "load_ac_rating_dump", str(dump_path),
        "--truncate", "--yes-i-am-sure",
        stdout=StringIO(),
    )
    assert ACModel.objects.count() == cnt_after_first


@pytest.mark.django_db
def test_command_recalculate_updates_total_index(dump_path):
    out = StringIO()
    call_command(
        "load_ac_rating_dump", str(dump_path),
        "--truncate", "--recalculate", "--yes-i-am-sure",
        stdout=out,
    )
    assert "Пересчитано" in out.getvalue()
    ac = ACModel.objects.get(inner_unit="MODEL-X")
    # raw_value=30, min=20, median=30, max=40 → normalized=50, weight=100 → total=50.0
    assert ac.total_index == pytest.approx(50.0, abs=0.5)


@pytest.mark.django_db
def test_command_missing_file(tmp_path):
    with pytest.raises(CommandError, match="Файл не найден"):
        call_command(
            "load_ac_rating_dump", str(tmp_path / "no.sql"), "--dry-run",
            stdout=StringIO(),
        )


@pytest.mark.django_db
def test_command_prints_target_db_for_safety(dump_path):
    out = StringIO()
    call_command(
        "load_ac_rating_dump", str(dump_path), "--dry-run", stdout=out,
    )
    body = out.getvalue()
    assert "Target DB:" in body  # safety pin
    assert "HOST=" in body
    assert "NAME=" in body


@pytest.mark.django_db
def test_command_skipped_section_lists_unmapped_tables(dump_path):
    out = StringIO()
    call_command(
        "load_ac_rating_dump", str(dump_path), "--dry-run", stdout=out,
    )
    body = out.getvalue()
    # auth_user из synthetic должен попасть в «Пропущено».
    assert "Пропущено" in body
    assert "auth_user" in body


def test_dump_format_smoke():
    """Sanity-check: synthetic-дамп выглядит как plain pg_dump."""
    text = _full_synthetic_dump()
    assert "\\restrict" in text  # pragma из pg_dump 16.13
    assert text.count("FROM stdin;") == 10
    assert text.count("\\.\n") == 10
