"""
Массовый импорт счетов (PDF + Excel) из локальной папки.

Полный цикл через единый InvoiceService.recognize() pipeline:
парсинг → Invoice + InvoiceItem + Product + ProductPriceHistory + категоризация.

Использование:
    python manage.py import_invoices_full ./invoices
    python manage.py import_invoices_full ./invoices --dry-run
    python manage.py import_invoices_full ./invoices --limit 3
    python manage.py import_invoices_full ./invoices --no-auto-counterparty
"""
from pathlib import Path

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError

from llm_services.services.exceptions import RateLimitError

SUPPORTED_EXTENSIONS = {'.pdf', '.xlsx', '.xls', '.png', '.jpg', '.jpeg'}


class Command(BaseCommand):
    help = 'Массовый импорт счетов (PDF + Excel) из локальной папки через InvoiceService.recognize()'

    def add_arguments(self, parser):
        parser.add_argument(
            'directory',
            type=str,
            help='Путь к директории с файлами счетов',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Только показать файлы, не импортировать',
        )
        parser.add_argument(
            '--limit',
            type=int,
            default=None,
            help='Максимальное количество файлов для обработки',
        )
        parser.add_argument(
            '--no-auto-counterparty',
            action='store_true',
            help='Не создавать контрагентов автоматически',
        )

    def _discover_files(self, directory: Path) -> list[Path]:
        """Рекурсивно находит поддерживаемые файлы."""
        files = []
        for ext in SUPPORTED_EXTENSIONS:
            files.extend(directory.rglob(f'*{ext}'))
        files.sort(key=lambda f: f.name)
        return files

    def handle(self, *args, **options):
        directory = Path(options['directory'])

        if not directory.exists():
            raise CommandError(f'Директория не найдена: {directory}')
        if not directory.is_dir():
            raise CommandError(f'Указанный путь не является директорией: {directory}')

        # Обнаружение файлов
        files = self._discover_files(directory)
        self.stdout.write(f'Найдено {len(files)} файлов для обработки')

        # Dry-run
        if options['dry_run']:
            self.stdout.write('\nРежим dry-run — файлы не будут обработаны:')
            limit = options['limit']
            shown = files[:limit] if limit else files
            for f in shown:
                self.stdout.write(f'  - {f.name} ({f.suffix})')
            if limit and len(files) > limit:
                self.stdout.write(f'  ... и ещё {len(files) - limit} файлов')
            return

        from payments.models import Invoice
        from payments.services import InvoiceService

        auto_counterparty = not options['no_auto_counterparty']
        limit = options['limit']
        if limit:
            files = files[:limit]

        total = len(files)
        successful = 0
        failed = 0
        errors = []

        for i, filepath in enumerate(files, 1):
            self.stdout.write(f'[{i}/{total}] {filepath.name}... ', ending='')

            try:
                # 1. Создать Invoice в статусе RECOGNITION
                invoice = Invoice.objects.create(
                    source=Invoice.Source.BULK_IMPORT,
                    status=Invoice.Status.RECOGNITION,
                    invoice_type=Invoice.InvoiceType.SUPPLIER,
                    description=f'Импорт из CLI: {filepath.name}',
                )
                # 2. Сохранить файл
                file_content = filepath.read_bytes()
                invoice.invoice_file.save(
                    filepath.name,
                    ContentFile(file_content),
                    save=True,
                )
                # 3. Вызвать единый pipeline синхронно
                InvoiceService.recognize(
                    invoice.id,
                    auto_counterparty=auto_counterparty,
                )
                successful += 1
                self.stdout.write(self.style.SUCCESS('OK'))

            except RateLimitError as exc:
                self.stdout.write(self.style.ERROR(f'RATE LIMIT: {exc}'))
                self.stdout.write(self.style.WARNING(
                    f'\nИмпорт остановлен на файле {i}/{total}.'
                ))
                errors.append(f'{filepath.name}: rate limit')
                break

            except Exception as exc:
                failed += 1
                errors.append(f'{filepath.name}: {exc}')
                self.stdout.write(self.style.ERROR(f'ОШИБКА: {exc}'))

        # Итоги
        self.stdout.write('')
        self.stdout.write('=' * 60)
        self.stdout.write(self.style.SUCCESS(
            f'Файлов обработано:          {successful + failed}'
        ))
        self.stdout.write(self.style.SUCCESS(
            f'Успешно:                    {successful}'
        ))
        if failed:
            self.stdout.write(self.style.ERROR(
                f'С ошибками:                 {failed}'
            ))
        if errors:
            self.stdout.write('')
            self.stdout.write(self.style.ERROR('Ошибки:'))
            for err in errors:
                self.stdout.write(f'  - {err}')
        self.stdout.write('=' * 60)
