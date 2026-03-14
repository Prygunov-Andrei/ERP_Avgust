"""
Дефолтная конфигурация столбцов сметы.
Используется когда estimate.column_config пуст.
"""

DEFAULT_COLUMN_CONFIG = [
    {
        "key": "item_number", "label": "№", "type": "builtin",
        "builtin_field": "item_number", "width": 50, "editable": False,
        "visible": True, "formula": None, "decimal_places": None,
        "aggregatable": False, "options": None,
    },
    {
        "key": "name", "label": "Наименование", "type": "builtin",
        "builtin_field": "name", "width": 250, "editable": True,
        "visible": True, "formula": None, "decimal_places": None,
        "aggregatable": False, "options": None,
    },
    {
        "key": "model_name", "label": "Модель", "type": "builtin",
        "builtin_field": "model_name", "width": 150, "editable": True,
        "visible": True, "formula": None, "decimal_places": None,
        "aggregatable": False, "options": None,
    },
    {
        "key": "unit", "label": "Ед.", "type": "builtin",
        "builtin_field": "unit", "width": 60, "editable": True,
        "visible": True, "formula": None, "decimal_places": None,
        "aggregatable": False, "options": None,
    },
    {
        "key": "quantity", "label": "Кол-во", "type": "builtin",
        "builtin_field": "quantity", "width": 80, "editable": True,
        "visible": True, "formula": None, "decimal_places": 3,
        "aggregatable": False, "options": None,
    },
    {
        "key": "material_unit_price", "label": "Цена мат.", "type": "builtin",
        "builtin_field": "material_unit_price", "width": 100, "editable": True,
        "visible": True, "formula": None, "decimal_places": 2,
        "aggregatable": False, "options": None,
    },
    {
        "key": "work_unit_price", "label": "Цена раб.", "type": "builtin",
        "builtin_field": "work_unit_price", "width": 100, "editable": True,
        "visible": True, "formula": None, "decimal_places": 2,
        "aggregatable": False, "options": None,
    },
    {
        "key": "material_total", "label": "Итого мат.", "type": "builtin",
        "builtin_field": "material_total", "width": 110, "editable": False,
        "visible": True, "formula": None, "decimal_places": 2,
        "aggregatable": True, "options": None,
    },
    {
        "key": "work_total", "label": "Итого раб.", "type": "builtin",
        "builtin_field": "work_total", "width": 110, "editable": False,
        "visible": True, "formula": None, "decimal_places": 2,
        "aggregatable": True, "options": None,
    },
    {
        "key": "line_total", "label": "Итого", "type": "builtin",
        "builtin_field": "line_total", "width": 120, "editable": False,
        "visible": True, "formula": None, "decimal_places": 2,
        "aggregatable": True, "options": None,
    },
]

# Допустимые builtin-поля для маппинга
ALLOWED_BUILTIN_FIELDS = {
    'item_number', 'name', 'model_name', 'unit',
    'quantity', 'material_unit_price', 'work_unit_price',
    'material_total', 'work_total', 'line_total',
}

# Допустимые типы столбцов
ALLOWED_COLUMN_TYPES = {
    'builtin', 'custom_number', 'custom_text', 'custom_date',
    'custom_select', 'custom_checkbox', 'formula',
}
