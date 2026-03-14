"""
Парсинг каталога поставщика из PDF в JSON через LLM vision.

Универсальная команда: автоматически определяет оглавление через LLM
или принимает секции вручную через --sections-json.

Использование:
    # Автоматическое определение секций через LLM:
    python manage.py parse_supplier_catalog catalog/data/suppliers/wheil/wheil_duct_equipment.pdf --supplier wheil

    # С ручным указанием секций:
    python manage.py parse_supplier_catalog ... --supplier wheil --sections-json sections.json

    # Только показать план:
    python manage.py parse_supplier_catalog ... --supplier wheil --dry-run

    # Парсить конкретные страницы:
    python manage.py parse_supplier_catalog ... --supplier wheil --pages 28-50
"""
import json
import re
from pathlib import Path

import fitz  # PyMuPDF
from django.core.management.base import BaseCommand, CommandError

from catalog.models import SupplierCatalog
from catalog.services.catalog_parser import CatalogParserService


class Command(BaseCommand):
    help = 'Парсит каталог поставщика из PDF в JSON через LLM vision'

    def add_arguments(self, parser):
        parser.add_argument('pdf_file', type=str, help='Путь к PDF-файлу каталога')
        parser.add_argument(
            '--supplier', '-s', type=str, required=True,
            help='Код поставщика (galvent, wheil, и т.д.)',
        )
        parser.add_argument(
            '--output', '-o', type=str, default=None,
            help='Путь к выходному JSON (по умолчанию: рядом с PDF, *_products.json)',
        )
        parser.add_argument(
            '--dry-run', action='store_true',
            help='Показать план разбиения без API-вызовов',
        )
        parser.add_argument(
            '--pages', type=str, default=None,
            help='Диапазон страниц для парсинга (напр. 28-50), 1-indexed',
        )
        parser.add_argument(
            '--sections-json', type=str, default=None,
            help='Путь к JSON-файлу с секциями (вместо автоматического определения)',
        )
        parser.add_argument(
            '--toc-pages', type=int, default=6,
            help='Кол-во первых страниц для определения оглавления (по умолч. 6)',
        )

    def handle(self, *args, **options):
        pdf_path = Path(options['pdf_file'])
        if not pdf_path.exists():
            raise CommandError(f'Файл не найден: {pdf_path}')

        supplier = options['supplier']

        # Определяем выходной файл
        if options['output']:
            output_path = Path(options['output'])
        else:
            output_path = pdf_path.parent / f'{pdf_path.stem}_products.json'

        # Открываем PDF для получения информации
        doc = fitz.open(str(pdf_path))
        total_pages = len(doc)
        doc.close()

        self.stdout.write(f'PDF: {pdf_path.name}, {total_pages} страниц')
        self.stdout.write(f'Поставщик: {supplier}')

        # Создаём временную запись SupplierCatalog для использования сервиса
        from django.core.files import File
        catalog = SupplierCatalog(
            name=f'CLI: {pdf_path.name}',
            supplier_name=supplier,
            total_pages=total_pages,
        )
        # Сохраняем PDF файл
        catalog.pdf_file.save(pdf_path.name, File(open(pdf_path, 'rb')), save=False)
        catalog.save()

        service = CatalogParserService(catalog)

        # Получаем секции
        if options['sections_json']:
            sections_path = Path(options['sections_json'])
            if not sections_path.exists():
                raise CommandError(f'Файл секций не найден: {sections_path}')
            with open(sections_path, 'r', encoding='utf-8') as f:
                sections_data = json.load(f)
            sections = sections_data if isinstance(sections_data, list) else sections_data.get('sections', [])
            catalog.sections = sections
            catalog.total_sections = len(sections)
            catalog.save(update_fields=['sections', 'total_sections'])
        else:
            self.stdout.write(f'\nОпределяю оглавление (первые {options["toc_pages"]} стр.)...')
            sections = service.detect_toc(toc_pages=options['toc_pages'])

        if not sections:
            raise CommandError('Не удалось определить секции каталога')

        # Фильтрация по диапазону страниц
        if options['pages']:
            match = re.match(r'(\d+)-(\d+)', options['pages'])
            if not match:
                raise CommandError('Формат: --pages START-END (1-indexed)')
            page_start = int(match.group(1))
            page_end = int(match.group(2))
            # Фильтруем секции по пересечению с заданным диапазоном
            filtered = []
            for s in sections:
                s_start, s_end = s['pages']
                if s_end >= page_start and s_start <= page_end:
                    s['pages'] = [max(s_start, page_start), min(s_end, page_end)]
                    filtered.append(s)
            sections = filtered
            catalog.sections = sections
            catalog.total_sections = len(sections)
            catalog.save(update_fields=['sections', 'total_sections'])

        # Показать план
        self.stdout.write(f'\nПлан разбиения ({len(sections)} секций):')
        from catalog.services.catalog_parser import MAX_PAGES_PER_BATCH
        total_batches = 0
        for i, section in enumerate(sections):
            start, end = section['pages']
            num_pages = end - start + 1
            batches = (num_pages + MAX_PAGES_PER_BATCH - 1) // MAX_PAGES_PER_BATCH
            total_batches += batches

            new_tag = ' [НОВАЯ КАТ.]' if section.get('is_new_category') else ''
            self.stdout.write(
                f'  [{i:2d}] {section["name"][:55]:<55s} '
                f'стр. {start}-{end} ({num_pages} стр., {batches} batch) '
                f'→ {section.get("category_code", "?")}{new_tag}'
            )

        self.stdout.write(f'\nВсего LLM-вызовов: {total_batches}')

        if options['dry_run']:
            self.stdout.write(self.style.WARNING('DRY RUN — API-вызовы не выполнены'))
            # Удаляем временную запись
            catalog.delete()
            return

        # Создаём недостающие категории
        created_cats = service.ensure_categories()
        if created_cats:
            self.stdout.write(self.style.SUCCESS(f'Создано новых категорий: {created_cats}'))

        # Парсим
        def on_progress(section_idx, batch_idx, total, products_count, variants_count):
            self.stdout.write(
                f'  Прогресс: батч {batch_idx}/{total}, '
                f'{products_count} товаров, {variants_count} вариантов',
                ending='\r',
            )

        output_data = service.parse_all_sections(progress_callback=on_progress)

        # Если указан свой output, копируем JSON туда
        if options['output']:
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(output_data, f, ensure_ascii=False, indent=2)

        # Итог
        self.stdout.write(f'\n{"=" * 60}')
        self.stdout.write(self.style.SUCCESS(f'Сохранено: {output_path}'))
        self.stdout.write(f'Товаров: {output_data["total_products"]}')
        self.stdout.write(f'Вариантов: {output_data["total_variants"]}')

        if output_data.get('errors'):
            self.stdout.write(self.style.ERROR(f'Ошибок: {len(output_data["errors"])}'))

        # Удаляем временную запись каталога (CLI-режим не сохраняет в БД)
        catalog.delete()
