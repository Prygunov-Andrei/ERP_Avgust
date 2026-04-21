# ТЗ Фазы M5 — Backend-поля под редизайн HVAC-новостей (Ф7A)

**Фаза:** M5 (maintenance, блокер для Ф7A)
**Ветка:** `ac-rating/m5-news-content-fields` (от `main`)
**Зависит от:** M4 (в main)
**Оценка:** 1.5-2 дня

## Контекст

Готовимся к Ф7A — полному редизайну HVAC-новостей (корневая `/` = лента, `/news/[id]/` = деталь).
Дизайн от клод-дизайна: NewsListA (`wf-screens.jsx:1014-1050`) + NewsDetailA (`:1052-1108`)
+ MobileNewsList (`:1112-1167`) + MobileNewsDetail (`:1169+`).

**Gaps текущего backend:**
- **Категория новости** — в дизайне chip-row с 7 категориями (Деловые/Индустрия/Рынок/Регулирование/Обзор/Гайд/Бренды). На `NewsPost` поле отсутствует.
- **Lede** (вводный абзац, отдельный от body) — в дизайне крупный serif-параграф над основным текстом. В модели только `body` (Markdown).
- **Reading time** — в дизайне «6 мин чтения» в eyebrow. Отсутствует.
- **Editorial-автор** (отображаемое имя + роль + аватар) — в дизайне «Евгений Лаврентьев · Редактор отраслевой ленты». В модели есть `author: User` (для ERP-оркестрации), но User не имеет display name/role/avatar в одной модели.
- **Связь с AC Rating моделью** — в дизайне «Упомянутая модель» card в detail, с ссылкой `/ratings/<slug>/`. M2M-связи нет.
- **Обратная связь на ACModel** — секция «Упоминания в прессе» на детальной странице AC-модели (Ф6B). Требует добавления `news_mentions` в `ACModelDetailSerializer`.

**Принцип:** расширяем существующую модель NewsPost + новая NewsAuthor. Не рушим ERP-use-case (author=User для оркестрации остаётся). Публичный endpoint `/api/v1/hvac/public/news/` — расширяем serializer.

## Задачи

### M5.1 — `NewsPost.category` enum

**Файл:** `backend/news/models.py`, модель `NewsPost`.

Добавить поле:

```python
class NewsPost(models.Model):
    # ... existing ...

    class Category(models.TextChoices):
        BUSINESS = "business", "Деловые"
        INDUSTRY = "industry", "Индустрия"
        MARKET = "market", "Рынок"
        REGULATION = "regulation", "Регулирование"
        REVIEW = "review", "Обзор"
        GUIDE = "guide", "Гайд"
        BRANDS = "brands", "Бренды"
        OTHER = "other", "Прочее"

    category = models.CharField(
        max_length=20, choices=Category.choices, default=Category.OTHER,
        help_text="Категория новости. Показывается как eyebrow-label и chip-filter в ленте.",
    )
```

**Миграция:** `0XXX_add_news_category`. Schema + RunSQL SET DEFAULT `'other'` (тот же паттерн M4, чтобы старый load работал). **Без data-миграции** — существующие новости получат `other`, админ отредактирует вручную.

### M5.2 — `NewsPost.lede` + `reading_time_minutes`

В той же модели:

```python
lede = models.TextField(
    blank=True, default="",
    help_text="Вводный абзац (serif 15px) отдельно от body. Если пустой — берётся первые 2 абзаца body.",
)
reading_time_minutes = models.PositiveSmallIntegerField(
    null=True, blank=True,
    help_text="Оценка времени чтения в минутах. Если null — вычисляется из body при save().",
)
```

Auto-calculation `reading_time_minutes` в `NewsPost.save()`:

```python
def save(self, *args, **kwargs):
    if self.body and self.reading_time_minutes is None:
        word_count = len(self.body.split())
        self.reading_time_minutes = max(1, round(word_count / 200))
    super().save(*args, **kwargs)
```

**Важно:** админ может вручную переопределить через admin-форму. Если редактор заполнил `reading_time_minutes` — логика save НЕ пересчитывает.

**Миграция:** `0XXX_add_news_lede_reading_time`. Schema + RunSQL SET DEFAULT `''` для lede.

### M5.3 — `NewsAuthor` модель + FK `editorial_author`

Новая модель в том же `backend/news/models.py`:

```python
class NewsAuthor(models.Model):
    """Отображаемый автор/редактор новости на публичном портале.
    Отдельно от внутреннего author=User (который фиксирует кто в ERP закоммитил пост)."""

    name = models.CharField(max_length=200, help_text="Имя для отображения: «Евгений Лаврентьев».")
    role = models.CharField(max_length=200, blank=True, default="", help_text="Должность/роль: «Редактор отраслевой ленты».")
    avatar = models.ImageField(upload_to="news/authors/", blank=True, null=True)
    is_active = models.BooleanField(default=True)
    order = models.PositiveSmallIntegerField(default=0, help_text="Порядок в admin-select.")

    class Meta:
        ordering = ("order", "name")

    def __str__(self):
        return self.name
```

В `NewsPost`:

```python
editorial_author = models.ForeignKey(
    NewsAuthor,
    on_delete=models.SET_NULL,
    null=True, blank=True,
    related_name="posts",
    help_text="Отображаемый автор на публичном портале. Можно оставить пустым — тогда подпись скрывается.",
)
```

**Миграция:** `0XXX_add_news_author` — CreateModel NewsAuthor + AddField editorial_author. Без data-миграции (старые посты без автора на публичном портале — подпись скрывается).

### M5.4 — `NewsPost.mentioned_ac_models` M2M

```python
mentioned_ac_models = models.ManyToManyField(
    "ac_catalog.ACModel",
    related_name="news_mentions",
    blank=True,
    help_text="AC-модели, упомянутые в новости. Показываются как «Упомянутая модель» card в детальной странице новости, и в секции «Упоминания в прессе» на детальной модели AC.",
)
```

**Миграция:** `0XXX_add_news_mentioned_ac_models` — M2M через автоматическую intermediate. Без data-миграции.

**Импорт:** используй string-ref `"ac_catalog.ACModel"` чтобы избежать circular-import (news зависит от ac_catalog, но не наоборот — для `ACModelDetailSerializer.news_mentions` через `related_name`).

### M5.5 — Публичный serializer + endpoint

**Файл:** `backend/news/serializers.py` (или там где `HvacNewsSerializer` — проверь внимательно, их может быть несколько).

Найди публичный serializer для `/api/v1/hvac/public/news/` и расширь fields:

```python
class HvacPublicNewsSerializer(serializers.ModelSerializer):
    category = serializers.CharField(read_only=True)
    category_display = serializers.CharField(source="get_category_display", read_only=True)
    editorial_author = NewsAuthorLiteSerializer(read_only=True)
    mentioned_ac_models = ACModelMentionLiteSerializer(many=True, read_only=True)

    class Meta:
        model = NewsPost
        fields = [
            # ... существующие (title, body, pub_date, source_url, media, star_rating, ...),
            "category",
            "category_display",
            "lede",
            "reading_time_minutes",
            "editorial_author",
            "mentioned_ac_models",
        ]
```

**`NewsAuthorLiteSerializer`:**
```python
class NewsAuthorLiteSerializer(serializers.ModelSerializer):
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = NewsAuthor
        fields = ["id", "name", "role", "avatar_url"]

    def get_avatar_url(self, obj):
        if obj.avatar:
            request = self.context.get("request")
            return request.build_absolute_uri(obj.avatar.url) if request else obj.avatar.url
        return ""
```

**`ACModelMentionLiteSerializer`** (новый, отдельно от ACModelListSerializer — чтобы не тащить тяжёлый shape):
```python
class ACModelMentionLiteSerializer(serializers.ModelSerializer):
    brand = serializers.CharField(source="brand.name", read_only=True)

    class Meta:
        model = ACModel
        fields = ["id", "slug", "brand", "inner_unit", "total_index", "price"]
```

Положить `ACModelMentionLiteSerializer` в `backend/ac_catalog/serializers.py` (у нас app-специфичные models), экспорт в news serializers через `from ac_catalog.serializers import ACModelMentionLiteSerializer`.

**Фильтр по category** в `HvacPublicNewsViewSet` или там где публичный list:

```python
def get_queryset(self):
    qs = super().get_queryset().filter(
        is_deleted=False,
        is_no_news_found=False,
        status="published",  # если enum другой — скорректируй
    ).order_by("-pub_date")
    category = self.request.query_params.get("category")
    if category:
        qs = qs.filter(category=category)
    return qs
```

### M5.6 — `ACModelDetailSerializer.news_mentions`

В `backend/ac_catalog/serializers.py` — `ACModelDetailSerializer`:

```python
class ACModelDetailSerializer(serializers.ModelSerializer):
    # ... existing ...
    news_mentions = serializers.SerializerMethodField()

    class Meta:
        # ... существующий fields + добавить:
        fields = [..., "news_mentions"]

    def get_news_mentions(self, obj) -> list[dict]:
        # reverse-relation через related_name="news_mentions" (из M5.4)
        mentions = obj.news_mentions.filter(
            is_deleted=False, is_no_news_found=False, status="published",
        ).order_by("-pub_date")[:5]
        return [
            {
                "id": n.id,
                "title": n.title,
                "category": n.category,
                "category_display": n.get_category_display(),
                "pub_date": n.pub_date.isoformat() if n.pub_date else None,
                "reading_time_minutes": n.reading_time_minutes,
            }
            for n in mentions
        ]
```

**Ограничение 5 постов** — больше нет смысла показывать на одной странице модели. Сортировка — по дате publication DESC.

**Почему SerializerMethodField, а не nested serializer:** лёгкий shape (6 полей вместо 20+), не тащим body/media — экономия payload.

### M5.7 — Admin

**`backend/news/admin.py`:**

- `NewsAuthorAdmin` — обычный ModelAdmin с `list_display = ("name", "role", "is_active", "order")`, search_fields `("name", "role")`.
- `NewsPostAdmin` — добавить:
  - `list_filter` — добавить `category`, `editorial_author`
  - `list_display` — добавить `category`, `editorial_author`
  - `fieldsets` — новая секция «Публичная часть» с полями: `category`, `lede`, `editorial_author`, `reading_time_minutes`, `mentioned_ac_models`.
  - `filter_horizontal = ("mentioned_ac_models",)` — удобный M2M-picker в админке.

### M5.8 — Тесты

**`backend/news/tests/test_models.py`** (или `test_api.py`, где-то в news-tests):

- `test_category_default_is_other` — NewsPost без category → `other`.
- `test_reading_time_auto_calculation` — save с body «word1 word2 ... wordN» → reading_time_minutes = round(N/200) или 1.
- `test_reading_time_manual_override` — ручное заполнение не перезаписывается.

**`backend/news/tests/test_api.py`:**

- `test_public_news_list_returns_new_fields` — list response каждого элемента содержит `category`, `category_display`, `lede`, `reading_time_minutes`, `editorial_author: null|object`, `mentioned_ac_models: []`.
- `test_public_news_category_filter` — `?category=business` → только business-новости.
- `test_public_news_excludes_deleted_and_drafts` — фильтр is_deleted+no_news_found+status=published.

**`backend/ac_catalog/tests/test_api.py`:**

- `test_detail_includes_news_mentions` — модель с 2 связанными опубликованными новостями → `news_mentions.length == 2`, shape корректный (id/title/category/pub_date/reading_time_minutes).
- `test_detail_news_mentions_excludes_drafts` — deleted/no_news_found/draft новости не попадают.
- `test_detail_news_mentions_limit_5` — 7 связанных → возвращает 5 самых свежих.

**Ожидаемые тесты:** ~9 новых. Всего в ac_* + news_* tests — текущие ~208 + ~9 = ~217.

### M5.9 — Фабрики для тестов

В `backend/news/tests/factories.py` (или создать):
- `NewsAuthorFactory`
- `NewsPostFactory` — `category`, `editorial_author`, `mentioned_ac_models` (post-gen hook с add()).

Если factories для news ещё нет — создай минимальный набор.

## Приёмочные критерии

- [ ] `manage.py check` + `makemigrations --dry-run` — чисто
- [ ] `manage.py migrate` — без ошибок на чистой БД и на БД с `load_ac_rating_dump`
- [ ] `pytest ac_*/tests/ news/tests/ --no-cov` — зелёный (~208 + ~9 = ~217)
- [ ] `curl /api/v1/hvac/public/news/?category=business` — фильтрует
- [ ] `curl /api/v1/hvac/public/news/<id>/` — содержит `category/category_display/lede/reading_time_minutes/editorial_author/mentioned_ac_models`
- [ ] `curl /api/public/v1/rating/models/<id>/` — содержит `news_mentions: [...]` (может быть пустой массив если нет упоминаний)
- [ ] Admin: создать NewsAuthor → привязать к NewsPost → mentioned_ac_models через filter_horizontal
- [ ] Frontend `/news/` и `/ratings/` работают без изменений (graceful degradation — поля пустые, но shape не ломается)

## Ограничения

- **НЕ изменять** существующие поля NewsPost (`title`, `body`, `author`, `manufacturer`, etc.). Только add.
- **НЕ удалять** `author: User` поле — это ERP-оркестрационная связь, остаётся отдельно от editorial_author.
- **НЕ менять** логику `Discovery`/`Rating*`/`Translation` сервисов.
- **НЕ менять** shape `HvacNewsSerializer` existing fields — **только add**, чтобы не сломать текущий frontend.
- Conventional Commits, коммит на M5.N. 8 коммитов + отчёт. Trailer `Co-authored-by: AC-Петя <ac-petya@erp-avgust>`.

## Формат отчёта

`ac-rating/reports/m5-news-content-fields.md`:
1. Коммиты
2. Что сделано (9 подзадач)
3. Smoke curl до/после на публичном news + ratings detail
4. pytest result
5. Ключевые файлы
6. Что Феде подтянуть в `frontend/lib/api/types/hvac.ts` и `frontend/lib/api/types/rating.ts` после merge

## Подсказки от техлида

- **Проверь точное имя публичного viewset news** — в views.py я видел `NewsPostViewSet` (ERP admin). Публичный может быть в другом файле (`api_public/` или `backend/hvac/` или прямо в `news/public_views.py`). Поиск `grep -rn "api/v1/hvac/public/news" backend/`.
- **`author`-поле is User** — не трогай. `editorial_author` — отдельная FK.
- **Data-миграция категорий — не делаем.** У Максима в production новости разных типов, маппинг по title-heuristic будет хрупким. Пусть админ ставит руками после M5.
- **`lede` vs `body`** — два разных поля. Lede — 1-2 абзаца подводки (serif 15 в дизайне), body — long-form Markdown. В existing postах `lede` будет пусто; фронт с graceful fallback возьмёт первые 2 параграфа body.
- **Reading time heuristic 200 wpm** — стандарт для editorial. Не настраивай.
- **Thumbnails для NewsAuthor.avatar** — если Max'овый media-backend не handles ImageField upload — возможно понадобится storage setup. Проверь `settings.MEDIA_ROOT` уже настроен (news/archives/ и news/media/ используются).
- **`ACModelMentionLiteSerializer`** — положи в `ac_catalog.serializers`, экспорт оттуда в news. Это не создаёт circular: news импортирует из ac_catalog, но ac_catalog.serializers не импортирует из news (для news_mentions используется `get_news_mentions` method + `obj.news_mentions.filter(...)` через related_name — ORM работает через string-ref).
- **`related_name="news_mentions"`** — уже зарезервировано для `ACModel`. Проверь что на ACModel ещё нет поля с таким именем.
- **Публичный endpoint без pagination?** Скорее всего news paginated, не отключаем (там может быть много постов в ленте). Если лента <50 — можно отключить позже в Ф7B, не сейчас.
- **Slug для news** — если его ещё нет на NewsPost, URL в frontend — `/news/<id>/`. Slug не добавляем в M5 (отдельный эпик, URL-стабильность требует data-миграции). Frontend остаётся на id.

## Запуск

```bash
cd /Users/andrei_prygunov/obsidian/avgust/ERP_Avgust
git fetch origin
git worktree add -b ac-rating/m5-news-content-fields \
    ../ERP_Avgust_ac_petya_m5 origin/main
cd ../ERP_Avgust_ac_petya_m5
# править + коммит по подзадаче + тесты + миграции + SQL DEFAULTs
# rebase + merge --no-ff + push
# remove worktree
```
