"""
LLM-категоризация товаров в иерархическое дерево.

Стратегия:
1. Загружает дерево категорий из БД → форматирует в текст
2. Отправляет LLM: product_names + дерево → category_code для каждого
3. Если LLM предлагает новую подкатегорию — создаёт её
4. Batch-режим (до 20 товаров за вызов) для экономии LLM-запросов
"""
import json
import logging
from typing import Dict, List, Optional

from .models import Category, Product

logger = logging.getLogger(__name__)

# Максимум товаров в одном LLM-вызове
BATCH_SIZE = 20


class ProductCategorizer:
    """LLM-категоризация товаров."""

    def __init__(self, provider_model=None):
        from llm_services.models import LLMProvider
        self.provider_model = provider_model or LLMProvider.get_default()
        self._tree_cache: Optional[str] = None
        self._code_to_category: Dict[str, Category] = {}

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def categorize(self, product_name: str) -> Optional[Category]:
        """Определяет категорию для одного товара."""
        results = self.categorize_batch([product_name])
        return results[0] if results else None

    def categorize_batch(self, product_names: List[str]) -> List[Optional[Category]]:
        """
        Batch-категоризация: один LLM-вызов для списка товаров (до BATCH_SIZE).

        Returns:
            Список Category (или None) для каждого товара, в том же порядке.
        """
        if not product_names:
            return []

        tree_text = self._build_category_tree_text()
        if not tree_text:
            logger.warning('Дерево категорий пустое — пропускаем категоризацию')
            return [None] * len(product_names)

        # Разбиваем на батчи
        all_results: List[Optional[Category]] = []
        for i in range(0, len(product_names), BATCH_SIZE):
            chunk = product_names[i:i + BATCH_SIZE]
            chunk_results = self._categorize_chunk(chunk, tree_text)
            all_results.extend(chunk_results)

        return all_results

    def categorize_products(self, products: List[Product]) -> int:
        """
        Категоризирует список Product-объектов (обновляет category FK).

        Returns:
            Количество успешно категоризированных товаров.
        """
        if not products:
            return 0

        names = [p.name for p in products]
        categories = self.categorize_batch(names)

        count = 0
        for product, category in zip(products, categories):
            if category and product.category_id != category.pk:
                product.category = category
                product.save(update_fields=['category', 'updated_at'])
                count += 1
                logger.info(
                    'Категоризирован: "%s" → %s',
                    product.name, category.get_full_path(),
                )

        return count

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _build_category_tree_text(self) -> str:
        """Форматирует дерево категорий в текст для LLM-промпта."""
        if self._tree_cache is not None:
            return self._tree_cache

        categories = list(
            Category.objects.filter(is_active=True)
            .select_related('parent')
            .order_by('level', 'sort_order', 'name')
        )

        if not categories:
            self._tree_cache = ''
            return ''

        # Индексируем
        self._code_to_category = {c.code: c for c in categories}
        children_map: Dict[Optional[int], list] = {}
        for c in categories:
            children_map.setdefault(c.parent_id, []).append(c)

        lines: list = []

        def _walk(parent_id: Optional[int], indent: int):
            for cat in children_map.get(parent_id, []):
                prefix = '  ' * indent
                lines.append(f'{prefix}- [{cat.code}] {cat.name}')
                _walk(cat.pk, indent + 1)

        _walk(None, 0)
        self._tree_cache = '\n'.join(lines)
        return self._tree_cache

    def _categorize_chunk(
        self, names: List[str], tree_text: str
    ) -> List[Optional[Category]]:
        """Один LLM-вызов для chunk товаров."""
        products_text = '\n'.join(
            f'{i + 1}. "{name}"' for i, name in enumerate(names)
        )

        prompt = (
            'Ты — эксперт по классификации товаров и услуг для строительства '
            'и инженерных систем (ОВиК, электрика, ВиК и др.).\n\n'
            f'Дерево категорий:\n{tree_text}\n\n'
            'Определи категорию для КАЖДОГО товара. Выбери САМУЮ КОНКРЕТНУЮ '
            'подкатегорию из дерева. Если ни одна категория не подходит — '
            'предложи новую (укажи parent_code родительской категории, '
            'code и name новой).\n\n'
            f'Товары:\n{products_text}\n\n'
            'Ответь строго JSON-массивом (без markdown):\n'
            '[\n'
            '  {"index": 1, "category_code": "ventilation_fans_duct"},\n'
            '  {"index": 2, "category_code": null, '
            '"new_category": {"parent_code": "heating", '
            '"code": "heating_expansion", "name": "Расширительные баки"}}\n'
            ']\n\n'
            'Правила:\n'
            '- index — порядковый номер товара из списка\n'
            '- category_code — код из дерева (в квадратных скобках)\n'
            '- Если товар — услуга (доставка, монтаж, проектирование и т.д.), '
            'используй раздел services\n'
            '- Если совсем не подходит ни одна категория — используй "other"\n'
            '- Ответь ТОЛЬКО JSON'
        )

        try:
            raw_text = self._call_llm(prompt)
            results = self._parse_llm_response(raw_text)
            return self._map_results(results, names)
        except Exception as exc:
            logger.warning('LLM categorization failed: %s', exc)
            return [None] * len(names)

    def _call_llm(self, prompt: str) -> str:
        """Вызывает LLM и возвращает сырой текст ответа."""
        provider_type = self.provider_model.provider_type
        api_key = self.provider_model.get_api_key()
        model_name = self.provider_model.model_name

        if provider_type == 'openai':
            import openai
            client = openai.OpenAI(api_key=api_key, timeout=60)
            response = client.chat.completions.create(
                model=model_name,
                messages=[
                    {
                        'role': 'system',
                        'content': 'Ты эксперт по классификации строительных товаров. Отвечай только JSON.',
                    },
                    {'role': 'user', 'content': prompt},
                ],
                temperature=0.1,
                max_tokens=2000,
            )
            return response.choices[0].message.content.strip()

        elif provider_type == 'grok':
            import httpx
            with httpx.Client(timeout=60) as client:
                resp = client.post(
                    'https://api.x.ai/v1/chat/completions',
                    headers={
                        'Authorization': f'Bearer {api_key}',
                        'Content-Type': 'application/json',
                    },
                    json={
                        'model': model_name,
                        'messages': [
                            {
                                'role': 'system',
                                'content': 'Ты эксперт по классификации строительных товаров. Отвечай только JSON.',
                            },
                            {'role': 'user', 'content': prompt},
                        ],
                        'temperature': 0.1,
                        'max_tokens': 2000,
                    },
                )
                resp.raise_for_status()
                return resp.json()['choices'][0]['message']['content'].strip()

        elif provider_type == 'gemini':
            import google.generativeai as genai
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel(model_name)
            response = model.generate_content(prompt)
            return response.text.strip()

        else:
            raise RuntimeError(f'Unsupported provider: {provider_type}')

    @staticmethod
    def _parse_llm_response(raw_text: str) -> list:
        """Парсит JSON-ответ LLM, убирая markdown-обёртку."""
        text = raw_text.strip()
        if text.startswith('```'):
            text = text.strip('`').strip()
            if text.startswith('json'):
                text = text[4:].strip()

        data = json.loads(text)
        if not isinstance(data, list):
            data = [data]
        return data

    def _map_results(
        self, results: list, names: List[str]
    ) -> List[Optional[Category]]:
        """Маппит LLM-результаты на Category-объекты."""
        output: List[Optional[Category]] = [None] * len(names)

        for item in results:
            idx = item.get('index', 0) - 1  # 1-based → 0-based
            if idx < 0 or idx >= len(names):
                continue

            code = item.get('category_code')

            # Новая категория
            if code is None and 'new_category' in item:
                new_cat = item['new_category']
                category = self._find_or_create_category(
                    code=new_cat.get('code', ''),
                    name=new_cat.get('name', ''),
                    parent_code=new_cat.get('parent_code', ''),
                )
                output[idx] = category
                continue

            if not code:
                continue

            # Ищем в кэше, потом в БД
            category = self._code_to_category.get(code)
            if category is None:
                category = Category.objects.filter(code=code, is_active=True).first()
                if category:
                    self._code_to_category[code] = category

            output[idx] = category

        return output

    def _find_or_create_category(
        self, code: str, name: str, parent_code: str
    ) -> Optional[Category]:
        """Находит категорию по коду или создаёт новую подкатегорию."""
        if not code or not name:
            return None

        existing = Category.objects.filter(code=code).first()
        if existing:
            self._code_to_category[code] = existing
            return existing

        parent = self._code_to_category.get(parent_code)
        if parent is None:
            parent = Category.objects.filter(code=parent_code).first()

        if parent is None:
            # Если parent не найден — ставим в корень "Прочее"
            parent = Category.objects.filter(code='other').first()

        category = Category.objects.create(
            code=code,
            name=name,
            parent=parent,
        )
        self._code_to_category[code] = category
        # Инвалидируем кэш дерева
        self._tree_cache = None
        logger.info('Создана новая категория: %s → %s', parent_code, name)
        return category
