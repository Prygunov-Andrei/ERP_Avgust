"""Агрегаты и ранжирование по каталогу моделей рейтинга.

Семантика rank совпадает с SQL RANK() OVER ORDER BY total_index DESC:
ties → одинаковый rank, следующая модель идёт через число ties.

`_median` и `published_median_total_index` — single source of truth для
hero-метрики на /methodology/.stats и для контекста /models/<id>/.
"""
from __future__ import annotations

from typing import Iterable

from django.db.models import Count, IntegerField, OuterRef, Subquery
from django.db.models.functions import Coalesce


def _median(values: Iterable[float]) -> float | None:
    """Медиана; None для пустой последовательности."""
    nums = sorted(v for v in values if v is not None)
    n = len(nums)
    if n == 0:
        return None
    mid = n // 2
    if n % 2:
        return float(nums[mid])
    return (nums[mid - 1] + nums[mid]) / 2


def published_median_total_index() -> float | None:
    """Медиана total_index по всем published моделям."""
    from ac_catalog.models import ACModel

    values = ACModel.objects.filter(
        publish_status=ACModel.PublishStatus.PUBLISHED,
    ).values_list("total_index", flat=True)
    return _median(values)


def rank_subquery():
    """Аннотация `rank` для списка моделей.

    Считает rank как «COUNT моделей с более высоким total_index по всему
    published-каталогу + 1». Subquery коррелирует с `OuterRef("total_index")`,
    и его результат НЕ зависит от других фильтров внешнего queryset —
    rank остаётся абсолютным по всему опубликованному каталогу, даже
    если внешний list отфильтрован по brand/region/capacity/price.
    """
    from ac_catalog.models import ACModel  # avoid circular at import time

    higher_count = (
        ACModel.objects
        .filter(
            publish_status=ACModel.PublishStatus.PUBLISHED,
            total_index__gt=OuterRef("total_index"),
        )
        .order_by()
        .values("publish_status")  # одна группа — subquery вернёт 1 строку
        .annotate(c=Count("pk"))
        .values("c")
    )
    return Coalesce(Subquery(higher_count, output_field=IntegerField()), 0) + 1


def rank_for_model(obj) -> int | None:
    """Rank одной модели — отдельный COUNT, для detail-view.

    Возвращает None если модель не published.
    """
    from ac_catalog.models import ACModel

    if obj.publish_status != ACModel.PublishStatus.PUBLISHED:
        return None
    higher = ACModel.objects.filter(
        publish_status=ACModel.PublishStatus.PUBLISHED,
        total_index__gt=obj.total_index,
    ).count()
    return higher + 1
