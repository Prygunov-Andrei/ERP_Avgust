"""Загрузка SQL-дампа Максимовского рейтинга в ERP БД.

Читает plain-text pg_dump (Максим: pg_dump 16.13, 31 таблица, ~647KB),
выбирает 16 нужных таблиц, переименовывает их в `ac_*`-схему ERP и
загружает через COPY FROM stdin. FK-колонки на auth_user обнуляются —
пользователи Максима в ERP не существуют. Sequence id_seq обновляются
после загрузки.

Безопасность:
- Команда печатает целевую БД (HOST:PORT, NAME) и без --dry-run требует
  --yes-i-am-sure.
- НЕ запускать через SSH-туннель к prod (`localhost:15432`)! Тестировать
  только на локальном Postgres или test-БД pytest.

Использование:
    manage.py load_ac_rating_dump <path-to-sql-file>
        [--truncate]          # TRUNCATE ac_* перед загрузкой (RESTART IDENTITY CASCADE)
        [--dry-run]           # парсинг + статистика, без записи
        [--recalculate]       # после загрузки — recalculate_all
        [--yes-i-am-sure]     # обязателен в non-dry-run
"""
from __future__ import annotations

import re
from io import StringIO
from pathlib import Path
from typing import Any

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction


# Источник (public.<key>) → цель (ac_*)
TABLE_MAPPING: dict[str, str] = {
    "brands_brandoriginclass": "ac_brands_brandoriginclass",
    "brands_brand": "ac_brands_brand",
    "catalog_equipmenttype": "ac_catalog_equipmenttype",
    "methodology_methodologyversion": "ac_methodology_methodologyversion",
    "methodology_criterion": "ac_methodology_criterion",
    "methodology_methodologycriterion": "ac_methodology_methodologycriterion",
    "catalog_acmodel": "ac_catalog_acmodel",
    "catalog_modelregion": "ac_catalog_modelregion",
    "catalog_acmodelphoto": "ac_catalog_acmodelphoto",
    "catalog_acmodelsupplier": "ac_catalog_acmodelsupplier",
    "catalog_modelrawvalue": "ac_catalog_modelrawvalue",
    "scoring_calculationrun": "ac_scoring_calculationrun",
    "scoring_calculationresult": "ac_scoring_calculationresult",
    "reviews_review": "ac_reviews_review",
    "submissions_acsubmission": "ac_submissions_acsubmission",
    "submissions_submissionphoto": "ac_submissions_submissionphoto",
}

# Порядок загрузки от независимых к зависимым (FK-направление).
LOAD_ORDER: list[str] = [
    "brands_brandoriginclass",
    "brands_brand",
    "catalog_equipmenttype",
    "methodology_methodologyversion",
    "methodology_criterion",
    "methodology_methodologycriterion",
    "catalog_acmodel",
    "catalog_modelregion",
    "catalog_acmodelphoto",
    "catalog_acmodelsupplier",
    "catalog_modelrawvalue",
    "scoring_calculationrun",
    "scoring_calculationresult",
    "reviews_review",
    "submissions_acsubmission",
    "submissions_submissionphoto",
]

# FK-колонки на auth_user — заменяем значения на NULL (\N в COPY-формате),
# т.к. user_id Максима ≠ user_id ERP. У всех трёх полей null=True (см. Ф2 модели).
USER_FK_COLUMNS: frozenset[str] = frozenset({
    "triggered_by_id",
    "entered_by_id",
    "approved_by_id",
})

# Все 16 ac_*-таблиц в одном TRUNCATE-стейтменте: CASCADE покроет FK
# из зависимых таблиц (например, calculation_result → calculation_run).
_TRUNCATE_SQL = (
    "TRUNCATE TABLE "
    + ", ".join(f'"{TABLE_MAPPING[src]}"' for src in LOAD_ORDER)
    + " RESTART IDENTITY CASCADE"
)

# Регулярка ловит ровно один COPY-блок. Терминатор — отдельная строка `\.`
# в начале строки (re.MULTILINE). Тело может быть пустым (таблица без данных:
# pg_dump пишет `FROM stdin;\n\.\n` без отдельной пустой строки между).
_COPY_RE = re.compile(
    r"^COPY public\.(\w+) \(([^)]+)\) FROM stdin;\n(.*?)^\\\.$",
    re.DOTALL | re.MULTILINE,
)


class ParsedCopyBlock:
    """Один распарсенный COPY-блок с уже применёнными преобразованиями."""

    __slots__ = ("source_table", "target_table", "columns", "rows", "user_fk_indices")

    def __init__(self, source_table: str, columns: list[str], rows: list[str]):
        self.source_table = source_table
        self.target_table = TABLE_MAPPING[source_table]
        self.columns = columns
        self.user_fk_indices = [
            i for i, c in enumerate(columns) if c in USER_FK_COLUMNS
        ]
        # Применяем обнуление user-FK сразу при парсинге.
        if self.user_fk_indices:
            self.rows = [self._null_user_fk(r) for r in rows]
        else:
            self.rows = list(rows)

    def _null_user_fk(self, row: str) -> str:
        parts = row.split("\t")
        for i in self.user_fk_indices:
            if i < len(parts):
                parts[i] = r"\N"
        return "\t".join(parts)

    @property
    def row_count(self) -> int:
        # Пустой блок (нет данных) даёт rows=[''] после split по \n.
        return sum(1 for r in self.rows if r != "")

    def to_copy_payload(self) -> str:
        """Тело для cursor.copy_expert (без заголовка, без терминатора)."""
        if not self.rows:
            return ""
        return "\n".join(self.rows) + "\n"


def parse_dump(text: str) -> list[ParsedCopyBlock]:
    """Возвращает только нужные блоки из дампа в порядке LOAD_ORDER.

    Skip-таблицы (auth/django_/core_/ratings_/methodology_criteriongroup) просто
    не попадают в результат.
    """
    found: dict[str, ParsedCopyBlock] = {}
    for match in _COPY_RE.finditer(text):
        source = match.group(1)
        if source not in TABLE_MAPPING:
            continue
        cols_raw = match.group(2)
        # `"order"` в catalog_acmodelphoto — quoted reserved keyword;
        # split по запятой без потери кавычек.
        columns = [c.strip() for c in cols_raw.split(",")]
        body = match.group(3)
        # Body может содержать trailing `\n` (для непустых блоков) или быть
        # пустым (для пустых COPY). Отфильтровываем пустые элементы.
        rows = [r for r in body.split("\n") if r != ""] if body else []
        found[source] = ParsedCopyBlock(source, columns, rows)

    return [found[src] for src in LOAD_ORDER if src in found]


class Command(BaseCommand):
    help = (
        "Загрузить SQL-дамп Максимовского рейтинга в ERP БД (парсинг pg_dump → COPY). "
        "ОБЯЗАТЕЛЬНО проверь target БД перед запуском без --dry-run."
    )

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument("file", help="Путь к .sql дампу (plain pg_dump)")
        parser.add_argument(
            "--truncate", action="store_true",
            help="TRUNCATE всех 16 ac_* таблиц перед загрузкой (RESTART IDENTITY CASCADE)",
        )
        parser.add_argument(
            "--dry-run", action="store_true",
            help="Только парсинг + статистика, без записи в БД",
        )
        parser.add_argument(
            "--recalculate", action="store_true",
            help="После загрузки вызвать ac_scoring.engine.recalculate_all",
        )
        parser.add_argument(
            "--yes-i-am-sure", action="store_true",
            help="Подтверждение для non-dry-run. Без него команда выходит без записи.",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        path = Path(options["file"])
        if not path.exists():
            raise CommandError(f"Файл не найден: {path}")

        db = settings.DATABASES["default"]
        target = (
            f"HOST={db.get('HOST') or 'localhost'}:{db.get('PORT') or '5432'}, "
            f"NAME={db['NAME']}"
        )
        self.stdout.write(self.style.NOTICE(f"Target DB: {target}"))

        dry_run = bool(options["dry_run"])
        truncate = bool(options["truncate"])
        recalculate = bool(options["recalculate"])

        if not dry_run and not options["yes_i_am_sure"]:
            self.stdout.write(self.style.WARNING(
                "Это запишет данные в указанную БД. "
                "Перед запуском убедись, что это НЕ прод (например, не туннель :15432). "
                "Если уверен — добавь --yes-i-am-sure."
            ))
            return

        self.stdout.write(f"Чтение дампа: {path} ({path.stat().st_size:,} байт)")
        text = path.read_text(encoding="utf-8")

        blocks = parse_dump(text)
        if not blocks:
            self.stdout.write(self.style.WARNING(
                "В дампе не найдено ни одной из ожидаемых 16 таблиц."
            ))
            return

        # Статистика парсинга
        total_rows = 0
        self.stdout.write(self.style.NOTICE("Найденные таблицы:"))
        for b in blocks:
            self.stdout.write(
                f"  {b.source_table:42s} → {b.target_table:42s} "
                f"({b.row_count} строк)"
            )
            total_rows += b.row_count
        self.stdout.write(f"Итого строк в дампе: {total_rows}")

        skipped = sorted(
            {m.group(1) for m in _COPY_RE.finditer(text)} - set(TABLE_MAPPING.keys())
        )
        if skipped:
            self.stdout.write(self.style.NOTICE(
                f"Пропущено (не из ac_*-домена): {', '.join(skipped)}"
            ))

        if dry_run:
            self.stdout.write(self.style.SUCCESS("Dry-run: ничего не записано."))
            return

        if not truncate:
            non_empty = self._find_non_empty_targets()
            if non_empty:
                raise CommandError(
                    "Целевые таблицы уже содержат данные: "
                    f"{', '.join(non_empty)}. "
                    "Добавь --truncate чтобы перезаписать."
                )

        with transaction.atomic():
            if truncate:
                self.stdout.write("TRUNCATE ac_* RESTART IDENTITY CASCADE…")
                with connection.cursor() as cur:
                    # Под pytest-django (вложенная транзакция) могут висеть
                    # deferred FK-checks от предыдущих INSERT — TRUNCATE
                    # тогда падает с «pending trigger events». Сбрасываем.
                    cur.execute("SET CONSTRAINTS ALL IMMEDIATE")
                    cur.execute(_TRUNCATE_SQL)

            for b in blocks:
                if b.row_count == 0:
                    self.stdout.write(f"  {b.target_table}: пусто — пропуск COPY")
                    continue
                self._copy_block(b)
                self.stdout.write(f"  {b.target_table}: {b.row_count} строк OK")

            self._update_sequences(blocks)

        self.stdout.write(self.style.SUCCESS(
            f"Загрузка завершена: {total_rows} строк в {len(blocks)} таблиц."
        ))

        if recalculate:
            self._recalculate()

    def _find_non_empty_targets(self) -> list[str]:
        non_empty: list[str] = []
        with connection.cursor() as cur:
            for src in LOAD_ORDER:
                target = TABLE_MAPPING[src]
                cur.execute(f'SELECT EXISTS(SELECT 1 FROM "{target}")')
                if cur.fetchone()[0]:
                    non_empty.append(target)
        return non_empty

    def _copy_block(self, block: ParsedCopyBlock) -> None:
        cols_quoted = ", ".join(block.columns)  # сохраняем "order" как есть
        sql = (
            f'COPY "{block.target_table}" ({cols_quoted}) '
            f"FROM stdin WITH (FORMAT text)"
        )
        with connection.cursor() as cur:
            cur.copy_expert(sql=sql, file=StringIO(block.to_copy_payload()))

    def _update_sequences(self, blocks: list[ParsedCopyBlock]) -> None:
        """setval для PK sequences тех таблиц, у которых есть колонка id."""
        with connection.cursor() as cur:
            for b in blocks:
                if "id" not in b.columns:
                    continue
                cur.execute(
                    "SELECT setval(pg_get_serial_sequence(%s, 'id'), "
                    "COALESCE((SELECT MAX(id) FROM \""
                    + b.target_table + "\"), 1))",
                    [b.target_table],
                )
        self.stdout.write("Sequences обновлены.")

    def _recalculate(self) -> None:
        from django.db.models import Max, Min

        from ac_catalog.models import ACModel
        from ac_scoring.engine import recalculate_all

        self.stdout.write("Запуск recalculate_all…")
        try:
            run = recalculate_all()
        except ValueError as e:
            self.stderr.write(self.style.WARNING(
                f"recalculate_all не выполнен: {e}"
            ))
            return

        if run.models_processed == 0:
            self.stdout.write("Моделей для пересчёта нет.")
            return

        agg = ACModel.objects.aggregate(mn=Min("total_index"), mx=Max("total_index"))
        if agg["mn"] is not None and agg["mx"] is not None:
            self.stdout.write(self.style.SUCCESS(
                f"Пересчитано {run.models_processed} моделей, "
                f"total_index в диапазоне [{agg['mn']:.2f}, {agg['mx']:.2f}]."
            ))
        else:
            self.stdout.write(self.style.SUCCESS(
                f"Пересчитано {run.models_processed} моделей."
            ))
