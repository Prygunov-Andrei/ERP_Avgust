import logging

from catalog.models import Product, ProductAlias

logger = logging.getLogger(__name__)


class SupplierProductLinker:
    """Привязка товара поставщика к нашему каталогу + обогащение"""

    def link_and_enrich(self, supplier_product, product):
        """
        Привязывает SupplierProduct к Product и обогащает пустые поля.
        Не перезатирает данные, заполненные вручную.
        """
        supplier_product.product = product
        supplier_product.save(update_fields=['product', 'updated_at'])

        self._enrich_product(supplier_product, product)
        self._ensure_alias(supplier_product, product)

    def _enrich_product(self, supplier_product, product):
        """Обогащает Product данными из SupplierProduct (только пустые поля)"""
        updated_fields = []

        if not product.images and supplier_product.images:
            product.images = supplier_product.images
            updated_fields.append('images')

        if not product.booklet_url and supplier_product.booklet_url:
            product.booklet_url = supplier_product.booklet_url
            updated_fields.append('booklet_url')

        if not product.manual_url and supplier_product.manual_url:
            product.manual_url = supplier_product.manual_url
            updated_fields.append('manual_url')

        if not product.description and supplier_product.description:
            product.description = supplier_product.description
            updated_fields.append('description')

        if not product.brand and supplier_product.brand:
            product.brand = supplier_product.brand.title
            updated_fields.append('brand')

        if not product.series and supplier_product.series:
            product.series = supplier_product.series
            updated_fields.append('series')

        if not product.tech_specs and supplier_product.tech_specs:
            product.tech_specs = supplier_product.tech_specs
            updated_fields.append('tech_specs')

        if updated_fields:
            product.save(update_fields=updated_fields + ['updated_at'])
            logger.info(
                'Обогащён Product #%d (%s): %s',
                product.pk, product.name, ', '.join(updated_fields)
            )

    def _ensure_alias(self, supplier_product, product):
        """Создаёт алиас breez:<nc_code> если его нет"""
        alias_name = f'breez:{supplier_product.nc_code}'
        normalized = Product.normalize_name(alias_name)

        ProductAlias.objects.get_or_create(
            product=product,
            normalized_alias=normalized,
            defaults={
                'alias_name': alias_name,
            }
        )
