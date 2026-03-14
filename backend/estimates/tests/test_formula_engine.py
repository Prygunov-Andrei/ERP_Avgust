"""
Тесты для formula_engine.py — безопасный вычислитель формул.
~18 тест-кейсов.
"""
from decimal import Decimal
from django.test import TestCase

from estimates.formula_engine import (
    evaluate_formula,
    get_formula_dependencies,
    topological_sort,
    validate_formula,
    compute_all_formulas,
    FormulaError,
    CycleError,
)


class TestEvaluateFormula(TestCase):
    """Тесты вычисления формул."""

    def test_basic_addition(self):
        self.assertEqual(evaluate_formula('2 + 3', {}), Decimal('5'))

    def test_basic_multiplication(self):
        self.assertEqual(evaluate_formula('10 * 5', {}), Decimal('50'))

    def test_basic_division(self):
        self.assertEqual(evaluate_formula('100 / 4', {}), Decimal('25'))

    def test_basic_subtraction(self):
        self.assertEqual(evaluate_formula('50 - 20', {}), Decimal('30'))

    def test_operator_precedence(self):
        """2 + 3 * 4 = 14 (не 20)."""
        self.assertEqual(evaluate_formula('2 + 3 * 4', {}), Decimal('14'))

    def test_parentheses(self):
        self.assertEqual(evaluate_formula('(2 + 3) * 4', {}), Decimal('20'))

    def test_nested_parentheses(self):
        self.assertEqual(evaluate_formula('((2 + 3) * (4 - 1))', {}), Decimal('15'))

    def test_unary_minus(self):
        self.assertEqual(evaluate_formula('-5 + 3', {}), Decimal('-2'))

    def test_function_round_one_arg(self):
        result = evaluate_formula('round(3.7)', {})
        self.assertEqual(result, Decimal('4'))

    def test_function_round_two_args(self):
        result = evaluate_formula('round(3.14159, 2)', {})
        self.assertEqual(result, Decimal('3.14'))

    def test_function_max(self):
        self.assertEqual(evaluate_formula('max(1, 5, 3)', {}), Decimal('5'))

    def test_function_min(self):
        self.assertEqual(evaluate_formula('min(10, 3, 7)', {}), Decimal('3'))

    def test_function_abs(self):
        self.assertEqual(evaluate_formula('abs(-5)', {}), Decimal('5'))

    def test_variable_reference(self):
        result = evaluate_formula(
            'quantity * material_unit_price',
            {'quantity': Decimal('10'), 'material_unit_price': Decimal('500')},
        )
        self.assertEqual(result, Decimal('5000'))

    def test_division_by_zero_returns_zero(self):
        """Деление на 0 — graceful, возвращает 0."""
        result = evaluate_formula('10 / 0', {})
        self.assertEqual(result, Decimal('0'))

    def test_unknown_variable_raises(self):
        with self.assertRaises(FormulaError) as ctx:
            evaluate_formula('unknown_var + 1', {})
        self.assertIn('unknown_var', str(ctx.exception))

    def test_syntax_error_unclosed_paren(self):
        with self.assertRaises(FormulaError):
            evaluate_formula('(2 + 3', {})

    def test_empty_formula_raises(self):
        with self.assertRaises(FormulaError):
            evaluate_formula('', {})

    def test_too_long_formula_raises(self):
        with self.assertRaises(FormulaError):
            evaluate_formula('x + ' * 200, {'x': Decimal('1')})

    def test_injection_attempt(self):
        """Попытка инъекции через __import__ — должна провалиться."""
        with self.assertRaises(FormulaError):
            evaluate_formula("__import__('os')", {})


class TestGetFormulaDependencies(TestCase):

    def test_extracts_variables(self):
        deps = get_formula_dependencies('quantity * material_unit_price + markup')
        self.assertEqual(deps, {'quantity', 'material_unit_price', 'markup'})

    def test_ignores_functions(self):
        deps = get_formula_dependencies('round(quantity * 1.2, 2)')
        self.assertEqual(deps, {'quantity'})


class TestTopologicalSort(TestCase):

    def test_sorts_dependencies(self):
        columns = [
            {'key': 'a', 'type': 'builtin'},
            {'key': 'c', 'type': 'formula', 'formula': 'a + b'},
            {'key': 'b', 'type': 'formula', 'formula': 'a * 2'},
        ]
        result = topological_sort(columns)
        keys = [c['key'] for c in result]
        self.assertLess(keys.index('b'), keys.index('c'))

    def test_cycle_detection(self):
        columns = [
            {'key': 'a', 'type': 'formula', 'formula': 'b + 1'},
            {'key': 'b', 'type': 'formula', 'formula': 'a + 1'},
        ]
        with self.assertRaises(CycleError):
            topological_sort(columns)


class TestValidateFormula(TestCase):

    def test_valid_formula(self):
        errors = validate_formula('quantity * 1.2', {'quantity', 'price'})
        self.assertEqual(errors, [])

    def test_unknown_variable(self):
        errors = validate_formula('unknown_var * 2', {'quantity'})
        self.assertTrue(any('unknown_var' in e for e in errors))

    def test_syntax_error(self):
        errors = validate_formula('2 + + 3', {'x'})
        self.assertTrue(len(errors) > 0)


class TestComputeAllFormulas(TestCase):

    def test_chain_computation(self):
        """Формула B зависит от формулы A."""
        columns = [
            {'key': 'quantity', 'type': 'builtin'},
            {'key': 'price', 'type': 'builtin'},
            {'key': 'subtotal', 'type': 'formula', 'formula': 'quantity * price'},
            {'key': 'total', 'type': 'formula', 'formula': 'subtotal * 1.2', 'decimal_places': 2},
        ]
        builtin_values = {'quantity': Decimal('10'), 'price': Decimal('500')}
        results = compute_all_formulas(columns, builtin_values, {})
        self.assertEqual(results['subtotal'], Decimal('5000'))
        self.assertEqual(results['total'], Decimal('6000.00'))

    def test_custom_number_in_formula(self):
        """Формула ссылается на custom_number столбец."""
        columns = [
            {'key': 'line_total', 'type': 'builtin'},
            {'key': 'markup_pct', 'type': 'custom_number'},
            {'key': 'with_markup', 'type': 'formula', 'formula': 'line_total * (1 + markup_pct / 100)', 'decimal_places': 2},
        ]
        builtin_values = {'line_total': Decimal('1000')}
        custom_data = {'markup_pct': '20'}
        results = compute_all_formulas(columns, builtin_values, custom_data)
        self.assertEqual(results['with_markup'], Decimal('1200.00'))

    def test_formula_error_returns_none(self):
        """При ошибке в формуле — None, не exception."""
        columns = [
            {'key': 'bad', 'type': 'formula', 'formula': 'nonexistent * 2'},
        ]
        results = compute_all_formulas(columns, {}, {})
        self.assertIsNone(results['bad'])
