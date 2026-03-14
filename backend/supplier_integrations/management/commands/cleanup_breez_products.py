from django.core.management.base import BaseCommand
from django.db.models import Q

from catalog.models import Product, ProductAlias
from supplier_integrations.models import SupplierIntegration, SupplierProduct


class Command(BaseCommand):
    help = 'Очистка Product/SupplierProduct связей перед переимпортом Breez'

    def add_arguments(self, parser):
        parser.add_argument(
            '--integration-id',
            type=int,
            help='ID интеграции Breez (по умолчанию — первая активная)',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Показать что будет сделано, без изменений',
        )

    def handle(self, *args, **options):
        integration = self._get_integration(options)
        if not integration:
            return

        dry_run = options['dry_run']
        prefix = '[DRY-RUN] ' if dry_run else ''

        # 1. Собрать ID Product, привязанных к SupplierProduct этой интеграции
        linked_product_ids = list(
            SupplierProduct.objects.filter(
                integration=integration,
                product__isnull=False,
            ).values_list('product_id', flat=True)
        )
        self.stdout.write(f'{prefix}SupplierProduct с привязкой к Product: {len(linked_product_ids)}')

        # 2. Обнулить SupplierProduct.product
        if not dry_run:
            updated = SupplierProduct.objects.filter(
                integration=integration,
                product__isnull=False,
            ).update(product=None)
            self.stdout.write(self.style.SUCCESS(f'Обнулено SupplierProduct.product: {updated}'))
        else:
            self.stdout.write(f'{prefix}Будет обнулено SupplierProduct.product: {len(linked_product_ids)}')

        # 3. Удалить алиасы breez:*
        breez_aliases = ProductAlias.objects.filter(alias_name__startswith='breez:')
        alias_count = breez_aliases.count()
        if not dry_run:
            breez_aliases.delete()
            self.stdout.write(self.style.SUCCESS(f'Удалено алиасов breez:*: {alias_count}'))
        else:
            self.stdout.write(f'{prefix}Будет удалено алиасов breez:*: {alias_count}')

        # 4. Архивировать Product без связей (только те, что были привязаны к Breez)
        if linked_product_ids:
            # Product, у которых нет: EstimateItem, InvoiceItem, ProductPriceHistory
            products_to_archive = Product.objects.filter(
                pk__in=linked_product_ids,
            ).exclude(
                status=Product.Status.ARCHIVED,
            ).exclude(
                # Есть связь с EstimateItem
                estimate_items__isnull=False,
            ).exclude(
                # Есть связь с InvoiceItem
                invoice_items__isnull=False,
            ).exclude(
                # Есть история цен
                price_history__isnull=False,
            ).exclude(
                # Ещё привязан к другому SupplierProduct (другой интеграции)
                supplier_products__isnull=False,
            ).distinct()

            archive_count = products_to_archive.count()
            if not dry_run:
                products_to_archive.update(status=Product.Status.ARCHIVED)
                self.stdout.write(self.style.SUCCESS(
                    f'Архивировано пустых Product: {archive_count}'
                ))
            else:
                self.stdout.write(f'{prefix}Будет архивировано пустых Product: {archive_count}')

            kept = len(linked_product_ids) - archive_count
            self.stdout.write(f'{prefix}Product сохранены (есть связи): {kept}')
        else:
            self.stdout.write(f'{prefix}Нет Product для архивации')

        self.stdout.write(self.style.SUCCESS(f'{prefix}Очистка завершена'))

    def _get_integration(self, options):
        if options['integration_id']:
            try:
                return SupplierIntegration.objects.get(pk=options['integration_id'])
            except SupplierIntegration.DoesNotExist:
                self.stderr.write(self.style.ERROR(
                    f'Интеграция #{options["integration_id"]} не найдена'
                ))
                return None

        integration = SupplierIntegration.objects.filter(
            provider='breez', is_active=True,
        ).first()
        if not integration:
            self.stderr.write(self.style.ERROR(
                'Нет активной Breez-интеграции'
            ))
            return None
        return integration
