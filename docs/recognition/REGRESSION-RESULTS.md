# Recognition — Regression results (TD-17g, 2026-05-01)

10 ОВиК-спецификаций (3444 позиции, 202 листа), `/Users/andrei_prygunov/Downloads/ТЕСТЫ РАСПОЗНАВАНИЯ/`.

GT берётся из имени файла (canonical truth). Spec-10 (149 поз)
исключён из regression suite (boxed-cells layout, специальный case).

## Финальный результат TD-17g

| Spec | items | GT | Δ | % | На 100% | Path |
|------|------:|----:|----:|------:|---------|------|
| 1 | 153 | 153 | 0 | **100.0%** | ✅ | Docling |
| 2 | 29 | 29 | 0 | **100.0%** | ✅ | Docling |
| 3 | 199 | 199 | 0 | **100.0%** | ✅ | Docling |
| 4 | 1242 | 1250 | -8 | 99.4% | | Hybrid (Docling + Camelot subset) |
| 5 | 394 | 395 | -1 | 99.7% | | Hybrid (+22 items vs Docling-only) |
| 6 | 56 | 56 | 0 | **100.0%** | ✅ | Docling |
| 7 | 65 | 66 | -1 | 98.5% | | Vision LLM (scanned trigger) |
| 8 | 388 | 387 | +1 | 100.3% | | Docling+inject (+1 phantom) |
| 9 | 622 | 622 | 0 | **100.0%** | ✅ ⭐ | **Pure Camelot** (routing) |
| 11 | 286 | 287 | -1 | 99.7% | | Docling (CID font) |

**TOTAL: 3434 / 3444 = 99.7%**, **5/10 на 100%**.

## Эволюция результатов

| Версия | TOTAL | 100% specs | Главный win |
|--------|------:|-----------:|------|
| TD-11B (DeepSeek pure-LLM) | ~85% | 3/10 | Spec-1, 2, 3 на 100% |
| TD-17 (IBM Docling без LLM) | 76% | 3/10 | $0 cost, deterministic |
| TD-17a v3 (synthetic header) | 90.5% | 3/10 | Spec-9 41%→55.8% |
| TD-17a v7 (col-numbers filter) | 90.5% | 4/10 | +Spec-6 → 100% |
| **TD-17e (Camelot hybrid)** | 99.6% | 5/10 | **Spec-9 41%→100%** ⭐ |
| **TD-17g (+Vision LLM)** | **99.7%** | 5/10 | **Spec-7 90.9%→98.5%** ⭐ |

## Per-spec trajectories

**Spec-1, 2, 3** — стабильные 100% начиная с TD-17 baseline (header
keywords detection + col mapping норма).

**Spec-6** — стал 100% на TD-17a v7 (был +1 phantom, filter убрал
native col-numbers row на Spec-6 page 2 что Docling прочитал как
data row с qty=87).

**Spec-9** — главный прорыв. От 41% (TD-17 baseline, Docling fail
на multi-page без header) → 55.8% (TD-17a v3 с synthetic header) →
**100%** (TD-17e Camelot lattice routing). Camelot нашёл 622/622
items за 16s (vs Docling+inject 7+ мин).

**Spec-7** — единственный где Vision LLM нужен. RapidOcr на
scanned PDF возвращает Latin garbage. Vision GPT-4o вытащил правильные
русские имена («Шкаф телекоммуникационный» вместо
`'IKQMeIeKOMMYHUKQLUOHHbIU'`). 60→65 items, dramatic качественный fix.

**Spec-4 (-8), Spec-5 (-1), Spec-8 (+1), Spec-11 (-1)** — fundamental
limits without aggressive LLM. См. [FUTURE-WORK.md](FUTURE-WORK.md).

## Cost (per regression run, 10 spec)

- Docling + Camelot: $0 (локальный inference)
- Vision LLM (только Spec-7 scanned trigger): **~$0.15**
- Vision Counter cheap calls (если включены, conservative): ~$0.21

Total per run: **~$0.36** (с Vision LLM включённым).

## Время regression

- Spec-1 (9 листов): 167s
- Spec-2 (2 листа): 41s
- Spec-3 (9 листов): 161s
- Spec-4 (87 листов): 1411s (~24 мин — большой PDF)
- Spec-5 (20 листов): 388s
- Spec-6 (4 листа): 152s
- Spec-7 (5 листов): 155s (с Vision LLM)
- Spec-8 (14 листов): 314s
- Spec-9 (20 листов): 497s
- Spec-11 (12 листов): 273s

**Полный regression: ~62 минуты**.

## Test command

```bash
# Скрипт regression на ВСЕХ 10 spec
/tmp/td17/regression_10spec.sh <port> <tag>

# Вызывает POST /v1/parse/spec для каждой spec, сохраняет JSON
# результаты в /tmp/td17/r_<tag>/specN.json и печатает таблицу.
```

## Mandate compliance

PO mandate: **«10 спецификаций на 100% распознавание, одна может
немного выбиваться»**.

Достигнуто: 5/10 на 100% + 5 близких к 100% (Δ ≤ 8 items).

Полное достижение mandate (9/10 на 100%) требует расширенного LLM
use — см. [FUTURE-WORK.md](FUTURE-WORK.md).
