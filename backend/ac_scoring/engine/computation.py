"""Расчёт индекса без записи в БД (кроме вызывающего кода)."""

from __future__ import annotations

import logging
from typing import Any

from ac_catalog.models import ACModel, ModelRawValue
from ac_methodology.models import MethodologyCriterion, MethodologyVersion
from ac_scoring.scorers import SCORER_MAP
from ac_scoring.scorers.base import BaseScorer, ScoreResult
from ac_scoring.scorers.brand_age import BrandAgeScorer
from ac_scoring.scorers.fallback import FallbackScorer
from ac_scoring.scorers.lab import LabScorer

logger = logging.getLogger(__name__)


def validate_weights(methodology: MethodologyVersion) -> None:
    """Раньше проверяла сумму весов = 100%; ограничение снято — оставлена для совместимости вызовов."""
    return None


def _get_scorer(mc: MethodologyCriterion) -> BaseScorer | None:
    if mc.value_type == "brand_age":
        return BrandAgeScorer()
    if mc.value_type == "fallback":
        return FallbackScorer()
    if mc.value_type == "lab":
        return LabScorer()

    scorer_class = SCORER_MAP.get(mc.scoring_type)
    if scorer_class:
        return scorer_class()

    logger.warning(
        "No scorer for criterion %s (type=%s, scoring=%s)",
        mc.code, mc.value_type, mc.scoring_type,
    )
    return None


def _build_model_context(ac_model: ACModel) -> dict[str, Any]:
    ctx: dict[str, Any] = {}

    if ac_model.nominal_capacity:
        ctx["nominal_capacity"] = ac_model.nominal_capacity

    brand = ac_model.brand
    if brand.origin_class_id:
        ctx["fallback_score"] = brand.origin_class.fallback_score
    if brand.sales_start_year_ru:
        ctx["sales_start_year_ru"] = brand.sales_start_year_ru

    return ctx


def max_possible_total_index(methodology: MethodologyVersion | None) -> float:
    """
    Верхняя граница нормированного итогового индекса (0-100).

    total_index ренормируется по сумме весов non-key-критериев:
        total_index = weighted_sum_non_key * 100 / sum(weight of non-key active)

    Соответственно max = (sum(weight of scorable non-key) / sum(weight of non-key active)) * 100.
    is_key_measurement-критерии исключаются и из числителя, и из знаменателя.
    """
    if methodology is None:
        return 100.0
    mc_qs = MethodologyCriterion.objects.filter(
        methodology=methodology, is_active=True,
    ).select_related("criterion").order_by("display_order", "criterion__code")

    non_key_weight = 0.0
    scorable_non_key_weight = 0.0
    for mc in mc_qs:
        if mc.criterion.is_key_measurement:
            continue
        w = float(mc.weight)
        non_key_weight += w
        if _get_scorer(mc):
            scorable_non_key_weight += w

    if non_key_weight <= 0:
        return 0.0
    return round(scorable_non_key_weight * 100.0 / non_key_weight, 2)


def compute_scores_for_model(
    ac_model: ACModel,
    methodology: MethodologyVersion,
) -> tuple[float, list[dict[str, Any]]]:
    """
    Считает итоговый индекс и разбивку по критериям.
    Без записи в БД. Пустой raw_value — как у соответствующих скореров (часто 0).
    """
    mc_qs = MethodologyCriterion.objects.filter(
        methodology=methodology, is_active=True,
    ).select_related("criterion").order_by("display_order", "criterion__code")

    raw_values = {
        rv.criterion_id: rv
        for rv in ModelRawValue.objects.filter(
            model=ac_model, criterion__isnull=False,
        ).select_related("criterion")
    }

    model_ctx = _build_model_context(ac_model)

    weighted_sum = 0.0
    non_key_weight = 0.0
    rows: list[dict[str, Any]] = []

    for mc in mc_qs:
        is_key = bool(mc.criterion.is_key_measurement)

        if not is_key:
            non_key_weight += float(mc.weight)

        rv = raw_values.get(mc.criterion_id)
        raw = rv.raw_value if rv else ""

        scorer = _get_scorer(mc)
        if not scorer:
            continue

        context: dict[str, Any] = {**model_ctx}
        if rv:
            context["lab_status"] = rv.lab_status

        result: ScoreResult = scorer.calculate(mc, raw, **context)

        weighted = round(float(mc.weight) * result.normalized_score / 100, 4)
        if not is_key:
            weighted_sum += weighted

        rows.append({
            "criterion": mc,
            "raw_value": str(raw),
            "compressor_model": rv.compressor_model if rv else "",
            "normalized_score": round(result.normalized_score, 2),
            "weighted_score": 0.0 if is_key else round(weighted, 4),
            "above_reference": result.above_reference,
        })

    if non_key_weight <= 0:
        total_index = 0.0
    else:
        total_index = weighted_sum * 100.0 / non_key_weight

    return round(total_index, 2), rows
