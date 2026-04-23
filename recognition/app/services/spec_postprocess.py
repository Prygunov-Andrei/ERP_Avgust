"""Post-process hooks для E15-06: safety-net поверх LLM нормализации.

1. `apply_no_qty_merge` (QA #51/#53) — склеить «продолжения» имени, которые
   LLM по какой-то причине выдал отдельными items. Эвристика: если у item
   quantity=0 И unit пуст И name начинается с lowercase / предлога /
   характерного прилагательного — это орфан, который должен был приклеиться
   к предыдущему item.

2. `cap_sticky_name` (QA #55) — отрезать sticky parent name у items, где он
   был применён к НЕ-серийной позиции. Sticky разрешён только когда текущая
   name содержит variant-marker (буквы + цифра): ПН2, ПД1, КВО-10 и т.п.
   Если LLM приписал sticky «Решётка» к «Воздуховод 250х100» — это ошибка.
"""

from __future__ import annotations

import re

from .spec_normalizer import NormalizedItem

# Предлоги / союзы которые однозначно начинают continuation.
_CONTINUATION_PREFIXES = (
    "с ", "на ", "в ", "под ", "для ", "из ", "над ", "при ", "через ",
    "со ", "во ", "ко ", "без ",
)

# Прилагательные в начале continuation-фрагментов (нижний регистр
# гарантирован is-lowercase проверкой выше, но регистронезависимо
# нужен на случай когда LLM сохраняет заглавную).
_CONTINUATION_ADJECTIVES_RE = re.compile(
    r"^(круглый|круглое|круглая|круглые|круглых|"
    r"морозостойкий|морозостойкие|морозостойких|"
    r"оцинкованный|оцинкованные|оцинкованных|оцинкованный|"
    r"защитный|защитное|защитная|защитные|защитных|"
    r"прямоугольный|прямоугольные|квадратный|квадратные|"
    r"стальной|стальные|стальных|"
    r"гибкий|гибкие|гибких|"
    r"утеплённый|утеплённые|утеплённых|утепленный|утепленные)\b",
    re.IGNORECASE,
)


def _looks_like_continuation(name: str) -> bool:
    """True если name выглядит как продолжение предыдущего item-а."""
    s = name.strip()
    if not s:
        return False
    if s[0].islower():
        return True
    lower = s.lower()
    if any(lower.startswith(p) for p in _CONTINUATION_PREFIXES):
        return True
    if _CONTINUATION_ADJECTIVES_RE.match(s):
        return True
    return False


def apply_no_qty_merge(items: list[NormalizedItem]) -> list[NormalizedItem]:
    """QA #51/#53: merge continuation-строк в предыдущий item.

    Правила merge (ЛЮБОЕ из двух триггерит склейку):

    (A) Классический «остаток» — quantity==0 И пустой unit И name выглядит
        как continuation (lowercase / предлог / continuation-прилагательное).

    (B) LLM-copy-qty артефакт — LLM иногда копирует qty+unit из предыдущей
        row в continuation-row (потому что в bbox-rows continuation сидит
        рядом с полной строкой). Признаки: (1) name выглядит как
        continuation, (2) qty И unit СОВПАДАЮТ с предыдущим item'ом,
        (3) у current item нет собственного model_name и brand/manufacturer
        (полноценная позиция всегда имеет хотя бы model или brand). В этом
        случае это не отдельная позиция, а продолжение имени.

    Первый item, даже если по виду похож на continuation, сохраняется как
    есть (некуда приклеивать).
    """
    if not items:
        return items
    out: list[NormalizedItem] = [items[0]]
    for item in items[1:]:
        qty = item.quantity or 0
        unit = (item.unit or "").strip()
        name_is_cont = _looks_like_continuation(item.name)

        # (A) no-qty & no-unit continuation.
        if name_is_cont and qty == 0 and unit == "":
            prev = out[-1]
            prev.name = f"{prev.name.rstrip()} {item.name.strip()}".strip()
            continue

        # (B) LLM-copy-qty: qty/unit совпадают с предком, пустой model/brand.
        if name_is_cont:
            prev = out[-1]
            prev_qty = prev.quantity or 0
            prev_unit = (prev.unit or "").strip()
            no_identity = not (item.model_name or item.brand or item.manufacturer)
            if (
                no_identity
                and prev_qty > 0
                and abs(qty - prev_qty) < 1e-6
                and unit == prev_unit
            ):
                prev.name = f"{prev.name.rstrip()} {item.name.strip()}".strip()
                continue

        out.append(item)
    return out


# ---------------------------------------------------------------------------
# QA #55 — sticky-name cap для не-серийных позиций
# ---------------------------------------------------------------------------
#
# variant-marker: буквенный (латиница/кириллица) префикс длиной 1–4 символа,
# затем опциональный разделитель (`-`, ` `, `.`), цифра. Примеры «да»:
# ПН2, ПД1, В1-3, ПК 4,5, КВО-10, АПК-10, КПУ2. Примеры «нет»: «Воздуховод»,
# «250х100», «Защитный козырёк» — НЕ содержат (букв+цифра) в начале.
_VARIANT_MARKER_RE = re.compile(r"^[A-Za-zА-Яа-яЁё]{1,4}[-\s.]?\d", re.UNICODE)


def _has_variant_marker(name: str) -> bool:
    """True если name начинается с кода-варианта (серия)."""
    s = (name or "").strip()
    if not s:
        return False
    return bool(_VARIANT_MARKER_RE.match(s))


def cap_sticky_name(
    items: list[NormalizedItem],
    *,
    initial_sticky: str = "",
) -> list[NormalizedItem]:
    """QA #55: отрезать sticky parent name у non-series items.

    Эвристика: если у item.name есть «parent sticky» (совпадает с предыдущим
    item.name или с initial_sticky, пришедшим с входа страницы), и при этом
    current item НЕ содержит variant-marker в оставшемся хвосте → sticky
    применился ошибочно, убираем его.

    В реальности LLM формирует name как единую строку («Решётка воздуховод
    250х100»), а не «parent + child». Поэтому мы проверяем: начинается ли
    name с known-sticky-parent, и если да — остаток не содержит variant-
    marker → режем sticky.

    Работает чисто защитно: если parent не определяется ни как повтор
    предыдущего, ни как initial_sticky — ничего не трогаем.
    """
    if not items:
        return items

    out: list[NormalizedItem] = []
    last_full_name = initial_sticky.strip() if initial_sticky else ""
    last_real_base: str = last_full_name  # «база» серии — то, что может стать sticky
    for item in items:
        original = item.name.strip()
        if not original:
            out.append(item)
            continue

        # Кандидаты на sticky-parent, с которого могло начаться item.name:
        # 1) base предыдущей серии (если у предыдущего name содержал variant-marker
        #    — например «Клапан КПУ2» → sticky-база «Клапан»);
        # 2) full name предыдущего item (если предыдущий сам был головой серии);
        # 3) initial_sticky со входа страницы.
        candidates: list[str] = []
        if last_real_base:
            candidates.append(last_real_base)
        if last_full_name and last_full_name != last_real_base:
            candidates.append(last_full_name)

        stripped = original
        sticky_applied = ""
        for cand in candidates:
            c = cand.strip()
            if not c:
                continue
            # current item начинается с candidate + space → sticky-применение.
            if stripped.startswith(c + " "):
                remainder = stripped[len(c):].lstrip()
                # Отрезаем sticky ТОЛЬКО если:
                #   (a) остаток начинается с БУКВЫ (т.е. это другое имя,
                #       а не размеры/артикул/variant-code),
                #   (b) остаток НЕ начинается с variant-marker (буква+цифра —
                #       это series, sticky легитимен),
                #   (c) остаток — осмысленная фраза длиной ≥ 4 символов.
                #
                # Если remainder начинается с цифры («250х100», «1,5») — это
                # размеры-продолжение legitimate parent'а, sticky не режем.
                remainder_safe = (
                    len(remainder) >= 4
                    and remainder[0].isalpha()
                    and not _has_variant_marker(remainder)
                )
                if remainder_safe:
                    sticky_applied = c
                    stripped = remainder
                break

        if sticky_applied:
            item.name = stripped[:500]

        # Обновляем контекст для следующей итерации.
        last_full_name = item.name.strip()
        # Базой серии считаем «head» имени до первого variant-marker-слова.
        # Если текущий name начинается с variant-marker → он сам — голова серии,
        # и base = пусто (sticky будет сброшен на следующей ИТОГОВОЙ голове).
        if _has_variant_marker(last_full_name):
            # Например «ПН2-4,5-Решётка» — это variant, base = то, что перед
            # variant-marker'ом, т.е. пусто. Но такие items обычно не дают
            # sticky-родителя, они сами являются вариантом.
            last_real_base = ""
        else:
            last_real_base = last_full_name

        out.append(item)

    return out
