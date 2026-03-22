"""Переиспользуемые поля для DRF-сериализаторов."""

from typing import Optional

from rest_framework import serializers


class AnnotatedCountField(serializers.IntegerField):
    """
    Поле которое читает annotated count если доступен,
    иначе fallback на related manager count.

    Заменяет типичный паттерн SerializerMethodField:

        items_count = serializers.SerializerMethodField()
        def get_items_count(self, obj):
            if hasattr(obj, 'annotated_items_count'):
                return obj.annotated_items_count
            return obj.items.count()

    Использование:

        items_count = AnnotatedCountField(
            annotated_attr='annotated_items_count',
            count_attr='items',
        )

    Параметры:
        annotated_attr: имя annotated-атрибута на модели (ставится через queryset.annotate)
        count_attr: имя related manager для fallback .count()
        count_filter: dict с фильтрами для fallback count (опционально),
                      например {'is_active': True}
    """

    def __init__(self, *, annotated_attr: str, count_attr: str,
                 count_filter: Optional[dict] = None, **kwargs):
        kwargs.setdefault('read_only', True)
        kwargs.setdefault('default', 0)
        # source='*' чтобы получить весь объект в to_representation
        kwargs['source'] = '*'
        super().__init__(**kwargs)
        self.annotated_attr = annotated_attr
        self.count_attr = count_attr
        self.count_filter = count_filter

    def to_representation(self, obj):
        """
        obj — это сам экземпляр модели (благодаря source='*').
        Пробуем сначала взять annotated-атрибут, затем fallback на .count().
        """
        if hasattr(obj, self.annotated_attr):
            value = getattr(obj, self.annotated_attr)
        else:
            manager = getattr(obj, self.count_attr)
            if self.count_filter:
                value = manager.filter(**self.count_filter).count()
            else:
                value = manager.count()
        return super().to_representation(value)
