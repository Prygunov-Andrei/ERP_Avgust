# Аудит RunPython-миграций

Инвентаризация data-миграций с оценкой безопасности повторного запуска.

## Сводная таблица

| App | Миграция | Безопасность | Reverse | Риск |
|---|---|---|---|---|
| personnel | 0002_migrate_erp_sections | one-time-only | noop | Перезаписывает весь permissions JSON |
| personnel | 0003_migrate_subsection_permissions | one-time-only | noop | Перезаписывает весь permissions JSON |
| personnel | 0004_migrate_goods_permissions | conditional | yes | Безопасен, есть reverse |
| payments | 0003_create_default_category | idempotent | yes | get_or_create, безопасен |
| payments | 0004_make_category_required | idempotent | noop | Зависит от 0003 |
| payments | 0013_create_system_accounts | idempotent | yes | get_or_create, безопасен |
| contracts | 0009_remove_commercial_proposal | one-time-only | noop | Намеренное удаление данных |
| accounting | 0002_populate_tax_systems | idempotent | yes | get_or_create, безопасен |

## Особый файл: api_public/migrations/0001_initial.py

Содержит **захардкоженные MinIO-креды** в S3Storage конструкторах:
- `access_key='minioadmin'`, `secret_key='minioadmin'`
- `endpoint_url='http://localhost:9000'`
- `bucket_name='portal-estimates'`

Не является data-миграцией (RunPython), но содержит чувствительные данные в истории миграций.

## Детали по приложениям

### personnel

**0002_migrate_erp_sections.py**
- Мигрирует `erp_permissions` из плоских секций в новые унифицированные
- Перезаписывает весь JSON для каждого сотрудника
- Повторный запуск: **ОПАСЕН** (сбросит все разрешения в `none`)

**0003_migrate_subsection_permissions.py**
- Разворачивает плоские разрешения в иерархические (dot-notation)
- Повторный запуск: **ОПАСЕН** (затрёт изменения из 0004)

**0004_migrate_goods_permissions.py**
- Переносит `settings.goods` → `goods`, `commercial.pricelists` → `goods.pricelists`
- Использует `pop()` с проверкой None — безопасен при повторном запуске
- Есть полноценная reverse-функция

### payments

**0003_create_default_category.py** — `get_or_create` для ExpenseCategory `contract`. Безопасен.

**0004_make_category_required.py** — заполняет NULL категории, затем AlterField. Безопасен.

**0013_create_system_accounts.py** — `get_or_create` для profit, working_capital, vat. Безопасен.

### contracts

**0009_remove_commercial_proposal.py** — удаляет все данные из CommercialProposal и CommercialProposalEstimateFile, затем дропает модели. **НЕОБРАТИМО**.

### accounting

**0002_populate_tax_systems.py** — `get_or_create` для 6 налоговых систем. Безопасен.

---

*Последнее обновление: Март 2026*
