# Polish-3: Пресеты «Своего рейтинга» в Django Admin

**Проблема:** 6 пресетов таба «Свой рейтинг» (`Август-климат` / `Тишина` / `Сибирь` / `Бюджет` / `Частный дом` / `Аллергики`) захардкожены на фронте в `PRESET_TAGS` с substring-эвристикой по `criterion.code` + `criterion.name_ru`. Редактор не может добавить/изменить пресет без разработчика.

**Решение:** вынести пресеты в БД как отдельная модель `RatingPreset`, связанная с `Criterion` через M2M. Редактирование через Django Admin с `filter_horizontal`. Фронт получает готовые пресеты в `methodology.presets`.

**Исполнители:** AC-Петя (backend) + AC-Федя (frontend), параллельно.

---

## Backend (AC-Петя)

**Worktree:** `ERP_Avgust_ac_petya_presets_db`
**Ветка:** `ac-rating/presets-db-backend`
**От:** `origin/main`

### 1. Модель `RatingPreset`

Файл: `backend/ac_methodology/models.py` (добавить в конец).

```python
class RatingPreset(TimestampedModel):
    slug = models.SlugField(max_length=64, unique=True, verbose_name="Slug")
    label = models.CharField(max_length=128, verbose_name="Название")
    order = models.PositiveSmallIntegerField(default=0, verbose_name="Порядок")
    is_active = models.BooleanField(default=True, verbose_name="Активен")
    description = models.TextField(blank=True, default="", verbose_name="Описание")
    criteria = models.ManyToManyField(
        "Criterion",
        related_name="presets",
        verbose_name="Критерии",
        blank=True,
    )
    is_all_selected = models.BooleanField(
        default=False,
        verbose_name="Выбирает все критерии",
        help_text="Если включено — M2M игнорируется, пресет включает все активные критерии методики.",
    )

    class Meta:
        ordering = ["order", "label"]
        verbose_name = "Пресет «Свой рейтинг»"
        verbose_name_plural = "Пресеты «Свой рейтинг»"

    def __str__(self) -> str:
        return f"{self.label} ({self.slug})"
```

Паттерн `is_all_selected=True` нужен для пресета «Август-климат» (выбирает все критерии — чтобы при добавлении новых критериев он автоматически их учитывал, без ручного update M2M).

### 2. Миграция `0004_ratingpreset.py` (или следующий номер)

`python manage.py makemigrations ac_methodology` — создаст автоматически.

**Затем:** отдельная data-migration `0005_seed_initial_presets.py` через RunPython для создания 6 текущих пресетов с ручным отбором critériев:

```python
from django.db import migrations

PRESETS = [
    {
        "slug": "avgust",
        "label": "Август-климат",
        "order": 0,
        "is_all_selected": True,
        "description": "Рейтинг по полной методике Август-климат — все активные критерии с текущими весами.",
    },
    {
        "slug": "silence",
        "label": "Тишина",
        "order": 1,
        "include_substrings": ["noise", "fan", "inverter", "silen", "шум", "вент", "инверт", "тих"],
        "description": "Приоритет тихой работы: малый уровень шума, инверторный компрессор, плавная регулировка вентилятора.",
    },
    {
        "slug": "cold",
        "label": "Сибирь",
        "order": 2,
        "include_substrings": ["heater", "cold", "winter", "evi", "drip", "8c", "heat_mode", "обогрев", "холод", "подд", "зима"],
        "description": "Работа в холодном климате: подогрев поддона, EVI-компрессор, обогрев до −25°C.",
    },
    {
        "slug": "budget",
        "label": "Бюджет",
        "order": 3,
        "exclude_substrings": ["wifi", "ionizer", "uv", "alice", "sensor", "auto_freeze", "sterilization", "aromat", "алис", "ионизат", "ультрафиол", "ароматиз"],
        "description": "Базовая функциональность без премиум-опций.",
    },
    {
        "slug": "house",
        "label": "Частный дом",
        "order": 4,
        "include_substrings": ["pipe", "height", "heat_exchanger", "compressor", "evi", "heater", "cold", "фреон", "перепад", "теплообмен", "компрес"],
        "description": "Длинная трасса, большой перепад высот, надёжный компрессор и теплообменник.",
    },
    {
        "slug": "allergy",
        "label": "Аллергики",
        "order": 5,
        "include_substrings": ["filter", "ionizer", "uv", "sterilization", "fresh_air", "self_clean", "heat_exchanger", "compressor", "фильтр", "ионизат", "приток", "теплообмен"],
        "description": "Эффективная очистка воздуха: тонкие фильтры, ионизатор, УФ-лампа, приток свежего воздуха.",
    },
]


def seed(apps, schema_editor):
    RatingPreset = apps.get_model("ac_methodology", "RatingPreset")
    Criterion = apps.get_model("ac_methodology", "Criterion")
    criteria = list(Criterion.objects.all())

    def matches(needles, haystacks):
        needles_lc = [n.lower() for n in needles]
        return any(n in h.lower() for h in haystacks for n in needles_lc)

    for spec in PRESETS:
        include = spec.pop("include_substrings", None)
        exclude = spec.pop("exclude_substrings", None)
        preset, _ = RatingPreset.objects.update_or_create(slug=spec["slug"], defaults=spec)
        if preset.is_all_selected:
            preset.criteria.clear()  # is_all_selected=True → M2M не нужен
            continue
        picked = []
        for c in criteria:
            hay = [c.code, c.name_ru or ""]
            if exclude:
                if not matches(exclude, hay):
                    picked.append(c)
            elif include:
                if matches(include, hay):
                    picked.append(c)
        preset.criteria.set(picked)


def unseed(apps, schema_editor):
    RatingPreset = apps.get_model("ac_methodology", "RatingPreset")
    RatingPreset.objects.filter(slug__in=[p["slug"] for p in PRESETS]).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("ac_methodology", "0004_ratingpreset"),  # актуальный номер
    ]
    operations = [migrations.RunPython(seed, unseed)]
```

**Важно (из CLAUDE.md sensitive):** перед push — бэкап прод-БД, проверить `sqlmigrate` + `migrate --plan`.

### 3. Django Admin

Файл: `backend/ac_methodology/admin.py` — новый ModelAdmin:

```python
@admin.register(RatingPreset)
class RatingPresetAdmin(admin.ModelAdmin):
    list_display = ("order", "label", "slug", "is_active", "is_all_selected", "criteria_count")
    list_display_links = ("label",)
    list_editable = ("order", "is_active")
    list_filter = ("is_active", "is_all_selected")
    search_fields = ("slug", "label")
    filter_horizontal = ("criteria",)
    fields = ("slug", "label", "order", "is_active", "is_all_selected", "description", "criteria")
    readonly_fields = ()

    @admin.display(description="Критериев")
    def criteria_count(self, obj):
        if obj.is_all_selected:
            return "ВСЕ"
        return obj.criteria.count()
```

### 4. Serializer

Файл: `backend/ac_catalog/serializers.py` — в `MethodologySerializer` добавить `presets` field:

```python
class RatingPresetSerializer(serializers.ModelSerializer):
    criteria_codes = serializers.SerializerMethodField()

    class Meta:
        model = RatingPreset
        fields = ("id", "slug", "label", "order", "description", "is_all_selected", "criteria_codes")

    def get_criteria_codes(self, obj):
        if obj.is_all_selected:
            # Возвращаем все коды критериев активной методики
            methodology = self.context.get("methodology_active")
            if methodology:
                return list(methodology.criteria.values_list("code", flat=True))
            return []
        return list(obj.criteria.values_list("code", flat=True))


class MethodologySerializer(serializers.ModelSerializer):
    # ... существующие поля
    presets = serializers.SerializerMethodField()

    def get_presets(self, obj):
        active_presets = RatingPreset.objects.filter(is_active=True).prefetch_related("criteria")
        ctx = {**self.context, "methodology_active": obj}
        return RatingPresetSerializer(active_presets, many=True, context=ctx).data
```

Либо проще — добавить criteria как `SlugRelatedField(slug_field="code", many=True)`, но SerializerMethodField с `is_all_selected`-fallback чище.

### 5. Тесты

Файл: `backend/ac_methodology/tests/test_rating_preset.py` (новый):

- Model: `__str__`, ordering, M2M с Criterion.
- Admin: `criteria_count` возвращает "ВСЕ" для all-selected, иначе count.
- Migration seed: после data-migration существуют 6 пресетов, у `avgust` `is_all_selected=True`, у `silence` ≥ 1 critérium.
- Serializer: `criteria_codes` для all-selected = все коды активной методики; для обычного = M2M codes.
- API `/api/public/v1/rating/methodology/` — ответ содержит `presets` array длиной 6.

### Acceptance backend

- [ ] Миграция применяется чисто. 6 пресетов в БД после seed.
- [ ] Admin: список пресетов, редактирование через `filter_horizontal` работает.
- [ ] API `/methodology/` возвращает `presets` с корректными `criteria_codes`.
- [ ] 10+ новых тестов зелёные, весь `pytest ac_methodology` 40+ pass.
- [ ] Прогон на проде: `python manage.py migrate ac_methodology` → 6 пресетов.
- [ ] Отчёт `ac-rating/reports/presets-db-backend.md` + скриншот админки (list + detail).

---

## Frontend (AC-Федя)

**Worktree:** `ERP_Avgust_ac_fedya_presets_db`
**Ветка:** `ac-rating/presets-db-frontend`
**От:** `origin/main`

### 1. Types

Файл: `frontend/lib/api/types/rating.ts`:

```ts
export type RatingMethodologyPreset = {
  id: number;
  slug: string;
  label: string;
  order: number;
  description: string;
  is_all_selected: boolean;
  criteria_codes: string[];
};

export type RatingMethodology = {
  // ... existing
  presets: RatingMethodologyPreset[];
};
```

### 2. CustomRatingTab

Файл: `frontend/app/(hvac-info)/ratings/_components/CustomRatingTab.tsx`:

- **Удалить** `PRESET_TAGS` (строка 1213), `buildPresetsFromCriteria`, импорт + export `buildPresetsFromCriteria`.
- `presetDefs` вычисляется из `methodology.presets` напрямую:
  ```ts
  const presetDefs = useMemo<PresetDef[]>(
    () => methodology.presets
      .sort((a, b) => a.order - b.order)
      .map((p) => ({ id: p.slug, label: p.label, codes: p.criteria_codes })),
    [methodology.presets],
  );
  ```
- `detectPreset(active, presets)` остаётся — логика matching не меняется.

### 3. Тесты

- Обновить существующие unit-тесты `CustomRatingTab.test.tsx` — фикстура методики теперь должна включать `presets`.
- Новый тест: если `methodology.presets` пустой → рендерится 0 preset-chips, grid всё равно работает.

### Acceptance frontend

- [ ] Таб «Свой рейтинг» показывает те же 6 пресетов (визуально идентично до/после).
- [ ] Клик на пресет выбирает критерии ровно как раньше.
- [ ] Редактирование пресета в Django Admin (добавить/убрать критерий) → после обновления страницы меняется набор критериев в пресете.
- [ ] 5+ обновлённых/новых тестов зелёные, весь ratings-suite 120+ pass.
- [ ] Отчёт `ac-rating/reports/presets-db-frontend.md` + скриншот до/после (должны быть идентичными).

---

## Порядок

1. Петя и Федя стартуют параллельно.
2. Федя работает с моками (hardcoded fixture с presets в `CustomRatingTab.test.tsx`).
3. После merge Пети — Федя rebase, финальный QA с реальным API.
4. Техлид (я) делает финальный review + deploy.

## Shared files

Петя — `backend/ac_methodology/*`, `backend/ac_catalog/serializers.py`.
Федя — `frontend/lib/api/types/rating.ts`, `frontend/app/(hvac-info)/ratings/_components/CustomRatingTab.tsx`.

Конфликтов не ожидается.
