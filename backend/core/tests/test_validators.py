"""Тесты для estimates.validators.validate_column_config."""

import sys
import pytest
from rest_framework import serializers

# formula_engine.py использует синтаксис Decimal | None (Python 3.10+)
if sys.version_info < (3, 10):
    pytest.skip(
        "estimates.validators требует Python >= 3.10 (type union syntax)",
        allow_module_level=True,
    )

from estimates.validators import validate_column_config


class TestValidateColumnConfig:
    def test_valid_config(self):
        """Валидная конфигурация проходит без ошибок."""
        config = [
            {
                "key": "name",
                "type": "builtin",
                "builtin_field": "name",
                "label": "Наименование",
            },
            {
                "key": "quantity",
                "type": "builtin",
                "builtin_field": "quantity",
                "label": "Кол-во",
            },
            {
                "key": "custom_note",
                "type": "custom_text",
                "label": "Заметка",
            },
        ]
        result = validate_column_config(config)
        assert result == config

    def test_invalid_key_with_spaces(self):
        """Ключ с пробелами вызывает ValidationError."""
        config = [
            {
                "key": "invalid key",
                "type": "custom_text",
                "label": "Тест",
            },
        ]
        with pytest.raises(serializers.ValidationError):
            validate_column_config(config)

    def test_invalid_key_starts_with_digit(self):
        """Ключ начинающийся с цифры вызывает ValidationError."""
        config = [
            {
                "key": "1abc",
                "type": "custom_text",
                "label": "Тест",
            },
        ]
        with pytest.raises(serializers.ValidationError):
            validate_column_config(config)

    def test_cycle_detection(self):
        """Циклические зависимости формул вызывают ValidationError."""
        config = [
            {
                "key": "quantity",
                "type": "builtin",
                "builtin_field": "quantity",
                "label": "Кол-во",
            },
            {
                "key": "col_a",
                "type": "formula",
                "formula": "col_b + 1",
                "label": "A",
            },
            {
                "key": "col_b",
                "type": "formula",
                "formula": "col_a + 1",
                "label": "B",
            },
        ]
        with pytest.raises(serializers.ValidationError) as exc_info:
            validate_column_config(config)
        errors = exc_info.value.detail
        # Должно содержать упоминание цикла
        assert any("цикл" in str(e).lower() for e in errors)

    def test_empty_config_passes(self):
        """Пустая конфигурация допустима."""
        assert validate_column_config([]) == []
        assert validate_column_config(None) is None

    def test_duplicate_keys(self):
        """Дублирующиеся ключи вызывают ValidationError."""
        config = [
            {
                "key": "name",
                "type": "builtin",
                "builtin_field": "name",
                "label": "Имя 1",
            },
            {
                "key": "name",
                "type": "builtin",
                "builtin_field": "name",
                "label": "Имя 2",
            },
        ]
        with pytest.raises(serializers.ValidationError):
            validate_column_config(config)

    def test_invalid_column_type(self):
        """Недопустимый тип столбца вызывает ValidationError."""
        config = [
            {
                "key": "test",
                "type": "nonexistent_type",
                "label": "Тест",
            },
        ]
        with pytest.raises(serializers.ValidationError):
            validate_column_config(config)

    def test_custom_select_without_options(self):
        """custom_select без options вызывает ValidationError."""
        config = [
            {
                "key": "status",
                "type": "custom_select",
                "label": "Статус",
            },
        ]
        with pytest.raises(serializers.ValidationError):
            validate_column_config(config)
