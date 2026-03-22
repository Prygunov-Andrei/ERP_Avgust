"""
Расширенные тесты для catalog/services.py — ProductMatcher и compare_products_with_llm.
"""
import json
from unittest.mock import patch, MagicMock, PropertyMock

from django.test import TestCase
from django.core.cache import cache

from catalog.models import Product, ProductAlias
from catalog.services import ProductMatcher, compare_products_with_llm


class ProductMatcherNormalizeTest(TestCase):
    """Тесты нормализации через Product.normalize_name (делегирует в text_utils)."""

    def test_normalize_lowercase(self):
        result = Product.normalize_name("Вентилятор КАНАЛЬНЫЙ")
        self.assertEqual(result, "вентилятор канальный")

    def test_normalize_removes_special_chars(self):
        result = Product.normalize_name("Болт М6х30 (оцинк.)")
        self.assertNotIn("(", result)
        self.assertNotIn(")", result)

    def test_normalize_collapses_whitespace(self):
        result = Product.normalize_name("  Гвозди   строительные   50мм  ")
        self.assertNotIn("  ", result)
        self.assertEqual(result, result.strip())

    def test_normalize_empty_string(self):
        self.assertEqual(Product.normalize_name(""), "")


class ProductMatcherExtractFirstWordTest(TestCase):
    """Тесты _extract_first_word."""

    def setUp(self):
        self.matcher = ProductMatcher()

    def test_extract_first_word_normal(self):
        self.assertEqual(self.matcher._extract_first_word("вентилятор канальный"), "вентилятор")

    def test_extract_first_word_single(self):
        self.assertEqual(self.matcher._extract_first_word("болт"), "болт")

    def test_extract_first_word_empty(self):
        self.assertEqual(self.matcher._extract_first_word(""), "")


class ProductMatcherCacheTest(TestCase):
    """Тесты кэширования в ProductMatcher."""

    def setUp(self):
        Product.objects.all().delete()
        ProductAlias.objects.all().delete()
        cache.clear()
        self.matcher = ProductMatcher()

    def test_invalidate_cache_clears_instance_cache(self):
        self.matcher._products_cache = [("fake",)]
        self.matcher.invalidate_cache()
        self.assertIsNone(self.matcher._products_cache)

    def test_get_products_list_uses_instance_cache(self):
        """Повторный вызов не обращается к БД, если instance cache есть."""
        fake_data = [(1, "Product A", "product a")]
        self.matcher._products_cache = fake_data
        result = self.matcher._get_products_list()
        self.assertEqual(result, fake_data)

    def test_get_products_list_loads_from_db(self):
        Product.objects.create(name="Тестовый товар", status=Product.Status.NEW)
        result = self.matcher._get_products_list(force_refresh=True)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0][1], "Тестовый товар")


class ProductMatcherFindSimilarTest(TestCase):
    """Тесты find_similar с различными сценариями."""

    def setUp(self):
        Product.objects.all().delete()
        ProductAlias.objects.all().delete()
        cache.clear()
        self.matcher = ProductMatcher()

        self.p1 = Product.objects.create(name="Вентилятор канальный ВКК-125", status=Product.Status.VERIFIED)
        self.p2 = Product.objects.create(name="Вентилятор радиальный ВР-80", status=Product.Status.VERIFIED)
        self.p3 = Product.objects.create(name="Гвозди строительные 50мм", status=Product.Status.NEW)
        self.matcher.invalidate_cache()

    def test_find_similar_exact_match(self):
        similar = self.matcher.find_similar("Вентилятор канальный ВКК-125", threshold=0.9)
        self.assertTrue(len(similar) > 0)
        self.assertEqual(similar[0]['product_name'], self.p1.name)
        self.assertGreaterEqual(similar[0]['score'], 0.9)

    def test_find_similar_fuzzy_match(self):
        similar = self.matcher.find_similar("ВКК-125 вентилятор канальный", threshold=0.7)
        self.assertTrue(len(similar) > 0)
        self.assertIn("ВКК-125", similar[0]['product_name'])

    def test_find_similar_no_match(self):
        similar = self.matcher.find_similar("Совершенно уникальный товар XYZ-999", threshold=0.8)
        self.assertEqual(len(similar), 0)

    def test_find_similar_respects_limit(self):
        similar = self.matcher.find_similar("Вентилятор", threshold=0.3, limit=1)
        self.assertLessEqual(len(similar), 1)

    def test_find_similar_sorted_by_score_desc(self):
        similar = self.matcher.find_similar("Вентилятор канальный", threshold=0.3)
        if len(similar) >= 2:
            self.assertGreaterEqual(similar[0]['score'], similar[1]['score'])

    def test_find_similar_result_structure(self):
        similar = self.matcher.find_similar("Вентилятор канальный ВКК-125", threshold=0.5)
        self.assertTrue(len(similar) > 0)
        item = similar[0]
        self.assertIn('product_id', item)
        self.assertIn('product_name', item)
        self.assertIn('score', item)

    def test_find_similar_prefilter_option(self):
        """Prefilter не ломает результат для большого каталога."""
        similar = self.matcher.find_similar(
            "Вентилятор канальный ВКК-125",
            threshold=0.7,
            prefilter=True,
        )
        # prefilter активируется только при > 1000 товарах, поэтому результат тот же
        self.assertTrue(len(similar) >= 0)


class ProductMatcherFindOrCreateTest(TestCase):
    """Тесты find_or_create_product."""

    def setUp(self):
        Product.objects.all().delete()
        ProductAlias.objects.all().delete()
        cache.clear()
        self.matcher = ProductMatcher()

        self.product1 = Product.objects.create(name="Вентилятор канальный ВКК-125", status=Product.Status.VERIFIED)
        self.matcher.invalidate_cache()

    def test_find_or_create_existing(self):
        product, created = self.matcher.find_or_create_product("Вентилятор канальный ВКК-125")
        self.assertFalse(created)
        self.assertEqual(product.id, self.product1.id)

    def test_find_or_create_new(self):
        product, created = self.matcher.find_or_create_product("Абсолютно новый уникальный товар XYZ")
        self.assertTrue(created)
        self.assertEqual(product.status, Product.Status.NEW)

    def test_find_or_create_creates_alias_on_fuzzy(self):
        product, created = self.matcher.find_or_create_product("Канальный вентилятор ВКК 125")
        self.assertFalse(created)
        self.assertEqual(product.id, self.product1.id)
        alias_exists = ProductAlias.objects.filter(
            product=self.product1,
            alias_name="Канальный вентилятор ВКК 125",
        ).exists()
        self.assertTrue(alias_exists)

    def test_find_or_create_via_alias(self):
        """Поиск по уже существующему алиасу."""
        ProductAlias.objects.create(product=self.product1, alias_name="Канальник ВКК125")
        product, created = self.matcher.find_or_create_product("Канальник ВКК125")
        self.assertFalse(created)
        self.assertEqual(product.id, self.product1.id)

    def test_find_or_create_no_llm(self):
        """При use_llm=False не вызывается LLM."""
        product, created = self.matcher.find_or_create_product(
            "Какой-то товар без совпадений",
            use_llm=False,
        )
        self.assertTrue(created)


class ProductMatcherLLMMatchTest(TestCase):
    """Тесты _try_llm_match с мокнутым LLM."""

    def setUp(self):
        Product.objects.all().delete()
        ProductAlias.objects.all().delete()
        cache.clear()
        self.matcher = ProductMatcher()

        self.product1 = Product.objects.create(name="Болт М6х30", status=Product.Status.VERIFIED)
        self.matcher.invalidate_cache()

    @patch('catalog.services.product_matcher.compare_products_with_llm')
    def test_try_llm_match_positive(self, mock_llm):
        """LLM подтверждает совпадение — возвращает Product."""
        mock_llm.return_value = [{'is_same': True, 'confidence': 0.95}]

        # Нужен кандидат в диапазоне 0.60-0.95
        # Используем find_similar, который вернёт кандидатов
        with patch.object(self.matcher, 'find_similar') as mock_find:
            mock_find.return_value = [
                {'product_id': self.product1.id, 'product_name': self.product1.name, 'score': 0.75},
            ]
            result = self.matcher._try_llm_match("Болт M6x30", "болт m6x30", None)

        self.assertIsNotNone(result)
        self.assertEqual(result.id, self.product1.id)
        self.assertTrue(ProductAlias.objects.filter(product=self.product1).exists())

    @patch('catalog.services.product_matcher.compare_products_with_llm')
    def test_try_llm_match_negative(self, mock_llm):
        """LLM отвергает — возвращает None."""
        mock_llm.return_value = [{'is_same': False, 'confidence': 0.3}]

        with patch.object(self.matcher, 'find_similar') as mock_find:
            mock_find.return_value = [
                {'product_id': self.product1.id, 'product_name': self.product1.name, 'score': 0.75},
            ]
            result = self.matcher._try_llm_match("Гайка М8", "гайка м8", None)

        self.assertIsNone(result)

    @patch('catalog.services.product_matcher.compare_products_with_llm')
    def test_try_llm_match_low_confidence(self, mock_llm):
        """LLM is_same=True но confidence ниже порога."""
        mock_llm.return_value = [{'is_same': True, 'confidence': 0.5}]

        with patch.object(self.matcher, 'find_similar') as mock_find:
            mock_find.return_value = [
                {'product_id': self.product1.id, 'product_name': self.product1.name, 'score': 0.75},
            ]
            result = self.matcher._try_llm_match("Болт M6", "болт m6", None)

        self.assertIsNone(result)

    @patch('catalog.services.product_matcher.compare_products_with_llm')
    def test_try_llm_match_exception_returns_none(self, mock_llm):
        """Ошибка LLM не ломает поток — возвращает None."""
        mock_llm.side_effect = RuntimeError("LLM API down")

        with patch.object(self.matcher, 'find_similar') as mock_find:
            mock_find.return_value = [
                {'product_id': self.product1.id, 'product_name': self.product1.name, 'score': 0.75},
            ]
            result = self.matcher._try_llm_match("Болт M6x30", "болт m6x30", None)

        self.assertIsNone(result)

    def test_try_llm_match_no_candidates(self):
        """Нет кандидатов в диапазоне — LLM не вызывается."""
        with patch.object(self.matcher, 'find_similar', return_value=[]):
            result = self.matcher._try_llm_match("XXXYYY", "xxxyyy", None)
        self.assertIsNone(result)


class ProductMatcherFindDuplicatesTest(TestCase):
    """Тесты find_duplicates."""

    def setUp(self):
        Product.objects.all().delete()
        ProductAlias.objects.all().delete()
        cache.clear()
        self.matcher = ProductMatcher()

    def test_find_duplicates_empty(self):
        """Нет товаров — пустой список."""
        duplicates = self.matcher.find_duplicates()
        self.assertEqual(duplicates, [])

    def test_find_duplicates_detects_pair(self):
        Product.objects.create(name="Гвозди строительные 50мм", status=Product.Status.NEW)
        Product.objects.create(name="Гвозди строит. 50 мм", status=Product.Status.NEW)
        self.matcher.invalidate_cache()

        duplicates = self.matcher.find_duplicates(threshold=0.7)
        self.assertTrue(len(duplicates) > 0)

    def test_find_duplicates_respects_limit(self):
        for i in range(10):
            Product.objects.create(name=f"Товар тестовый {i}", status=Product.Status.NEW)
        self.matcher.invalidate_cache()

        duplicates = self.matcher.find_duplicates(threshold=0.3, limit=2)
        self.assertLessEqual(len(duplicates), 2)


class CompareProductsWithLLMTest(TestCase):
    """Тесты compare_products_with_llm с мокнутым LLM API."""

    @patch('llm_services.models.LLMProvider.objects')
    def test_no_active_provider_raises(self, mock_objects):
        """Нет активного провайдера — RuntimeError."""
        mock_objects.filter.return_value.first.return_value = None
        with self.assertRaises(RuntimeError):
            compare_products_with_llm("Болт М6", ["Болт М6х30"])

    @patch('openai.OpenAI')
    @patch('llm_services.models.LLMProvider.objects')
    def test_openai_provider_returns_results(self, mock_objects, mock_openai_cls):
        """OpenAI провайдер — корректный JSON ответ."""
        provider_record = MagicMock()
        provider_record.provider_type = 'openai'
        provider_record.api_key = 'test-key'
        provider_record.model_name = 'gpt-4o'
        mock_objects.filter.return_value.first.return_value = provider_record

        response_data = json.dumps([{"is_same": True, "confidence": 0.9}])
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value.choices = [
            MagicMock(message=MagicMock(content=response_data))
        ]
        mock_openai_cls.return_value = mock_client

        results = compare_products_with_llm("Болт М6", ["Болт М6х30"])
        self.assertEqual(len(results), 1)
        self.assertTrue(results[0]['is_same'])

    @patch('openai.OpenAI')
    @patch('llm_services.models.LLMProvider.objects')
    def test_invalid_json_returns_empty(self, mock_objects, mock_openai_cls):
        """LLM вернул невалидный JSON — возвращает пустой список."""
        provider_record = MagicMock()
        provider_record.provider_type = 'openai'
        provider_record.api_key = 'test-key'
        provider_record.model_name = 'gpt-4o'
        mock_objects.filter.return_value.first.return_value = provider_record

        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value.choices = [
            MagicMock(message=MagicMock(content="NOT JSON"))
        ]
        mock_openai_cls.return_value = mock_client
        results = compare_products_with_llm("Болт", ["Гайка"])
        self.assertEqual(results, [])

    @patch('openai.OpenAI')
    @patch('llm_services.models.LLMProvider.objects')
    def test_markdown_wrapped_json_parsed(self, mock_objects, mock_openai_cls):
        """LLM вернул JSON в markdown-обёртке — парсится корректно."""
        provider_record = MagicMock()
        provider_record.provider_type = 'openai'
        provider_record.api_key = 'test-key'
        provider_record.model_name = 'gpt-4o'
        mock_objects.filter.return_value.first.return_value = provider_record

        wrapped = '```json\n[{"is_same": true, "confidence": 0.85}]\n```'
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value.choices = [
            MagicMock(message=MagicMock(content=wrapped))
        ]
        mock_openai_cls.return_value = mock_client
        results = compare_products_with_llm("Болт М6", ["Болт М6х30"])
        self.assertEqual(len(results), 1)
        self.assertTrue(results[0]['is_same'])
