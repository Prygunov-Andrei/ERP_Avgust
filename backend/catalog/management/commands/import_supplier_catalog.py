"""
Импорт каталога поставщика из JSON в базу данных.

Читает JSON-файл (сгенерированный parse_supplier_catalog) и создаёт
Product-записи: один Product на каждый размерный вариант.

Использование:
    python manage.py import_supplier_catalog catalog/data/suppliers/galvent/galvent_products.json
    python manage.py import_supplier_catalog ... --reset   # удалить старые товары поставщика
    python manage.py import_supplier_catalog ... --dry-run  # только показать что будет создано
"""
import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from catalog.models import Category, Product, ProductAlias


class Command(BaseCommand):
    help = 'Импортирует каталог поставщика из JSON в базу (Product на каждый вариант)'

    def add_arguments(self, parser):
        parser.add_argument('json_file', type=str, help='Путь к JSON-файлу каталога')
        parser.add_argument(
            '--reset', action='store_true',
            help='Удалить все товары этого поставщика перед импортом',
        )
        parser.add_argument(
            '--dry-run', action='store_true',
            help='Показать план импорта без записи в БД',
        )

    def handle(self, *args, **options):
        json_path = Path(options['json_file'])
        if not json_path.exists():
            raise CommandError(f'Файл не найден: {json_path}')

        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        supplier = data.get('supplier', 'unknown')
        products_data = data.get('products', [])

        self.stdout.write(f'Поставщик: {supplier}')
        self.stdout.write(f'Товаров в JSON: {len(products_data)}')
        self.stdout.write(f'Вариантов в JSON: {data.get("total_variants", "?")}')

        # Загружаем все категории по коду
        categories = {c.code: c for c in Category.objects.all()}

        # Собираем план импорта
        import_plan = []
        missing_categories = set()
        skipped_no_variants = 0

        for product_data in products_data:
            category_code = product_data.get('category_code', '')
            category = categories.get(category_code)

            if not category and category_code:
                missing_categories.add(category_code)

            base_name = product_data.get('name', '').strip()
            default_unit = product_data.get('default_unit', 'шт')
            description = product_data.get('description', '')
            variants = product_data.get('variants', [])

            if not variants:
                skipped_no_variants += 1
                continue

            for variant in variants:
                name_suffix = variant.get('name_suffix', '').strip()
                if name_suffix:
                    full_name = f'{base_name} {name_suffix}'
                else:
                    full_name = base_name

                import_plan.append({
                    'name': full_name,
                    'base_name': base_name,
                    'category': category,
                    'category_code': category_code,
                    'default_unit': default_unit,
                    'supplier': supplier,
                })

        # Отчёт о плане
        self.stdout.write(f'\nК импорту: {len(import_plan)} товаров (Product)')
        if skipped_no_variants:
            self.stdout.write(self.style.WARNING(
                f'Пропущено без вариантов: {skipped_no_variants}'
            ))
        if missing_categories:
            self.stdout.write(self.style.WARNING(
                f'Категории не найдены в БД: {", ".join(sorted(missing_categories))}'
            ))

        # Статистика по категориям
        cat_counts = {}
        for item in import_plan:
            code = item['category_code'] or '(без категории)'
            cat_counts[code] = cat_counts.get(code, 0) + 1
        self.stdout.write('\nПо категориям:')
        for code, count in sorted(cat_counts.items(), key=lambda x: -x[1]):
            self.stdout.write(f'  {code:<40s} {count:>5d}')

        if options['dry_run']:
            self.stdout.write(self.style.WARNING('\nDRY RUN — запись в БД не выполнена'))
            return

        # Удаление старых товаров поставщика
        if options['reset']:
            # Ищем товары по алиасу-маркеру поставщика
            marker = f'supplier:{supplier}'
            old_aliases = ProductAlias.objects.filter(
                normalized_alias=Product.normalize_name(marker)
            )
            old_product_ids = list(old_aliases.values_list('product_id', flat=True))
            if old_product_ids:
                deleted_count = Product.objects.filter(id__in=old_product_ids).delete()[0]
                self.stdout.write(self.style.WARNING(
                    f'Удалено старых товаров поставщика {supplier}: {deleted_count}'
                ))

        # Импорт
        created_count = 0
        alias_count = 0

        with transaction.atomic():
            for item in import_plan:
                product = Product.objects.create(
                    name=item['name'],
                    category=item['category'],
                    default_unit=item['default_unit'],
                    is_service=False,
                    status=Product.Status.VERIFIED,
                )
                created_count += 1

                # Алиас с базовым именем (без размера) — для будущего матчинга
                base_normalized = Product.normalize_name(item['base_name'])
                if base_normalized != product.normalized_name:
                    ProductAlias.objects.get_or_create(
                        product=product,
                        normalized_alias=base_normalized,
                        defaults={'alias_name': item['base_name']},
                    )
                    alias_count += 1

                # Маркер поставщика — для --reset
                supplier_marker = f'supplier:{item["supplier"]}'
                ProductAlias.objects.get_or_create(
                    product=product,
                    normalized_alias=Product.normalize_name(supplier_marker),
                    defaults={'alias_name': supplier_marker},
                )

        self.stdout.write(f'\n{"="*60}')
        self.stdout.write(self.style.SUCCESS(f'Создано товаров: {created_count}'))
        self.stdout.write(f'Создано алиасов: {alias_count}')
        self.stdout.write(f'Всего товаров в БД: {Product.objects.count()}')
