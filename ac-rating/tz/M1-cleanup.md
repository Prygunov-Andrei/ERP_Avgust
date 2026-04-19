# ТЗ Фазы M1 — Cleanup (tech debt из Ф2-Ф4B)

**Фаза:** M1 (maintenance, вне основного плана 10 фаз)
**Ветка:** `ac-rating/m1-cleanup` (от `main`)
**Зависит от:** Ф5 (в main)
**Оценка:** 0.3 дня

## Контекст

Backend-часть MVP готова (Ф1-Ф5 смержены, 190 тестов). В твоих отчётах за Ф2-Ф4B есть 3 мелких долга, каждый ты сам помечал как «исправим позже / не блокер / future refactor». «Позже» — сейчас, пока ждём дизайн для Ф6A.

Задачи маленькие, не связаны между собой — можешь коммитить по одной.

## Задача 1 — Ratelimit: 403 → 429

**Откуда:** Ф4A отчёт, риск #1. `django-ratelimit` c `block=True` бросает `Ratelimited(PermissionDenied)` → Django default handler возвращает **403**. По семантике HTTP это должно быть **429 Too Many Requests**.

**Что сделать:**

1. Создать `backend/ac_catalog/ratelimit.py`:
   ```python
   from django.http import JsonResponse

   def ratelimited_view(request, exception):
       return JsonResponse(
           {"detail": "Слишком много запросов. Попробуй позже."},
           status=429,
       )
   ```

2. Добавить в `backend/finans_assistant/settings.py` (в существующий блок настроек ratelimit, если его нет — в конец файла):
   ```python
   RATELIMIT_VIEW = "ac_catalog.ratelimit.ratelimited_view"
   ```

   **Этот `settings.py` разрешено трогать — это изменение относится только к нашему домену рейтинга.** Если есть уже какой-то `RATELIMIT_VIEW` — не перезаписывай, сообщи в отчёте.

3. Обновить тесты:
   - `ac_reviews/tests/test_api.py`: поменять `assert response.status_code == 403` → `== 429` для ratelimit-теста; добавить `assert response.json()["detail"].startswith("Слишком много")`.
   - `ac_submissions/tests/test_api.py`: то же самое.

**Приёмка:**
- [ ] `pytest ac_reviews/tests/test_api.py ac_submissions/tests/test_api.py` — зелёный с 429
- [ ] Smoke-curl (вручную): 6-й POST в час на `/api/public/v1/rating/reviews/` возвращает **429** + JSON `{"detail": "..."}`
- [ ] `Retry-After` заголовок — **не обязательно** (django-ratelimit не знает точного reset-time; по желанию добавь hardcoded `Retry-After: 60`, это hint клиенту)

## Задача 2 — `MethodologyVersion.save()` в транзакции

**Откуда:** Ф2 отчёт, риск #9. Деактивация других активных версий и сохранение текущей идут двумя SQL-запросами вне транзакции. Окно гонки: два одновременных save() могут оставить 0 или 2 активных.

**Что сделать:**

В `backend/ac_methodology/models.py`, метод `MethodologyVersion.save()` — обернуть в `transaction.atomic()`:

```python
def save(self, *args, **kwargs):
    from django.db import transaction
    with transaction.atomic():
        if self.is_active:
            MethodologyVersion.objects.exclude(pk=self.pk).update(is_active=False)
        super().save(*args, **kwargs)
```

Плюс `select_for_update()` на deactivation? — Не надо, это PostgreSQL-level `UPDATE` с `WHERE`, блокировка строк автоматом под row-level lock.

**Приёмка:**
- [ ] Существующий тест Ф2 `test_methodology_version_save_single_active` продолжает проходить
- [ ] `manage.py check` + `makemigrations --dry-run` чисто
- [ ] Новый unit-тест (если быстро — необязательно): `transaction.atomic` видно в trace (либо тест через `transaction.set_autocommit(False)` + одновременные `save()`)

## Задача 3 — Удалить `raw_values_migration.py` (stub)

**Откуда:** Ф4B отчёт, риск #1. Ты сам написал «Альтернатива на будущее: убрать вызов из methodology_version admin и удалить файл».

**Что сделать:**

1. Найти в `backend/ac_methodology/admin/methodology_version.py` вызов `migrate_model_raw_values_between_methodologies(...)` и импорт (`from ac_catalog.services.raw_values_migration import ...` или аналогичный). Удалить обе строки.
2. Удалить файл `backend/ac_catalog/services/raw_values_migration.py`.
3. Если `backend/ac_catalog/services/__init__.py` re-export-ит эту функцию — убрать из `__all__` / removal импорта.
4. Проверить что `grep -rn "migrate_model_raw_values_between_methodologies\|raw_values_migration" backend/` — пусто.

**Приёмка:**
- [ ] `pytest ac_*/tests/` — зелёный (все 190 существующих тестов; ратлимит-тесты теперь ожидают 429 — смотри Задачу 1)
- [ ] `manage.py check` — 0 issues
- [ ] `/admin/ac_methodology/methodologyversion/<pk>/duplicate/` открывается и сохранение копии работает (smoke на runserver — одного клика достаточно)
- [ ] `grep -rn "raw_values_migration" backend/` — пусто

## Ограничения

- **НЕ трогать** ничего кроме файлов, упомянутых выше.
- **Разрешено** редактировать `backend/finans_assistant/settings.py` — но только добавить строку `RATELIMIT_VIEW = "ac_catalog.ratelimit.ratelimited_view"`. Больше ничего в settings.py не менять.
- Conventional Commits. По коммиту на задачу: `fix(ac-rating): ratelimit 429 handler (M1.1)`, `fix(ac-rating): atomic save for MethodologyVersion (M1.2)`, `chore(ac-rating): remove raw_values_migration stub (M1.3)`.

## Формат отчёта

Положить в `ac-rating/reports/m1-cleanup.md`:
1. Ветка + 3 коммита
2. По каждой задаче: что сделано, какие тесты поменял/добавил
3. Результаты: `pytest ac_*/`, `manage.py check`, `makemigrations --dry-run`, smoke-curl для задачи 1
4. Если что-то не получилось (например, `RATELIMIT_VIEW` уже задан) — написать и оставить на ревью
5. Ключевые файлы для ревью

## Подсказки

- **`transaction.atomic`** импортируется `from django.db import transaction` — скорее всего уже есть в `ac_methodology/models.py`. Если нет — добавь в импорты наверху файла, не внутри метода.
- **Пустой `__init__.py`** у `ac_catalog/services/` после удаления файла — не страшно, но проверь что `__all__` не сломался.
- **Если в `MethodologyVersionAdmin.save_related` логика очистки/переноса raw_values действительно нужна** (нашёл скрытый use case) — не удаляй, напиши в отчёте и оставь как есть. Но по коду это должна быть просто строка вызова без реальной логики (раз функция no-op).
- **Тест для Задачи 1** — не городи моки django-ratelimit; просто `ratelimit.ENABLE = True` в фикстуре + 6 POST-ов, как у тебя уже в Ф4A.
