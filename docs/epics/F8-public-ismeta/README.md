# Эпик F8: Public ISMeta — recognition спецификаций как фича на hvac-info.com

**Цель:** выкатить распознавание ОВиК спецификаций в продакшн как
отдельный публичный продукт на `hvac-info.com/ismeta` (заглушка
в верхнем меню уже существует).

**Решение принято:** 2026-05-01. PO + Tech Lead (Claude).

## Принятые архитектурные решения

| Параметр | Решение |
|---|---|
| **Доступ** | Anonymous (без логина). Toggle «требовать регистрацию» в настройках, выключен. |
| **Цена** | Бесплатно. |
| **URL** | `hvac-info.com/ismeta` (точный path TBD в Этапе 5). |
| **Бренд** | «ISMeta» (как есть). |
| **Документы** | Только спецификации. Счета/КП — отдельно когда понадобится. |
| **Хранение PDF** | Копия на нашем сервере для ручного анализа. Пользователь не видит. |
| **Движок default** | TD-17g hybrid (Docling+Camelot+Vision LLM, ~$0.36/run, 3-7 мин/PDF). |
| **Защита от abuse** | 1 PDF одновременно с одной сессии (cookie + IP fallback). Настраиваемо. |
| **Подключение** | hvac-info.com → ERP backend → recognition сервис. Все настройки в ERP. |
| **ERP меню** | Новый блок «HVAC» в left sidebar, подразделы: Новости / Рейтинг / **ISMeta** (новый). |
| **Прогресс** | Страница X из Y + опциональное email-поле «пришлю ссылку». |
| **Подключение agents** | НЕ предупреждаем команду AC Rating пока. |

## Этапы (8 шт., 9.5-14 рабочих дней)

| # | Этап | Effort | Может параллельно? |
|---|------|--------|------|
| 00 | [Локальный стенд](00-local-stand.md) | 0.5-1 день | Да (либо первым) |
| 01 | [Pipeline TD-17g production-ready](01-pipeline-production.md) | 1-2 дня | Да |
| 02 | [ERP HVAC меню + ISMeta settings](02-erp-hvac-menu.md) | 1-2 дня | Да |
| 03 | [ERP backend API](03-erp-backend-api.md) | 2 дня | Зависит от 01, 02, 00 |
| 04 | [Grok LLM provider](04-grok-provider.md) | 1 день | Да |
| 05 | [Public frontend](05-public-frontend.md) | 3-4 дня | Зависит от 03 |
| 06 | [Concurrency limit + monitoring](06-concurrency-monitoring.md) | 1 день | Зависит от 05 |
| 07 | [Launch](07-launch.md) | 1 день | Зависит от всего |

## Граф зависимостей

```
[00 Local stand] ──┐  (БД, recognition-public, frontend, redis — всё локально)
                    │
[01 Pipeline] ─────┤
                    ├─→ [03 Backend API] ─┐
[02 HVAC menu]─────┘                       │
                                            ├─→ [05 Frontend] ─→ [06 Concurrency] ─→ [07 Launch]
[04 Grok]   ──────────────────────────────┘
```

**Важно:** F8-00 разворачивает локальный стенд (отдельные локальные
postgres'ы для ERP и ismeta-postgres, recognition-public:8004, redis,
PDF storage, frontend) — без зависимости от прод-БД через SSH-туннель.
Все F8 миграции и тестовые данные идут ТОЛЬКО локально до F8-07 (Launch).

## Команды (агенты)

- **IS-Петя** (backend) — этапы 01, 02, 03, 04, 06
- **IS-Федя** (frontend) — этап 05
- **Tech Lead (Claude)** — code review, etc

## Shared файлы (требуют пинга команде AC Rating ДО правки)

⚠️ **AC Rating НЕ предупреждать пока** — мы там в финальной фазе ISMeta MVP. Когда подойдём к Этапу 02 (HVAC меню) — пинг нужен (raздел News/Ratings перемещаем в подразделы блока HVAC).

- `frontend/components/layout/sidebar/` — добавим блок HVAC
- `frontend/app/news/`, `frontend/app/ratings/` — НЕ ТРОГАТЬ (только переместить ссылки в HVAC)
- `backend/finans_assistant/urls.py` — добавим `/api/hvac/ismeta/`
- `backend/finans_assistant/settings.py` — добавим INSTALLED_APPS=hvac_ismeta

## Текущее состояние recognition

**Best:** `recognition/td-17g-llm-targeted @ d8bce21` (см. [`docs/recognition/`](../../recognition/README.md)).

- TOTAL 99.7%, 5/10 на 100%
- Cost: $0.36/regression run
- Готов к продакшну после Phase 1 (build + deploy).

## Mandate progress

PO mandate: 9/10 на 100%. Достигнуто 5/10. Phase 1-3 в
[`docs/recognition/FUTURE-WORK.md`](../../recognition/FUTURE-WORK.md)
доводят до 9/10 (~14 ч, $6/run). **Отложено** до явного запроса PO
после публичного запуска и feedback от сметчиков.
