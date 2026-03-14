from django.core.management import call_command
from django.core.management.base import BaseCommand

from supplier_integrations.models import SupplierIntegration
from supplier_integrations.services.breez_import import BreezImportService
from supplier_integrations.services.breez_sync import BreezSyncService


class Command(BaseCommand):
    help = 'Полный переимпорт Breez: очистка → каталог → остатки'

    def add_arguments(self, parser):
        parser.add_argument(
            '--integration-id',
            type=int,
            help='ID интеграции Breez (по умолчанию — первая активная)',
        )
        parser.add_argument(
            '--skip-cleanup',
            action='store_true',
            help='Пропустить очистку (если уже выполнена)',
        )
        parser.add_argument(
            '--skip-stock',
            action='store_true',
            help='Пропустить синхронизацию остатков',
        )

    def handle(self, *args, **options):
        integration = self._get_integration(options)
        if not integration:
            return

        # 1. Очистка
        if not options['skip_cleanup']:
            self.stdout.write(self.style.WARNING('=== Этап 1: Очистка ==='))
            cleanup_args = []
            if options['integration_id']:
                cleanup_args.extend(['--integration-id', str(options['integration_id'])])
            call_command('cleanup_breez_products', *cleanup_args, stdout=self.stdout, stderr=self.stderr)
        else:
            self.stdout.write('Очистка пропущена (--skip-cleanup)')

        # 2. Полный импорт каталога
        self.stdout.write(self.style.WARNING('=== Этап 2: Импорт каталога ==='))
        import_service = BreezImportService(integration)
        sync_log = import_service.import_full_catalog()
        self.stdout.write(self.style.SUCCESS(
            f'Каталог: обработано={sync_log.items_processed}, '
            f'создано={sync_log.items_created}, '
            f'обновлено={sync_log.items_updated}, '
            f'ошибок={sync_log.items_errors}, '
            f'длительность={sync_log.duration_seconds:.1f}с'
        ))

        # 3. Синхронизация остатков
        if not options['skip_stock']:
            self.stdout.write(self.style.WARNING('=== Этап 3: Синхронизация остатков ==='))
            sync_service = BreezSyncService(integration)
            stock_log = sync_service.sync_stock_and_prices()
            self.stdout.write(self.style.SUCCESS(
                f'Остатки: обработано={stock_log.items_processed}, '
                f'обновлено={stock_log.items_updated}, '
                f'ошибок={stock_log.items_errors}, '
                f'длительность={stock_log.duration_seconds:.1f}с'
            ))
        else:
            self.stdout.write('Синхронизация остатков пропущена (--skip-stock)')

        # Итог
        from catalog.models import Product
        from supplier_integrations.models import SupplierProduct

        sp_count = SupplierProduct.objects.filter(integration=integration).count()
        sp_linked = SupplierProduct.objects.filter(
            integration=integration, product__isnull=False,
        ).count()
        product_count = Product.objects.filter(
            status=Product.Status.VERIFIED,
        ).count()

        self.stdout.write(self.style.SUCCESS(
            f'\n=== Итог ===\n'
            f'SupplierProduct: {sp_count}\n'
            f'SupplierProduct с привязкой: {sp_linked}\n'
            f'Product (verified): {product_count}'
        ))

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
                'Нет активной Breez-интеграции. Сначала: python manage.py import_breez --create-integration'
            ))
            return None
        return integration
