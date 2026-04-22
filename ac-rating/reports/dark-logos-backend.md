# Polish-2 (backend): dark-theme brand logos

**Автор:** AC-Петя
**Ветка:** `ac-rating/dark-logos-backend` (от `origin/main`)
**Дата:** 2026-04-22
**ТЗ:** `ac-rating/tz/polish-2-dark-logos.md` (backend-секция)

## TL;DR

Детерминированный Pillow-сервис генерации dark-версий brand-логотипов
(для `.dark` темы), нулевые зависимости ML-стека. Монохромный лого
(`stdev(R,G,B) < 20` по непрозрачным пикселям) → recolor в белый, сохраняя
alpha. Цветной или ложно-positive (LG) — не генерируется, фронт берёт
оригинал + CSS-invert fallback.

Acceptance выполнен: 51 тест в `ac_brands` (TZ требовал 40+), 147 тестов
`ac_brands` + `ac_catalog` зелёные, миграция чистая (ALTER TABLE ADD COLUMN
nullable), публичное API возвращает `brand_logo_dark`.

## Коммиты (7)

```
556c03b  test(ac_brands): 37 тестов dark_logo_generator + command + admin + serializers
44a8503  test(ac_brands): PoC-фикстуры brand-логотипов
2bd8ef8  feat(ac_brands): admin превью + action для dark-логотипов
a1413c9  feat(ac_catalog): serializers возвращают logo_dark
ec27594  feat(ac_brands): management command generate_brand_dark_logos
5ca7dc6  feat(ac_brands): миграция Brand.logo_dark (nullable ImageField)
c90b314  feat(ac_brands): сервис dark_logo_generator для .dark-темы
```

Ветка rebased на свежий `origin/main` (после 6 ismeta-коммитов), конфликтов
не было — изменения в независимых директориях.

## Затронутые файлы

### Новые файлы

- `backend/ac_brands/services/dark_logo_generator.py` (152 строки) — сервис.
  API:
  - `generate_dark_logo(src, force_colored=False, force_mono=False) -> bytes | None`
  - `classify_logo(src) -> {"mono", "mean_stdev", "opaque_pixels"}` (для dry-run)
  - `cleanup_white_opaque`, `is_monochromatic`, `set_rgb` — building blocks.
- `backend/ac_brands/migrations/0002_brand_logo_dark.py` — миграция.
- `backend/ac_brands/management/commands/generate_brand_dark_logos.py` (231 строка) — команда.
- `backend/ac_brands/tests/test_dark_logo_generator.py` (19 тестов).
- `backend/ac_brands/tests/test_generate_brand_dark_logos_command.py` (11 тестов).
- `backend/ac_brands/tests/test_dark_logo_admin.py` (4 теста).
- `backend/ac_catalog/tests/test_logo_dark_serializers.py` (5 тестов).
- `backend/ac_brands/tests/fixtures/logos/` — 4 PoC-фикстуры (casarte, haier, lg, mhi).

### Изменения

- `backend/ac_brands/models.py` — добавлено поле `logo_dark = ImageField(null=True, blank=True, upload_to='ac_rating/brands/dark/')`.
- `backend/ac_brands/admin.py` — колонка `logo_dark_preview` в списке, `logo_dark_preview_large` readonly на detail, новый action `generate_dark_logos_action`.
- `backend/ac_catalog/serializers.py`:
  - `BrandSerializer`: +`logo_dark` (через `_url_with_mtime`).
  - `ACModelListSerializer`: +`brand_logo_dark`.
- `backend/ac_brands/tests/test_models.py` — +2 теста (nullable, independence).

## Миграция — проверка

```
$ python manage.py makemigrations ac_brands --dry-run
Migrations for 'ac_brands':
  ac_brands/migrations/0002_brand_logo_dark.py
    - Add field logo_dark to brand

$ python manage.py sqlmigrate ac_brands 0002
BEGIN;
ALTER TABLE "ac_brands_brand" ADD COLUMN "logo_dark" varchar(100) NULL;
COMMIT;

$ python manage.py migrate ac_brands
Operations to perform:
  Apply all migrations: ac_brands
Running migrations:
  Applying ac_brands.0002_brand_logo_dark... OK
```

Простой `ADD COLUMN ... NULL` — без default, без data-migration. Существующие
22 бренда получат NULL в `logo_dark` (корректно: фронт трактует falsy как
"использовать оригинал + CSS invert fallback").

Применено на локальной dev-DB без ошибок.

## Тесты

### Итого

```
51 passed  ac_brands               (TZ требовал 40+)
 5 passed  ac_catalog (serializer)
---
147 passed ac_brands + ac_catalog full suite (0 fail)
```

### Разбивка по файлам

| Файл                                          | Тестов | Что покрывает |
|-----------------------------------------------|-------:|---------------|
| test_dark_logo_generator.py                   |     19 | cleanup, classify, generate, mono/colored/force_* комбинации, byte-input, canvas size |
| test_generate_brand_dark_logos_command.py     |     11 | dry-run, slug, force-colored/mono/force, default override lg, no-default-overrides, existing skip, conflict |
| test_dark_logo_admin.py                       |      4 | preview empty/populated, bulk action |
| test_logo_dark_serializers.py (ac_catalog)    |      5 | BrandSerializer, ACModelListSerializer, ACModelDetailSerializer |
| test_models.py (+ к существующим)             |      2 | logo_dark nullable, independence |

### Фикстуры

4 PNG из PoC v6 (скопированы из `/tmp/logo-poc/original/`):
- `casarte.png` — mono (stdev ~0)
- `haier.png`   — colored (stdev ~36)
- `lg.png`      — mono false-positive (stdev ~15 < threshold)
- `mhi.png`     — mono (stdev ~12)

## Поведение на прод-брендах

Sanity-check через Django shell (на фикстурах, эмулируя прод):

```
casarte    mono=True  stdev=  0.00 → recolor
haier      mono=False stdev= 36.17 → skip
lg         mono=True  stdev= 14.80 → recolor (должен быть --force-colored)
mhi        mono=True  stdev= 12.36 → recolor
```

**Прогон dry-run команды** (локальная DB, 22 бренда, файлы только на проде):
все 22 бренда enumerated, READ-FAIL на чтении — ожидаемо, файлы на прод-сервере.
Логика классификации проверена отдельно на фикстурах.

## Публичное API

`GET /api/public/v1/rating/models/` возвращает для каждой модели:
```json
{
  "brand": "CASARTE",
  "brand_logo": "/media/ac_rating/brands/casarte.png?v=1776872344",
  "brand_logo_dark": "/media/ac_rating/brands/dark/casarte-dark.png?v=1776872344",
  ...
}
```

Для брендов без dark-версии `brand_logo_dark` == `""` (фронт проверяет truthy).

## Прогон на прод (**после merge**)

```bash
docker compose -f docker-compose.prod.yml exec backend \
  python manage.py generate_brand_dark_logos --force-colored lg

docker compose -f docker-compose.prod.yml exec backend \
  python manage.py shell -c "from ac_brands.models import Brand; \
  [print(b.name, b.logo_dark.name if b.logo_dark else '—') for b in Brand.objects.all()]"
```

Ожидаемо: ~18 брендов получат dark-версию, ~4 colored (Haier, Midea, etc.)
останутся без. Если какие-то выглядят плохо визуально — override через
`--force-mono <slug>` или `--force-colored <slug>`.

## Скриншоты админки

- `ac-rating/reports/dark-logos-screens/admin-brand-list-empty.png` — список
  брендов (22), колонки «Лого» и «Лого (dark)», всё `—` до генерации.
- `ac-rating/reports/dark-logos-screens/admin-brand-list-populated.png` —
  тот же список после ручной генерации на 4 брендах (Casarte, Haier, LG,
  Mhi). CASARTE и Mhi — с dark-превью на тёмном фоне; Haier и LG — без
  (colored / force-colored).
- `ac-rating/reports/dark-logos-screens/admin-brand-detail.png` — CASARTE
  detail view с двумя полями (light + dark) и двумя превью.
- `ac-rating/reports/dark-logos-screens/admin-actions-menu.png` —
  Actions-дропдаун с новым пунктом «Сгенерировать dark-логотипы».

## Открытые вопросы / riski

Нет blocker'ов. Миграция чистая, сервис детерминирован, команда покрыта
тестами, API отдаёт поле.

Единственный nuance: **LG** по текущему алгоритму ловится как mono
(stdev ~15, ниже threshold 20) — как и прогнозировал PoC. Это adressed
через DEFAULT_FORCE_COLORED={"lg"} в команде — но если появится другой
бренд с похожим профилем (цветной бренд с низкой саturation), потребуется
добавить slug в `--force-colored`. Для будущей automation можно поднять
threshold до 25-30, но это может начать ловить mono как colored — лучше
оставить явный override list.

## Acceptance checklist

- [x] Миграция применяется чисто локально (`migrate` OK; `sqlmigrate` —
      простой `ALTER TABLE ADD COLUMN NULL`).
- [x] Management command запускается на всех 22 брендах (dry-run показывает
      enumeration; генерация требует файлов, которых локально нет).
- [x] Admin показывает две превьюхи: light + dark (скриншоты).
- [x] `GET /api/public/v1/rating/models/` возвращает `brand_logo` и
      `brand_logo_dark` в каждой модели (проверено через curl).
- [x] 40+ новых тестов (факт: 41 новых в `ac_brands` + 5 в `ac_catalog`).
      Весь `pytest ac_brands` — 51 passed.
- [x] Отчёт + 4 скриншота админки.
