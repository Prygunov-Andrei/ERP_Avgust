# Интеграционное тестирование ISMeta MVP

**Дата создания:** 2026-04-17. **Когда:** перед первым деплоем.

## Подготовка (~10 мин)

```bash
# 1. ISMeta стек
cd ismeta && docker compose up -d --build
# Ждём: 4 контейнера healthy (postgres, redis, backend, frontend)

# 2. Миграции + seed
docker compose exec ismeta-backend python manage.py migrate
docker compose exec ismeta-backend python manage.py seed_dev_data

# 3. Проверяем API
curl -s http://localhost:8001/health/ | jq .
# Ожидаем: {"status":"ok","db":"ok","redis":"ok"}

# 4. Проверяем frontend
open http://localhost:3001
# Ожидаем: redirect на /estimates
```

## Блокер: Auth

Сейчас backend требует SessionAuth, frontend не умеет логиниться. Два варианта обхода для тестирования:

**Вариант A (быстрый):** временно разрешить анонимный доступ в dev:
```python
# ismeta/backend/ismeta/settings.py
REST_FRAMEWORK = {
    ...
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.AllowAny",  # TODO: вернуть IsAuthenticated после теста
    ],
}
```

**Вариант B (правильный):** создать сессию через Django admin:
```bash
open http://localhost:8001/admin/  # admin/admin
# После логина — cookie сессии действует
```

## Чеклист

### 1. Список смет
- [ ] `localhost:3001/estimates` загружается
- [ ] Видна "Тестовая смета — Вентиляция офиса" из seed
- [ ] Фильтр по статусу работает (таб "Черновик")
- [ ] Поиск по названию фильтрует
- [ ] Кнопка "Новая смета" → диалог → создать → появилась в списке

### 2. Редактор сметы
- [ ] Клик по смете → `/estimates/{id}` → header с именем и статусом
- [ ] Секции слева (Вентиляция, Слаботочка)
- [ ] Позиции в таблице (5 seed items)
- [ ] Клик по ячейке → inline edit → blur → значение обновилось
- [ ] 409 при конфликте (открыть в 2 табах, изменить одно и то же)

### 3. Два трека оборудования (E25)
- [ ] Табы "Все / Стандарт / Основное оборудование"
- [ ] Звезда toggle → позиция перемещается между табами
- [ ] Dropdown статуса закупки (requested → quoted → booked)
- [ ] Procurement summary widget в header

### 4. Подбор работ (E5 + E10)
- [ ] Кнопка "Подобрать работы" в header
- [ ] Результаты matching: таблица с confidence badges
- [ ] Keyboard: ↑↓ навигация, Enter accept, Esc reject, Tab skip green
- [ ] "Применить" → позиции обновились (work_price, match_source)

### 5. ИИ-проверка (E8)
- [ ] Кнопка "Проверить ИИ" → ValidationReport modal
- [ ] Issues с severity icons (warning/error/info)
- [ ] Клик по issue → scroll к позиции в таблице
- [ ] **Примечание:** требует OPENAI_API_KEY в .env (или LLM_MODE=mock)

### 6. Чат (E8)
- [ ] Кнопка "ИИ-помощник" → ChatPanel slide-over
- [ ] Отправить сообщение → ответ появляется
- [ ] Tool calls показываются (badge "Инструмент")
- [ ] **Примечание:** требует OPENAI_API_KEY или mock

### 7. Excel export (E6)
- [ ] Кнопка "Скачать Excel" → .xlsx скачивается
- [ ] Открыть в Excel: sheet "Смета" с разделами и позициями
- [ ] Sheet "Агрегаты" с итогами
- [ ] Скрытые столбцы row_id и row_hash (показать все столбцы)

### 8. Создание версии
- [ ] Кнопка "Создать версию" → новая смета v2
- [ ] Все секции и позиции скопированы
- [ ] Оригинал не изменился

### 9. Передача в ERP (E18)
- [ ] **Требует работающий ERP** (SSH-туннель или локальный)
- [ ] Кнопка "Передать в ERP" (или POST через curl)
- [ ] Статус → "transmitted"
- [ ] PATCH на переданную смету → 403

### 10. Webhook (E17)
- [ ] POST на `/api/v1/webhooks/erp/` с правильным secret
- [ ] `contract.signed` → estimate status обновляется

## Известные риски

1. **CORS** — frontend на :3001, backend на :8001. `CORS_ALLOW_ALL_ORIGINS = DEBUG` должно работать, но не тестировалось.
2. **Auth** — JWT flow (E14) реализован, но не подключён к frontend. Для теста — AllowAny или session.
3. **LLM** — validate/chat требуют OPENAI_API_KEY. Без ключа → `LLM_MODE=mock` (фиксированный ответ).
4. **ERP connection** — transmission/webhook требуют работающий ERP backend.

## После тестирования

- [ ] Вернуть `IsAuthenticated` в settings
- [ ] Зафиксировать найденные баги
- [ ] Подключить JWT auth к frontend (Федя, мелкая задача)
- [ ] E23: backup скрипт, monitoring
- [ ] E24: user guide, admin guide
- [ ] Deploy на прод
