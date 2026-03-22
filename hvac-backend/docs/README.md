# 📚 Документация проекта HVAC News

> Часть монорепозитория ERP Avgust. Основная документация: [docs/README.md](../../docs/README.md). API prefix: `/api/hvac/`. Отдельная БД `hvac_db`.

Добро пожаловать в документацию проекта HVAC News Platform — специализированного мультиязычного новостного ресурса для индустрии отопления, вентиляции и кондиционирования.

## 📂 Структура документации

### [01-general](./01-general/) — Общая информация о проекте

Основные документы, описывающие концепцию и статус проекта:

- **[PROJECT_BRIEF.md](./01-general/PROJECT_BRIEF.md)** — Краткое описание проекта, технологический стек, функциональные разделы
- **[DEVELOPMENT_PLAN.md](./01-general/DEVELOPMENT_PLAN.md)** — Поэтапный план разработки (Backend First подход)
- **[DEVELOPMENT_STATUS.md](./01-general/DEVELOPMENT_STATUS.md)** — Текущий статус реализации функционала
- **[NEWS_TEMPLATE.md](./01-general/NEWS_TEMPLATE.md)** — Шаблон формата .md файлов для новостей

---

### [02-backend](./02-backend/) — Backend разработка

Документация по серверной части, API и решению технических проблем:

- **[BACKEND_ENDPOINTS_ANSWERS.md](./02-backend/BACKEND_ENDPOINTS_ANSWERS.md)** — Описание API endpoints и их ответов
- **[BACKGROUND_PROCESSING_ANALYSIS.md](./02-backend/BACKGROUND_PROCESSING_ANALYSIS.md)** — Анализ фоновой обработки задач

---

### [03-frontend](./03-frontend/) — Frontend разработка

Задания и спецификации для фронтенд-разработчиков:

#### Основные задачи (актуальные)

- **[FRONTEND_TASK_STAGE_5.md](./03-frontend/FRONTEND_TASK_STAGE_5.md)** — Актуальный этап разработки фронтенда
- **[FRONTEND_TASK_CRUD_REFERENCES.md](./03-frontend/FRONTEND_TASK_CRUD_REFERENCES.md)** — CRUD операции для справочников (Источники, Бренды, Производители)
- **[FRONTEND_TASK_RESOURCE_CARD.md](./03-frontend/FRONTEND_TASK_RESOURCE_CARD.md)** — Карточка источника новостей
- **[STAGE_5_WEB_NEWS_EDITOR.md](./03-frontend/STAGE_5_WEB_NEWS_EDITOR.md)** — Веб-редактор новостей

#### Автоматический поиск новостей

- **[FRONTEND_TASK_NEWS_DISCOVERY.md](./03-frontend/FRONTEND_TASK_NEWS_DISCOVERY.md)** — UI для автоматического поиска новостей
- **[FRONTEND_TASK_PROVIDER_SELECTION.md](./03-frontend/FRONTEND_TASK_PROVIDER_SELECTION.md)** — Выбор провайдера LLM (Grok/Anthropic/OpenAI)
- **[FRONTEND_TASK_SEARCH_SETTINGS.md](./03-frontend/FRONTEND_TASK_SEARCH_SETTINGS.md)** — Настройки поиска и аналитика
- **[FRONTEND_TASK_NO_NEWS_FOUND.md](./03-frontend/FRONTEND_TASK_NO_NEWS_FOUND.md)** — Фильтрация записей "новостей не найдено"

#### Статистика и аналитика

- **[FRONTEND_TASK_SOURCE_STATISTICS.md](./03-frontend/FRONTEND_TASK_SOURCE_STATISTICS.md)** — Инфографика статистики источников
- **[FRONTEND_TASK_MANUFACTURER_STATISTICS.md](./03-frontend/FRONTEND_TASK_MANUFACTURER_STATISTICS.md)** — Инфографика статистики производителей
- **[FRONTEND_RESOURCES_GROUPING.md](./03-frontend/FRONTEND_RESOURCES_GROUPING.md)** — Группировка ресурсов

---

### [04-news-discovery](./04-news-discovery/) — Автоматический поиск новостей

Документация системы автоматического поиска новостей через LLM:

#### Основные документы

- **[NEWS_DISCOVERY_PLAN.md](./04-news-discovery/NEWS_DISCOVERY_PLAN.md)** — Полный план реализации функционала
- **[PROVIDER_SELECTION.md](./04-news-discovery/PROVIDER_SELECTION.md)** — Выбор и сравнение провайдеров LLM
- **[NEWS_DISCOVERY_COST_ESTIMATE.md](./04-news-discovery/NEWS_DISCOVERY_COST_ESTIMATE.md)** — Оценка стоимости поиска новостей

#### Интеграция LLM провайдеров

- **[GROK_INTEGRATION_ANALYSIS.md](./04-news-discovery/GROK_INTEGRATION_ANALYSIS.md)** — Анализ интеграции Grok от x.ai
- **[GROK_IMPLEMENTATION.md](./04-news-discovery/GROK_IMPLEMENTATION.md)** — Реализация Grok
- **[GROK_ANALYSIS.md](./04-news-discovery/GROK_ANALYSIS.md)** — Анализ работы Grok
- **[ANTHROPIC_INTEGRATION.md](./04-news-discovery/ANTHROPIC_INTEGRATION.md)** — Интеграция Anthropic Claude

#### Статистика и аналитика

- **[SOURCE_STATISTICS_ANALYSIS.md](./04-news-discovery/SOURCE_STATISTICS_ANALYSIS.md)** — Анализ статистики источников
- **[NO_NEWS_FOUND_FIELD.md](./04-news-discovery/NO_NEWS_FOUND_FIELD.md)** — Поле "новостей не найдено"
- **[TESTING_DISCOVERY.md](./04-news-discovery/TESTING_DISCOVERY.md)** — Тестирование системы поиска

---

### [05-archived](./05-archived/) — Архив устаревших документов

Устаревшие документы, сохраненные для истории:

- Ранние этапы разработки (STAGE_1-4)
- Исправленные баги (JWT Auth Fix, POST 403, Gemini API)
- Старые результаты тестирования

---

## 🚀 Быстрый старт

### Для разработчиков

1. **Начните с общей информации:**
   - Прочитайте [PROJECT_BRIEF.md](./01-general/PROJECT_BRIEF.md) для понимания концепции
   - Изучите [DEVELOPMENT_STATUS.md](./01-general/DEVELOPMENT_STATUS.md) для актуального статуса

2. **Backend разработчики:**
   - [BACKEND_ENDPOINTS_ANSWERS.md](./02-backend/BACKEND_ENDPOINTS_ANSWERS.md) — API спецификация
   - [NEWS_DISCOVERY_PLAN.md](./04-news-discovery/NEWS_DISCOVERY_PLAN.md) — система поиска новостей

3. **Frontend разработчики:**
   - [FRONTEND_TASK_STAGE_5.md](./03-frontend/FRONTEND_TASK_STAGE_5.md) — текущие задачи
   - [FRONTEND_TASK_NEWS_DISCOVERY.md](./03-frontend/FRONTEND_TASK_NEWS_DISCOVERY.md) — UI поиска новостей

### Для менеджеров проекта

- [DEVELOPMENT_STATUS.md](./01-general/DEVELOPMENT_STATUS.md) — что уже готово
- [DEVELOPMENT_PLAN.md](./01-general/DEVELOPMENT_PLAN.md) — что планируется
- [NEWS_DISCOVERY_COST_ESTIMATE.md](./04-news-discovery/NEWS_DISCOVERY_COST_ESTIMATE.md) — оценка затрат

---

## 🔍 Ключевые технологии

- **Backend:** Django, Django REST Framework, PostgreSQL
- **Frontend:** React/Next.js (планируется)
- **LLM Integration:** Grok (x.ai), Anthropic Claude, OpenAI GPT
- **Многоязычность:** Russian, English, German, Portuguese

---

## 📊 Статус проекта

**Текущий этап:** Backend MVP + система автоматического поиска новостей

✅ **Реализовано:**
- Система пользователей и JWT аутентификация
- CRUD для справочников (Производители, Бренды, Ресурсы)
- Автоматический поиск новостей через LLM (Grok/Anthropic/OpenAI)
- Статистика и ранжирование источников
- REST API для всех функций

⏳ **В разработке:**
- Веб-редактор новостей
- Frontend приложение
- Система комментариев

---

## 📝 Соглашения

- Документы именуются в формате `UPPERCASE_WITH_UNDERSCORES.md`
- Папки нумеруются для сохранения порядка (`01-`, `02-`, и т.д.)
- Устаревшие документы перемещаются в `05-archived/`, не удаляются

---

## 🤝 Контакты

Если у вас есть вопросы по документации или проекту, обращайтесь к руководителю проекта.

---

**Последнее обновление:** 22 января 2026
