import logging
from typing import Dict, List, Optional
from decimal import Decimal
from django.db.models import F

from catalog.models import Product, ProductPriceHistory, ProductWorkMapping
from catalog.services import ProductMatcher
from pricelists.models import WorkItem, PriceList

logger = logging.getLogger(__name__)


class EstimateAutoMatcher:
    """
    Автоматический подбор цен материалов и расценок на работы для строк сметы.

    Двухуровневая стратегия:
    - Подбор цены: ProductMatcher (fuzzy + LLM) → последняя цена из ProductPriceHistory
    - Подбор работы: ProductWorkMapping (история) → правила по Category → LLM fallback

    При ручной правке сметчиком — обновляет ProductWorkMapping для обучения системы.
    """

    MIN_USAGE_COUNT_FOR_AUTO = 2

    def __init__(self):
        self.product_matcher = ProductMatcher()

    def match_prices(self, estimate) -> Dict:
        """Для каждой строки сметы ищет Product через ProductMatcher,
        подтягивает последнюю цену из ProductPriceHistory."""
        from estimates.models import EstimateItem

        items = EstimateItem.objects.filter(
            estimate=estimate, product__isnull=True,
        ).exclude(name='')

        matched = 0
        skipped = 0

        for item in items:
            product, created = self.product_matcher.find_or_create_product(
                name=item.name,
                unit=item.unit,
                use_llm=True,
            )

            item.product = product

            latest_price = ProductPriceHistory.objects.filter(
                product=product,
            ).order_by('-invoice_date').first()

            if latest_price and item.material_unit_price == 0:
                item.material_unit_price = latest_price.price
                item.source_price_history = latest_price

            item.save(update_fields=[
                'product', 'material_unit_price', 'source_price_history',
            ])
            matched += 1

        return {'matched': matched, 'skipped': skipped, 'total': matched + skipped}

    def match_works(self, estimate, price_list_id: Optional[int] = None) -> Dict:
        """Для каждой строки сметы подбирает WorkItem:
        1. Ищет в ProductWorkMapping (история)
        2. Правила по Category → WorkSection
        3. LLM-классификация из предфильтрованных WorkItem"""
        from estimates.models import EstimateItem

        items = EstimateItem.objects.filter(
            estimate=estimate,
            product__isnull=False,
            work_item__isnull=True,
        )

        price_list = None
        if price_list_id:
            try:
                price_list = PriceList.objects.get(pk=price_list_id)
            except PriceList.DoesNotExist:
                pass

        matched_history = 0
        matched_rule = 0
        matched_llm = 0
        unmatched = 0

        for item in items:
            work_item = self._match_work_for_item(item, price_list)
            if work_item:
                source = work_item.pop('_source', 'unknown')
                item.work_item = work_item['work_item']
                if item.work_unit_price == 0 and 'price' in work_item:
                    item.work_unit_price = work_item['price']
                item.save(update_fields=['work_item', 'work_unit_price'])

                if source == 'history':
                    matched_history += 1
                elif source == 'rule':
                    matched_rule += 1
                elif source == 'llm':
                    matched_llm += 1
            else:
                unmatched += 1

        return {
            'matched_history': matched_history,
            'matched_rule': matched_rule,
            'matched_llm': matched_llm,
            'unmatched': unmatched,
        }

    def _match_work_for_item(
        self, item, price_list: Optional[PriceList], record: bool = True,
    ) -> Optional[Dict]:
        """Подбирает WorkItem для одной строки сметы.
        record=False — preview-режим без записи в ProductWorkMapping."""

        # 1. История — ProductWorkMapping
        mapping = ProductWorkMapping.objects.filter(
            product=item.product,
            usage_count__gte=self.MIN_USAGE_COUNT_FOR_AUTO,
        ).first()

        if mapping:
            result = {'work_item': mapping.work_item, '_source': 'history'}
            price = self._get_work_price(mapping.work_item, price_list)
            if price is not None:
                result['price'] = price
            return result

        # 2. Правила по Category → WorkSection
        if item.product and item.product.category:
            work_items_qs = WorkItem.objects.filter(
                is_current=True,
                section__code__icontains=item.product.category.code[:4],
            )
            if work_items_qs.exists():
                best = self._fuzzy_match_work(item.name, work_items_qs[:20])
                if best:
                    if record:
                        self._record_mapping(
                            item.product, best, ProductWorkMapping.Source.RULE, confidence=0.7,
                        )
                    result = {'work_item': best, '_source': 'rule'}
                    price = self._get_work_price(best, price_list)
                    if price is not None:
                        result['price'] = price
                    return result

        # 3. LLM fallback — предфильтрация + LLM
        try:
            candidates = WorkItem.objects.filter(is_current=True)[:20]
            best = self._fuzzy_match_work(item.name, candidates)
            if best:
                if record:
                    self._record_mapping(
                        item.product, best, ProductWorkMapping.Source.LLM, confidence=0.5,
                    )
                result = {'work_item': best, '_source': 'llm'}
                price = self._get_work_price(best, price_list)
                if price is not None:
                    result['price'] = price
                return result
        except Exception as exc:
            logger.warning('Work matching failed for item %s: %s', item.id, exc)

        return None

    def _fuzzy_match_work(
        self, item_name: str, work_items_qs
    ) -> Optional[WorkItem]:
        """Fuzzy-подбор WorkItem по названию строки сметы."""
        from fuzzywuzzy import fuzz

        best_score = 0
        best_item = None
        normalized_name = Product.normalize_name(item_name)

        for wi in work_items_qs:
            wi_normalized = Product.normalize_name(wi.name)
            score = fuzz.token_set_ratio(normalized_name, wi_normalized) / 100.0
            if score > best_score and score >= 0.5:
                best_score = score
                best_item = wi

        return best_item

    def _get_work_price(
        self, work_item: WorkItem, price_list: Optional[PriceList]
    ) -> Optional[Decimal]:
        """Получает цену работы из прайс-листа."""
        if not price_list:
            return None

        try:
            from pricelists.models import PriceListItem
            pli = PriceListItem.objects.filter(
                price_list=price_list,
                work_item=work_item,
            ).first()
            if pli:
                return pli.price_per_unit
        except Exception:
            pass

        return None

    def _record_mapping(
        self,
        product: Product,
        work_item: WorkItem,
        source: str,
        confidence: float = 1.0,
    ):
        """Записывает или обновляет ProductWorkMapping."""
        mapping, created = ProductWorkMapping.objects.get_or_create(
            product=product,
            work_item=work_item,
            defaults={
                'source': source,
                'confidence': confidence,
                'usage_count': 1,
            },
        )
        if not created:
            mapping.usage_count = F('usage_count') + 1
            if confidence > mapping.confidence:
                mapping.confidence = confidence
            mapping.save(update_fields=['usage_count', 'confidence'])

    def preview_matches(
        self,
        estimate,
        supplier_ids: Optional[List[int]] = None,
        price_strategy: str = 'cheapest',
    ) -> List[Dict]:
        """Preview-подбор цен из каталога поставщиков и счетов БЕЗ сохранения в БД.

        supplier_ids — ID Counterparty для фильтрации (None = все).
        price_strategy — 'cheapest' | 'latest'.
        """
        from estimates.models import EstimateItem
        from supplier_integrations.models import SupplierProduct

        items = EstimateItem.objects.filter(
            estimate=estimate,
        ).exclude(name='')

        results = []
        for item in items:
            if item.product and item.material_unit_price > 0:
                continue

            try:
                product, _created = self.product_matcher.find_or_create_product(
                    name=item.name,
                    unit=item.unit,
                    use_llm=True,
                )
            except Exception as exc:
                logger.warning('preview_matches: product match failed for "%s": %s', item.name, exc)
                product = None

            if not product:
                continue

            # Собираем все предложения
            all_offers = []

            # 1. Цены из каталога поставщика (SupplierProduct.base_price)
            sp_qs = SupplierProduct.objects.filter(
                product=product, base_price__isnull=False, is_active=True,
            ).select_related('integration__counterparty')
            if supplier_ids:
                sp_qs = sp_qs.filter(integration__counterparty_id__in=supplier_ids)
            for sp in sp_qs:
                if sp.base_price and sp.base_price > 0:
                    counterparty = sp.integration.counterparty if sp.integration else None
                    all_offers.append({
                        'price': str(sp.base_price),
                        'source_type': 'supplier_catalog',
                        'counterparty_name': counterparty.name if counterparty else sp.integration.name,
                        'counterparty_id': counterparty.id if counterparty else None,
                        'supplier_product_id': sp.id,
                        'price_date': str(sp.price_updated_at) if sp.price_updated_at else None,
                    })

            # 2. Цены из счетов (ProductPriceHistory)
            ph_qs = ProductPriceHistory.objects.filter(
                product=product,
            ).select_related('counterparty')
            if supplier_ids:
                ph_qs = ph_qs.filter(counterparty_id__in=supplier_ids)
            for ph in ph_qs.order_by('-invoice_date')[:5]:
                if ph.price and ph.price > 0:
                    all_offers.append({
                        'price': str(ph.price),
                        'source_type': 'invoice',
                        'counterparty_name': (
                            ph.counterparty.short_name or ph.counterparty.name
                        ) if ph.counterparty else None,
                        'counterparty_id': ph.counterparty_id,
                        'source_price_history_id': ph.id,
                        'invoice_number': ph.invoice_number or '',
                        'invoice_date': str(ph.invoice_date) if ph.invoice_date else '',
                        'price_date': str(ph.invoice_date) if ph.invoice_date else None,
                    })

            # 3. Выбор лучшего предложения
            best_offer = None
            if all_offers:
                if price_strategy == 'cheapest':
                    best_offer = min(all_offers, key=lambda o: Decimal(o['price']))
                else:  # latest
                    best_offer = all_offers[0]

            product_confidence = 0.85 if best_offer else 0.5

            results.append({
                'item_id': item.id,
                'name': item.name,
                'matched_product': {
                    'id': product.id,
                    'name': product.name,
                    'price': best_offer['price'] if best_offer else '0',
                },
                'best_offer': best_offer,
                'all_offers': all_offers,
                'matched_work': None,
                'product_confidence': product_confidence,
                'work_confidence': 0,
                'invoice_info': None,
                'source_price_history_id': (
                    best_offer.get('source_price_history_id')
                    if best_offer else None
                ),
            })

        return results

    # ------------------------------------------------------------------
    # Confidence по источнику совпадения
    # ------------------------------------------------------------------
    _SOURCE_CONFIDENCE = {'history': 0.9, 'rule': 0.7, 'llm': 0.5}

    def preview_works(
        self, estimate, price_list_id: Optional[int] = None,
    ) -> List[Dict]:
        """Preview-подбор работ БЕЗ сохранения в БД.

        Возвращает per-item результаты для review сметчиком.
        """
        from estimates.models import EstimateItem

        items = EstimateItem.objects.filter(
            estimate=estimate,
            product__isnull=False,
            work_item__isnull=True,
        ).select_related('product', 'product__category')

        price_list = None
        if price_list_id:
            try:
                price_list = PriceList.objects.get(pk=price_list_id)
            except PriceList.DoesNotExist:
                pass

        results: List[Dict] = []
        for item in items:
            match = self._match_work_for_item(item, price_list, record=False)
            if not match:
                continue

            wi = match['work_item']
            source = match.get('_source', 'unknown')
            results.append({
                'item_id': item.id,
                'name': item.name,
                'matched_work': {
                    'id': wi.id,
                    'name': wi.name,
                    'article': wi.article,
                    'section_name': wi.section.name if wi.section_id else '',
                    'hours': str(wi.hours) if wi.hours is not None else '0',
                    'required_grade': str(wi.required_grade),
                    'unit': wi.unit,
                },
                'work_price': str(match['price']) if 'price' in match else None,
                'work_confidence': self._SOURCE_CONFIDENCE.get(source, 0.5),
                'source': source,
            })

        return results

    def auto_fill(
        self, estimate, price_list_id: Optional[int] = None
    ) -> Dict:
        """Одна кнопка: match_prices + match_works."""
        prices_result = self.match_prices(estimate)
        works_result = self.match_works(estimate, price_list_id=price_list_id)
        return {
            'prices': prices_result,
            'works': works_result,
        }

    @staticmethod
    def record_manual_correction(
        product: Product,
        work_item: WorkItem,
    ):
        """При ручной правке сметчиком — обновляет ProductWorkMapping."""
        mapping, created = ProductWorkMapping.objects.get_or_create(
            product=product,
            work_item=work_item,
            defaults={
                'source': ProductWorkMapping.Source.MANUAL,
                'confidence': 1.0,
                'usage_count': 1,
            },
        )
        if not created:
            mapping.source = ProductWorkMapping.Source.MANUAL
            mapping.confidence = 1.0
            mapping.usage_count = F('usage_count') + 1
            mapping.save(update_fields=['source', 'confidence', 'usage_count'])
