"""Детерминированные pre-checks без LLM (E29).

Быстрые, бесплатные проверки перед вызовом ИИ.
"""

from collections import Counter
from decimal import Decimal


def run_pre_checks(items) -> list[dict]:
    """Быстрые проверки без LLM. Возвращает список issues."""
    issues = []

    # --- 1. Нулевые цены ---
    for item in items:
        if item.equipment_price == 0 and item.material_price == 0 and item.work_price == 0:
            issues.append({
                "item_name": item.name,
                "severity": "warning",
                "category": "price_outlier",
                "message": "Все цены = 0. Позиция без стоимости.",
                "suggestion": "Заполнить цены оборудования/материалов/работ.",
                "source": "pre-check",
            })

    # --- 2. Не подобранные работы ---
    for item in items:
        if item.match_source == "unmatched" and item.work_price == 0:
            issues.append({
                "item_name": item.name,
                "severity": "info",
                "category": "missing_work",
                "message": "Работа не подобрана (match_source=unmatched, work_price=0).",
                "suggestion": "Запустить подбор работ или указать вручную.",
                "source": "pre-check",
            })

    # --- 3. Нулевая наценка ---
    for item in items:
        if item.material_price > 0 and item.quantity > 0:
            expected_no_markup = item.material_price * item.quantity
            if item.material_total > 0 and abs(item.material_total - expected_no_markup) < Decimal("1"):
                issues.append({
                    "item_name": item.name,
                    "severity": "info",
                    "category": "price_outlier",
                    "message": f"Наценка на материалы ≈ 0% (material_total ≈ material_price × qty = {expected_no_markup}₽).",
                    "suggestion": "Проверить, заложена ли наценка на материалы.",
                    "source": "pre-check",
                })

    # --- 4. Дубликаты ---
    name_counter = Counter(item.name.lower().strip() for item in items)
    duplicates = {name for name, count in name_counter.items() if count > 1}
    if duplicates:
        seen = set()
        for item in items:
            key = item.name.lower().strip()
            if key in duplicates and key not in seen:
                seen.add(key)
                count = name_counter[key]
                issues.append({
                    "item_name": item.name,
                    "severity": "warning",
                    "category": "duplicate",
                    "message": f"Позиция встречается {count} раз(а). Возможный дубликат.",
                    "suggestion": "Проверить, не дублируется ли позиция. Если намеренно — игнорировать.",
                    "source": "pre-check",
                })

    # --- 5. Подозрительные единицы ---
    for item in items:
        name_lower = item.name.lower()
        unit_lower = item.unit.lower().strip()
        if "воздуховод" in name_lower and unit_lower == "шт":
            issues.append({
                "item_name": item.name,
                "severity": "warning",
                "category": "unit_error",
                "message": f"Воздуховод с единицей «шт» вместо «м.п.» — возможная ошибка.",
                "suggestion": "Проверить единицу измерения. Воздуховоды обычно в м.п.",
                "source": "pre-check",
            })

    # --- 6. Большие количества ---
    for item in items:
        if item.quantity > 10000:
            issues.append({
                "item_name": item.name,
                "severity": "info",
                "category": "quantity_mismatch",
                "message": f"Количество {item.quantity} > 10000 — необычно большое.",
                "suggestion": "Проверить порядок величины.",
                "source": "pre-check",
            })

    return issues
