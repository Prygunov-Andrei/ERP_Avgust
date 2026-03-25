"""
Сервис для автоматического перевода новостей через LLM API.
Поддерживает OpenAI, Anthropic и DeepL.
"""
import json
import logging
import re
import time
from typing import Dict, Optional
from django.conf import settings
from django.utils.translation import gettext_lazy as _

logger = logging.getLogger(__name__)

# Exponential backoff: до 3 попыток с задержками 1s, 2s, 4s
MAX_RETRIES = 3
BACKOFF_BASE = 1  # секунды
BACKOFF_FACTOR = 2


class TranslationService:
    """
    Сервис для перевода текста через LLM API.
    """
    
    # Маппинг языков проекта на коды языков для API
    LANGUAGE_MAP = {
        'ru': 'Russian',
        'en': 'English',
        'de': 'German',
        'pt': 'Portuguese',
    }
    
    def __init__(self):
        self.provider = getattr(settings, 'TRANSLATION_PROVIDER', 'openai')
        self.api_key = getattr(settings, 'TRANSLATION_API_KEY', '')
        self.model = getattr(settings, 'TRANSLATION_MODEL', 'gpt-4o-mini')
        self.enabled = getattr(settings, 'TRANSLATION_ENABLED', True)
    
    def translate(self, text: str, source_lang: str, target_lang: str) -> Optional[str]:
        """
        Переводит текст с одного языка на другой.
        Использует exponential backoff при ошибках (1s, 2s, 4s).

        Args:
            text: Текст для перевода
            source_lang: Исходный язык (ru, en, de, pt)
            target_lang: Целевой язык (ru, en, de, pt)

        Returns:
            Переведенный текст или None в случае ошибки
        """
        if not self.enabled or not self.api_key:
            logger.warning("Translation is disabled or API key is not set")
            return None

        if source_lang == target_lang:
            return text

        if not text or not text.strip():
            return text

        dispatch = {
            'openai': self._translate_openai,
            'anthropic': self._translate_anthropic,
            'deepl': self._translate_deepl,
        }

        translate_fn = dispatch.get(self.provider)
        if not translate_fn:
            logger.error(f"Unknown translation provider: {self.provider}")
            return None

        last_error = None
        for attempt in range(MAX_RETRIES):
            try:
                return translate_fn(text, source_lang, target_lang)
            except Exception as e:
                last_error = e
                if attempt < MAX_RETRIES - 1:
                    delay = BACKOFF_BASE * (BACKOFF_FACTOR ** attempt)
                    logger.warning(
                        "Translation attempt %d/%d failed (%s), retrying in %ds: %s",
                        attempt + 1, MAX_RETRIES, self.provider, delay, str(e),
                    )
                    time.sleep(delay)
                else:
                    logger.error(
                        "Translation failed after %d attempts (%s): %s",
                        MAX_RETRIES, self.provider, str(last_error),
                    )

        return None
    
    def _translate_openai(self, text: str, source_lang: str, target_lang: str) -> Optional[str]:
        """Перевод через OpenAI API"""
        try:
            from openai import OpenAI
            
            # Явный таймаут: иначе запрос может "зависнуть" и привести к убийству воркера gunicorn.
            client = OpenAI(api_key=self.api_key, timeout=30.0)
            
            source_name = self.LANGUAGE_MAP.get(source_lang, source_lang)
            target_name = self.LANGUAGE_MAP.get(target_lang, target_lang)
            
            prompt = f"""Translate the following text from {source_name} to {target_name}. 
Preserve all HTML/Markdown formatting, links, and structure. 
Return only the translated text without any explanations or additional comments.

Text to translate:
{text}"""
            
            response = client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a professional translator. Translate accurately while preserving all formatting."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=2000
            )
            
            translated_text = response.choices[0].message.content.strip()
            return translated_text
            
        except ImportError:
            logger.error("OpenAI library is not installed. Install it with: pip install openai")
            return None
        except Exception as e:
            logger.error(f"OpenAI translation error: {str(e)}")
            return None

    def _translate_openai_news_bulk(
        self,
        title: str,
        body: str,
        source_lang: str,
        target_languages: list,
    ) -> Optional[Dict[str, Dict[str, str]]]:
        """
        Переводит title+body сразу на несколько языков одним запросом.

        Это критично для стабильности: старый путь делал ~2*N запросов, что часто
        превышало таймауты и приводило к убийству воркера gunicorn (и "падению" API).

        Использует exponential backoff при ошибках (1s, 2s, 4s).
        """
        if not target_languages:
            return {}

        last_error = None
        for attempt in range(MAX_RETRIES):
            try:
                result = self._translate_openai_news_bulk_once(
                    title, body, source_lang, target_languages
                )
                return result
            except Exception as e:
                last_error = e
                if attempt < MAX_RETRIES - 1:
                    delay = BACKOFF_BASE * (BACKOFF_FACTOR ** attempt)
                    logger.warning(
                        "Bulk translation attempt %d/%d failed, retrying in %ds: %s",
                        attempt + 1, MAX_RETRIES, delay, str(e),
                    )
                    time.sleep(delay)
                else:
                    logger.error(
                        "Bulk translation failed after %d attempts: %s",
                        MAX_RETRIES, str(last_error), exc_info=True,
                    )

        return None

    def _translate_openai_news_bulk_once(
        self,
        title: str,
        body: str,
        source_lang: str,
        target_languages: list,
    ) -> Optional[Dict[str, Dict[str, str]]]:
        """
        Единичная попытка bulk-перевода через OpenAI API.
        Исключения пробрасываются наверх для retry.
        """
        from openai import OpenAI

        # Один запрос может быть тяжелее; даем больше времени, но все равно ограничиваем.
        client = OpenAI(api_key=self.api_key, timeout=60.0)

        source_name = self.LANGUAGE_MAP.get(source_lang, source_lang)
        targets = [
            {"code": lang, "name": self.LANGUAGE_MAP.get(lang, lang)}
            for lang in target_languages
            if lang in self.LANGUAGE_MAP
        ]
        if not targets:
            return {}

        targets_lines = "\n".join([f'- "{t["code"]}": {t["name"]}' for t in targets])

        prompt = f"""Translate the following NEWS fields from {source_name} to the target languages.
Preserve all HTML/Markdown formatting, links, and structure.

Return STRICTLY JSON only, no comments, no markdown fences.

Target languages:
{targets_lines}

JSON format:
{{
  "translations": {{
    "ru": {{"title": "...", "body": "..."}},
    "en": {{"title": "...", "body": "..."}},
    "de": {{"title": "...", "body": "..."}},
    "pt": {{"title": "...", "body": "..."}}
  }}
}}

News title:
{title}

News body:
{body}
"""

        response = client.chat.completions.create(
            model=self.model,
            messages=[
                {
                    "role": "system",
                    "content": "You are a professional translator. Output JSON only.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
            max_tokens=4000,
        )

        content = (response.choices[0].message.content or "").strip()
        if not content:
            return None

        # Сначала пробуем распарсить как чистый JSON, иначе выковыриваем объект.
        try:
            parsed = json.loads(content)
        except json.JSONDecodeError:
            match = re.search(r"\{.*\}", content, flags=re.DOTALL)
            if not match:
                logger.error("OpenAI bulk translation returned non-JSON response")
                return None
            parsed = json.loads(match.group(0))

        translations = parsed.get("translations")
        if not isinstance(translations, dict):
            return None

        out: Dict[str, Dict[str, str]] = {}
        for lang in target_languages:
            item = translations.get(lang)
            if not isinstance(item, dict):
                continue
            t_title = (item.get("title") or "").strip()
            t_body = (item.get("body") or "").strip()
            if not t_title or not t_body:
                continue
            out[lang] = {"title": t_title, "body": t_body}

        return out
    
    def _translate_anthropic(self, text: str, source_lang: str, target_lang: str) -> Optional[str]:
        """Перевод через Anthropic API (Claude)"""
        # TODO: Реализовать при необходимости
        logger.warning("Anthropic translation is not yet implemented")
        return None
    
    def _translate_deepl(self, text: str, source_lang: str, target_lang: str) -> Optional[str]:
        """Перевод через DeepL API"""
        # TODO: Реализовать при необходимости
        logger.warning("DeepL translation is not yet implemented")
        return None
    
    def translate_news(self, title: str, body: str, source_lang: str, target_languages: list = None) -> Dict[str, Dict[str, str]]:
        """
        Переводит заголовок и текст новости на все указанные языки.
        
        Args:
            title: Заголовок новости
            body: Текст новости
            source_lang: Исходный язык
            target_languages: Список целевых языков (по умолчанию все кроме исходного)
        
        Returns:
            Словарь вида {'ru': {'title': '...', 'body': '...'}, ...}
        """
        if target_languages is None:
            target_languages = [lang for lang in self.LANGUAGE_MAP.keys() if lang != source_lang]
        
        # Быстрый путь: один запрос на все языки вместо 2*N запросов.
        if self.provider == "openai":
            bulk = self._translate_openai_news_bulk(title, body, source_lang, target_languages)
            if isinstance(bulk, dict) and bulk:
                # Заполняем отсутствующие языки пустыми значениями, чтобы поведение не менялось.
                out: Dict[str, Dict[str, str]] = {}
                for lang in target_languages:
                    out[lang] = bulk.get(lang, {"title": "", "body": ""})
                return out

        # Fallback: старый режим (может быть медленным, но сохраняем для совместимости).
        translations: Dict[str, Dict[str, str]] = {}
        for target_lang in target_languages:
            translated_title = self.translate(title, source_lang, target_lang)
            translated_body = self.translate(body, source_lang, target_lang)

            if translated_title and translated_body:
                translations[target_lang] = {"title": translated_title, "body": translated_body}
            else:
                logger.warning(f"Failed to translate to {target_lang}, leaving empty")
                translations[target_lang] = {"title": "", "body": ""}

        return translations

