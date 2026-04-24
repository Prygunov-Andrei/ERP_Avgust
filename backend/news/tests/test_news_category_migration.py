"""Тесты data-migration 0028_seed_news_categories.

pytest-django создаёт тестовую БД, прогоняя все миграции — в т.ч. seed.
Эти тесты проверяют результат seed'а + идемпотентность: повторный прогон
seed-функции не падает и не дублирует записей.
"""
from __future__ import annotations

import pytest

from news.models import NewsCategory


SEED_SLUGS = {"business", "industry", "market", "regulation",
              "review", "guide", "brands", "other"}


@pytest.mark.django_db
def test_seed_created_all_8_categories():
    """После migrate все 8 seed-slug'ов есть в БД."""
    existing = set(NewsCategory.objects.values_list("slug", flat=True))
    assert SEED_SLUGS.issubset(existing)


@pytest.mark.django_db
def test_seed_names_and_order_are_correct():
    """Проверяем content seed-записей."""
    expected = {
        "business": ("Деловые", 10),
        "industry": ("Индустрия", 20),
        "market": ("Рынок", 30),
        "regulation": ("Регулирование", 40),
        "review": ("Обзор", 50),
        "guide": ("Гайд", 60),
        "brands": ("Бренды", 70),
        "other": ("Прочее", 80),
    }
    for slug, (name, order) in expected.items():
        cat = NewsCategory.objects.get(slug=slug)
        assert cat.name == name, f"{slug}: name"
        assert cat.order == order, f"{slug}: order"
        assert cat.is_active is True


@pytest.mark.django_db
def test_seed_is_idempotent():
    """Повторный вызов функции seed не падает и не создаёт дублей."""
    import importlib
    from django.apps import apps as django_apps

    mig = importlib.import_module("news.migrations.0028_seed_news_categories")

    class _FakeApps:
        def get_model(self, app, model):
            return django_apps.get_model(app, model)

    before = NewsCategory.objects.count()
    mig.seed_categories(_FakeApps(), None)
    after = NewsCategory.objects.count()
    assert before == after


@pytest.mark.django_db
def test_backfill_fills_category_ref_for_posts_created_after_migration():
    """Интеграционный: если NewsPost создаётся после seed (как в тестах),
    его category_ref автоматически подтягивается через save()-sync. Это
    косвенно покрывает и поведение backfill'а: посты, у которых только
    CharField category, получают FK."""
    from news.models import NewsPost

    # Как если бы пост был создан ДО миграции 0027 — мы явно обнуляем FK
    # через update(), чтобы save()-sync в create() не сработал.
    post = NewsPost.objects.create(title="old", body="body", category="guide")
    NewsPost.objects.filter(pk=post.pk).update(category_ref_id=None)

    # Эмулируем backfill — вызов save() должен подтянуть FK из CharField.
    post.refresh_from_db()
    assert post.category_ref_id is None
    post.save()
    post.refresh_from_db()
    assert post.category_ref_id == "guide"
