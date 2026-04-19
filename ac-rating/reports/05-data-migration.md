# Фаза 5: Data migration — отчёт

**Ветка:** `ac-rating/05-data-migration` (от `main`, поверх Ф4B)
**Дата:** 2026-04-19

**Коммиты** (`git log --oneline main..HEAD`):

- `d651223` feat(ac-rating): load_ac_rating_dump command (фаза 5)
- `45ab3c8` test(ac-rating): test_load_dump.py (15 tests, 190 ac_* total)
- `ff988a8` docs(ac-rating): инструкция data-migration для Андрея
- (+ этот отчёт отдельным docs-коммитом)

## ⚠️ На какой БД тестировал

**Локальный Postgres** на `localhost:5432` (контейнер dev-стенда), БД **`finans_assistant`**, пользователь `postgres`. **НЕ через SSH-туннель** к prod (`:15432`). pytest использует test-БД `test_finans_assistant`, создаваемую/удаляемую pytest-django каждый прогон — следов в проде нет.

Команда `load_ac_rating_dump` каждый запуск печатает `Target DB: HOST=localhost:5432, NAME=finans_assistant` — этим визуально подтверждаю что не туннель.

## Что сделано

### 1. Management command `load_ac_rating_dump`

`backend/ac_catalog/management/commands/load_ac_rating_dump.py` (~338 LoC):

- Сигнатура `manage.py load_ac_rating_dump <path> [--truncate] [--dry-run] [--recalculate] [--yes-i-am-sure]`.
- Парсер на `re.compile(r"^COPY public\.(\w+) \(([^)]+)\) FROM stdin;\n(.*?)^\\\.$", re.DOTALL | re.MULTILINE)` — терминатор `\.` ищется как начало строки (важно для пустых COPY-блоков `FROM stdin;\n\.\n`).
- `TABLE_MAPPING` (16 пар source→target) + `LOAD_ORDER` (от независимых к зависимым: brands → catalog/methodology → calculations/reviews/submissions).
- `USER_FK_COLUMNS = {"triggered_by_id", "entered_by_id", "approved_by_id"}` — обнуляются на этапе парсинга (`\N` в TAB-строке).
- Безопасность: первая строка вывода — `Target DB: HOST=...:PORT, NAME=...`. Без `--dry-run` и без `--yes-i-am-sure` — печатает warning и выходит без записи.
- Идемпотентность: без `--truncate` отказ с `CommandError` если хотя бы одна целевая таблица непустая. С `--truncate` — `TRUNCATE TABLE ... RESTART IDENTITY CASCADE` одним statement (16 имён). Перед TRUNCATE — `SET CONSTRAINTS ALL IMMEDIATE` (для совместимости с pytest-django вложенной транзакцией, где висят deferred FK-checks от предыдущих INSERT).
- Транзакционность: всё внутри `transaction.atomic()`. `cursor.copy_expert(sql=..., file=StringIO(payload))` для каждого блока. После всех COPY — `setval(pg_get_serial_sequence(table, 'id'), MAX(id))`.
- `--recalculate` → `ac_scoring.engine.recalculate_all` + печатает `[min, max]` диапазон `total_index`.

### 2. Тесты (15 новых, всего 190)

`backend/ac_catalog/tests/test_load_dump.py`:

| Группа | Тестов | Что проверяем |
|---|---|---|
| `parse_dump` | 5 | skip auth_user, порядок LOAD_ORDER, переименование source→target, обнуление user_fk_indices (`\N` для approved_by_id/entered_by_id), пустой COPY-блок → `row_count=0`. Плюс `USER_FK_COLUMNS` константа. |
| Команда (call_command) | 9 | dry-run без записи; требование `--yes-i-am-sure` для non-dry-run; full load (ORM-ассерты на Brand/ACModel/ModelRawValue, FK-обнуление видно через `entered_by_id is None`); отказ без `--truncate` в непустой БД (`CommandError`); `--truncate` идемпотентность (count после второго load == count после первого); `--recalculate` (total_index ≈ 50 на noise=30 в шкале [20..40]); `Target DB:` в выводе; skip-секция. |
| Smoke | 1 | формат synthetic-дампа sanity-check (10 COPY-блоков, `\restrict` pragma присутствует). |

Synthetic-дамп: `_full_synthetic_dump()` собирает 10 COPY-блоков (1 skip auth_user + 8 с данными + 1 пустой scoring_calculationrun) с `\restrict s8...` pragma в начале — в формате pg_dump 16.13.

### 3. Документация

`docs/ac_rating/data-migration.md` — для Андрея, разворачивание локально в 6 шагов:
1. `createdb finans_assistant_dev` (НЕ через `:15432`).
2. `migrate` всей ERP в новую БД.
3. `load_ac_rating_dump <dump> --truncate --recalculate --yes-i-am-sure`.
4. Медиа из Docker volume `maksim_rating_review_backend_media` через `docker run --rm -v vol:/src -v $PROJECT/backend/media:/dst alpine cp -a`.
5. Smoke `/admin/` + `/api/public/v1/rating/`.
6. Сверка `total_index` с продом Максима (`hvac-info.com/v2`).

Плюс «откат» (TRUNCATE через shell) и справочник флагов.

## Результаты проверок

| Проверка | Результат |
|---|---|
| `manage.py check` | ✅ `0 issues` |
| `makemigrations --dry-run` | ✅ `No changes detected` (моделей не добавлял) |
| `pytest ac_*/tests/ --no-cov` | ✅ **190 passed** (175 → +15) |
| `manage.py load_ac_rating_dump --help` | ✅ показывает все 4 флага |
| **Dry-run на реальном дампе** `~/Downloads/ac_rating_2026-04-18.sql` (647,448 байт) | ✅ см. таблицу ниже |
| **Реальная загрузка** на `localhost:5432, finans_assistant` с `--truncate --recalculate --yes-i-am-sure` | ✅ `Загрузка завершена: 1303 строк в 16 таблиц. Пересчитано 27 моделей, total_index в диапазоне [20.39, 78.85].` |

### Dry-run распознавание (16/16 таблиц)

| Источник | Цель | Строк |
|---|---|---|
| `brands_brandoriginclass` | `ac_brands_brandoriginclass` | 5 |
| `brands_brand` | `ac_brands_brand` | 22 |
| `catalog_equipmenttype` | `ac_catalog_equipmenttype` | 1 |
| `methodology_methodologyversion` | `ac_methodology_methodologyversion` | 3 |
| `methodology_criterion` | `ac_methodology_criterion` | 34 |
| `methodology_methodologycriterion` | `ac_methodology_methodologycriterion` | 96 |
| `catalog_acmodel` | `ac_catalog_acmodel` | 27 |
| `catalog_modelregion` | `ac_catalog_modelregion` | 26 |
| `catalog_acmodelphoto` | `ac_catalog_acmodelphoto` | 170 |
| `catalog_acmodelsupplier` | `ac_catalog_acmodelsupplier` | 1 |
| `catalog_modelrawvalue` | `ac_catalog_modelrawvalue` | 918 |
| `scoring_calculationrun` | `ac_scoring_calculationrun` | 0 |
| `scoring_calculationresult` | `ac_scoring_calculationresult` | 0 |
| `reviews_review` | `ac_reviews_review` | 0 |
| `submissions_acsubmission` | `ac_submissions_acsubmission` | 0 |
| `submissions_submissionphoto` | `ac_submissions_submissionphoto` | 0 |
| **Итого** | | **1303** |

Skip-таблицы (15): `auth_group, auth_group_permissions, auth_permission, auth_user, auth_user_groups, auth_user_user_permissions, core_auditlog, core_page, django_admin_log, django_content_type, django_migrations, django_session, methodology_criteriongroup, ratings_airconditioner, ratings_parametervalue`.

Реальная загрузка пустых блоков пропускает (`пусто — пропуск COPY`); это нормально — TRUNCATE уже почистил, COPY на пустых данных вызывает только лишний overhead.

## Известные риски / сюрпризы

1. **Дамп Максима пустой по 5 ac_*-таблицам** (`scoring_calculationrun`, `scoring_calculationresult`, `reviews_review`, `submissions_acsubmission`, `submissions_submissionphoto`). Это нормально для prod-снапшота (отзывов/заявок ещё не было; calculation_run генерируется нашим recalculate). Команда корректно обрабатывает пустые блоки — пишет `пусто — пропуск COPY` без ошибок. После `--recalculate` `ac_scoring_calculationrun` и `ac_scoring_calculationresult` заполняются нашим engine.
2. **Регулярка изначально не ловила пустые COPY-блоки.** Первая версия использовала `(.*?)\n\\\.\n` — между `;` и `\.` ожидался хотя бы один `\n` с данными. Pg_dump для пустых таблиц пишет `FROM stdin;\n\.\n` (один `\n`), что не матчилось. Поправил на `(.*?)^\\\.$` с `re.MULTILINE` — теперь `\.` ищется как начало строки. Дополнительно при сравнении первой и второй версий обнаружилось расхождение: старый парсер давал 1313 строк (10 «фантомных» из-за non-greedy backtracking через границы пустых блоков), новый — 1303 (правильно).
3. **`SET CONSTRAINTS ALL IMMEDIATE` перед TRUNCATE.** Без этого pytest-django падал на `cannot TRUNCATE because it has pending trigger events` во втором вызове внутри одной test-транзакции (FK-проверки от предыдущего INSERT висят отложенными). Добавил перед TRUNCATE — безопасно для прода, чинит тест. В обычной non-test-транзакции триггеры IMMEDIATE по умолчанию, оператор no-op.
4. **FK-обнуление user-полей выполняется на этапе парсинга**, не SQL-ом. Преимущество: `\N` уезжает прямо в `copy_expert` payload, COPY быстрее. Минус: если у Максима появится новая колонка с `_by_id` (например, `moderated_by_id`), её надо явно добавить в `USER_FK_COLUMNS`. Зафиксировано в комментарии.
5. **Sequences обновляются по `pg_get_serial_sequence(table, 'id')`.** Если Django в будущей версии перейдёт с serial на identity-колонки, эта функция вернёт NULL. На Django 4.2 + Postgres 14/15/16 работает. После миграции на Django 5.x проверить.
6. **`copy_expert` использует `WITH (FORMAT text)`** (default). pg_dump в 16.13 пишет именно этот формат, совместим. Если кто-то выгружает дамп в `FORMAT csv` — наша команда не справится.
7. **CASCADE в TRUNCATE может задеть таблицы вне ac_*-домена**, если кто-то в ERP добавит FK на ac_* модели (маловероятно, но возможно). Сейчас никто не ссылается — проверял grep `ForeignKey.*ac_` по `backend/`.
8. **Реальная загрузка делалась на `finans_assistant`** (та же БД, что используется ERP-туннелем для прода-чтения, но локальные ac_* таблицы изолированы — прод-БД ERP не имеет ac_*-таблиц вообще, миграции туда ещё не катали). Это безопасно: `--truncate` ограничен 16 ac_* таблицами. Но в продовой схеме БД был бы `finans_assistant_dev` (отдельная БД) согласно докам — Андрей будет следовать инструкции.
9. **Recalculate на загруженных данных работает идеально:** 27 моделей → `total_index ∈ [20.39, 78.85]`, что соответствует ожидаемому диапазону рейтинга. Сверка с продом Максима — за Андреем (шаг 6 docs).

## Ключевые файлы для ревью

- `backend/ac_catalog/management/commands/load_ac_rating_dump.py:90-97` — `_COPY_RE` регулярка (DOTALL+MULTILINE, `^\.$` терминатор).
- `backend/ac_catalog/management/commands/load_ac_rating_dump.py:104-138` — `ParsedCopyBlock` (обнуление user-FK в `_null_user_fk`, payload без заголовка/терминатора).
- `backend/ac_catalog/management/commands/load_ac_rating_dump.py:208-244` — `Command.handle` (Target DB печать → safety check → парсинг → статистика → optional TRUNCATE → COPY каждой таблицы → setval).
- `backend/ac_catalog/management/commands/load_ac_rating_dump.py:255-262` — TRUNCATE с `SET CONSTRAINTS ALL IMMEDIATE`.
- `backend/ac_catalog/management/commands/load_ac_rating_dump.py:289-304` — `_recalculate` с aggregate min/max total_index.
- `backend/ac_catalog/tests/test_load_dump.py:33-117` — `_full_synthetic_dump` (10 COPY-блоков для покрытия всех веток, включая пустой).
- `docs/ac_rating/data-migration.md` — пошаговая инструкция для Андрея, особенно warning про порт `:15432` и Docker volume для медиа.
