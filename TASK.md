# TASK — Wave 8 backend — engine fix is_key_measurement + NewsEditor category sync

## 1. КРИТИЧНО: `is_key_measurement=true` → weight=0 в total_index

### Контекст
Активная методика v1.0 сейчас сумма весов = 110%. Виновник: критерий `noise` (`code='noise'`) имеет `is_key_measurement=true` AND `weight=10`. SQL подтверждает.

Решение Андрея (2026-04-27):
> «Если ключевой замер НЕ участвует в индексе ... его вклад в индекс должен быть ноль»

То есть: **критерии с `is_key_measurement=true` исключаются из расчёта total_index**, независимо от их weight в `MethodologyCriterion`. На UI они продолжают отображаться отдельным выделенным блоком (это уже работает).

### Что делать

**Файлы для расследования:**
- `backend/ac_scoring/engine.py` — основной модуль скоринга.
- `backend/ac_scoring/scorers/` — отдельные scorer-классы.

**Ожидаемая правка:**
В функции расчёта total_index (`update_model_total_index` или эквивалент) — итерация по `MethodologyCriterion` с `is_active=True`. Добавить условие: если `mc.criterion.is_key_measurement=True` → пропустить (weighted_score = 0, не добавлять к сумме весов в нормализации).

**Внимание к нормализации:** total_index нормируется через `weighted_sum / total_weight`. Если просто игнорировать `noise`, total_weight тоже должен пересчитаться — иначе модели потеряют нормировку. Подход:
```python
# было: 
total_weight = sum(mc.weight for mc in active_criteria)
total_index = weighted_sum / total_weight if total_weight else 0

# станет:
scoring_criteria = [mc for mc in active_criteria if not mc.criterion.is_key_measurement]
total_weight = sum(mc.weight for mc in scoring_criteria)
weighted_sum = sum(score(mc) * mc.weight for mc in scoring_criteria)
total_index = weighted_sum / total_weight if total_weight else 0
```

(Конкретная реализация на твоё усмотрение — главное чтобы критерии с `is_key_measurement=true` не учитывались ни в числителе weighted_sum, ни в знаменателе total_weight.)

### Recalculate всех моделей

После правки engine — всех существующих моделей нужно пересчитать (их total_index считались по старой формуле).

```bash
python manage.py recalculate_ac_rating
```

Этот management command уже существует (Ф3). После Wave 8 backend merge — Андрей запустит его на проде через ssh, либо я.

В тестах добавь явную проверку: создать критерий с `is_key_measurement=true` и `weight=20`, плюс обычный с `weight=80`. Сумма весов в active методике = 100. Расчёт total_index должен использовать только weight=80 → нормировано до 100/80=1.25 множителя на каждом параметре.

### Тесты

В `backend/ac_scoring/tests/test_engine.py` (или новом файле) — 3-4 теста:
1. Критерий с is_key_measurement=true и weight=20 НЕ влияет на total_index.
2. Если ВСЕ критерии is_key_measurement=true → total_index = 0 (нет вкладывающих).
3. Случай как сейчас на проде: сумма весов 110, реально учтённый суммарный вес = 100 (без noise).
4. Без is_key_measurement-критериев — total_index не изменился (regression).

### Smoke на проде (Андрей запустит вручную после деплоя)

```bash
# В docker:
docker exec finans_assistant-backend-1 python manage.py recalculate_ac_rating
# или для одной модели:
docker exec finans_assistant-backend-1 python manage.py recalculate_ac_rating --model-ids 5
```

В отчёте укажи: какой management command использовать для recalculate.

---

## 2. КРИТИЧНО: NewsEditor — синхронизация category ↔ category_ref

### Контекст

В `backend/news/serializers.py:NewsPostWriteSerializer` (строка 177-191):
```python
class NewsPostWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = NewsPost
        fields = (
            'title', 'body', 'pub_date', 'status', 'source_language', 'auto_translate',
            'category', 'lede', 'reading_time_minutes',
            'editorial_author', 'mentioned_ac_models',
        )
```

Сериализатор обновляет только **legacy `category`** (CharField) при создании/редактировании новости через NewsEditor.

`FeaturedNewsView` фильтрует через **`category_ref_id`** (FK на NewsCategory). При несовпадении — featured-news не находит новости в выбранной категории.

`bulk-update-category` view (`backend/news/views.py:557-593`) делает синхронно:
```python
queryset.update(
    category=cat.slug,
    category_ref_id=cat.slug,
)
```

### Фикс

В `NewsPostWriteSerializer` (или в `NewsPostViewSet.perform_create/perform_update`) — при изменении `category` синхронно обновлять `category_ref`:

```python
def update(self, instance, validated_data):
    cat_slug = validated_data.get('category')
    instance = super().update(instance, validated_data)
    if cat_slug:
        # Sync category_ref
        try:
            cat = NewsCategory.objects.get(slug=cat_slug, is_active=True)
            instance.category_ref = cat
            instance.save(update_fields=['category_ref'])
        except NewsCategory.DoesNotExist:
            # legacy 'other' и т.п. — оставляем category_ref пустым
            instance.category_ref = None
            instance.save(update_fields=['category_ref'])
    return instance

def create(self, validated_data):
    cat_slug = validated_data.get('category')
    instance = super().create(validated_data)
    if cat_slug:
        try:
            cat = NewsCategory.objects.get(slug=cat_slug, is_active=True)
            instance.category_ref = cat
            instance.save(update_fields=['category_ref'])
        except NewsCategory.DoesNotExist:
            pass
    return instance
```

(Адаптируй под фактическую структуру модели — может `category_ref` хранит slug, не FK PK.)

**ВАЖНО:** если `category_ref` использует `to_field="slug"` и `db_column="category_ref_slug"` — то `instance.category_ref = cat` достаточно (Django резолвит to_field автоматически). Проверь что эта связь в модели настроена правильно.

### Тесты

В `backend/news/tests/test_serializers.py` или `test_views.py`:
1. POST `{"title": "...", "category": "brands"}` → новость создана с `category_ref` указывает на NewsCategory(slug='brands').
2. PATCH `{"category": "market"}` → category_ref обновился.
3. PATCH `{"category": "other"}` (legacy default, нет в NewsCategory) → category_ref → None.

### Data fix на проде

После деплоя Wave 8 — нужно одноразово синхронизировать существующие новости:
```python
# Management command или shell
python manage.py shell -c "
from news.models import NewsPost, NewsCategory
fixed = 0
for cat in NewsCategory.objects.all():
    n = NewsPost.objects.filter(category=cat.slug).exclude(category_ref=cat).update(category_ref=cat)
    fixed += n
print(f'Updated: {fixed}')
"
```

В отчёте укажи snippet для запуска. Андрей выполнит после деплоя.

---

## 3. Прогон

```bash
pytest backend/ac_scoring/tests/ --no-cov   # тесты engine, после фикса
pytest backend/news/tests/ --no-cov          # тесты writer, regression
pytest backend/ac_*/tests/ --no-cov          # без регрессий по AC Rating
python manage.py check
python manage.py makemigrations --dry-run --check    # No changes (модели не меняем)
```

---

## 4. Что НЕ делаем

- ❌ Не меняем модели (`Criterion`, `MethodologyCriterion`, `NewsPost`).
- ❌ Не меняем публичный API methodology (он и так отдаёт is_key_measurement).
- ❌ Не делаем UI — это Федя в Wave 8 frontend.

---

## 5. Известные нюансы

1. **`is_key_measurement` на проде:** только `noise` имеет true (см. SQL diagnostic). Other criterion.is_key_measurement = false. После твоего фикса noise в активной методике перестанет влиять на total_index.
2. **Recalculate всех моделей** — занимает несколько секунд на 27 моделях. Не блокирующий.
3. **Public methodology API** уже корректно отдаёт `is_key_measurement` — фронт UI не меняется.
4. **legacy `category='other'`** — это не slug в NewsCategory. Sync должен оставлять category_ref=None (что и сделает `NewsCategory.DoesNotExist`-ветка).

---

## 6. Формат отчёта

```
Отчёт — Wave 8 backend (AC-Петя)

Ветка: ac-rating/wave8-backend (rebased на origin/main)
Коммиты: <git log --oneline main..HEAD>

Что сделано:
- ✅ ac_scoring engine: is_key_measurement → исключение из total_index
- ✅ <N> тестов engine
- ✅ NewsPostWriteSerializer: sync category → category_ref
- ✅ <M> тестов news writer
- (опц.) management command для data-fix существующих новостей

Прогон:
- pytest ac_scoring/: <X> passed
- pytest news/: <Y> passed
- pytest ac_*/: <Z> passed (без регрессий)
- check / dry-run: ok

Расчёт после деплоя (Андрей запустит):
  docker exec finans_assistant-backend-1 python manage.py recalculate_ac_rating
  
Data fix новостей после деплоя (Андрей запустит):
  docker exec finans_assistant-backend-1 python manage.py shell -c "<snippet>"

Известные риски:
- ...

Ключевые файлы:
- backend/ac_scoring/engine.py (или scorers/)
- backend/ac_scoring/tests/test_engine.py
- backend/news/serializers.py (NewsPostWriteSerializer)
- backend/news/tests/...
```
