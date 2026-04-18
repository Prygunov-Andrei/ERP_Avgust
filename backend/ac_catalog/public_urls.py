"""Публичный API рейтинга кондиционеров (/api/public/v1/rating/).

Фаза 1: каркас без роутов. В фазе 4 сюда заедут endpoints моделей,
брендов, методики, отзывов и заявок (см. ac-rating/plan.md, фаза 4).
"""
from django.urls import path

app_name = 'ac_rating_public'

urlpatterns: list[path] = []
