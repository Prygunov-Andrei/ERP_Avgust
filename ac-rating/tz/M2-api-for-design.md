# ТЗ Фазы M2 — Backend enhancements под дизайн

**Фаза:** M2 (maintenance, вне основного плана)
**Ветка:** `ac-rating/m2-api-for-design` (от `main`)
**Зависит от:** M1 (в main)
**Оценка:** 0.3-0.5 дня

## Контекст

Клод-дизайн сдал вайрфреймы публичной части (`ac-rating/design/`, утверждено 2026-04-20). В макетах есть данные, которых сейчас нет в API — нужно их добавить, чтобы Ф6A писал фронт без хардкодов и mock-данных.

## Задачи

### 1. `rank` в `ACModelListSerializer` + `ACModelDetailSerializer`

**Где нужен:**
- **Листинг (LIST-A):** в таблице колонка «#» — номер строки. Сейчас фронт делает `idx + 1` по порядку массива, но это хрупко (теряется при фильтрации).
- **Деталь (DetailA hero):** «№ 1 из 87 моделей» — крупная метрика 72px serif. Нужен на детали явно.

**Логика:**
`rank` = позиция модели в полном published-каталоге по `total_index DESC`, с учётом активной методики. Ties (одинаковый total_index) — одинаковый rank (стандартный RANK, не DENSE_RANK).

**Реализация:**

В `ac_catalog/views/ac_models.py:ACModelListView.get_queryset`:

```python
from django.db.models import Window
from django.db.models.functions import Rank
from django.db.models.expressions import F

qs = ACModel.objects.filter(publish_status=ACModel.PublishStatus.PUBLISHED).annotate(
    rank=Window(
        expression=Rank(),
        order_by=F("total_index").desc(),
    ),
).select_related("brand", "brand__origin_class").prefetch_related(
    "regions", "raw_values__criterion",
).order_by("-total_index")
# применяем фильтры ПОСЛЕ annotate — rank остаётся абсолютным по всему каталогу
# (фильтр в UI визуально режет список, но №1 остаётся №1 во всём каталоге)
```

**Важно:** rank вычисляется **ДО** фильтров (brand/region/capacity/price). Логика — «ваш выбор — №7 в рейтинге», не «№7 из 5 отфильтрованных».

В `ACModelListSerializer` и `ACModelDetailSerializer` — добавить поле:
```python
rank = serializers.IntegerField(read_only=True)
```

Для detail view — rank не через annotate в queryset (там один объект), а через отдельный COUNT:
```python
def get_rank(self, obj):
    if obj.publish_status != ACModel.PublishStatus.PUBLISHED:
        return None
    return ACModel.objects.filter(
        publish_status=ACModel.PublishStatus.PUBLISHED,
        total_index__gt=obj.total_index,
    ).count() + 1
```

Это стандартный способ rank для single row — COUNT моделей с более высоким индексом +1. Совпадает с Window Rank() семантически.

### 2. Meta-агрегаты в `MethodologyView`

Сейчас `MethodologyView` отдаёт структуру методики (критерии, веса). Дизайн (LIST-A hero) требует 3 числа:
- **87 моделей** → `total_models` — count `publish_status='published'`
- **33 критерия** → `active_criteria_count` — count `MethodologyCriterion` где `methodology=active AND is_active=True`
- **4 года замеров** → **хардкод на фронте**, в API НЕ добавляем

Также для **detail** нужна:
- **68.2 (медиана)** → `median_total_index` — медиана `total_index` по published моделям

**Где хранить:**

Вариант A (в `MethodologyView` response, рядом со structure):
```json
{
  "version": "2026.1",
  "criteria": [...],
  "stats": {
    "total_models": 87,
    "active_criteria_count": 33,
    "median_total_index": 68.2
  }
}
```

Вариант B (отдельный endpoint `/api/public/v1/rating/stats/`):
Короче для клиента, но лишний запрос.

**Выбирай A** — фронт делает 1 запрос `/methodology/` на hero листинга и получает всё сразу.

Для **detail** — `median_total_index` также включи в `ACModelDetailSerializer` (через context, чтобы не считать много раз):

В `ACModelDetailView.get_serializer_context`:
```python
ctx = super().get_serializer_context()
published = ACModel.objects.filter(publish_status=ACModel.PublishStatus.PUBLISHED)
ctx["median_total_index"] = _median([m.total_index for m in published.only("total_index")])
return ctx
```

Функция `_median`:
```python
def _median(values):
    values = sorted(values)
    n = len(values)
    if not n:
        return None
    mid = n // 2
    return values[mid] if n % 2 else (values[mid - 1] + values[mid]) / 2
```

Положи `_median` в `ac_catalog/stats.py` (новый файл). Переиспользуется и в MethodologyView, и в detail.

### 3. Тесты

**`ac_catalog/tests/test_api.py`**:
- `test_list_includes_rank` — создать 3 модели с разными `total_index`, проверить `rank=[1,2,3]`. Плюс проверить ties: две модели с одинаковым `total_index` → обе получают одинаковый rank.
- `test_detail_includes_rank` — аналогично для одной модели в контексте 3 моделей.
- `test_methodology_includes_stats` — статы с правильными числами (total_models, active_criteria_count, median_total_index).
- `test_detail_includes_median` — median приходит в detail.

Фабрики (из Ф2) — `PublishedACModelFactory` уже есть (добавлена в Ф4A).

## Приёмочные критерии

- [ ] `manage.py check` + `makemigrations --dry-run` чисто (моделей не добавлял)
- [ ] `pytest ac_*/tests/` — зелёный (190 + новые тесты)
- [ ] `curl /api/public/v1/rating/models/` — каждый элемент содержит `"rank": N`
- [ ] `curl /api/public/v1/rating/models/<pk>/` — содержит `"rank": N` и `"median_total_index": X`
- [ ] `curl /api/public/v1/rating/methodology/` — содержит `"stats": {"total_models", "active_criteria_count", "median_total_index"}`
- [ ] Rank для ties корректен (двое с одинаковым `total_index` → одинаковый rank, следующий через 2)
- [ ] `ac_catalog/stats.py` с функцией `_median` (single source of truth)

## Ограничения

- **НЕ менять** модели / миграции.
- **НЕ добавлять** поле `measurements_years` или `rating_year` — это хардкод на фронте.
- **НЕ трогать** сам scoring engine (модуль `ac_scoring`) — это только slim-добавки в view/serializer.
- Conventional Commits, по коммиту на задачу.

## Формат отчёта

`ac-rating/reports/m2-api-for-design.md`:
1. Коммиты
2. Что сделано — rank в list/detail, stats в methodology, median в detail context, новый `stats.py`
3. Smoke-curl 3 endpoints с примерами ответов (чтобы Ф6A-агент/фронт увидел точный shape данных)
4. Результаты pytest/check/dry-run
5. Ключевые файлы для ревью

## Подсказки от техлида

- **Window Rank() требует Postgres >= 11** — у нас 16, ОК.
- **Rank после annotate + filter:** в Django Window применяется на queryset ДО применения WHERE на ранг (если не используешь Subquery). Но для нашей цели — rank по всему каталогу — мы хотим аннотировать на **неотфильтрованном** queryset, а потом делать `.filter(...)` для пагинации/фильтрации. То есть:
  ```python
  ranked = ACModel.objects.filter(publish_status=PUBLISHED).annotate(rank=Window(...))
  # теперь фильтр:
  qs = ranked.filter(brand__name__icontains=brand) if brand else ranked
  ```
- **Median через percentile_cont:** можно через PG `percentile_cont(0.5)`, но для 87 моделей Python-медиана за O(n log n) — тривиально. Читаемее.
- **Caching:** `MethodologyView.stats.total_models` — частый count. Сейчас кешировать НЕ нужно (запросы редкие). В Ф10 если появится нагрузка — завернём в `cache_page(300)`.
- **Если `MethodologyView` сейчас не имеет `stats` секции в JSON** — фронт, вероятно, ожидает её в верхнем уровне как siblings к `version`/`criteria`. Уточни в `ACModelDetailSerializer` у Максима как было — и сохрани тот же shape, добавив `stats` вложенным объектом.
