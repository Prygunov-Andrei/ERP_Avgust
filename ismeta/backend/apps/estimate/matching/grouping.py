"""Group matching — группировка одинаковых позиций для batch-подбора."""

import re
from collections import defaultdict

from .types import ItemGroup


def normalize_name(name: str) -> str:
    """Нормализация: lower, убрать артикулы, размеры в скобках, лишние пробелы."""
    s = name.lower().strip()
    s = re.sub(r"\([^)]*\)", "", s)  # убрать скобки с содержимым
    s = re.sub(r"\b[A-Z0-9]{3,}-[A-Z0-9/]+\b", "", s, flags=re.IGNORECASE)  # артикулы
    s = re.sub(r"\d+[xх×]\d+", "", s)  # размеры типа 500x400
    s = re.sub(r"\s+", " ", s).strip()
    return s


def find_groups(items) -> list[ItemGroup]:
    """Группирует позиции по normalized_name + unit.

    Группа из 20 одинаковых кабелей → подбор 1 раз → apply ко всем 20.
    """
    buckets: dict[tuple[str, str], list[str]] = defaultdict(list)
    for item in items:
        key = (normalize_name(item.name), item.unit)
        buckets[key].append(str(item.id))

    groups = []
    for (norm_name, unit), ids in buckets.items():
        groups.append(ItemGroup(normalized_name=norm_name, unit=unit, item_ids=ids))

    return groups
