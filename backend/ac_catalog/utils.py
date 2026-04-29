"""Утилиты для каталога моделей кондиционеров: транслитерация, генерация slug."""
from __future__ import annotations

import re

from django.utils.text import slugify

_TRANSLIT_MAP = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "yo",
    "ж": "zh", "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m",
    "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u",
    "ф": "f", "х": "kh", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "shch",
    "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya",
}


def transliterate(text: str) -> str:
    """Транслитерация кириллицы в латиницу."""
    result = []
    for ch in text:
        lower = ch.lower()
        if lower in _TRANSLIT_MAP:
            mapped = _TRANSLIT_MAP[lower]
            result.append(mapped.upper() if ch.isupper() else mapped)
        else:
            result.append(ch)
    return "".join(result)


def slugify_part(text: str) -> str:
    """Подготовка одной части slug: пробелы → _, убираем лишние символы."""
    text = transliterate(text.strip())
    text = text.replace(" ", "_")
    text = text.replace(".", "_")
    text = re.sub(r"[^\w\-]", "", text, flags=re.ASCII)
    return text


def generate_acmodel_slug(brand_name: str, series: str, inner_unit: str, outer_unit: str) -> str:
    """Генерация slug для модели кондиционера.

    Формат: <brand>-<series>-<inner_unit>-<outer_unit>
    Пробелы внутри частей → _, части соединяются через -.
    """
    parts = [slugify_part(brand_name), slugify_part(series), slugify_part(inner_unit)]
    if outer_unit.strip():
        parts.append(slugify_part(outer_unit))
    parts = [p for p in parts if p]
    return "-".join(parts)


def generate_lowercase_slug(
    brand_name: str, series: str, inner_unit: str, outer_unit: str = "",
) -> str:
    """Wave 12: SEO-friendly lowercase slug формата 'brand-series-inner-outer'.

    Пример: ('MDV', 'NOVA 3-in-1', 'MDSAH-09HRFN8', 'MDOAH-09HFN8')
            → 'mdv-nova-3-in-1-mdsah-09hrfn8-mdoah-09hfn8'

    Кириллица предварительно транслитерируется (slugify(allow_unicode=False)
    иначе вырезает её до пустоты). Django slugify оставляет '_', поэтому
    дополнительно меняем '_' → '-' и схлопываем дубликаты дефиса.
    """
    parts = [p for p in (brand_name, series, inner_unit, outer_unit) if p]
    raw = "-".join(parts)
    raw = transliterate(raw)
    s = slugify(raw, allow_unicode=False)
    s = s.replace("_", "-")
    s = re.sub(r"-+", "-", s).strip("-")
    return s
