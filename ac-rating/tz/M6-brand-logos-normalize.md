# ТЗ Фазы M6 — Нормализация бренд-логотипов (equal optical weight)

**Фаза:** M6 (maintenance, визуальная полировка)
**Ветка:** `ac-rating/m6-brand-logos-normalize` (от `main`)
**Зависит от:** prod deploy 2026-04-21 (данные + медиа на hvac-info.com)
**Оценка:** 1-1.5 дня

## Контекст / боль

После prod deploy мы залили 22 бренд-логотипа (в `/media/brands/<slug>.png`). Визуально
они выглядят **рассинхронизированно** — см. `ac-rating/reports/m6-screenshots/before.png`
(положи сам скриншот, Андрей пришлёт):

- AQUA, MDV — массивные, доминируют по ширине
- Haier, Casarte — средние
- Kalashnikov, Energolux — маленькие и «пустые» (внутри PNG много whitespace)
- Royal Clima — круглый, выглядит мельче соседей
- Midea-в-круге — средний

Источник проблемы: исходные PNG **разных** пропорций + разные уровни внутреннего
padding (невидимый прозрачный/белый). CSS `object-fit: contain` вписывает в бокс, но
плотность/«оптический вес» у всех разная.

**Цель M6:** нормализовать 22 PNG на единый canvas с единым optical weight — визуально
все логотипы должны восприниматься **как одного веса** в листинге моделей рейтинга.

## Подход — Python + Pillow preprocess

### Алгоритм `normalize_logo(src_path) -> Image`:

1. **Открыть PNG как RGBA.** Если исходник JPG/WebP — конвертировать в RGBA (прозрачность = отсутствует, фон считаем белым — шаг 2).
2. **Определить «content-bbox»** — обрезать прозрачность и белый фон:
   - Если у изображения alpha-канал есть значения < 255 → `img.getbbox()` (Pillow native) обрезает по непрозрачным пикселям.
   - Если фон белый (RGB: 255,255,255 ±5 tolerance) → вычислить вручную:
     ```python
     def content_bbox_rgb(img):
         arr = np.asarray(img.convert("RGB"))
         mask = np.any(arr < 250, axis=-1)  # не-белые пиксели
         rows = np.any(mask, axis=1)
         cols = np.any(mask, axis=0)
         if not rows.any(): return None
         rmin, rmax = np.where(rows)[0][[0, -1]]
         cmin, cmax = np.where(cols)[0][[0, -1]]
         return (cmin, rmin, cmax + 1, rmax + 1)
     ```
3. **Crop до content-bbox** — убираем пустые поля.
4. **Scale к target-size** с сохранением aspect:
   - Canvas target: **200×56** (px). Соотношение ~3.5:1 — комфортное для листинга.
   - Content max-height = 40 (71% от 56), content max-width = 160 (80% от 200).
   - `scale = min(160 / cropped.width, 40 / cropped.height)`.
   - `resize((int(cropped.w * scale), int(cropped.h * scale)), Image.LANCZOS)`.
5. **Положить на прозрачный canvas 200×56**, центрировано:
   ```python
   canvas = Image.new("RGBA", (200, 56), (0, 0, 0, 0))
   offset = ((200 - content.width) // 2, (56 - content.height) // 2)
   canvas.paste(content, offset, content if content.mode == "RGBA" else None)
   ```
6. **Сохранить** как PNG с оптимизацией: `canvas.save(dst, "PNG", optimize=True)`.

**Результат:** все 22 лого на одинаковом canvas 200×56. Content занимает ≤80% × ≤71%,
центрировано. Плотные (AQUA/MDV) получат max-height-constrained → станут пропорционально
уже. Воздушные (Kalashnikov) получат max-width-constrained → станут пропорционально
выше. В листинге все **визуально одного веса**.

### Обработка edge-cases:

- **JPG с белым фоном** (Energolux.jpg, Mhi-5.jpg из оригинального Максимовского дампа):
  content_bbox_rgb обрезает по не-белому → работает.
- **PNG с обводкой на белом** (LG, Casarte): содержимое лого обычно тёмное на белом →
  bbox корректный.
- **Уже прозрачный PNG** (viomi.png, большинство новых): `img.getbbox()` даёт tight bbox.
- **Логотип с мелкими artefacts** (copyright значки, TM): bbox включит их → незначимо, <2% площади.

### Защита от перерегрессии:

Перед записью нового файла — **бэкап старого** в `brands/pre-normalize/<slug>.png`
(через `storage.save()`), чтобы можно было откатиться. Работает только 1 раз — при
повторном запуске если `pre-normalize/` уже есть — не перезаписывать (первый снапшот
самый ценный).

## Задачи

### M6.1 — Management command `normalize_brand_logos`

**Файл:** `backend/ac_brands/management/commands/normalize_brand_logos.py`.

Структура:

```python
from django.core.management.base import BaseCommand
from django.core.files.base import ContentFile
from ac_brands.models import Brand
from ac_brands.services.logo_normalizer import normalize_logo_file
import io


class Command(BaseCommand):
    help = "Нормализует логотипы всех брендов (content-crop + canvas 200x56)."

    def add_arguments(self, parser):
        parser.add_argument("--brand", help="Slug или name одного бренда (default: все).")
        parser.add_argument("--dry-run", action="store_true", help="Не сохранять, только showing.")
        parser.add_argument("--force", action="store_true", help="Перезаписать даже если backup уже есть.")

    def handle(self, *args, **opts):
        qs = Brand.objects.filter(is_active=True, logo__isnull=False).exclude(logo="")
        if opts.get("brand"):
            qs = qs.filter(name__iexact=opts["brand"])

        for brand in qs:
            # 1. Read
            with brand.logo.storage.open(brand.logo.name, "rb") as f:
                src_bytes = f.read()

            # 2. Normalize
            try:
                normalized_bytes = normalize_logo_file(src_bytes)
            except Exception as e:
                self.stderr.write(f"  FAIL {brand.name}: {e}")
                continue

            # 3. Backup original (once)
            backup_name = f"brands/pre-normalize/{brand.name.lower().replace(' ', '_')}.png"
            if not brand.logo.storage.exists(backup_name) or opts.get("force"):
                brand.logo.storage.save(backup_name, ContentFile(src_bytes))

            # 4. Write normalized back to same Brand.logo path
            if opts["dry_run"]:
                self.stdout.write(f"  DRY  {brand.name} → would write {len(normalized_bytes)} bytes")
            else:
                # Save to same path, overwrite
                path = brand.logo.name
                brand.logo.storage.delete(path)
                brand.logo.storage.save(path, ContentFile(normalized_bytes))
                self.stdout.write(f"  OK   {brand.name:25s} {len(src_bytes)//1024}KB → {len(normalized_bytes)//1024}KB")

        self.stdout.write("Done.")
```

### M6.2 — Service `logo_normalizer`

**Файл:** `backend/ac_brands/services/logo_normalizer.py` (новый).

```python
from __future__ import annotations
import io
from PIL import Image
import numpy as np

CANVAS_W, CANVAS_H = 200, 56
MAX_CONTENT_W = 160  # 80% от canvas_w
MAX_CONTENT_H = 40   # ~71% от canvas_h
WHITE_TOLERANCE = 250  # считаем белым всё выше этого уровня


def _content_bbox(img: Image.Image) -> tuple[int, int, int, int] | None:
    """Определяет bbox не-прозрачного или не-белого контента. None если изображение пустое."""
    if img.mode != "RGBA":
        img = img.convert("RGBA")

    # Если есть полупрозрачные пиксели — используем alpha
    alpha = np.asarray(img)[..., 3]
    if alpha.min() < 255:
        mask = alpha > 10
    else:
        # Все пиксели непрозрачные → фон должен быть белым, ищем не-белый
        rgb = np.asarray(img)[..., :3]
        mask = np.any(rgb < WHITE_TOLERANCE, axis=-1)

    if not mask.any():
        return None

    rows = np.any(mask, axis=1)
    cols = np.any(mask, axis=0)
    rmin, rmax = np.where(rows)[0][[0, -1]]
    cmin, cmax = np.where(cols)[0][[0, -1]]
    return (int(cmin), int(rmin), int(cmax) + 1, int(rmax) + 1)


def normalize_logo_file(src_bytes: bytes) -> bytes:
    """Принимает bytes исходного логотипа, возвращает bytes нормализованного PNG."""
    img = Image.open(io.BytesIO(src_bytes)).convert("RGBA")

    bbox = _content_bbox(img)
    if bbox is None:
        raise ValueError("Empty or all-white image")

    content = img.crop(bbox)

    # Scale under MAX_CONTENT
    scale = min(MAX_CONTENT_W / content.width, MAX_CONTENT_H / content.height)
    new_w = max(1, int(round(content.width * scale)))
    new_h = max(1, int(round(content.height * scale)))
    content = content.resize((new_w, new_h), Image.LANCZOS)

    # Canvas + center
    canvas = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    offset = ((CANVAS_W - new_w) // 2, (CANVAS_H - new_h) // 2)
    canvas.paste(content, offset, content)

    out = io.BytesIO()
    canvas.save(out, "PNG", optimize=True)
    return out.getvalue()
```

### M6.3 — Admin action «Normalize logo»

**Файл:** `backend/ac_brands/admin.py`.

В `BrandAdmin`:
```python
actions = ["normalize_selected_logos"]

@admin.action(description="Нормализовать логотипы (crop + canvas 200×56)")
def normalize_selected_logos(self, request, queryset):
    from ac_brands.services.logo_normalizer import normalize_logo_file
    from django.core.files.base import ContentFile
    count = 0
    for brand in queryset.filter(logo__isnull=False).exclude(logo=""):
        with brand.logo.storage.open(brand.logo.name, "rb") as f:
            src = f.read()
        try:
            norm = normalize_logo_file(src)
        except Exception as e:
            self.message_user(request, f"Ошибка для {brand.name}: {e}", level="ERROR")
            continue
        path = brand.logo.name
        brand.logo.storage.delete(path)
        brand.logo.storage.save(path, ContentFile(norm))
        count += 1
    self.message_user(request, f"Нормализовано логотипов: {count}")
```

**Зачем:** в будущем админ сможет загружать оригинальный логотип через Django-форму и
одним действием нормализовать — вручную, без вызова management-команды.

### M6.4 — Тесты

**Файл:** `backend/ac_brands/tests/test_logo_normalizer.py`.

Фикстуры (генерировать в тесте через Pillow):

- `test_wide_rgba_logo` — 500×50 с solid-red контентом → bbox 500×50 → scale to 160×16 →
  canvas 200×56 center.
- `test_tall_rgba_logo` — 40×200 → scale to 8×40 → canvas center.
- `test_whitebg_no_alpha` — 300×100 white background + black square 10..290×10..90 →
  content_bbox (10,10,290,90) → scale → canvas.
- `test_empty_image` — full transparent → ValueError.
- `test_square_logo` — 100×100 content → uses min(160/100, 40/100) = 0.4 → 40×40 → canvas.
- `test_preserves_aspect` — 200×50 content (aspect 4:1) → output content-aspect остаётся 4:1.
- `test_canvas_dimensions` — любое output = 200×56 exactly.

Ожидаемо **7+ новых тестов**.

### M6.5 — Прогон normalize на проде

После merge M6 в main:
1. Deploy (`./deploy/deploy.sh`).
2. **На проде**: `docker compose exec backend python manage.py normalize_brand_logos`.
   - Команда сделает backup + нормализует все 22 бренда.
   - Brand.logo-пути не меняются (перезаписывает по тому же path).
   - Frontend сам подхватит новые файлы (nginx cache-bust через filename остаётся тем же;
     но nginx Expires может дать до 1h задержки — проверить max-age в nginx или бампнуть timestamp).

**Если nginx кеширует /media/ с длинным expires** — нужно либо:
- Добавить query-param `?v=<timestamp>` в Brand.logo URL (но это изменит serializer)
- Либо сократить Expires для /media/brands/ до 300s на время M6
- Либо **сменить имя файла** при нормализации (`brands/casarte-v2.png`) и обновить Brand.logo.

Проверь `/etc/nginx/sites-enabled/hvac-info.conf` — `grep expires` / `grep 'Cache-Control'` для `/media/` location.

### M6.6 — Документация

В `backend/ac_brands/services/logo_normalizer.py` — docstring с:
- Параметрами canvas (200×56, 80%/71% content)
- Ссылкой на ТЗ M6
- Примером «До/После» для 2-3 брендов (в комментарии: размеры в kB, содержимое bbox)

В `ac-rating/reports/m6-brand-logos-normalize.md` (отчёт):
- Скриншоты before/after для 22 брендов на странице `/ratings`
- Размеры файлов до и после (экономия должна быть — normalized < original обычно)
- Визуальная оценка: 22 логотипа выглядят одного оптического веса?

## Приёмочные критерии

- [ ] `manage.py check` + `makemigrations --dry-run` чисто
- [ ] `pytest backend/ac_brands/tests/` — зелёный (+7 новых)
- [ ] `manage.py normalize_brand_logos --dry-run` — показывает что сделает, без записи
- [ ] На dev: `manage.py normalize_brand_logos` → 22 лого нормализованы, backup в `brands/pre-normalize/`
- [ ] На проде (после deploy M6 + команды): `https://hvac-info.com/ratings/` показывает все 22 лого **визуально одного веса** — не более 30% разницы в optical area между самым плотным и самым разреженным. Скриншот в отчёте.
- [ ] Файлы в `/media/brands/<slug>.png` остаются 200×56 PNG, открываются в любом просмотрщике
- [ ] Admin action «Normalize logo» работает на одиночном Brand

## Ограничения

- **НЕ менять** структуру `Brand.logo` поля или path
- **НЕ переименовывать** файлы (перезаписывать in-place)
- **НЕ трогать** `ACModelPhoto` или другие media — скоуп только Brand
- **НЕ реализовывать** auto-normalize через signal (on save) — можно в отдельном эпике
- **Pillow + numpy** — добавить в `requirements.txt` если нет (Pillow уже есть; numpy тоже есть для news rating_service). Проверь.
- Conventional Commits, по коммиту на M6.N. Trailer `Co-authored-by: AC-Петя <ac-petya@erp-avgust>`.

## Формат отчёта

`ac-rating/reports/m6-brand-logos-normalize.md`:
1. Коммиты
2. Алгоритм (короткое описание, как работает)
3. Результаты dry-run на локальной dev-БД (22 бренда, размеры до/после)
4. Результаты применения на проде (размеры, время выполнения)
5. Скриншоты before/after на `/ratings/`
6. Известные риски / edge cases (например: если какой-то PNG имеет особенности)
7. Ключевые файлы

## Подсказки от техлида

- **Canvas 200×56 ~ 3.5:1** — оптимально для листинга где ширина колонки ~180px. Если дизайнер пересмотрит — поменяй constants в logo_normalizer.py.
- **MAX_CONTENT 80%×71%** — эвристика. Если после нормализации логотипы кажутся мелкими — поменяй до 85%×80%. Если крупными — до 75%×65%. Subjective, итеративно.
- **WHITE_TOLERANCE = 250** — не-белым считаем RGB < 250. Можно увеличить до 240 если логотипы на grey background плохо crop'ятся.
- **`content.paste(..., mask=content)`** — если content.mode==RGBA, маска обязательна для сохранения прозрачности. Если mode==RGB — без маски. Проверь.
- **Nginx cache `/media/`** — если старый логотип кешируется у пользователей по expires, можно добавить `?v=<brand.updated_at>` через модель (нужно поле `logo_version` или использовать `updated_at` если есть). Альтернатива: **bust через file rename** — при нормализации сохранять в `brands/<slug>-norm.png` и update Brand.logo. Но это усложняет. Попробуй сначала просто перезаписать, проверь через incognito — если кеш не бьёт, проблема решена.
- **`img.convert("RGBA")`** дважды (в bbox-detect + при crop) — не оптимально, но для 22 файлов не критично. Если профайлинг покажет — optimize.
- **Не используй `Image.thumbnail()`** — она in-place, теряешь исходный объект. Используй `Image.resize()` с explicit size.

## Запуск

```bash
cd /Users/andrei_prygunov/obsidian/avgust/ERP_Avgust
git fetch origin
git worktree add -b ac-rating/m6-brand-logos-normalize \
    ../ERP_Avgust_ac_petya_m6 origin/main
cd ../ERP_Avgust_ac_petya_m6
# тесты → команда → admin-action → отчёт
# rebase + merge --no-ff + push
# remove worktree

# На проде после merge:
# ssh root@216.57.110.41
# cd /opt/finans_assistant && git pull && ./deploy/deploy.sh
# docker compose exec backend python manage.py normalize_brand_logos
```
