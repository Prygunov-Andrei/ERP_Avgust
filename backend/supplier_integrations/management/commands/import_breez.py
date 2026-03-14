from django.core.management.base import BaseCommand

from accounting.models import Counterparty
from supplier_integrations.models import SupplierIntegration
from supplier_integrations.services.breez_import import BreezImportService
from supplier_integrations.services.breez_sync import BreezSyncService


class Command(BaseCommand):
    help = 'Импорт каталога Breez'

    def add_arguments(self, parser):
        parser.add_argument(
            '--create-integration',
            action='store_true',
            help='Создать интеграцию Breez (если не существует)',
        )
        parser.add_argument(
            '--integration-id',
            type=int,
            help='ID существующей интеграции',
        )
        parser.add_argument(
            '--stock-only',
            action='store_true',
            help='Только синхронизация остатков/цен (без полного импорта каталога)',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Тестовый запуск без сохранения (проверка подключения)',
        )

    def handle(self, *args, **options):
        integration = self._get_or_create_integration(options)
        if not integration:
            return

        if options['dry_run']:
            self._dry_run(integration)
            return

        if options['stock_only']:
            self._sync_stock(integration)
        else:
            self._import_catalog(integration)

    def _get_or_create_integration(self, options):
        if options['integration_id']:
            try:
                return SupplierIntegration.objects.get(pk=options['integration_id'])
            except SupplierIntegration.DoesNotExist:
                self.stderr.write(self.style.ERROR(
                    f'Интеграция #{options["integration_id"]} не найдена'
                ))
                return None

        if options['create_integration']:
            import os

            # Создать/найти контрагента БРИЗ
            counterparty, cp_created = Counterparty.objects.get_or_create(
                name='БРИЗ',
                defaults={
                    'type': Counterparty.Type.VENDOR,
                    'vendor_subtype': Counterparty.VendorSubtype.SUPPLIER,
                    'is_active': True,
                },
            )
            if cp_created:
                self.stdout.write(self.style.SUCCESS(
                    f'Создан контрагент: {counterparty.name}'
                ))

            integration, created = SupplierIntegration.objects.get_or_create(
                provider='breez',
                defaults={
                    'name': 'Breez',
                    'base_url': os.environ.get(
                        'BREEZ_API_BASE_URL', 'https://api.breez.ru/v1'
                    ),
                    'auth_header': os.environ.get(
                        'BREEZ_API_AUTH_HEADER', ''
                    ),
                    'counterparty': counterparty,
                    'is_active': True,
                },
            )
            if created:
                self.stdout.write(self.style.SUCCESS(
                    f'Создана интеграция #{integration.pk}: {integration.name}'
                ))
            else:
                # Привязать контрагента если ещё не привязан
                if not integration.counterparty:
                    integration.counterparty = counterparty
                    integration.save(update_fields=['counterparty', 'updated_at'])
                    self.stdout.write(f'Привязан контрагент к интеграции #{integration.pk}')
                self.stdout.write(f'Используется существующая интеграция #{integration.pk}')
            return integration

        # Берём первую активную Breez-интеграцию
        integration = SupplierIntegration.objects.filter(
            provider='breez', is_active=True,
        ).first()
        if not integration:
            self.stderr.write(self.style.ERROR(
                'Нет активной Breez-интеграции. Используйте --create-integration или --integration-id'
            ))
            return None
        return integration

    def _dry_run(self, integration):
        """Тестовый запуск — проверка подключения"""
        from supplier_integrations.clients.breez import BreezAPIClient, BreezAPIError

        self.stdout.write(f'Тестовое подключение к {integration.base_url}...')
        try:
            with BreezAPIClient(integration) as client:
                categories = client.get_categories()
                cat_count = len(categories) if isinstance(categories, dict) else 0
                self.stdout.write(self.style.SUCCESS(f'OK. Категорий: {cat_count}'))

                brands = client.get_brands()
                brand_count = len(brands) if isinstance(brands, dict) else 0
                self.stdout.write(self.style.SUCCESS(f'OK. Брендов: {brand_count}'))

                products = client.get_products()
                prod_count = len(products) if isinstance(products, dict) else 0
                self.stdout.write(self.style.SUCCESS(f'OK. Товаров: {prod_count}'))

        except BreezAPIError as e:
            self.stderr.write(self.style.ERROR(f'Ошибка: {e.message}'))

    def _import_catalog(self, integration):
        self.stdout.write(f'Запуск полного импорта каталога {integration.name}...')
        service = BreezImportService(integration)
        sync_log = service.import_full_catalog()
        self.stdout.write(self.style.SUCCESS(
            f'Импорт завершён ({sync_log.get_status_display()}): '
            f'обработано={sync_log.items_processed}, '
            f'создано={sync_log.items_created}, '
            f'обновлено={sync_log.items_updated}, '
            f'ошибок={sync_log.items_errors}, '
            f'длительность={sync_log.duration_seconds:.1f}с'
        ))

    def _sync_stock(self, integration):
        self.stdout.write(f'Запуск синхронизации остатков {integration.name}...')
        service = BreezSyncService(integration)
        sync_log = service.sync_stock_and_prices()
        self.stdout.write(self.style.SUCCESS(
            f'Синхронизация завершена ({sync_log.get_status_display()}): '
            f'обработано={sync_log.items_processed}, '
            f'обновлено={sync_log.items_updated}, '
            f'ошибок={sync_log.items_errors}, '
            f'длительность={sync_log.duration_seconds:.1f}с'
        ))
