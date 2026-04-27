"""NewsPostWriteSerializer должен синхронизировать category_ref FK.

Без этого FeaturedNewsView (фильтрует по category_ref_id) не находит новости,
у которых редактор сменил category через NewsEditor — потому что NewsPost.save()
при наличии расходящегося category_ref откатывает CharField обратно к старому
значению (см. backend/news/models.py:359-389 save()-sync).

Ключевые сценарии: PATCH category, POST category, legacy 'other' (нет в
NewsCategory), категория не существует в БД.
"""
from __future__ import annotations

import pytest
from django.utils import timezone

from news.models import NewsCategory, NewsPost
from news.serializers import NewsPostWriteSerializer


@pytest.fixture
def categories(db):
    """Активные категории для тестов (seed-миграция уже создала их в test DB)."""
    NewsCategory.objects.update_or_create(
        slug="brands", defaults={"name": "Бренды", "order": 10, "is_active": True},
    )
    NewsCategory.objects.update_or_create(
        slug="market", defaults={"name": "Рынок", "order": 20, "is_active": True},
    )


@pytest.mark.django_db
def test_create_post_with_category_sets_category_ref(categories):
    serializer = NewsPostWriteSerializer(data={
        "title": "T", "body": "B",
        "pub_date": timezone.now().isoformat(),
        "status": "draft", "source_language": "ru",
        "category": "brands",
    })
    assert serializer.is_valid(), serializer.errors
    # auto_translate — write_only, view-слой его pop'ает; в unit-тесте делаем то же.
    serializer.validated_data.pop("auto_translate", None)
    post = serializer.save()
    post.refresh_from_db()
    assert post.category == "brands"
    assert post.category_ref_id == "brands"


@pytest.mark.django_db
def test_patch_changes_category_and_category_ref(categories):
    """Главный кейс из бага #8: PATCH category на новой категории должен
    обновить и category_ref. Без фикса save()-sync откатывает category обратно
    к старому category_ref_id.
    """
    post = NewsPost.objects.create(
        title="T", body="B",
        pub_date=timezone.now(),
        status="draft", source_language="ru",
        category="brands",
    )
    post.refresh_from_db()
    assert post.category_ref_id == "brands"

    serializer = NewsPostWriteSerializer(
        post, data={"category": "market"}, partial=True,
    )
    assert serializer.is_valid(), serializer.errors
    serializer.save()

    post.refresh_from_db()
    assert post.category == "market"
    assert post.category_ref_id == "market"


@pytest.mark.django_db
def test_patch_to_legacy_category_clears_category_ref(categories):
    """PATCH category='other' (нет в NewsCategory) → category_ref = None.

    Замечание: NewsCategory seed-миграция (0028) обычно создаёт slug='other'
    тоже, но если slug отсутствует или is_active=False — FK должен стать NULL.
    """
    post = NewsPost.objects.create(
        title="T", body="B",
        pub_date=timezone.now(),
        status="draft", source_language="ru",
        category="brands",
    )
    post.refresh_from_db()

    NewsCategory.objects.filter(slug="other").delete()

    serializer = NewsPostWriteSerializer(
        post, data={"category": "other"}, partial=True,
    )
    assert serializer.is_valid(), serializer.errors
    serializer.save()

    post.refresh_from_db()
    assert post.category == "other"
    assert post.category_ref_id is None


@pytest.mark.django_db
def test_patch_without_category_keeps_existing_ref(categories):
    """Если category не пришла в payload — category_ref не трогаем."""
    post = NewsPost.objects.create(
        title="T", body="B",
        pub_date=timezone.now(),
        status="draft", source_language="ru",
        category="brands",
    )
    post.refresh_from_db()
    assert post.category_ref_id == "brands"

    serializer = NewsPostWriteSerializer(
        post, data={"title": "Updated"}, partial=True,
    )
    assert serializer.is_valid(), serializer.errors
    serializer.save()

    post.refresh_from_db()
    assert post.title == "Updated"
    assert post.category == "brands"
    assert post.category_ref_id == "brands"


