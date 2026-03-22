"""
Вынесенные валидаторы для estimates app.
Переиспользуются в EstimateSerializer и ColumnConfigTemplateSerializer.
"""
import re

from rest_framework import serializers

from .column_defaults import ALLOWED_BUILTIN_FIELDS, ALLOWED_COLUMN_TYPES
from .formula_engine import validate_formula, topological_sort, CycleError

_KEY_RE = re.compile(r'^[a-z][a-z0-9_]{0,49}$')


def validate_column_config(value):
    """
    Валидация конфигурации столбцов сметы.

    Проверяет:
    - формат (список объектов)
    - уникальность ключей, допустимый формат key
    - допустимые типы столбцов
    - builtin_field для builtin-столбцов
    - options для custom_select
    - синтаксис и переменные формул
    - отсутствие циклических зависимостей (topological sort)

    Args:
        value: значение поля column_config

    Returns:
        value (без изменений при успехе)

    Raises:
        serializers.ValidationError
    """
    if not value:
        return value

    if not isinstance(value, list):
        raise serializers.ValidationError('column_config должен быть списком')

    keys_seen = set()
    errors = []
    for i, col in enumerate(value):
        if not isinstance(col, dict):
            errors.append(f'Столбец #{i}: должен быть объектом')
            continue

        key = col.get('key', '')
        col_type = col.get('type', '')

        if not key or not _KEY_RE.match(key):
            errors.append(
                f'Столбец #{i}: key должен содержать только [a-z0-9_], '
                f'начинаться с буквы, длина 1-50'
            )
        if key in keys_seen:
            errors.append(f'Столбец #{i}: дублирующийся key "{key}"')
        keys_seen.add(key)

        if col_type not in ALLOWED_COLUMN_TYPES:
            errors.append(f'Столбец "{key}": недопустимый тип "{col_type}"')

        if col_type == 'builtin':
            bf = col.get('builtin_field')
            if bf not in ALLOWED_BUILTIN_FIELDS:
                errors.append(f'Столбец "{key}": недопустимое builtin_field "{bf}"')

        if col_type == 'custom_select':
            opts = col.get('options')
            if not opts or not isinstance(opts, list) or len(opts) == 0:
                errors.append(f'Столбец "{key}": custom_select требует непустой options')

        if col_type == 'formula':
            formula = col.get('formula', '')
            if formula:
                formula_errors = validate_formula(formula, keys_seen | ALLOWED_BUILTIN_FIELDS)
                for fe in formula_errors:
                    errors.append(f'Столбец "{key}": {fe}')

    # Check for cycles
    if not errors:
        try:
            topological_sort(value)
        except CycleError as e:
            errors.append(str(e))

    if errors:
        raise serializers.ValidationError(errors)

    return value
