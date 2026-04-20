# ТЗ Фазы M3 — Отключить DRF pagination на публичных list-view

**Фаза:** M3 (maintenance, параллельно Ф6A)
**Ветка:** `ac-rating/m3-disable-public-pagination` (от `main`)
**Зависит от:** M2 (в main)
**Оценка:** 0.1-0.2 дня

## Контекст

Федя при чтении ТЗ Ф6A заметил: в `backend/finans_assistant/settings.py:282-283` глобально:

```python
'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
'PAGE_SIZE': 20,
```

`ACModelListView` наследует этот default, значит `/api/public/v1/rating/models/` отдаёт
DRF-wrapped shape `{count, next, previous, results: [...]}` с PAGE_SIZE=20. Это бьётся с
двумя вещами в Ф6A:

1. **F0-клиент** (`frontend/lib/api/services/rating.ts`) уже в main типизирован как
   `getRatingModels(): Promise<RatingModelListItem[]>` — ожидает plain array.
2. **«Свой рейтинг»** (T5 в Ф6A) должен считать индекс по всему каталогу (27 моделей),
   а фронт получает только 20. Пагинация на публичной SEO-странице — антипаттерн:
   поисковики должны индексировать весь рейтинг за один hit, ISR 3600s кешируется в CDN.

**Решение:** отключить pagination на двух публичных list-view — рейтинг уже ограничен
`publish_status=PUBLISHED` фильтром и не будет расти взрывно в ближайший год. Через Ф10
если каталог перевалит 500+ моделей — пересмотрим (cursor-based, client-side infinity).

## Задачи

### 1. Отключить pagination на `ACModelListView`

`backend/ac_catalog/views/ac_models.py:15`:

```python
class ACModelListView(LangMixin, generics.ListAPIView):
    serializer_class = ACModelListSerializer
    permission_classes = [AllowAny]
    pagination_class = None  # публичный рейтинг отдаёт весь каталог одним ответом
```

### 2. Отключить pagination на `ACModelArchiveListView`

Там же, `ac_models.py:113`:

```python
class ACModelArchiveListView(ACModelListView):
    pagination_class = None  # переопределяем, т.к. наследует от ACModelListView (всё равно None, но явно)
    def get_queryset(self):
        ...
```

Факт: наследуется от `ACModelListView`, значит получает `pagination_class = None`
автоматически. Но явное лучше неявного — поставь отдельно, с тем же комментарием.

### 3. Тесты

`backend/ac_catalog/tests/test_api.py` — **добавь два теста** (или поправь существующие):

- `test_list_returns_plain_array_not_paginated` — `resp.data` это список, не dict.
  Проверить `isinstance(resp.data, list)` + `len(resp.data) == N`.
- `test_archive_list_returns_plain_array` — то же для `/models/archive/`.

Существующие тесты `test_list_includes_rank_for_each_item` и т.п. могли работать с
paginated-shape — проверь все 199 существующих, не сломал ли их смены (они, возможно,
обращались к `resp.data["results"]`, теперь нужно `resp.data`).

### 4. Smoke curl перед мержем

```bash
curl -s http://localhost:8000/api/public/v1/rating/models/ | jq 'type, length'
# ожидается: "array", 27

curl -s http://localhost:8000/api/public/v1/rating/models/archive/ | jq 'type, length'
# ожидается: "array", N (сколько архивных в dump)
```

## Приёмочные критерии

- [ ] `manage.py check` — 0 issues
- [ ] `pytest ac_catalog/tests/ --no-cov` — зелёный (199 + 2 новых = 201)
- [ ] Smoke curl `/models/` и `/models/archive/` возвращают plain array
- [ ] F0-клиент `getRatingModels()` работает без изменений (Федя проверит на своей стороне)
- [ ] Другие endpoints (`/methodology/`, `/reviews/`, `/brands/`) — **не трогать**, там pagination/shape как было

## Ограничения

- **НЕ менять** `settings.py` — глобальный дефолт оставляем для остального ERP
- **НЕ трогать** `MethodologyView`, `BrandListView`, `ReviewsListView` — они либо single-object,
  либо pagination там уместна
- **НЕ менять** `ACModelListSerializer` / `ACModelDetailSerializer` — только view-level
- Conventional Commits. Два коммита: `fix(ac-rating)` + `test(ac-rating)` или один
  комбинированный, на твоё усмотрение

## Формат отчёта

Короткий `ac-rating/reports/m3-disable-public-pagination.md`:
1. Коммиты
2. Что сделано (2 view + 2 теста)
3. Smoke curl «до / после»
4. pytest result
5. Ключевые файлы

## Подсказки от техлида

- **Если тесты М2 сейчас обращаются к `resp.data["results"]`** — нужно поправить на
  `resp.data`. Поиск: `grep -rn "data\[.results.\]" backend/ac_catalog/tests/`. Ожидается
  >= 3-5 мест.
- **Вариант фолбэк** — если вдруг окажется, что 200+ моделей уже в БД Максима и выдача
  тяжёлая (~100KB JSON), можем вернуть pagination но добавить `page_size_query_param`,
  чтобы фронт мог запросить `?page_size=1000`. Но этот вариант костыльный — отключение
  чище. Если payload > 200KB — напиши мне, обсудим.
- **Почему не pagination с большим PAGE_SIZE?** Глобальное значение PAGE_SIZE=20
  используется другими ERP-эндпоинтами. Менять глобальный — риск регресса в ERP. Лучше
  точечно на нашей view.
- **Сhecklist Петя-специфичный:** ты мог помнить, что рейтинг работал с pagination при
  ручных smoke-тестах M2 (в отчёте ты написал «count=27, results[0..4]»). Это не
  регрессия — просто раньше мы не использовали response в JS, а теперь используем.

## Запуск

```bash
cd /Users/andrei_prygunov/obsidian/avgust/ERP_Avgust
git fetch origin
git worktree add -b ac-rating/m3-disable-public-pagination \
    ../ERP_Avgust_ac_petya_m3_disable_pagination origin/main
cd ../ERP_Avgust_ac_petya_m3_disable_pagination
# правка + тест + коммит
# rebase + merge --no-ff + push origin main
# remove worktree
```
