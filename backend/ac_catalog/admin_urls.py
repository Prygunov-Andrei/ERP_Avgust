"""Админский API рейтинга кондиционеров (/api/hvac/rating/).

Фаза 1: каркас без роутов. В фазе 4 сюда заедут CRUD-эндпоинты для
ERP-админов (модели, методика, модерация отзывов и заявок).
"""
from django.urls import path

app_name = 'ac_rating_admin'

urlpatterns: list[path] = []
