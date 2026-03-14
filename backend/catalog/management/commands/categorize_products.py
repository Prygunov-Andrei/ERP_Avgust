"""
Массовая LLM-категоризация товаров без категории.

Использует ProductCategorizer для батч-обработки.
Безопасно прерывается — уже категоризированные товары не будут обработаны повторно.

Примеры:
    python manage.py categorize_products                    # все без категории
    python manage.py categorize_products --limit 100        # первые 100
    python manage.py categorize_products --dry-run           # только показать кол-во
    python manage.py categorize_products --supplier breez    # только товары от Breez
"""
from django.core.management.base import BaseCommand

from catalog.categorizer import ProductCategorizer, BATCH_SIZE
from catalog.models import Product


class Command(BaseCommand):
    help = 'Категоризировать товары без категории через LLM'

    def add_arguments(self, parser):
        parser.add_argument(
            '--limit',
            type=int,
            default=0,
            help='Максимум товаров для обработки (0 = все)',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Только показать количество, не вызывать LLM',
        )
        parser.add_argument(
            '--supplier',
            type=str,
            default='',
            help='Фильтр по провайдеру интеграции (например: breez)',
        )
        parser.add_argument(
            '--batch-size',
            type=int,
            default=BATCH_SIZE,
            help=f'Размер батча для LLM (по умолчанию {BATCH_SIZE})',
        )

    def handle(self, *args, **options):
        qs = Product.objects.filter(
            category__isnull=True,
            status__in=[Product.Status.NEW, Product.Status.VERIFIED],
        )

        if options['supplier']:
            qs = qs.filter(
                supplier_products__integration__provider=options['supplier'],
            ).distinct()

        total = qs.count()
        self.stdout.write(f'Товаров без категории: {total}')

        if total == 0:
            self.stdout.write(self.style.SUCCESS('Все товары уже имеют категорию'))
            return

        if options['dry_run']:
            self.stdout.write('Dry-run: LLM не вызывается')
            return

        limit = options['limit'] or total
        products = list(qs.order_by('id')[:limit])
        self.stdout.write(f'Будет обработано: {len(products)} (батч={options["batch_size"]})')

        categorizer = ProductCategorizer()
        categorized = 0
        batch_size = options['batch_size']

        for i in range(0, len(products), batch_size):
            batch = products[i:i + batch_size]
            count = categorizer.categorize_products(batch)
            categorized += count

            self.stdout.write(
                f'  Батч {i // batch_size + 1}: '
                f'{count}/{len(batch)} категоризировано'
            )

        self.stdout.write(self.style.SUCCESS(
            f'\nИтог: категоризировано {categorized} из {len(products)}'
        ))
