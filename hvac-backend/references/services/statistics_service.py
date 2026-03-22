"""
Сервис для агрегации статистики производителей и источников новостей.

Вынесен из views.py для переиспользования и тестируемости.
Объединяет несколько отдельных aggregate-запросов в один вызов .aggregate().
"""
import logging
from typing import Any, Dict, List

from django.db.models import Avg, Count, Q, Sum

from references.models import (
    Manufacturer,
    ManufacturerStatistics,
    NewsResource,
    NewsResourceStatistics,
)

logger = logging.getLogger(__name__)


class ManufacturerStatisticsService:
    """Агрегация статистики по всем производителям."""

    @staticmethod
    def get_summary() -> Dict[str, Any]:
        """
        Возвращает словарь с общей статистикой по всем производителям.
        Один вызов .aggregate() вместо восьми раздельных.
        """
        all_stats = ManufacturerStatistics.objects.all()

        total_manufacturers = Manufacturer.objects.count()

        # --- Единый aggregate вместо 8 отдельных ---
        agg = all_stats.aggregate(
            manufacturers_with_stats=Count('id'),
            active_manufacturers=Count('id', filter=Q(is_active=True)),
            total_news_found=Sum('total_news_found'),
            total_searches=Sum('total_searches'),
            total_no_news=Sum('total_no_news'),
            total_errors=Sum('total_errors'),
            avg_success_rate=Avg('success_rate'),
            avg_news_per_search=Avg('avg_news_per_search'),
            avg_ranking_score=Avg('ranking_score'),
            news_last_30_days=Sum('news_last_30_days'),
            high_performers=Count('id', filter=Q(ranking_score__gte=50)),
            medium_performers=Count('id', filter=Q(ranking_score__gte=20, ranking_score__lt=50)),
            low_performers=Count('id', filter=Q(ranking_score__lt=20)),
            problematic=Count('id', filter=Q(error_rate__gte=30)),
        )

        manufacturers_with_stats = agg['manufacturers_with_stats'] or 0
        active_manufacturers = agg['active_manufacturers'] or 0

        # --- Топ-производители (3 запроса с select_related) ---
        top_by_news = list(
            all_stats.select_related('manufacturer')
            .order_by('-total_news_found')[:10]
        )
        top_by_ranking = list(
            all_stats.select_related('manufacturer')
            .order_by('-ranking_score')[:10]
        )
        top_by_activity = list(
            all_stats.select_related('manufacturer')
            .order_by('-news_last_30_days')[:10]
        )

        return {
            'overview': {
                'total_manufacturers': total_manufacturers,
                'manufacturers_with_stats': manufacturers_with_stats,
                'active_manufacturers': active_manufacturers,
                'inactive_manufacturers': total_manufacturers - active_manufacturers,
            },
            'aggregated': {
                'total_news_found': agg['total_news_found'] or 0,
                'total_searches': agg['total_searches'] or 0,
                'total_no_news': agg['total_no_news'] or 0,
                'total_errors': agg['total_errors'] or 0,
                'news_last_30_days': agg['news_last_30_days'] or 0,
            },
            'averages': {
                'success_rate': round(agg['avg_success_rate'] or 0.0, 2),
                'avg_news_per_search': round(agg['avg_news_per_search'] or 0.0, 2),
                'avg_ranking_score': round(agg['avg_ranking_score'] or 0.0, 2),
            },
            'categories': {
                'high_performers': agg['high_performers'] or 0,
                'medium_performers': agg['medium_performers'] or 0,
                'low_performers': agg['low_performers'] or 0,
                'problematic': agg['problematic'] or 0,
            },
            'top_manufacturers': {
                'by_news': [
                    {
                        'id': stat.manufacturer.id,
                        'name': stat.manufacturer.name,
                        'total_news': stat.total_news_found,
                        'ranking_score': stat.ranking_score,
                    }
                    for stat in top_by_news
                ],
                'by_ranking': [
                    {
                        'id': stat.manufacturer.id,
                        'name': stat.manufacturer.name,
                        'ranking_score': stat.ranking_score,
                        'total_news': stat.total_news_found,
                    }
                    for stat in top_by_ranking
                ],
                'by_activity': [
                    {
                        'id': stat.manufacturer.id,
                        'name': stat.manufacturer.name,
                        'news_last_30_days': stat.news_last_30_days,
                        'ranking_score': stat.ranking_score,
                    }
                    for stat in top_by_activity
                ],
            },
        }


class ResourceStatisticsService:
    """Агрегация статистики по всем источникам новостей."""

    @staticmethod
    def get_summary() -> Dict[str, Any]:
        """
        Возвращает словарь с общей статистикой по всем источникам.
        Один вызов .aggregate() вместо восьми раздельных.
        """
        all_stats = NewsResourceStatistics.objects.all()

        # --- Единый aggregate ---
        agg = all_stats.aggregate(
            resources_with_stats=Count('id'),
            active_resources=Count('id', filter=Q(is_active=True)),
            total_news_found=Sum('total_news_found'),
            total_searches=Sum('total_searches'),
            total_no_news=Sum('total_no_news'),
            total_errors=Sum('total_errors'),
            avg_success_rate=Avg('success_rate'),
            avg_news_per_search=Avg('avg_news_per_search'),
            avg_ranking_score=Avg('ranking_score'),
            news_last_30_days=Sum('news_last_30_days'),
            high_performers=Count('id', filter=Q(ranking_score__gte=50)),
            medium_performers=Count('id', filter=Q(ranking_score__gte=20, ranking_score__lt=50)),
            low_performers=Count('id', filter=Q(ranking_score__lt=20)),
            problematic=Count('id', filter=Q(error_rate__gte=30)),
        )

        total_resources = NewsResource.objects.count()
        active_resources = agg['active_resources'] or 0

        # Статистика по типам источников (один запрос с aggregate)
        source_type_agg = NewsResource.objects.aggregate(
            auto=Count('id', filter=Q(source_type='auto')),
            manual=Count('id', filter=Q(source_type='manual')),
            hybrid=Count('id', filter=Q(source_type='hybrid')),
        )
        auto_sources = source_type_agg['auto'] or 0
        manual_sources = source_type_agg['manual'] or 0
        hybrid_sources = source_type_agg['hybrid'] or 0

        # --- Топ-источники (3 запроса с select_related) ---
        top_by_news = list(
            all_stats.select_related('resource')
            .order_by('-total_news_found')[:10]
        )
        top_by_ranking = list(
            all_stats.select_related('resource')
            .order_by('-ranking_score')[:10]
        )
        top_by_activity = list(
            all_stats.select_related('resource')
            .order_by('-news_last_30_days')[:10]
        )

        return {
            'overview': {
                'total_resources': total_resources,
                'resources_with_stats': agg['resources_with_stats'] or 0,
                'active_resources': active_resources,
                'inactive_resources': total_resources - active_resources,
            },
            'source_types': {
                'auto': auto_sources,
                'manual': manual_sources,
                'hybrid': hybrid_sources,
                'auto_searchable': auto_sources + hybrid_sources,
            },
            'aggregated': {
                'total_news_found': agg['total_news_found'] or 0,
                'total_searches': agg['total_searches'] or 0,
                'total_no_news': agg['total_no_news'] or 0,
                'total_errors': agg['total_errors'] or 0,
                'news_last_30_days': agg['news_last_30_days'] or 0,
            },
            'averages': {
                'success_rate': round(agg['avg_success_rate'] or 0.0, 2),
                'avg_news_per_search': round(agg['avg_news_per_search'] or 0.0, 2),
                'avg_ranking_score': round(agg['avg_ranking_score'] or 0.0, 2),
            },
            'categories': {
                'high_performers': agg['high_performers'] or 0,
                'medium_performers': agg['medium_performers'] or 0,
                'low_performers': agg['low_performers'] or 0,
                'problematic': agg['problematic'] or 0,
            },
            'top_sources': {
                'by_news': [
                    {
                        'id': stat.resource.id,
                        'name': stat.resource.name,
                        'total_news': stat.total_news_found,
                        'ranking_score': stat.ranking_score,
                    }
                    for stat in top_by_news
                ],
                'by_ranking': [
                    {
                        'id': stat.resource.id,
                        'name': stat.resource.name,
                        'ranking_score': stat.ranking_score,
                        'total_news': stat.total_news_found,
                    }
                    for stat in top_by_ranking
                ],
                'by_activity': [
                    {
                        'id': stat.resource.id,
                        'name': stat.resource.name,
                        'news_last_30_days': stat.news_last_30_days,
                        'ranking_score': stat.ranking_score,
                    }
                    for stat in top_by_activity
                ],
            },
        }
