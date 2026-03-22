"""
Расширенные тесты для core/validators.py — validate_positive_amount,
validate_non_negative, validate_max_digits_18_2.
"""
from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError

from core.validators import (
    validate_positive_amount,
    validate_non_negative,
    validate_max_digits_18_2,
)


class TestValidatePositiveAmount:
    def test_positive_value_passes(self):
        validate_positive_amount(Decimal('100.50'))

    def test_zero_passes(self):
        validate_positive_amount(Decimal('0'))
        validate_positive_amount(0)

    def test_none_passes(self):
        validate_positive_amount(None)

    def test_negative_raises(self):
        with pytest.raises(ValidationError):
            validate_positive_amount(Decimal('-1'))

    def test_negative_float_raises(self):
        with pytest.raises(ValidationError):
            validate_positive_amount(-0.01)

    def test_large_positive_passes(self):
        validate_positive_amount(Decimal('999999999999.99'))


class TestValidateNonNegative:
    def test_positive_passes(self):
        validate_non_negative(Decimal('1'))

    def test_zero_passes(self):
        validate_non_negative(Decimal('0'))

    def test_none_passes(self):
        validate_non_negative(None)

    def test_negative_raises(self):
        with pytest.raises(ValidationError):
            validate_non_negative(Decimal('-0.01'))


class TestValidateMaxDigits182:
    def test_valid_value_passes(self):
        validate_max_digits_18_2(Decimal('100.50'))

    def test_none_passes(self):
        validate_max_digits_18_2(None)

    def test_integer_passes(self):
        validate_max_digits_18_2(Decimal('100'))

    def test_zero_passes(self):
        validate_max_digits_18_2(Decimal('0'))

    def test_too_many_decimals_raises(self):
        with pytest.raises(ValidationError):
            validate_max_digits_18_2(Decimal('100.123'))

    def test_exactly_two_decimals_passes(self):
        validate_max_digits_18_2(Decimal('100.12'))

    def test_max_value_passes(self):
        validate_max_digits_18_2(Decimal('9999999999999999.99'))

    def test_exceeds_max_value_raises(self):
        with pytest.raises(ValidationError):
            validate_max_digits_18_2(Decimal('10000000000000000.00'))

    def test_negative_within_range_passes(self):
        validate_max_digits_18_2(Decimal('-100.50'))

    def test_negative_exceeds_max_raises(self):
        with pytest.raises(ValidationError):
            validate_max_digits_18_2(Decimal('-10000000000000000.00'))

    def test_string_coercion(self):
        """Значение приводится к Decimal через str()."""
        validate_max_digits_18_2(100.50)
