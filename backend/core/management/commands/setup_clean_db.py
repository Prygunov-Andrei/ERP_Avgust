"""
Единая команда для подготовки чистой базы данных.

Выполняет все шаги в правильном порядке:
1. Юрлица и сотрудники
2. Категории товаров
3. Разряды монтажников
4. Импорт прайс-листа из Excel
5. Каталоги поставщиков (JSON → DB)
6. Матрица компетенций по разрядам

Использование:
    python manage.py setup_clean_db
    python manage.py setup_clean_db --skip-pricelist   # без импорта прайса
    python manage.py setup_clean_db --skip-catalogs    # без импорта каталогов поставщиков
    python manage.py setup_clean_db --pricelist path/to/file.xlsx
"""
from pathlib import Path

from django.core.management import call_command
from django.core.management.base import BaseCommand

# Путь к Excel-файлу прайс-листа по умолчанию (относительно backend/)
DEFAULT_PRICELIST = Path(__file__).resolve().parents[3] / 'pricelists' / 'data' / 'pricelist_2026.xlsx'

# JSON-каталоги поставщиков для импорта
SUPPLIER_CATALOGS = [
    Path(__file__).resolve().parents[3] / 'catalog' / 'data' / 'suppliers' / 'galvent' / 'galvent_catalog_products.json',
    Path(__file__).resolve().parents[3] / 'catalog' / 'data' / 'suppliers' / 'wheil' / 'wheil_duct_equipment_products.json',
    Path(__file__).resolve().parents[3] / 'catalog' / 'data' / 'suppliers' / 'wheil' / 'wheil_grilles_products.json',
    Path(__file__).resolve().parents[3] / 'catalog' / 'data' / 'suppliers' / 'wheil' / 'wheil_cable_trays_products.json',
    Path(__file__).resolve().parents[3] / 'catalog' / 'data' / 'suppliers' / 'wheil' / 'wheil_accessories_products.json',
]


class Command(BaseCommand):
    help = 'Подготовка чистой БД: юрлица, сотрудники, категории, прайс-лист, каталоги, компетенции'

    def add_arguments(self, parser):
        parser.add_argument(
            '--skip-pricelist',
            action='store_true',
            help='Пропустить импорт прайс-листа из Excel',
        )
        parser.add_argument(
            '--skip-catalogs',
            action='store_true',
            help='Пропустить импорт каталогов поставщиков',
        )
        parser.add_argument(
            '--pricelist',
            type=str,
            default=None,
            help='Путь к Excel-файлу прайс-листа (по умолчанию: pricelists/data/pricelist_2026.xlsx)',
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.MIGRATE_HEADING(
            '=== Подготовка чистой базы данных ==='
        ))

        # 1. Юрлица + сотрудники
        self.stdout.write('')
        self.stdout.write(self.style.MIGRATE_HEADING('Шаг 1/6: Юрлица и сотрудники'))
        call_command('load_real_employees', stdout=self.stdout, stderr=self.stderr)

        # 2. Категории товаров
        self.stdout.write('')
        self.stdout.write(self.style.MIGRATE_HEADING('Шаг 2/6: Категории товаров'))
        call_command('seed_categories', reset=True, stdout=self.stdout, stderr=self.stderr)

        # 3. Разряды монтажников
        self.stdout.write('')
        self.stdout.write(self.style.MIGRATE_HEADING('Шаг 3/6: Разряды монтажников'))
        call_command('populate_pricelists', stdout=self.stdout, stderr=self.stderr)

        # 4. Прайс-лист из Excel
        if options['skip_pricelist']:
            self.stdout.write('')
            self.stdout.write(self.style.WARNING('Шаг 4/6: Импорт прайс-листа — ПРОПУЩЕН'))
        else:
            pricelist_path = options['pricelist'] or str(DEFAULT_PRICELIST)
            pricelist_file = Path(pricelist_path)

            self.stdout.write('')
            self.stdout.write(self.style.MIGRATE_HEADING('Шаг 4/6: Импорт прайс-листа'))

            if not pricelist_file.exists():
                self.stderr.write(self.style.ERROR(
                    f'Файл прайс-листа не найден: {pricelist_file}\n'
                    f'Используйте --pricelist <путь> или --skip-pricelist'
                ))
                return

            call_command(
                'import_pricelist_from_excel',
                str(pricelist_file),
                skip_header=True,
                stdout=self.stdout,
                stderr=self.stderr,
            )

        # 5. Каталоги поставщиков
        if options['skip_catalogs']:
            self.stdout.write('')
            self.stdout.write(self.style.WARNING('Шаг 5/6: Каталоги поставщиков — ПРОПУЩЕН'))
        else:
            self.stdout.write('')
            self.stdout.write(self.style.MIGRATE_HEADING('Шаг 5/6: Каталоги поставщиков'))
            for catalog_path in SUPPLIER_CATALOGS:
                if catalog_path.exists():
                    self.stdout.write(f'  Импорт: {catalog_path.name}')
                    call_command(
                        'import_supplier_catalog',
                        str(catalog_path),
                        reset=True,
                        stdout=self.stdout,
                        stderr=self.stderr,
                    )
                else:
                    self.stdout.write(self.style.WARNING(
                        f'  Каталог не найден (пропуск): {catalog_path}'
                    ))

        # 6. Матрица компетенций
        self.stdout.write('')
        self.stdout.write(self.style.MIGRATE_HEADING('Шаг 6/6: Матрица компетенций'))
        call_command('populate_grade_skills', clear=True, stdout=self.stdout, stderr=self.stderr)

        # Итог
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(
            '=== База данных готова к работе ==='
        ))
