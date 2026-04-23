"""Unit-тесты post-process E15-06:
- apply_no_qty_merge (QA #51, #53)
- cap_sticky_name (QA #55)
"""

from __future__ import annotations

from app.services.spec_normalizer import NormalizedItem
from app.services.spec_postprocess import (
    _has_variant_marker,
    _looks_like_continuation,
    apply_no_qty_merge,
    cap_sticky_name,
)


def _mk(
    name: str, *, qty: float = 1.0, unit: str = "шт", model: str = ""
) -> NormalizedItem:
    return NormalizedItem(name=name, quantity=qty, unit=unit, model_name=model)


class TestLooksLikeContinuation:
    def test_lowercase_start(self):
        assert _looks_like_continuation("на узле прохода УП1")
        assert _looks_like_continuation("с решёткой")

    def test_prepositions(self):
        for p in ["с ", "со ", "на ", "в ", "во ", "под ", "для ", "из ",
                 "над ", "при ", "через ", "без ", "ко "]:
            assert _looks_like_continuation(p + "чем-то"), p

    def test_adjectives(self):
        assert _looks_like_continuation("Круглый")
        assert _looks_like_continuation("МОРОЗОСТОЙКИЙ")
        assert _looks_like_continuation("оцинкованный")

    def test_normal_name_not_continuation(self):
        assert not _looks_like_continuation("Воздуховод 250х100")
        assert not _looks_like_continuation("Дефлектор Цаги")
        assert not _looks_like_continuation("Клапан КПУ2")

    def test_empty(self):
        assert not _looks_like_continuation("")
        assert not _looks_like_continuation("   ")


class TestApplyNoQtyMerge:
    def test_merge_continuation_lowercase(self):
        items = [
            _mk("Дефлектор Цаги", qty=1, unit="шт"),
            _mk("на узле прохода УП1", qty=0, unit=""),
        ]
        result = apply_no_qty_merge(items)
        assert len(result) == 1
        assert result[0].name == "Дефлектор Цаги на узле прохода УП1"

    def test_merge_preposition_с(self):
        items = [
            _mk("Клапан КПУ2", qty=5, unit="шт"),
            _mk("с решёткой", qty=0, unit=""),
        ]
        result = apply_no_qty_merge(items)
        assert len(result) == 1
        assert result[0].name == "Клапан КПУ2 с решёткой"

    def test_merge_adjective(self):
        items = [
            _mk("Воздуховод ВД1", qty=3, unit="м"),
            _mk("круглый морозостойкий", qty=0, unit=""),
        ]
        result = apply_no_qty_merge(items)
        assert len(result) == 1
        assert result[0].name == "Воздуховод ВД1 круглый морозостойкий"

    def test_no_merge_when_qty_positive(self):
        items = [
            _mk("Клапан КПУ2", qty=5, unit="шт"),
            _mk("с решёткой", qty=1, unit="шт"),
        ]
        result = apply_no_qty_merge(items)
        assert len(result) == 2

    def test_no_merge_when_unit_present(self):
        items = [
            _mk("Клапан КПУ2", qty=5, unit="шт"),
            # unit есть → не continuation, даже если qty=0.
            _mk("с решёткой", qty=0, unit="шт"),
        ]
        result = apply_no_qty_merge(items)
        assert len(result) == 2

    def test_no_merge_when_capital_start(self):
        items = [
            _mk("Воздуховод 250х100", qty=3, unit="м"),
            _mk("Воздуховод 315х160", qty=2, unit="м"),
        ]
        result = apply_no_qty_merge(items)
        assert len(result) == 2

    def test_no_merge_first_item_orphan(self):
        # Первый item сам похож на continuation — оставить как есть.
        items = [
            _mk("с решёткой", qty=0, unit=""),
            _mk("Воздуховод", qty=2, unit="м"),
        ]
        result = apply_no_qty_merge(items)
        assert len(result) == 2
        assert result[0].name == "с решёткой"

    def test_empty_input(self):
        assert apply_no_qty_merge([]) == []

    def test_llm_copy_qty_artefact_merged(self):
        # Живой артефакт из ov2 p1: LLM скопировал qty=58 / unit=шт в
        # continuation-row «на узле прохода УП1». Нет model/brand — склеиваем.
        items = [
            _mk("Дефлектор Цаги", qty=58, unit="шт"),
            _mk("на узле прохода УП1", qty=58, unit="шт"),
        ]
        result = apply_no_qty_merge(items)
        assert len(result) == 1
        assert result[0].name == "Дефлектор Цаги на узле прохода УП1"
        assert result[0].quantity == 58

    def test_llm_copy_qty_not_merged_when_model_present(self):
        # Если у continuation-looking item есть свой model_name — это
        # НЕ continuation, не склеиваем (защита от ложных срабатываний).
        items = [
            _mk("Клапан КПУ2", qty=5, unit="шт"),
            _mk("с решёткой", qty=5, unit="шт", model="РЕШ-250"),
        ]
        result = apply_no_qty_merge(items)
        assert len(result) == 2

    def test_llm_copy_qty_not_merged_when_qty_differs(self):
        items = [
            _mk("Дефлектор Цаги", qty=58, unit="шт"),
            _mk("на узле прохода УП1", qty=5, unit="шт"),
        ]
        result = apply_no_qty_merge(items)
        # Разные qty → это отдельный item, не продолжение.
        assert len(result) == 2

    def test_multiple_continuations(self):
        items = [
            _mk("Вентилятор ВР", qty=1, unit="шт"),
            _mk("с глушителем", qty=0, unit=""),
            _mk("и крышей", qty=0, unit=""),
        ]
        result = apply_no_qty_merge(items)
        assert len(result) == 1
        assert result[0].name == "Вентилятор ВР с глушителем и крышей"


class TestVariantMarker:
    def test_variant_patterns(self):
        assert _has_variant_marker("ПН2")
        assert _has_variant_marker("ПД1")
        assert _has_variant_marker("В1-3")
        assert _has_variant_marker("КВО-10")
        assert _has_variant_marker("АПК-10")
        assert _has_variant_marker("ПК 4,5")
        assert _has_variant_marker("КПУ2")

    def test_not_variant(self):
        assert not _has_variant_marker("Воздуховод")
        assert not _has_variant_marker("Решётка")
        assert not _has_variant_marker("250х100")
        assert not _has_variant_marker("")


class TestCapStickyName:
    def test_no_sticky_applied(self):
        items = [
            _mk("Воздуховод 250х100", qty=3, unit="м"),
            _mk("Воздуховод 315х160", qty=2, unit="м"),
        ]
        result = cap_sticky_name(items)
        assert result[0].name == "Воздуховод 250х100"
        assert result[1].name == "Воздуховод 315х160"

    def test_sticky_series_preserved(self):
        # Серия ПН1, ПН2, ПН3 после головы — sticky легитимен.
        items = [
            _mk("Клапан ПН1", qty=1),
            _mk("Клапан ПН2", qty=1),
            _mk("Клапан ПН3", qty=1),
        ]
        result = cap_sticky_name(items)
        # Серия не должна потерять «Клапан».
        assert all(r.name.startswith("Клапан ПН") for r in result)

    def test_sticky_removed_from_non_series(self):
        # Предыдущий item «Решётка», текущий «Решётка Воздуховод 250х100» —
        # sticky «Решётка» прилип ошибочно, остаток «Воздуховод…» не имеет
        # variant-marker'а → режем sticky.
        items = [
            _mk("Решётка", qty=1, model="ПН2-4,5"),
            _mk("Решётка Воздуховод 250х100", qty=3, unit="м"),
        ]
        result = cap_sticky_name(items)
        assert result[0].name == "Решётка"
        assert result[1].name == "Воздуховод 250х100"

    def test_initial_sticky_removed(self):
        # Page-boundary carry-over: initial_sticky «Решётка» пришёл с
        # предыдущей страницы, первый item «Решётка Воздуховод…».
        items = [_mk("Решётка Воздуховод 315х160", qty=2, unit="м")]
        result = cap_sticky_name(items, initial_sticky="Решётка")
        assert result[0].name == "Воздуховод 315х160"

    def test_initial_sticky_kept_for_series(self):
        # Если после initial_sticky идёт реальный variant — sticky легитимен.
        items = [_mk("Решётка ПН2-4,5", qty=1)]
        result = cap_sticky_name(items, initial_sticky="Решётка")
        # variant-marker ПН2 после sticky → не режем.
        assert result[0].name == "Решётка ПН2-4,5"

    def test_empty_items(self):
        assert cap_sticky_name([]) == []
