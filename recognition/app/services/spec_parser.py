"""SpecParser — port from backend/llm_services/services/specification_parser.py.

Stateless, no Django. Pure Python + PyMuPDF + LLM Vision provider.
"""

import json
import logging

import fitz

from ..config import settings
from ..providers.base import BaseLLMProvider
from ..schemas.spec import PagesStats, SpecItem, SpecParseResponse
from .pdf_render import render_page_to_b64

logger = logging.getLogger(__name__)

CLASSIFY_PROMPT = """Ты получаешь изображение страницы проектной спецификации (ОВиК/СС).

Определи тип страницы:
- "specification" — таблица с перечнем оборудования/материалов (колонки: наименование, тип/марка, ед.изм., кол-во)
- "drawing" — чертёж, план, схема (пропускаем)
- "title" — титульный лист, штампы (пропускаем)
- "other" — прочее (пропускаем)

Если это specification, также определи название раздела (если виден заголовок типа "Система вентиляции", "Слаботочные системы" и т.д.).

Ответь строго JSON:
{"type": "specification|drawing|title|other", "section_name": "..." или ""}
"""

EXTRACT_PROMPT = """Ты получаешь изображение страницы спецификации оборудования ОВиК/СС.

Извлеки ВСЕ позиции из таблицы. Для каждой позиции:
- name: наименование и техническая характеристика (полное)
- model_name: тип, марка, обозначение документа (артикул)
- brand: поставщик/производитель (если указан)
- unit: единица измерения (шт, м.п., м.кв., кг)
- quantity: количество (число)
- tech_specs: дополнительные ТТХ (строка, если есть)

Если на странице нет позиций — верни пустой массив.
Ответь строго JSON: {"items": [...]}
"""


class SpecParser:
    """Stateless PDF specification parser via LLM Vision."""

    def __init__(self, provider: BaseLLMProvider):
        self.provider = provider

    def parse(self, pdf_bytes: bytes, filename: str = "document.pdf") -> SpecParseResponse:
        """Parse PDF specification → SpecParseResponse."""
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        pages_total = len(doc)

        all_items: list[SpecItem] = []
        errors: list[str] = []
        pages_processed = 0
        pages_skipped = 0
        current_section = ""
        sort_order = 0

        logger.info("SpecParser: parsing '%s' (%d pages)", filename, pages_total)

        for page_num in range(pages_total):
            try:
                page_b64 = render_page_to_b64(doc, page_num)

                # Step 1: classify page
                classification = self._classify_page(page_b64, page_num)

                if classification.get("section_name"):
                    current_section = classification["section_name"]

                if classification.get("type") != "specification":
                    pages_skipped += 1
                    continue

                # Step 2: extract items
                items = self._extract_items(page_b64, page_num)
                for item_data in items:
                    sort_order += 1
                    all_items.append(SpecItem(
                        name=item_data.get("name", "").strip(),
                        model_name=item_data.get("model_name", ""),
                        brand=item_data.get("brand", ""),
                        unit=item_data.get("unit", "шт"),
                        quantity=float(item_data.get("quantity", 1)),
                        tech_specs=str(item_data.get("tech_specs", "")),
                        section_name=current_section,
                        page_number=page_num + 1,
                        sort_order=sort_order,
                    ))
                pages_processed += 1

            except Exception as e:
                error_msg = f"Page {page_num + 1}: {e}"
                logger.warning("SpecParser: %s", error_msg)
                errors.append(error_msg)

        doc.close()

        # Deduplicate
        all_items = self._deduplicate(all_items)

        status = "done"
        if errors and all_items:
            status = "partial"
        elif errors and not all_items:
            status = "error"

        return SpecParseResponse(
            status=status,
            items=all_items,
            errors=errors,
            pages_stats=PagesStats(
                total=pages_total,
                processed=pages_processed,
                skipped=pages_skipped,
                error=len(errors),
            ),
        )

    def _classify_page(self, image_b64: str, page_num: int) -> dict:
        for attempt in range(settings.max_page_retries):
            try:
                response = self.provider.vision_complete(image_b64, CLASSIFY_PROMPT)
                return json.loads(response)
            except (json.JSONDecodeError, KeyError) as e:
                if attempt == settings.max_page_retries - 1:
                    logger.warning("Classify page %d failed after %d retries: %s", page_num, settings.max_page_retries, e)
                    return {"type": "other", "section_name": ""}
        return {"type": "other", "section_name": ""}

    def _extract_items(self, image_b64: str, page_num: int) -> list[dict]:
        for attempt in range(settings.max_page_retries):
            try:
                response = self.provider.vision_complete(image_b64, EXTRACT_PROMPT)
                data = json.loads(response)
                return data.get("items", [])
            except (json.JSONDecodeError, KeyError) as e:
                if attempt == settings.max_page_retries - 1:
                    raise ValueError(f"Extract items page {page_num}: {e}") from e
        return []

    @staticmethod
    def _deduplicate(items: list[SpecItem]) -> list[SpecItem]:
        """Merge identical items (name+model+brand) → sum quantities."""
        seen: dict[tuple, int] = {}
        result: list[SpecItem] = []

        for item in items:
            key = (item.name.lower().strip(), item.model_name.lower().strip(), item.brand.lower().strip())
            if key in seen:
                result[seen[key]].quantity += item.quantity
            else:
                seen[key] = len(result)
                result.append(item)

        return result
