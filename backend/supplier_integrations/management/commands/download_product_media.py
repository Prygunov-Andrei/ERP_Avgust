from django.core.management.base import BaseCommand

from supplier_integrations.models import SupplierIntegration


class Command(BaseCommand):
    help = 'Скачать медиа товаров (картинки, буклеты, инструкции) в MinIO'

    def add_arguments(self, parser):
        parser.add_argument(
            '--product-id',
            type=int,
            help='ID одного Product для скачивания',
        )
        parser.add_argument(
            '--integration-id',
            type=int,
            help='ID интеграции (скачать медиа всех её товаров)',
        )
        parser.add_argument(
            '--async',
            action='store_true',
            dest='run_async',
            help='Запустить как Celery-задачу',
        )

    def handle(self, *args, **options):
        if options['run_async']:
            self._run_async(options)
            return

        from supplier_integrations.services.media_downloader import ProductMediaDownloader

        with ProductMediaDownloader() as downloader:
            if options['product_id']:
                from catalog.models import Product
                try:
                    product = Product.objects.get(pk=options['product_id'])
                except Product.DoesNotExist:
                    self.stderr.write(self.style.ERROR(
                        f'Product #{options["product_id"]} не найден'
                    ))
                    return
                self.stdout.write(f'Скачивание медиа Product #{product.pk}: {product.name}...')
                downloader.download_for_product(product)

            elif options['integration_id']:
                self.stdout.write(f'Скачивание медиа для интеграции #{options["integration_id"]}...')
                stats = downloader.download_all_for_integration(options['integration_id'])
                self._print_stats(stats)

            else:
                # Все активные интеграции
                integrations = SupplierIntegration.objects.filter(is_active=True)
                for integration in integrations:
                    self.stdout.write(f'Скачивание медиа для {integration.name}...')
                    stats = downloader.download_all_for_integration(integration.pk)
                    self._print_stats(stats)

        self.stdout.write(self.style.SUCCESS('Готово'))

    def _run_async(self, options):
        from supplier_integrations.tasks import download_all_product_media, download_product_media

        if options['product_id']:
            task = download_product_media.delay(options['product_id'])
            self.stdout.write(f'Celery задача: {task.id}')
        else:
            task = download_all_product_media.delay(
                integration_id=options.get('integration_id'),
            )
            self.stdout.write(f'Celery задача: {task.id}')

    def _print_stats(self, stats):
        self.stdout.write(self.style.SUCCESS(
            f'Скачано: {stats["downloaded"]}, '
            f'пропущено: {stats["skipped"]}, '
            f'ошибок: {stats["errors"]}'
        ))
