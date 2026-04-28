"""Golden set test — invoice-01.pdf (ООО «Фабрика Вентиляции ГалВент»).

4 items (Воздуховоды АЛ-102/160/203/254), total 16 466,25 ₽,
НДС 2 969,33 ₽ (22%). Шапка — бухгалтерский блок с банком сверху.
«в т.ч. НДС» per-item.

Помечен маркером `golden_llm` — требует OPENAI_API_KEY.
"""

import os
from pathlib import Path

import pytest

from app.services.invoice_parser import InvoiceParser

FIXTURE_PDF = (
    Path(__file__).resolve().parent.parent.parent.parent
    / "ismeta"
    / "tests"
    / "fixtures"
    / "golden"
    / "invoice-01.pdf"
)

_LLM_SKIP_REASON = "LLM_API_KEY/OPENAI_API_KEY не задан — skip golden_llm"


@pytest.mark.golden_llm
@pytest.mark.asyncio
@pytest.mark.skipif(not (os.environ.get("LLM_API_KEY") or os.environ.get("OPENAI_API_KEY")), reason=_LLM_SKIP_REASON)
async def test_invoice_01_hybrid_pipeline():
    """E16 it1: Phase 0 title block + bbox extraction + LLM normalize."""
    from app.providers.openai_vision import OpenAIVisionProvider

    assert FIXTURE_PDF.exists(), f"fixture not found: {FIXTURE_PDF}"
    provider = OpenAIVisionProvider()
    try:
        parser = InvoiceParser(provider)
        result = await parser.parse(
            FIXTURE_PDF.read_bytes(), filename=FIXTURE_PDF.name
        )

        assert result.status == "done", f"status={result.status} errors={result.errors}"

        # ---- Items ----
        air_ducts = [it for it in result.items if "Воздуховод" in it.name]
        assert len(air_ducts) == 4, (
            f"ожидалось 4 items-Воздуховода, получено {len(air_ducts)}: "
            f"{[it.name for it in result.items]}"
        )
        for item in air_ducts:
            assert item.unit in ("упак", "упак."), f"unit={item.unit!r}"
            assert item.price_unit > 0
            assert item.price_total > 0
            # invoice-01 имеет per-item НДС (колонка «в т.ч. НДС»).
            assert item.vat_amount > 0, (
                f"item {item.name[:40]!r} vat_amount={item.vat_amount}"
            )

        # Первый item: 10 упак × 668,75 = 6 687,50 ₽, НДС 1 205,94 ₽.
        first = air_ducts[0]
        assert first.quantity == 10.0
        assert abs(first.price_unit - 668.75) < 0.01
        assert abs(first.price_total - 6687.50) < 0.01
        assert abs(first.vat_amount - 1205.94) < 0.01

        # ---- Supplier (Phase 0) ----
        assert "ГалВент" in result.supplier.name, (
            f"supplier={result.supplier.name!r}"
        )
        assert result.supplier.inn == "7720605108"
        assert result.supplier.kpp == "500101001"
        assert result.supplier.bank_account == "40702810701300018012"
        assert result.supplier.bik == "044525593"
        assert result.supplier.correspondent_account == "30101810200000000593"

        # ---- Invoice meta ----
        assert result.invoice_meta.number == "20047"
        assert result.invoice_meta.date == "2026-03-02"
        assert abs(result.invoice_meta.total_amount - 16466.25) < 0.01
        assert abs(result.invoice_meta.vat_amount - 2969.33) < 0.01
        assert result.invoice_meta.vat_rate == 22
        assert "12/20-315" in result.invoice_meta.contract_ref
        assert "Озеры" in result.invoice_meta.project_ref

    finally:
        await provider.aclose()


@pytest.mark.golden_llm
@pytest.mark.asyncio
@pytest.mark.skipif(not (os.environ.get("LLM_API_KEY") or os.environ.get("OPENAI_API_KEY")), reason=_LLM_SKIP_REASON)
async def test_invoice_01_time_budget():
    """Нефункциональный: 2-стр invoice-01 ≤ 60s."""
    import time

    from app.providers.openai_vision import OpenAIVisionProvider

    provider = OpenAIVisionProvider()
    try:
        parser = InvoiceParser(provider)
        t0 = time.time()
        await parser.parse(FIXTURE_PDF.read_bytes(), filename=FIXTURE_PDF.name)
        dt = time.time() - t0
        assert dt < 60.0, f"invoice-01 time budget exceeded: {dt:.1f}s"
    finally:
        await provider.aclose()
