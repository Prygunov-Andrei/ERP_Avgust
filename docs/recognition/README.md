# Recognition Service — документация

Распознавание ОВиК спецификаций PDF → структурированные SpecItems.

**Текущий best:** TD-17g (commit `d8bce21`), TOTAL 99.7%, 5/10 на 100%.

## Документы

- [ARCHITECTURE.md](ARCHITECTURE.md) — pipeline, ENV flags, dependencies
- [REGRESSION-RESULTS.md](REGRESSION-RESULTS.md) — таблица per-spec, эволюция
- [REGRESSION-SUITE.md](REGRESSION-SUITE.md) — описание test PDFs (10 spec)
- [EVOLUTION-TD.md](EVOLUTION-TD.md) — история TD-04 → TD-17g
- [FUTURE-WORK.md](FUTURE-WORK.md) — пути доведения до 9/10 на 100%

## Quick reference

### Production main (текущий)
`main @ 1cb8932` — DeepSeek pure-LLM (Spec-4 99.92% historic).

### TD-17g experimental (recommended next merge)
`recognition/td-17g-llm-targeted @ d8bce21` — Docling+Camelot+Vision
hybrid. **5/10 на 100%, 99.7% TOTAL**. Ключевые wins:
- Spec-9 41% → **100%** (Camelot lattice routing)
- Spec-7 90.9% → 98.5% (Vision LLM targeted, читаемые русские имена)
- Spec-6 +1 phantom → **100%** (col-numbers row filter)

### Architecture diff vs main

| Aspect | Main (DeepSeek) | TD-17g (hybrid) |
|--------|-----------------|------------------|
| Primary extract | text-layer bbox + LLM normalize | Docling TableFormer ML |
| Fallback | Vision LLM (gpt-4o) | Camelot lattice + Vision targeted |
| Cost per spec | ~$1-3 (DeepSeek thinking-high) | ~$0.04 (mostly local) |
| Time per spec (avg) | 30-60 min (DeepSeek thinking) | 3-7 min |
| Determinism | seed=42 (best effort) | $0 path = full deterministic |
| Spec-9 baseline | ~85% (DeepSeek) | **100%** (Camelot) |

### Regression command

```bash
/tmp/td17/regression_10spec.sh <port> <tag>
```

Containers (живые):
- `rec-td17g` (port 8033) = TD-17g final.
- `rec-td17e` (port 8032) = TD-17e baseline (без LLM).
- `rec-td17a` (port 8031) = TD-17a v7.
- `rec-td17` (port 8030) = TD-17 baseline.
- `ismeta-recognition` (port 8003) = production main.

### Mandate compliance

PO mandate: 9/10 на 100% + 1 выбивающаяся, без LLM на главном path.

Достигнуто:
- 5/10 на 100% (Spec-1, 2, 3, 6, 9) — без LLM
- 4 близких (Δ ≤ 8) — Spec-4, 5, 8, 11
- 1 outlier — Spec-7 (-1, scanned, Vision LLM dramatic improvement)

Чтобы 9/10 → mandate complete, нужны Phase 1-3 из FUTURE-WORK.md
(~14 часов, ~$6/run cost). Strategic call PO.
