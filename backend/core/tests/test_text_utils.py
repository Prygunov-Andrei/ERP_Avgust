"""Тесты для core.text_utils."""

import pytest

from core.text_utils import normalize_name, name_similarity


class TestNormalizeName:
    def test_normalize_basic(self):
        """lowercase, strip, collapse spaces."""
        result = normalize_name("  Hello   WORLD  ")
        assert result == "hello world"

    def test_normalize_basic_preserves_letters_digits(self):
        result = normalize_name("Товар-123 (новый)")
        # без strip_legal_forms спецсимволы заменяются на пробелы
        assert result == "товар 123 новый"

    def test_normalize_strips_legal_forms(self):
        """strip_legal_forms=True убирает ООО, ИП и кавычки."""
        result = normalize_name(
            'ООО «Рога и Копыта»', strip_legal_forms=True
        )
        assert "ооо" not in result
        assert "«" not in result
        assert "»" not in result
        assert "рога" in result
        assert "копыта" in result

    def test_normalize_strips_ip(self):
        result = normalize_name("ИП Иванов", strip_legal_forms=True)
        assert "ип" not in result.split()
        assert "иванов" in result

    def test_normalize_keeps_legal_forms(self):
        """strip_legal_forms=False НЕ убирает юридические формы."""
        result = normalize_name("ООО Рога", strip_legal_forms=False)
        assert "ооо" in result

    def test_normalize_strips_quotes(self):
        """strip_legal_forms=True убирает «»""."""
        result = normalize_name(
            '«Компания» "Тест"', strip_legal_forms=True
        )
        assert "«" not in result
        assert "»" not in result
        assert "\u201c" not in result
        assert "\u201d" not in result

    def test_normalize_empty_string(self):
        assert normalize_name("") == ""

    def test_normalize_full_legal_form(self):
        """Полное наименование 'общество с ограниченной ответственностью' убирается."""
        result = normalize_name(
            'Общество с ограниченной ответственностью «Тест»',
            strip_legal_forms=True,
        )
        assert "общество" not in result
        assert "тест" in result


class TestNameSimilarity:
    def test_similarity_identical(self):
        score = name_similarity("Тест", "Тест")
        assert score == 1.0

    def test_similarity_different(self):
        score = name_similarity("Яблоко", "Кирпич")
        assert score < 0.5

    def test_similarity_similar(self):
        """Похожие названия: score > 0.8."""
        score = name_similarity(
            "ООО Стройсервис", "ООО СтройСервис",
        )
        assert score > 0.8

    def test_similarity_case_insensitive(self):
        score = name_similarity("HELLO", "hello")
        assert score == 1.0

    def test_similarity_with_strip_legal_forms(self):
        """С strip_legal_forms похожесть компаний без учёта юр.формы."""
        score = name_similarity(
            'ООО «Альфа»', 'ИП «Альфа»', strip_legal_forms=True
        )
        assert score > 0.8
