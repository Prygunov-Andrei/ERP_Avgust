import html
import logging
import time

from django.db import transaction
from django.utils import timezone

from catalog.models import Product
from supplier_integrations.clients.breez import BreezAPIClient, BreezAPIError
from supplier_integrations.models import (
    SupplierBrand,
    SupplierCategory,
    SupplierProduct,
    SupplierSyncLog,
)
from supplier_integrations.services.product_linker import SupplierProductLinker

logger = logging.getLogger(__name__)


class BreezImportService:
    """Полный импорт каталога из Breez API"""

    def __init__(self, integration):
        self.integration = integration
        self.linker = SupplierProductLinker()

    def import_full_catalog(self):
        """Полный импорт: категории → бренды → товары"""
        sync_log = SupplierSyncLog.objects.create(
            integration=self.integration,
            sync_type=SupplierSyncLog.SyncType.CATALOG_FULL,
            status=SupplierSyncLog.Status.STARTED,
        )
        start_time = time.time()

        try:
            with BreezAPIClient(self.integration) as client:
                self._import_categories(client, sync_log)
                self._import_brands(client, sync_log)
                self._import_products(client, sync_log)

            sync_log.status = (
                SupplierSyncLog.Status.PARTIAL
                if sync_log.items_errors > 0
                else SupplierSyncLog.Status.SUCCESS
            )
            self.integration.last_catalog_sync = timezone.now()
            self.integration.save(update_fields=['last_catalog_sync', 'updated_at'])

        except Exception as e:
            sync_log.status = SupplierSyncLog.Status.FAILED
            sync_log.error_details.append(str(e))
            logger.exception('Ошибка полного импорта Breez: %s', e)
            raise
        finally:
            sync_log.duration_seconds = time.time() - start_time
            sync_log.save()

        return sync_log

    def _import_categories(self, client, sync_log):
        """Импорт категорий — формат: {id_str: {title, level, order, chpu}}"""
        logger.info('Импорт категорий Breez...')
        data = client.get_categories()

        # Breez API returns dict: {"1": {"title": "...", "level": "0", ...}, ...}
        if not isinstance(data, dict):
            logger.warning('Неожиданный формат категорий: %s', type(data))
            return

        for ext_id_str, item in data.items():
            try:
                ext_id = int(ext_id_str)
                # level = parent category ID; "0" means root
                parent_ext_id = int(item.get('level', '0')) or None
                if parent_ext_id == 0:
                    parent_ext_id = None

                SupplierCategory.objects.update_or_create(
                    integration=self.integration,
                    external_id=ext_id,
                    defaults={
                        'title': item.get('title', ''),
                        'parent_external_id': parent_ext_id,
                    }
                )
            except Exception as e:
                sync_log.items_errors += 1
                sync_log.error_details.append(f'Category {ext_id_str}: {e}')
                logger.warning('Ошибка импорта категории %s: %s', ext_id_str, e)

        # Восстановление parent FK
        for cat in SupplierCategory.objects.filter(
            integration=self.integration,
            parent_external_id__isnull=False,
            parent__isnull=True,
        ):
            parent = SupplierCategory.objects.filter(
                integration=self.integration,
                external_id=cat.parent_external_id,
            ).first()
            if parent:
                cat.parent = parent
                cat.save(update_fields=['parent', 'updated_at'])

        logger.info('Импортировано категорий: %d', len(data))

    def _import_brands(self, client, sync_log):
        """Импорт брендов — формат: {id_str: {title, image, url, order, chpu}}"""
        logger.info('Импорт брендов Breez...')
        data = client.get_brands()

        if not isinstance(data, dict):
            logger.warning('Неожиданный формат брендов: %s', type(data))
            return

        for ext_id_str, item in data.items():
            try:
                ext_id = int(ext_id_str)
                SupplierBrand.objects.update_or_create(
                    integration=self.integration,
                    external_id=ext_id,
                    defaults={
                        'title': item.get('title', ''),
                        'image_url': item.get('image', ''),
                        'website_url': item.get('url', ''),
                    }
                )
            except Exception as e:
                sync_log.items_errors += 1
                sync_log.error_details.append(f'Brand {ext_id_str}: {e}')
                logger.warning('Ошибка импорта бренда %s: %s', ext_id_str, e)

        logger.info('Импортировано брендов: %d', len(data))

    def _import_products(self, client, sync_log):
        """Импорт товаров — формат: {id_str: {nc, title, articul, ...}}"""
        logger.info('Импорт товаров Breez...')
        data = client.get_products()

        if not isinstance(data, dict):
            logger.warning('Неожиданный формат товаров: %s', type(data))
            return

        categories_map = {
            c.external_id: c
            for c in SupplierCategory.objects.filter(integration=self.integration)
        }
        brands_map = {
            b.external_id: b
            for b in SupplierBrand.objects.filter(integration=self.integration)
        }

        for ext_id_str, item in data.items():
            try:
                ext_id = int(ext_id_str)
                self._import_single_product(ext_id, item, sync_log, categories_map, brands_map)
                sync_log.items_processed += 1
            except Exception as e:
                sync_log.items_errors += 1
                sync_log.error_details.append(
                    f'Product {item.get("nc", ext_id_str)}: {e}'
                )
                logger.warning('Ошибка импорта товара %s: %s', item.get('nc', ext_id_str), e)

            # Сохраняем прогресс каждые 100 товаров
            if sync_log.items_processed % 100 == 0 and sync_log.items_processed > 0:
                sync_log.save(update_fields=[
                    'items_processed', 'items_created', 'items_updated', 'items_errors',
                ])

        logger.info(
            'Импорт товаров завершён: обработано=%d, создано=%d, обновлено=%d, ошибок=%d',
            sync_log.items_processed, sync_log.items_created,
            sync_log.items_updated, sync_log.items_errors,
        )

        # LLM-категоризация товаров без категории (созданных без маппинга)
        self._categorize_uncategorized_products()

    @transaction.atomic
    def _import_single_product(self, ext_id, item, sync_log, categories_map, brands_map):
        """Импорт одного товара"""
        nc_code = item.get('nc', '')
        if not nc_code:
            return

        # Маппинг полей из Breez API
        category_id = int(item.get('category_id', 0)) if item.get('category_id') else None
        brand_id = int(item.get('brand', 0)) if item.get('brand') else None

        supplier_cat = categories_map.get(category_id)
        supplier_brand = brands_map.get(brand_id)

        images = item.get('images', [])
        if isinstance(images, str):
            images = [images] if images else []

        # Tech specs: {char_id: {title, value, ...}} → {title: value}
        raw_techs = item.get('techs', {})
        tech_specs = {}
        if isinstance(raw_techs, dict):
            for _, spec in raw_techs.items():
                if isinstance(spec, dict) and spec.get('title') and spec.get('value'):
                    tech_specs[spec['title']] = spec['value']

        # Description: combine utp and description, decode HTML entities
        description_parts = []
        if item.get('utp'):
            description_parts.append(self._clean_html(item['utp']))
        if item.get('description'):
            description_parts.append(self._clean_html(item['description']))
        description = '\n\n'.join(description_parts)

        # Price: {ric: "32923", ric_currency: "RUB"} — base price only in leftovers
        price_data = item.get('price', {})
        ric_price = None
        if isinstance(price_data, dict):
            raw_ric = price_data.get('ric')
            if raw_ric and str(raw_ric).strip():
                ric_price = raw_ric

        # Truncate series to fit model field (255 chars)
        series = (item.get('series', '') or '')[:255]

        defaults = {
            'external_id': ext_id,
            'articul': (item.get('articul', '') or '')[:100],
            'title': (item.get('title', '') or '')[:500],
            'description': description,
            'supplier_category': supplier_cat,
            'brand': supplier_brand,
            'series': series,
            'ric_price': ric_price,
            'ric_price_currency': price_data.get('ric_currency', 'RUB') if isinstance(price_data, dict) else 'RUB',
            'for_marketplace': bool(item.get('for_marketplace', False)),
            'images': images,
            'booklet_url': (item.get('booklet', '') or '')[:200],
            'manual_url': (item.get('manual', '') or '')[:200],
            'tech_specs': tech_specs,
            'is_active': True,
        }

        supplier_product, created = SupplierProduct.objects.update_or_create(
            integration=self.integration,
            nc_code=nc_code,
            defaults=defaults,
        )

        if created:
            sync_log.items_created += 1
        else:
            sync_log.items_updated += 1

        # Привязка к нашему каталогу — всегда 1:1
        if not supplier_product.product:
            # Определяем категорию из маппинга SupplierCategory → Category
            category = None
            if supplier_cat and supplier_cat.our_category_id:
                category = supplier_cat.our_category

            product = Product.objects.create(
                name=supplier_product.title,
                default_unit='шт',
                status=Product.Status.VERIFIED,
                category=category,
            )
            self.linker.link_and_enrich(supplier_product, product)

    def _categorize_uncategorized_products(self):
        """LLM-категоризация товаров без категории после импорта."""
        uncategorized = list(
            Product.objects.filter(
                category__isnull=True,
                status__in=[Product.Status.NEW, Product.Status.VERIFIED],
                supplier_products__integration=self.integration,
            ).distinct().order_by('id')
        )
        if not uncategorized:
            return

        logger.info('LLM-категоризация %d товаров без категории...', len(uncategorized))
        try:
            from catalog.categorizer import ProductCategorizer, BATCH_SIZE
            categorizer = ProductCategorizer()
            total = 0
            for i in range(0, len(uncategorized), BATCH_SIZE):
                batch = uncategorized[i:i + BATCH_SIZE]
                total += categorizer.categorize_products(batch)
            logger.info('Категоризировано: %d из %d', total, len(uncategorized))
        except Exception as e:
            logger.warning('LLM-категоризация не удалась: %s', e)

    @staticmethod
    def _clean_html(text):
        """Убирает HTML-теги и декодирует HTML-entities"""
        import re
        # Decode HTML entities (&#9679; → ●, &lt; → <, etc.)
        text = html.unescape(text)
        # Remove HTML tags
        text = re.sub(r'<[^>]+>', '', text)
        # Clean up whitespace
        text = re.sub(r'\n\s*\n', '\n', text).strip()
        return text
