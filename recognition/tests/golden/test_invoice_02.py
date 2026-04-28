"""Golden set test — invoice-02.pdf (ООО «ЛУИС+»).

15 items (контроллеры доступа / коммутаторы / кабель), total
1 714 790,31 ₽, НДС 309 224,48 ₽. Шапка — списковый формат (Продавец →
р/с → ИНН / КПП → Банк → БИК → Адрес). Ед. изм. ВНУТРИ «Кол-во»
(«27 шт.»), колонка «ЗТ*» (заказной), колонка «Срок» (7 р.д. для
2 items).

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
    / "invoice-02.pdf"
)

_LLM_SKIP_REASON = "LLM_API_KEY/OPENAI_API_KEY не задан — skip golden_llm"


@pytest.mark.golden_llm
@pytest.mark.asyncio
@pytest.mark.skipif(not (os.environ.get("LLM_API_KEY") or os.environ.get("OPENAI_API_KEY")), reason=_LLM_SKIP_REASON)
async def test_invoice_02_hybrid_pipeline():
    """E16 it1: 15 items + «27 шт.» split + lead_time_days + supply_type."""
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
        assert len(result.items) == 15, (
            f"ожидалось 15 items, получено {len(result.items)}: "
            f"{[it.name[:40] for it in result.items]}"
        )
        for item in result.items:
            assert item.price_unit > 0
            assert item.price_total > 0
            assert item.quantity > 0

        # 2 items с lead_time_days=7 (row 4 и row 7 — ПО модули).
        items_with_lead = [
            it for it in result.items if it.lead_time_days == 7
        ]
        assert len(items_with_lead) >= 2, (
            f"ожидалось ≥2 items с lead_time_days=7, получено "
            f"{len(items_with_lead)}: {[it.name[:40] for it in items_with_lead]}"
        )

        # Первый item (Контроллер доступа ЛКД-КС-8000): qty=27, unit=шт.
        ctrl_items = [
            it for it in result.items if "Контроллер" in it.name and "ЛКД-КС" in it.name
        ]
        assert ctrl_items, f"Контроллер ЛКД-КС не найден: {[it.name for it in result.items]}"
        ctrl = ctrl_items[0]
        assert ctrl.quantity == 27.0
        assert ctrl.unit in ("шт", "шт."), f"unit={ctrl.unit!r}"
        assert abs(ctrl.price_unit - 30133.00) < 0.01
        assert abs(ctrl.price_total - 813591.00) < 0.01

        # ---- Supplier ----
        assert "ЛУИС" in result.supplier.name
        assert result.supplier.inn == "5040070405"
        assert result.supplier.kpp == "772201001"

        # ---- Invoice meta ----
        assert result.invoice_meta.number == "ЛП001556"
        assert result.invoice_meta.date == "2026-03-06"
        assert abs(result.invoice_meta.total_amount - 1714790.31) < 1.0
        assert abs(result.invoice_meta.vat_amount - 309224.48) < 1.0
        assert "ЛП2024/0416-2" in result.invoice_meta.contract_ref
    finally:
        await provider.aclose()


@pytest.mark.golden_llm
@pytest.mark.asyncio
@pytest.mark.skipif(not (os.environ.get("LLM_API_KEY") or os.environ.get("OPENAI_API_KEY")), reason=_LLM_SKIP_REASON)
async def test_invoice_02_time_budget():
    """Нефункциональный: 2-стр invoice-02 (15 items) ≤ 60s."""
    import time

    from app.providers.openai_vision import OpenAIVisionProvider

    provider = OpenAIVisionProvider()
    try:
        parser = InvoiceParser(provider)
        t0 = time.time()
        await parser.parse(FIXTURE_PDF.read_bytes(), filename=FIXTURE_PDF.name)
        dt = time.time() - t0
        assert dt < 60.0, f"invoice-02 time budget exceeded: {dt:.1f}s"
    finally:
        await provider.aclose()
