"""Unit tests for services/pdf_text.py — text-layer parser."""

from dataclasses import dataclass

import fitz

from app.services.pdf_text import (
    UNITS,
    extract_lines,
    has_usable_text_layer,
    is_section_heading,
    is_stamp_line,
    parse_page_items,
    parse_quantity,
)


@dataclass
class FakePage:
    """Минимальный stand-in для fitz.Page — дёшево эмулируем `get_text()`.

    Реальный fitz.insert_text без кастомного Unicode-шрифта не пишет кириллицу,
    поэтому формировать PDF «с нуля» с русским текстом неудобно — подсовываем
    фейк с нужным выводом get_text().
    """

    _text: str

    def get_text(self, *_args: object, **_kwargs: object) -> str:
        return self._text


def _make_page_with_lines(lines: list[str]) -> FakePage:
    return FakePage(_text="\n".join(lines) + "\n")


class TestIsStamp:
    def test_stamp_exact(self):
        assert is_stamp_line("Формат А3")
        assert is_stamp_line("Изм.")
        assert is_stamp_line("Лист")
        assert is_stamp_line("Подп.")
        assert is_stamp_line("ГИП")
        assert is_stamp_line("+10%")
        assert is_stamp_line("2024г.")

    def test_page_number(self):
        assert is_stamp_line("1")
        assert is_stamp_line("42")
        assert is_stamp_line("100")

    def test_doc_code(self):
        assert is_stamp_line("470-05/2025-ОВ2.СО")

    def test_model_not_stamp(self):
        assert not is_stamp_line("KLR-DU-400-80H-5,5x10-HF")
        assert not is_stamp_line("OKL-2D-30-1200х500-S-220-V-S")
        assert not is_stamp_line("УП1-ф355-1000-оц-фл.фл")
        assert not is_stamp_line("Дефлектор Цаги")

    def test_empty(self):
        assert is_stamp_line("")
        assert is_stamp_line("   ")


class TestIsSection:
    def test_section_headings(self):
        assert is_section_heading("Система общеобменной вытяжной вентиляции. Жилая часть.")
        assert is_section_heading("Клапаны на кровле (снаружи)")
        assert is_section_heading("Противодымная вентиляция")
        assert is_section_heading("Отопление встроенных помещений")

    def test_item_names_not_section(self):
        assert not is_section_heading("Дефлектор Цаги")
        assert not is_section_heading("KLR-DU-400-80H-5,5x10-HF")
        assert not is_section_heading("Огнезащитная клеящая смесь")
        assert not is_section_heading("Противопожарная изоляция EI30")


class TestParseQuantity:
    def test_integer(self):
        assert parse_quantity("58") == 58.0

    def test_comma_decimal(self):
        assert parse_quantity("1,5") == 1.5

    def test_approx(self):
        assert parse_quantity("~4900") == 4900.0

    def test_not_number(self):
        assert parse_quantity("шт") is None
        assert parse_quantity("abc") is None
        assert parse_quantity("") is None


class TestHasTextLayer:
    def test_rich_text(self):
        page = _make_page_with_lines(["Строка 1", "Строка 2", "Строка 3", "Строка 4"])
        assert has_usable_text_layer(page, min_chars=10)

    def test_empty_page(self):
        doc = fitz.open()
        page = doc.new_page()
        assert not has_usable_text_layer(page, min_chars=50)
        doc.close()


class TestParsePageItems:
    def test_simple_item(self):
        lines = [
            "Система общеобменной вытяжной вентиляции. Жилая часть.",
            "Дефлектор Цаги",
            "ф355-оц-фл",
            "шт",
            "58",
        ]
        page = _make_page_with_lines(lines)
        items, section = parse_page_items(page, current_section="")
        assert section == "Система общеобменной вытяжной вентиляции. Жилая часть."
        assert len(items) == 1
        assert items[0]["name"] == "Дефлектор Цаги"
        assert items[0]["model_name"] == "ф355-оц-фл"
        assert items[0]["unit"] == "шт"
        assert items[0]["quantity"] == 58.0
        assert items[0]["section_name"] == "Система общеобменной вытяжной вентиляции. Жилая часть."

    def test_multiple_items_same_section(self):
        lines = [
            "Клапаны на кровле (снаружи)",
            "Вентилятор дымоудаления",
            "KLR-DU-400",
            "шт",
            "3",
            "Клапан противопожарный",
            "OKL-2D-30",
            "шт",
            "5",
        ]
        page = _make_page_with_lines(lines)
        items, _ = parse_page_items(page, current_section="")
        assert len(items) == 2
        assert items[0]["section_name"] == "Клапаны на кровле (снаружи)"
        assert items[1]["section_name"] == "Клапаны на кровле (снаружи)"

    def test_inherit_section_from_previous_page(self):
        lines = [
            "Вентилятор дымоудаления",
            "KLR-DU-400",
            "шт",
            "3",
        ]
        page = _make_page_with_lines(lines)
        items, section = parse_page_items(page, current_section="Противодымная вентиляция")
        assert section == "Противодымная вентиляция"
        assert items[0]["section_name"] == "Противодымная вентиляция"

    def test_decimal_quantity(self):
        lines = ["Воздуховод", "ф100", "м.п.", "1,5"]
        page = _make_page_with_lines(lines)
        items, _ = parse_page_items(page, current_section="")
        assert items[0]["quantity"] == 1.5

    def test_stamp_lines_ignored(self):
        lines = [
            "Формат А3",
            "Лист",
            "Вентилятор",
            "VX-100",
            "шт",
            "1",
            "Изм.",
            "Подп.",
        ]
        page = _make_page_with_lines(lines)
        items, _ = parse_page_items(page, current_section="")
        assert len(items) == 1

    def test_multiline_name(self):
        lines = [
            "Моноблочная установка приточная",
            "с рекуператором",
            "UTR 50-25",
            "шт",
            "2",
        ]
        page = _make_page_with_lines(lines)
        items, _ = parse_page_items(page, current_section="")
        assert len(items) == 1
        # name = буфер без последней, model = последняя строка
        assert "Моноблочная установка приточная" in items[0]["name"]
        assert items[0]["model_name"] == "UTR 50-25"

    def test_units_coverage(self):
        """Все ключевые unit-слова распознаются."""
        for unit in ["шт", "м.п.", "м.кв.", "кг", "т", "комплект"]:
            lines = ["Элемент", "Код-1", unit, "10"]
            page = _make_page_with_lines(lines)
            items, _ = parse_page_items(page, current_section="")
            assert len(items) == 1, f"failed for unit {unit!r}"
            assert items[0]["unit"] == unit


def test_units_set_nonempty():
    assert "шт" in UNITS
    assert "м.п." in UNITS


def test_extract_lines_filters_empty():
    page = _make_page_with_lines(["А", "", "Б", "   ", "В"])
    lines = extract_lines(page)
    assert all(ln.strip() for ln in lines)
