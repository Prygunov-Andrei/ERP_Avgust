# F8-02: ERP — блок «HVAC» в левом меню + раздел ISMeta

**Команда:** IS-Петя (backend-настройки) + IS-Федя (frontend меню)
**Effort:** 1-2 дня
**Зависимости:** нет (можно параллельно с 01, 04). Этап 03 зависит от этого.

---

## Цель

Реструктурировать левое меню ERP: создать единый блок «HVAC» в
котором подразделами разместить уже существующие HVAC-Сметы,
HVAC-Новости, HVAC-Рейтинг + добавить новый подраздел **HVAC-ISMeta**
с страницей настроек публичного сайта распознавания.

## Текущее состояние

В `frontend/components/erp/components/Layout.tsx` сейчас 3 отдельных
top-level пункта в левом меню:
- **9. HVAC-СМЕТЫ** (`/hvac/смет?`)
- **10. HVAC-НОВОСТИ** — collapsible с children (Новости, Категории
  новостей, Производители, Бренды, и др.)
- **11. HVAC-Рейтинг** (`/hvac/rating?`)

Эти 3 раздуты как top-level. PO решил собрать в один блок «HVAC».

## Целевое состояние

### Структура меню (после)

```
... (другие top-level пункты ERP — Финансы, Сметы, Поставщики, и т.д.)
HVAC ▾ (новый top-level collapsible)
  ├─ HVAC-Сметы
  ├─ HVAC-Новости ▾
  │    ├─ Новости
  │    ├─ Категории новостей
  │    ├─ Производители
  │    ├─ Бренды
  │    ├─ Ресурсы
  │    └─ Настройки поиска
  ├─ HVAC-Рейтинг
  └─ HVAC-ISMeta ▾ (новый)
       ├─ Настройки
       └─ История загрузок (опционально, для будущего monitoring)
```

### Страница «HVAC-ISMeta → Настройки»

URL: `/hvac/ismeta/settings`

Поля формы:
| Поле | Тип | Default | Описание |
|------|-----|---------|---------|
| `enabled` | toggle | true | Включить публичный сайт ISMeta. Если выключено — на hvac-info.com показывается «Сервис временно недоступен». |
| `default_pipeline` | select | `td17g` | По умолчанию какой движок: `main` (DeepSeek pure-LLM) или `td17g` (Docling+Camelot+Vision hybrid). Видно пользователю в выпадающем списке но default это. |
| `default_llm_profile_id` | select | DeepSeek | По умолчанию какая ИИ-модель из 4 (DeepSeek/OpenAI/Gemini/Grok). Использует `LLMProfile` из ismeta-postgres. |
| `concurrency_limit_enabled` | toggle | true | Ограничить 1 PDF одновременно с одной сессии. Для внутреннего ISMeta MVP = false. |
| `pdf_storage_path` | text | `/storage/ismeta-uploads/` | Куда сервер копирует загруженные PDF. |
| `require_registration` | toggle | false | Требовать регистрацию для доступа. По умолчанию выключено. На будущее. |
| `max_file_size_mb` | number | 50 | Лимит на размер PDF (предотвращает OOM). |
| `feedback_email` | text | `andrei@aug-clim.ru` | Адрес куда уходят feedback из формы внизу страницы. |

Кнопка «Сохранить» → POST в backend.

## Файлы которые меняем

### Frontend

#### `frontend/components/erp/components/Layout.tsx`
1. Удалить top-level пункты `HVAC-СМЕТЫ`, `HVAC-НОВОСТИ`, `HVAC-Рейтинг`.
2. Создать новый top-level `HVAC` collapsible.
3. Внутри `HVAC` поместить как children:
   - HVAC-Сметы
   - HVAC-Новости (с её existing children)
   - HVAC-Рейтинг
   - **HVAC-ISMeta** — новый, с child «Настройки» (`/hvac/ismeta/settings`)
4. Обновить breadcrumbs (`pathToParent`).

#### `frontend/app/hvac/ismeta/settings/page.tsx` (новый файл)
React-страница с формой настроек. Использовать существующие UI
primitives (`@/components/ui/`). Loader → GET `/api/v1/hvac/ismeta/settings`,
сохранение → PUT.

#### `frontend/lib/api/types/hvac-ismeta.ts` (новый)
TypeScript types для `HvacIsmetaSettings` (соответствие backend модели).

#### `frontend/lib/api/services/hvac-ismeta.ts` (новый)
Service: `getHvacIsmetaSettings()`, `updateHvacIsmetaSettings(data)`.

### Backend

#### `backend/hvac_ismeta/` (новый Django app)
```
hvac_ismeta/
  __init__.py
  apps.py
  models.py        # HvacIsmetaSettings (singleton, get_or_create pk=1)
  serializers.py   # HvacIsmetaSettingsSerializer
  views.py         # SettingsViewSet (retrieve, update — admin only)
  urls.py          # /api/v1/hvac/ismeta/settings
  migrations/
    0001_initial.py
  admin.py         # registration в Django admin
```

#### `backend/hvac_ismeta/models.py`
```python
class HvacIsmetaSettings(models.Model):
    enabled = models.BooleanField(default=True)
    default_pipeline = models.CharField(
        max_length=20, choices=[("main", "Main (DeepSeek)"), ("td17g", "TD-17g (hybrid)")],
        default="td17g",
    )
    default_llm_profile_id = models.IntegerField(null=True, blank=True)
    concurrency_limit_enabled = models.BooleanField(default=True)
    pdf_storage_path = models.CharField(max_length=500, default="/storage/ismeta-uploads/")
    require_registration = models.BooleanField(default=False)
    max_file_size_mb = models.IntegerField(default=50)
    feedback_email = models.EmailField(default="andrei@aug-clim.ru")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.CheckConstraint(check=models.Q(pk=1), name="hvac_ismeta_settings_singleton"),
        ]

    @classmethod
    def get_settings(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj
```

#### `backend/finans_assistant/settings.py`
Добавить `'hvac_ismeta'` в `INSTALLED_APPS` (раздел HVAC apps).
**Shared файл** — пинг команде AC Rating перед commit.

#### `backend/finans_assistant/urls.py`
Подключить `path('api/v1/hvac/ismeta/', include('hvac_ismeta.urls'))`.
**Shared файл** — пинг.

## Acceptance criteria

### Frontend
- [ ] В левом меню ERP только один top-level пункт «HVAC» вместо 3.
- [ ] HVAC раскрывается → видны 4 подпункта (Сметы, Новости, Рейтинг, ISMeta).
- [ ] HVAC-Новости остаётся collapsible с её existing children
      (Новости, Категории, Производители, Бренды, Ресурсы, Настройки поиска).
- [ ] HVAC-ISMeta раскрывается → видна «Настройки».
- [ ] Клик по «Настройки» → переход на `/hvac/ismeta/settings`.
- [ ] Существующие пути `/hvac/news`, `/hvac/rating?` etc продолжают работать.
- [ ] Breadcrumbs корректные (`HVAC > HVAC-Новости > Новости`).

### Backend
- [ ] `HvacIsmetaSettings` model создана, миграция применена.
- [ ] Singleton constraint работает (только pk=1, повторное create
      бросает IntegrityError).
- [ ] `GET /api/v1/hvac/ismeta/settings` возвращает текущие настройки
      (создаёт запись pk=1 если нет).
- [ ] `PUT /api/v1/hvac/ismeta/settings` обновляет настройки (только
      authenticated admin).
- [ ] Django admin показывает модель в разделе HVAC-ISMeta.
- [ ] Поле `default_llm_profile_id` валидируется — если задан,
      должен существовать в `llm_profile` table (FK soft check).

### Integration
- [ ] Страница `/hvac/ismeta/settings` загружает значения из
      backend и показывает в форме.
- [ ] «Сохранить» обновляет backend и показывает toast «Сохранено».
- [ ] При изменении `default_pipeline` или `default_llm_profile_id`
      настройки применяются к recognition сервису через ENV update
      (Этап 03).

## Тест-план

1. **Меню structure:** открыть ERP → проверить что HVAC top-level
   collapsible с 4 children.
2. **Existing routes:** проверить что `/hvac/news`, `/hvac/rating?`
   продолжают работать без regression.
3. **Settings page load:** открыть `/hvac/ismeta/settings` → форма
   loaded с default values.
4. **Save test:** изменить `default_pipeline` на `main`, save → reload →
   значение сохранилось.
5. **Toggle disabled:** выставить `enabled=false`, save → проверить
   что соответствующее поле в БД false.
6. **Migration:** `python manage.py migrate hvac_ismeta` → success.
7. **Admin:** Django admin → HVAC ISMeta → Settings → видна одна запись.

## Риски

- **Shared файл `Layout.tsx`:** AC Rating не предупрежден о изменении
  меню structure. Может conflict с их работой. Mitigation: пинг ДО
  commit, сначала проверить что они не правят меню.
- **Existing pages routing:** перемещение пунктов в submenu может
  сломать активацию menu item на конкретной странице. Тест-план шаг 2
  это проверяет.
- **Singleton enforcement:** если migrate упадёт на existing проде —
  rollback план через delete от pk=1.

## Definition of Done

- HVAC меню реструктурировано, 4 подраздела.
- HVAC-ISMeta → Настройки page работает.
- Backend model + API endpoint работают.
- Existing routes без regression.
- Tests passing.
- Пинг команде AC Rating отправлен ДО merge в main.
