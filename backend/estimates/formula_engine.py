"""
Безопасный вычислитель формул для настраиваемых столбцов сметы.
Реализация: токенизатор + рекурсивный спуск (без eval/exec).

Поддерживает: +, -, *, /, (), числовые литералы, ссылки на столбцы,
функции round(), max(), min(), abs().
"""

import re
from decimal import Decimal, InvalidOperation, DivisionByZero
from enum import Enum, auto
from typing import NamedTuple


class FormulaError(Exception):
    """Ошибка парсинга или вычисления формулы."""
    pass


class CycleError(FormulaError):
    """Циклическая зависимость в формулах."""
    pass


class TokenType(Enum):
    NUMBER = auto()
    IDENT = auto()
    PLUS = auto()
    MINUS = auto()
    MUL = auto()
    DIV = auto()
    LPAREN = auto()
    RPAREN = auto()
    COMMA = auto()
    EOF = auto()


class Token(NamedTuple):
    type: TokenType
    value: str


_MAX_FORMULA_LEN = 500
_TOKEN_RE = re.compile(
    r'\s*(?:'
    r'(\d+(?:\.\d+)?)'   # number
    r'|([a-z_][a-z0-9_]*)' # identifier
    r'|(\+)'              # +
    r'|(-)'               # -
    r'|(\*)'              # *
    r'|(/)'               # /
    r'|(\()'              # (
    r'|(\))'              # )
    r'|(,)'               # ,
    r')\s*'
)

_FUNCTIONS = {'round', 'max', 'min', 'abs'}


def tokenize(formula: str) -> list[Token]:
    """Разбить формулу на токены. Бросает FormulaError при невалидном вводе."""
    if not formula or not formula.strip():
        raise FormulaError('Пустая формула')
    if len(formula) > _MAX_FORMULA_LEN:
        raise FormulaError(f'Формула слишком длинная (>{_MAX_FORMULA_LEN} символов)')

    tokens: list[Token] = []
    pos = 0
    while pos < len(formula):
        m = _TOKEN_RE.match(formula, pos)
        if not m:
            raise FormulaError(f'Неожиданный символ на позиции {pos}: {formula[pos]!r}')
        if m.group(1) is not None:
            tokens.append(Token(TokenType.NUMBER, m.group(1)))
        elif m.group(2) is not None:
            tokens.append(Token(TokenType.IDENT, m.group(2)))
        elif m.group(3) is not None:
            tokens.append(Token(TokenType.PLUS, '+'))
        elif m.group(4) is not None:
            tokens.append(Token(TokenType.MINUS, '-'))
        elif m.group(5) is not None:
            tokens.append(Token(TokenType.MUL, '*'))
        elif m.group(6) is not None:
            tokens.append(Token(TokenType.DIV, '/'))
        elif m.group(7) is not None:
            tokens.append(Token(TokenType.LPAREN, '('))
        elif m.group(8) is not None:
            tokens.append(Token(TokenType.RPAREN, ')'))
        elif m.group(9) is not None:
            tokens.append(Token(TokenType.COMMA, ','))
        pos = m.end()

    tokens.append(Token(TokenType.EOF, ''))
    return tokens


class _Parser:
    """Рекурсивный спуск: expr → term ((+|-) term)*
       term → unary ((*|/) unary)*
       unary → (-) unary | atom
       atom → NUMBER | IDENT | func(args) | (expr)"""

    def __init__(self, tokens: list[Token], variables: dict[str, Decimal]):
        self.tokens = tokens
        self.variables = variables
        self.pos = 0

    def _peek(self) -> Token:
        return self.tokens[self.pos]

    def _advance(self) -> Token:
        t = self.tokens[self.pos]
        self.pos += 1
        return t

    def _expect(self, tt: TokenType) -> Token:
        t = self._advance()
        if t.type != tt:
            raise FormulaError(f'Ожидался {tt.name}, получен {t.type.name} ({t.value!r})')
        return t

    def parse(self) -> Decimal:
        result = self._expr()
        if self._peek().type != TokenType.EOF:
            raise FormulaError(f'Неожиданный токен: {self._peek().value!r}')
        return result

    def _expr(self) -> Decimal:
        left = self._term()
        while self._peek().type in (TokenType.PLUS, TokenType.MINUS):
            op = self._advance()
            right = self._term()
            if op.type == TokenType.PLUS:
                left = left + right
            else:
                left = left - right
        return left

    def _term(self) -> Decimal:
        left = self._unary()
        while self._peek().type in (TokenType.MUL, TokenType.DIV):
            op = self._advance()
            right = self._unary()
            if op.type == TokenType.MUL:
                left = left * right
            else:
                try:
                    left = left / right
                except (DivisionByZero, InvalidOperation):
                    return Decimal('0')
        return left

    def _unary(self) -> Decimal:
        if self._peek().type == TokenType.MINUS:
            self._advance()
            return -self._unary()
        return self._atom()

    def _atom(self) -> Decimal:
        t = self._peek()

        if t.type == TokenType.NUMBER:
            self._advance()
            return Decimal(t.value)

        if t.type == TokenType.IDENT:
            self._advance()
            name = t.value

            # Function call
            if self._peek().type == TokenType.LPAREN and name in _FUNCTIONS:
                return self._call_function(name)

            # Variable reference
            if name not in self.variables:
                raise FormulaError(f'Неизвестная переменная: {name}')
            return self.variables[name]

        if t.type == TokenType.LPAREN:
            self._advance()
            result = self._expr()
            self._expect(TokenType.RPAREN)
            return result

        raise FormulaError(f'Неожиданный токен: {t.value!r} ({t.type.name})')

    def _call_function(self, name: str) -> Decimal:
        self._expect(TokenType.LPAREN)
        args: list[Decimal] = [self._expr()]
        while self._peek().type == TokenType.COMMA:
            self._advance()
            args.append(self._expr())
        self._expect(TokenType.RPAREN)

        if name == 'round':
            if len(args) == 1:
                return args[0].quantize(Decimal('1'))
            elif len(args) == 2:
                places = int(args[1])
                return args[0].quantize(Decimal(10) ** -places)
            raise FormulaError('round() принимает 1 или 2 аргумента')
        elif name == 'max':
            if not args:
                raise FormulaError('max() требует хотя бы 1 аргумент')
            return max(args)
        elif name == 'min':
            if not args:
                raise FormulaError('min() требует хотя бы 1 аргумент')
            return min(args)
        elif name == 'abs':
            if len(args) != 1:
                raise FormulaError('abs() принимает ровно 1 аргумент')
            return abs(args[0])

        raise FormulaError(f'Неизвестная функция: {name}')


def evaluate_formula(formula: str, variables: dict[str, Decimal]) -> Decimal:
    """Вычислить формулу с заданными переменными. Бросает FormulaError."""
    tokens = tokenize(formula)
    parser = _Parser(tokens, variables)
    return parser.parse()


def get_formula_dependencies(formula: str) -> set[str]:
    """Извлечь имена переменных, используемых в формуле."""
    tokens = tokenize(formula)
    deps: set[str] = set()
    for i, token in enumerate(tokens):
        if token.type == TokenType.IDENT and token.value not in _FUNCTIONS:
            deps.add(token.value)
    return deps


def topological_sort(columns: list[dict]) -> list[dict]:
    """Топологическая сортировка столбцов по зависимостям формул.
    Бросает CycleError при циклических зависимостях.
    Возвращает список в порядке вычисления (зависимости сначала)."""
    formula_cols = {c['key']: c for c in columns if c.get('type') == 'formula' and c.get('formula')}
    if not formula_cols:
        return columns

    # Build dependency graph
    deps: dict[str, set[str]] = {}
    for key, col in formula_cols.items():
        try:
            deps[key] = get_formula_dependencies(col['formula']) & set(formula_cols.keys())
        except FormulaError:
            deps[key] = set()

    # Kahn's algorithm
    in_degree = {k: 0 for k in formula_cols}
    for key, dep_set in deps.items():
        for dep in dep_set:
            if dep in in_degree:
                in_degree[key] += 1

    queue = [k for k, d in in_degree.items() if d == 0]
    sorted_keys: list[str] = []

    while queue:
        node = queue.pop(0)
        sorted_keys.append(node)
        for key, dep_set in deps.items():
            if node in dep_set:
                in_degree[key] -= 1
                if in_degree[key] == 0:
                    queue.append(key)

    if len(sorted_keys) != len(formula_cols):
        remaining = set(formula_cols.keys()) - set(sorted_keys)
        raise CycleError(f'Циклическая зависимость в формулах: {", ".join(remaining)}')

    # Reconstruct full list: non-formula first, then formulas in order
    non_formula = [c for c in columns if c['key'] not in formula_cols]
    return non_formula + [formula_cols[k] for k in sorted_keys]


def validate_formula(formula: str, available_keys: set[str]) -> list[str]:
    """Валидировать формулу. Возвращает список ошибок (пустой = OK)."""
    errors: list[str] = []
    try:
        tokens = tokenize(formula)
    except FormulaError as e:
        errors.append(str(e))
        return errors

    for token in tokens:
        if token.type == TokenType.IDENT and token.value not in _FUNCTIONS:
            if token.value not in available_keys:
                errors.append(f'Неизвестная переменная: {token.value}')

    # Try to parse (catch syntax errors)
    try:
        dummy_vars = {k: Decimal('1') for k in available_keys}
        _Parser(tokens, dummy_vars).parse()
    except FormulaError as e:
        errors.append(str(e))

    return errors


def compute_all_formulas(
    columns: list[dict],
    builtin_values: dict[str, Decimal],
    custom_data: dict[str, str],
) -> dict[str, Decimal | None]:
    """Вычислить все formula-столбцы для одной строки.
    Возвращает dict { key: Decimal | None }."""
    sorted_cols = topological_sort(columns)
    variables: dict[str, Decimal] = dict(builtin_values)

    # Add custom data as variables
    for col in columns:
        if col.get('type') == 'custom_number' and col['key'] in custom_data:
            try:
                variables[col['key']] = Decimal(str(custom_data[col['key']]))
            except (InvalidOperation, ValueError):
                variables[col['key']] = Decimal('0')

    results: dict[str, Decimal | None] = {}
    for col in sorted_cols:
        if col.get('type') != 'formula' or not col.get('formula'):
            continue
        try:
            value = evaluate_formula(col['formula'], variables)
            dp = col.get('decimal_places')
            if dp is not None:
                value = value.quantize(Decimal(10) ** -dp)
            results[col['key']] = value
            variables[col['key']] = value
        except FormulaError:
            results[col['key']] = None

    return results
