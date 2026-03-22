"""
Единые утилиты для нормализации текста и сравнения строк.

Используется в:
- accounting (контрагенты: normalize_name с strip_legal_forms=True)
- catalog (товары: normalize_name без strip_legal_forms)
- contracts, estimates и др. — через Product.normalize_name()
"""

import re
from difflib import SequenceMatcher

# Полные наименования организационно-правовых форм
_LEGAL_FORMS_FULL = [
    'общество с ограниченной ответственностью',
    'акционерное общество',
    'закрытое акционерное общество',
    'открытое акционерное общество',
    'публичное акционерное общество',
    'непубличное акционерное общество',
    'индивидуальный предприниматель',
    'некоммерческая организация',
    'автономная некоммерческая организация',
    'государственное бюджетное учреждение',
    'муниципальное унитарное предприятие',
    'федеральное государственное унитарное предприятие',
]

# Сокращённые формы (ооо, ип, зао и т.д.)
_LEGAL_FORMS_SHORT = [
    'ооо', 'ип', 'зао', 'оао', 'пао', 'нао', 'ао',
    'нко', 'ано', 'гбу', 'муп', 'фгуп',
]


def normalize_name(name: str, *, strip_legal_forms: bool = False) -> str:
    """Нормализация имени: lowercase, strip, удаление спецсимволов.

    Args:
        name: Исходное название.
        strip_legal_forms: Если True — дополнительно убирает юридические
            формы (ООО, ОАО, ИП и т.д.) и кавычки.  Используется для
            контрагентов, но не для товаров.

    Returns:
        Нормализованная строка для сравнения/поиска.
    """
    s = name.lower().strip()

    if strip_legal_forms:
        # Убираем кавычки
        s = re.sub(r'[«»""\'"]', '', s)
        # Убираем полные наименования организационно-правовых форм
        for form in _LEGAL_FORMS_FULL:
            s = s.replace(form, '')
        # Убираем сокращённые формы
        for abbr in _LEGAL_FORMS_SHORT:
            s = re.sub(rf'\b{abbr}\b', '', s)
    else:
        # Удаляем спецсимволы, оставляем буквы, цифры, пробелы
        s = re.sub(r'[^\w\s]', ' ', s)

    # Убираем множественные пробелы
    s = re.sub(r'\s+', ' ', s).strip()
    return s


def name_similarity(a: str, b: str, *, strip_legal_forms: bool = False) -> float:
    """Вычисляет схожесть двух названий (0..1) через SequenceMatcher.

    Args:
        a: Первое название.
        b: Второе название.
        strip_legal_forms: Передаётся в normalize_name().

    Returns:
        Коэффициент схожести от 0.0 до 1.0.
    """
    na = normalize_name(a, strip_legal_forms=strip_legal_forms)
    nb = normalize_name(b, strip_legal_forms=strip_legal_forms)
    return SequenceMatcher(None, na, nb).ratio()
