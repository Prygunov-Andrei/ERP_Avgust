"""
Сервис парсинга PDF-каталогов поставщиков через LLM vision.

Два этапа:
1. Определение оглавления (TOC) — отправляет первые N страниц в LLM
2. Парсинг секций — батчами по MAX_PAGES_PER_BATCH страниц

Использование:
    service = CatalogParserService(catalog)
    service.detect_toc()        # определить секции
    service.parse_all_sections() # распарсить товары
"""
import json
import logging
import time
from io import BytesIO
from pathlib import Path

import fitz  # PyMuPDF

from catalog.models import Category

logger = logging.getLogger(__name__)

MAX_PAGES_PER_BATCH = 8

# Промпт для определения оглавления
TOC_DETECTION_PROMPT = """Ты — эксперт по вентиляционному и инженерному оборудованию.
Проанализируй оглавление (содержание) этого технического каталога.

Раздели каталог на логические секции — по типам оборудования/продукции.
Каждая секция содержит один тип продукции (например: вентиляторы, нагреватели, фильтры, кабельные лотки и т.д.).

Для каждой секции верни:
- name: название раздела (как в каталоге)
- pages: [start_page, end_page] — диапазон страниц 1-indexed, включительно
- category_code: код существующей категории из СПИСКА НИЖЕ
- is_new_category: true ТОЛЬКО если ни одна из существующих категорий не подходит даже приблизительно
- new_category_name: название новой категории (только если is_new_category=true)
- new_category_code: код новой категории на латинице, snake_case (только если is_new_category=true)
- parent_category_code: код родительской категории из СПИСКА НИЖЕ (только если is_new_category=true)

КРИТИЧЕСКИ ВАЖНЫЕ ПРАВИЛА:
1. ВСЕГДА сначала ищи подходящую категорию в списке ниже. Используй существующую, даже если название не совпадает дословно — важно смысловое соответствие.
   Примеры: «Решётки» → ventilation_grilles, «Диффузоры» → ventilation_grilles, «Гибкие воздуховоды» → ventilation_flex, «Хомуты» → fasteners_clamps, «Теплоизоляция» → insulation_thermal, «Огнезащита» → insulation_fire.
2. Учитывай ИЕРАРХИЮ: если продукция подходит под дочернюю категорию — используй дочернюю. Если под родительскую — используй родительскую.
3. is_new_category=true ТОЛЬКО когда продукция принципиально не вписывается ни в одну существующую категорию.
4. Код новой категории (new_category_code) — строго snake_case латиницей, без заглавных букв.
5. parent_category_code для новой категории ДОЛЖЕН быть кодом из существующего списка.

Пропускай вводные страницы (о компании, общая информация) — только разделы с конкретной продукцией.
Не объединяй разные типы продукции в одну секцию, если они имеют отдельные таблицы и характеристики.

СУЩЕСТВУЮЩИЕ КАТЕГОРИИ (код: название, иерархия):
{categories}

Формат ответа — строго JSON:
{{"sections": [...]}}

Верни ТОЛЬКО валидный JSON без markdown-форматирования."""


# Промпт для парсинга товаров
PRODUCT_PARSING_PROMPT = """Ты — эксперт по вентиляционному и инженерному оборудованию. Твоя задача — извлечь ВСЕ товары
и их размерные варианты из каталога поставщика.

Для каждого товара на страницах верни JSON-объект.
Если на страницах есть таблица с размерами/вариантами — извлеки КАЖДУЮ строку таблицы как отдельный вариант.

Формат ответа — строго JSON:
{{
  "products": [
    {{
      "name": "Воздуховод прямоугольного сечения",
      "description": "Краткое описание из каталога (1-2 предложения)",
      "default_unit": "м²",
      "variants": [
        {{
          "name_suffix": "100x100 L=1500",
          "params": {{"A_mm": 100, "B_mm": 100, "L_mm": 1500, "thickness_mm": 0.5, "weight_kg": 2.6, "area_m2": 0.6}}
        }}
      ]
    }}
  ]
}}

Правила:
1. name — полное название товара БЕЗ размеров (напр. «Воздуховод прямоугольного сечения»)
2. name_suffix — ТОЛЬКО размерная часть (напр. «500x300 L=1500», «Ø160 L=3000»)
3. default_unit: одно из «шт», «м.п.», «м²», «м³», «компл», «кг»
4. params — словарь числовых параметров из таблицы. Ключи: A_mm, B_mm, D_mm (диаметр), L_mm, thickness_mm, weight_kg, area_m2 и любые другие из таблицы
5. Будь ТОЧЕН с числами из таблиц — не округляй, не пропускай строки
6. Если страница — титульная/разделительная без товаров — верни {{"products": []}}
7. Если товар не имеет размерных вариантов (один размер) — variants содержит один элемент
8. Верни ТОЛЬКО валидный JSON без markdown-форматирования"""


class CatalogParserService:
    """Сервис для парсинга PDF-каталогов поставщиков через LLM vision."""

    def __init__(self, catalog):
        """
        Args:
            catalog: экземпляр SupplierCatalog
        """
        self.catalog = catalog

    def _get_provider(self):
        from llm_services.providers import get_provider
        return get_provider()

    def detect_toc(self, toc_pages: int = 6) -> list:
        """
        Определяет оглавление каталога через LLM.

        Отправляет первые N страниц PDF в LLM с промптом,
        который содержит список существующих категорий.

        Args:
            toc_pages: количество первых страниц для анализа

        Returns:
            list секций [{name, pages, category_code, ...}]
        """
        provider = self._get_provider()

        # Открываем PDF
        pdf_path = self.catalog.pdf_file.path
        doc = fitz.open(pdf_path)
        total_pages = len(doc)

        # Сохраняем общее количество страниц
        self.catalog.total_pages = total_pages
        self.catalog.save(update_fields=['total_pages'])

        # Извлекаем первые N страниц
        pages_to_send = min(toc_pages, total_pages)
        toc_pdf = self._extract_pages(doc, 0, pages_to_send)
        doc.close()

        # Собираем список существующих категорий
        categories = Category.objects.filter(is_active=True).select_related('parent')
        cat_lines = []
        for cat in categories:
            parent_info = f" (parent: {cat.parent.code})" if cat.parent else " (корневая)"
            cat_lines.append(f"- {cat.code}: {cat.name}{parent_info}")
        categories_text = '\n'.join(cat_lines)

        # Формируем промпт
        system_prompt = TOC_DETECTION_PROMPT.format(categories=categories_text)
        user_prompt = (
            f'Проанализируй оглавление этого каталога. '
            f'Всего страниц в каталоге: {total_pages}.'
        )

        logger.info('Определяю оглавление каталога %s (%d стр., отправляю %d стр.)',
                     self.catalog.name, total_pages, pages_to_send)

        result = provider.parse_with_prompt(
            file_content=toc_pdf,
            file_type='pdf',
            system_prompt=system_prompt,
            user_prompt=user_prompt,
        )

        sections = result.get('sections', [])

        # Валидация и нормализация секций
        validated = []
        for s in sections:
            pages = s.get('pages', [])
            if len(pages) != 2:
                continue
            start, end = pages
            if start < 1 or end > total_pages or start > end:
                continue

            section = {
                'name': (s.get('name') or '').strip(),
                'pages': [start, end],
                'category_code': s.get('category_code') or '',
                'is_new_category': s.get('is_new_category', False),
            }
            if section['is_new_category']:
                section['new_category_name'] = s.get('new_category_name') or ''
                section['new_category_code'] = s.get('new_category_code') or ''
                section['parent_category_code'] = s.get('parent_category_code') or ''

            validated.append(section)

        # Сохраняем секции
        self.catalog.sections = validated
        self.catalog.total_sections = len(validated)
        self.catalog.save(update_fields=['sections', 'total_sections'])

        logger.info('Определено %d секций для каталога %s', len(validated), self.catalog.name)
        return validated

    def ensure_categories(self) -> int:
        """
        Создаёт недостающие категории из sections (где is_new_category=True).

        Перед созданием выполняет fuzzy-поиск по существующим категориям:
        если название новой категории похоже на существующую — использует её.

        Returns:
            количество созданных категорий
        """
        created = 0
        existing_categories = {c.code: c for c in Category.objects.all()}

        for section in self.catalog.sections:
            if not section.get('is_new_category'):
                continue

            code = (section.get('new_category_code') or '').strip()
            name = (section.get('new_category_name') or '').strip()
            parent_code = (section.get('parent_category_code') or '').strip()

            if not code or not name:
                continue

            # Проверяем точное совпадение по коду
            if code in existing_categories:
                section['is_new_category'] = False
                section['category_code'] = code
                continue

            # Fuzzy-поиск: проверяем похожие категории по названию
            matched = self._find_similar_category(name, existing_categories)
            if matched:
                section['is_new_category'] = False
                section['category_code'] = matched.code
                logger.info(
                    'Категория "%s" (%s) заменена на существующую "%s" (%s)',
                    name, code, matched.name, matched.code,
                )
                continue

            # Создаём новую категорию
            parent = existing_categories.get(parent_code)

            new_cat = Category.objects.create(
                code=code,
                name=name,
                parent=parent,
            )
            existing_categories[code] = new_cat
            created += 1

            section['is_new_category'] = False
            section['category_code'] = code

            logger.info('Создана категория: %s (%s), parent=%s', name, code, parent_code)

        if created or any(not s.get('is_new_category') for s in self.catalog.sections):
            self.catalog.categories_created = created
            self.catalog.save(update_fields=['sections', 'categories_created'])

        return created

    @staticmethod
    def _find_similar_category(name: str, existing: dict, threshold: float = 0.6):
        """
        Ищет существующую категорию, похожую по названию.

        Использует нормализацию и пересечение слов.
        Возвращает Category или None.
        """
        name_lower = name.lower().strip()
        name_words = set(name_lower.split())

        best_match = None
        best_score = 0.0

        for cat in existing.values():
            cat_name_lower = cat.name.lower().strip()
            cat_words = set(cat_name_lower.split())

            # Точное совпадение названия
            if name_lower == cat_name_lower:
                return cat

            # Одно название содержит другое
            if name_lower in cat_name_lower or cat_name_lower in name_lower:
                return cat

            # Пересечение значимых слов (Jaccard similarity)
            if not name_words or not cat_words:
                continue
            intersection = name_words & cat_words
            union = name_words | cat_words
            score = len(intersection) / len(union)

            if score > best_score:
                best_score = score
                best_match = cat

        if best_score >= threshold:
            return best_match

        return None

    def parse_all_sections(self, progress_callback=None) -> dict:
        """
        Парсит все секции каталога через LLM vision.

        Args:
            progress_callback: callable(section_idx, batch_idx, total_batches,
                                        products_count, variants_count)

        Returns:
            dict с результатами: {supplier, source_file, total_products, total_variants, products}
        """
        provider = self._get_provider()
        sections = self.catalog.sections
        supplier_name = self.catalog.supplier_name

        if not sections:
            raise ValueError('Секции не определены. Сначала вызовите detect_toc().')

        pdf_path = self.catalog.pdf_file.path
        doc = fitz.open(pdf_path)

        # Считаем общее количество батчей
        total_batches = 0
        for section in sections:
            start, end = section['pages']
            num_pages = end - start + 1
            total_batches += (num_pages + MAX_PAGES_PER_BATCH - 1) // MAX_PAGES_PER_BATCH

        self.catalog.total_batches = total_batches
        self.catalog.save(update_fields=['total_batches'])

        all_products = []
        errors = []
        global_batch = 0

        for section_idx, section in enumerate(sections):
            start_page = section['pages'][0] - 1  # 1-indexed → 0-indexed
            end_page = section['pages'][1]         # exclusive для fitz
            category_code = section.get('category_code', '')

            logger.info('Секция %d/%d: %s (стр. %d-%d)',
                        section_idx + 1, len(sections),
                        section['name'], start_page + 1, end_page)

            # Батчи внутри секции
            for batch_start in range(start_page, end_page, MAX_PAGES_PER_BATCH):
                batch_end = min(batch_start + MAX_PAGES_PER_BATCH, end_page)
                global_batch += 1

                try:
                    batch_pdf = self._extract_pages(doc, batch_start, batch_end)

                    user_prompt = (
                        f'Извлеки все товары и размерные варианты с этих страниц каталога.\n'
                        f'Раздел каталога: {section["name"]}'
                    )

                    t0 = time.time()
                    result = provider.parse_with_prompt(
                        file_content=batch_pdf,
                        file_type='pdf',
                        system_prompt=PRODUCT_PARSING_PROMPT,
                        user_prompt=user_prompt,
                    )
                    elapsed = time.time() - t0

                    products = result.get('products', [])

                    # Добавляем метаданные
                    for product in products:
                        product['catalog_section'] = section['name']
                        product['category_code'] = category_code
                        product['source_pages'] = f'{batch_start + 1}-{batch_end}'
                        product['supplier'] = supplier_name

                    all_products.extend(products)

                    variant_count = sum(len(p.get('variants', [])) for p in products)
                    logger.info(
                        '  Батч %d/%d (стр. %d-%d): %d товаров, %d вариантов (%.1fс)',
                        global_batch, total_batches,
                        batch_start + 1, batch_end,
                        len(products), variant_count, elapsed
                    )

                except Exception as e:
                    error_msg = f'Ошибка стр. {batch_start + 1}-{batch_end}: {e}'
                    errors.append(error_msg)
                    logger.warning(error_msg)

                # Обновляем прогресс
                total_variants = sum(len(p.get('variants', [])) for p in all_products)
                if progress_callback:
                    progress_callback(
                        section_idx, global_batch, total_batches,
                        len(all_products), total_variants
                    )

                # Промежуточное сохранение JSON после каждого батча
                self._save_intermediate_json(all_products, errors, supplier_name)

        doc.close()

        # Финальное сохранение
        output_data = self._save_intermediate_json(all_products, errors, supplier_name)

        # Вычисляем относительный путь для FileField
        from django.conf import settings
        relative_path = str(json_path.relative_to(Path(settings.MEDIA_ROOT)))
        self.catalog.json_file.name = relative_path

        # Обновляем модель
        self.catalog.products_count = len(all_products)
        self.catalog.variants_count = total_variants
        self.catalog.errors = errors
        self.catalog.save(update_fields=[
            'json_file', 'products_count', 'variants_count', 'errors'
        ])

        logger.info(
            'Парсинг завершён: %d товаров, %d вариантов, %d ошибок',
            len(all_products), total_variants, len(errors)
        )

        return output_data

    def _save_intermediate_json(self, all_products, errors, supplier_name) -> dict:
        """Сохраняет промежуточный JSON после каждого батча (защита от потери прогресса)."""
        total_variants = sum(len(p.get('variants', [])) for p in all_products)
        output_data = {
            'supplier': supplier_name,
            'source_file': Path(self.catalog.pdf_file.name).name,
            'total_products': len(all_products),
            'total_variants': total_variants,
            'products': all_products,
        }

        json_content = json.dumps(output_data, ensure_ascii=False, indent=2)
        json_filename = f'{Path(self.catalog.pdf_file.name).stem}_products.json'
        json_path = Path(self.catalog.pdf_file.path).parent / json_filename

        with open(json_path, 'w', encoding='utf-8') as f:
            f.write(json_content)

        return output_data

    @staticmethod
    def _extract_pages(doc, start: int, end: int) -> bytes:
        """Извлекает диапазон страниц из PDF в отдельный PDF (bytes)."""
        new_doc = fitz.open()
        new_doc.insert_pdf(doc, from_page=start, to_page=end - 1)
        buf = BytesIO()
        new_doc.save(buf)
        new_doc.close()
        return buf.getvalue()

    @staticmethod
    def import_to_db(catalog, reset: bool = False) -> int:
        """
        Импортирует распарсенный JSON в таблицу Product.

        Args:
            catalog: экземпляр SupplierCatalog (со статусом parsed/imported)
            reset: удалить старые товары этого поставщика перед импортом

        Returns:
            количество созданных товаров
        """
        from catalog.models import Product, ProductAlias
        from django.db import transaction

        if not catalog.json_file:
            raise ValueError('JSON-файл не найден. Сначала запустите парсинг.')

        with open(catalog.json_file.path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        supplier = data.get('supplier', catalog.supplier_name)
        products_data = data.get('products', [])

        # Загружаем категории по коду
        categories = {c.code: c for c in Category.objects.all()}

        # Удаление старых товаров
        if reset:
            marker = f'supplier:{supplier}'
            old_aliases = ProductAlias.objects.filter(
                normalized_alias=Product.normalize_name(marker)
            )
            old_product_ids = list(old_aliases.values_list('product_id', flat=True))
            if old_product_ids:
                deleted_count = Product.objects.filter(id__in=old_product_ids).delete()[0]
                logger.info('Удалено старых товаров поставщика %s: %d', supplier, deleted_count)

        # Собираем план импорта
        import_plan = []
        for product_data in products_data:
            category_code = product_data.get('category_code', '')
            category = categories.get(category_code)
            base_name = product_data.get('name', '').strip()
            default_unit = product_data.get('default_unit', 'шт')
            variants = product_data.get('variants', [])

            if not variants:
                continue

            for variant in variants:
                name_suffix = variant.get('name_suffix', '').strip()
                full_name = f'{base_name} {name_suffix}' if name_suffix else base_name

                import_plan.append({
                    'name': full_name,
                    'base_name': base_name,
                    'category': category,
                    'default_unit': default_unit,
                    'supplier': supplier,
                })

        # Импорт
        created_count = 0
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

                # Алиас с базовым именем
                base_normalized = Product.normalize_name(item['base_name'])
                if base_normalized != product.normalized_name:
                    ProductAlias.objects.get_or_create(
                        product=product,
                        normalized_alias=base_normalized,
                        defaults={'alias_name': item['base_name']},
                    )

                # Маркер поставщика
                supplier_marker = f'supplier:{item["supplier"]}'
                ProductAlias.objects.get_or_create(
                    product=product,
                    normalized_alias=Product.normalize_name(supplier_marker),
                    defaults={'alias_name': supplier_marker},
                )

        catalog.imported_count = created_count
        catalog.save(update_fields=['imported_count'])

        logger.info('Импортировано %d товаров для %s', created_count, supplier)
        return created_count
