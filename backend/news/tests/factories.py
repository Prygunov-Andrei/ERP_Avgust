"""Factory-boy фабрики для news моделей (M5.9)."""
from __future__ import annotations

import factory
from django.utils import timezone
from factory.django import DjangoModelFactory

from news.models import NewsAuthor, NewsPost


class NewsAuthorFactory(DjangoModelFactory):
    class Meta:
        model = NewsAuthor

    name = factory.Sequence(lambda n: f"Редактор-{n}")
    role = "Редактор отраслевой ленты"
    is_active = True
    order = 0


class NewsPostFactory(DjangoModelFactory):
    class Meta:
        model = NewsPost

    title = factory.Sequence(lambda n: f"News-{n}")
    body = "Первый абзац.\n\nВторой абзац."
    status = "published"
    source_language = "ru"
    pub_date = factory.LazyFunction(timezone.now)
    category = NewsPost.Category.INDUSTRY

    @factory.post_generation
    def mentioned_ac_models(self, create, extracted, **kwargs):
        if not create or not extracted:
            return
        for ac_model in extracted:
            self.mentioned_ac_models.add(ac_model)
