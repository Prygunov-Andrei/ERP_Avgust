# F8-07: Launch — DNS, monitoring, disclaimer, smoke

**Команда:** Tech Lead (Claude) + IS-Петя + IS-Федя
**Effort:** 1 день
**Зависимости:** все предыдущие этапы (01-06).

---

## Цель

Финализировать запуск ISMeta на hvac-info.com:
- Маршрут `/ismeta` работает на production stack.
- Privacy disclaimer прикреплен.
- Production monitoring настроен.
- Smoke-test пройден на production (5-10 реальных PDF).
- Документация для PO как пользоваться + смотреть metrics.

## Pre-launch checklist

### Инфраструктура
- [ ] `recognition-public:8004` контейнер на 216.57.110.41 healthy.
- [ ] PDF storage volume `/storage/ismeta-uploads/` смонтирован.
- [ ] ERP backend `/api/hvac/ismeta/*` endpoints работают.
- [ ] Celery worker для `process_ismeta_job` запущен и обрабатывает
      jobs.
- [ ] Redis connection OK (для rate limit).
- [ ] LLMProfile записи в `ismeta-postgres` актуальные (DeepSeek, OpenAI,
      Gemini, Grok — keys валидны).

### Frontend
- [ ] Страница `/ismeta` развёрнута на hvac-info.com.
- [ ] Заглушка в верхнем меню активирована.
- [ ] Все компоненты (UploadZone, SettingsPanel, ProgressView,
      ResultView, FeedbackForm) работают.
- [ ] Mobile responsive.
- [ ] SEO metadata (title, description, og: tags) корректные.

### Backend
- [ ] HvacIsmetaSettings singleton заполнен правильными default'ами:
      ```
      enabled = true
      default_pipeline = "td17g"
      default_llm_profile_id = 6  (OpenAI GPT-4o)
      concurrency_limit_enabled = true
      pdf_storage_path = "/storage/ismeta-uploads/"
      require_registration = false
      max_file_size_mb = 50
      hourly_per_session = 5
      hourly_per_ip = 10
      daily_per_ip = 30
      feedback_email = "andrei@aug-clim.ru"
      ```

### Privacy disclaimer

Тексты для добавления:

#### Внизу `/ismeta` страницы
```markdown
## Конфиденциальность

Загруженные PDF используются только для распознавания позиций
и хранятся на наших серверах для анализа качества работы сервиса.
Мы не передаём данные третьим лицам и не используем их для других
целей.

Если у вас есть вопросы по обработке данных — свяжитесь с нами:
[andrei@aug-clim.ru](mailto:andrei@aug-clim.ru).
```

#### Footer hvac-info.com (если ещё нет)
```
Политика конфиденциальности · Условия использования
```

Создать `/privacy` и `/terms` страницы (минимальные, легально-достаточные).

## DNS / маршрутизация

Текущий setup hvac-info.com:
- Frontend: Next.js app на сервере 216.57.110.41
- Все routes автоматически работают через Next.js routing
- Новая страница `(hvac-info)/ismeta/` появляется как `/ismeta`
  без DNS-изменений

Никаких DNS-операций не нужно. Только deploy frontend (Next.js
build + restart).

## Monitoring setup

### Production logs

```bash
# ERP backend logs
docker logs -f ismeta-backend 2>&1 | grep "ismeta_job_"

# Recognition logs
docker logs -f recognition-public 2>&1
```

### Stats dashboard

`/admin/hvac_ismeta/stats/` — главная dashboard, см. F8-06.

### Простой alert (опционально)

Cron task проверяющий every 5 min:
- Recognition healthy?
- Celery worker alive?
- Last job старше 30 мин (если queue не пуст) → alert.

Реализация на bash + curl + Telegram bot (отправка в личный канал PO).
В v1 — опционально, если критично.

### Cost monitoring

Daily summary email PO:
```
ISMeta daily report — 2026-05-15
- Total jobs: 12 (success: 11, errors: 1)
- Total cost: $0.42
- Pipeline distribution: TD-17g 11, main 1
- Most popular LLM: OpenAI GPT-4o (8 jobs)
- Feedback: 8 👍 / 1 👎
```

Cron job (Django management command):
```bash
0 9 * * * cd /opt/finans_assistant && docker exec ismeta-backend python manage.py ismeta_daily_report
```

## Smoke test (production)

Запустить через UI 5-10 реальных PDF:

1. **Spec-1** (ОВиК, 153 поз) → ожидаем 100% recognition.
2. **Spec-7** (scanned) → ожидаем 95%+ через Vision LLM.
3. **Spec-9** (multi-page без header) → ожидаем 100% через Camelot.
4. **Spec-3** (CID font) → ожидаем 99%+ через guard.
5. **Тест разные pipelines:** перезапустить Spec-1 на «main» pipeline
   → должно работать, но дольше.
6. **Тест разные LLM:** Spec-7 на DeepSeek vs OpenAI vs Grok →
   все три должны вытащить русский текст с Vision.
7. **Concurrency:** запустить 2 parses в разных вкладках → 2-й
   получает 429.
8. **Rate limit:** 6-й PDF за час → 429.
9. **Большой PDF (Spec-4 87 листов):** загружаем → ожидаем 24 минуты
   обработки на TD-17g, корректный progress, итоговый Excel.
10. **Mobile:** загрузить с телефона → UI работает.
11. **Excel verify:** скачать xlsx, открыть в Excel → данные корректные,
    форматирование читабельное.
12. **Feedback:** отправить feedback (👍 + comment) → запись в БД +
    email PO.

## Acceptance criteria

- [ ] `/ismeta` доступен на hvac-info.com.
- [ ] Заглушка ISMeta в меню активирована.
- [ ] Privacy disclaimer виден на странице.
- [ ] Все 12 smoke-тестов passed.
- [ ] Stats dashboard в Django admin показывает корректные данные.
- [ ] PO получает первый daily report email.
- [ ] Production logs идут в JSON, без warnings/errors.
- [ ] Recognition healthy, Celery worker healthy.
- [ ] Recovery план: если recognition-public упадёт — fall back на
      ismeta-recognition (8003) автоматически (через настройку).

## Документация для PO (post-launch)

### Как смотреть статистику
- ERP → HVAC → HVAC-ISMeta → Настройки.
- ERP `/admin/hvac_ismeta/stats/` (admin URL) — dashboard.
- Daily report email каждое утро.

### Как менять настройки
- Все настройки через UI: ERP → HVAC → HVAC-ISMeta → Настройки.
- Изменения применяются сразу (recognition сервис читает через ENV
  с reload или прямо из БД на каждый запрос — TBD в F8-02).

### Как выключить сервис
- ERP → HVAC → HVAC-ISMeta → Настройки → toggle «Включён» = false.
- Сразу public site показывает «Сервис временно недоступен».

### Как добавить новую LLM модель
- ERP → Настройки → LLM Profiles (или ISMeta UI port 3001).
- Заполнить base_url, models, api_key.
- Test connection.
- Сохранить → автоматически появится в выпадающем списке `/ismeta`.

### Что делать если что-то сломалось
1. Проверить healthy ли контейнеры:
   ```
   docker ps --format 'table {{.Names}}\t{{.Status}}' | grep -E 'recognition|ismeta'
   ```
2. Логи:
   ```
   docker logs --tail 100 recognition-public
   docker logs --tail 100 ismeta-backend
   ```
3. Перезапустить:
   ```
   docker restart recognition-public ismeta-backend
   ```
4. Если совсем плохо — toggle «Включён» в настройках, public сайт
   покажет maintenance-message, успокаивающее пользователей.

## Документация для пользователей (на странице)

Раздел FAQ / «Как это работает» (опционально, после launch):

- **Что я могу загрузить?** — PDF спецификации ОВиК, до 50 MB.
- **Сколько ждать?** — обычно 3-7 минут на быстром движке, до часа
  на точном.
- **Что делать с Excel?** — копировать в свою смету, использовать
  как есть.
- **Безопасно ли?** — PDF хранится у нас для анализа качества, не
  передаётся третьим лицам.
- **Если не точно распознало?** — оставьте отзыв 👎 + комментарий —
  поможете нам сделать инструмент лучше.

## Definition of Done

- ISMeta live на hvac-info.com/ismeta.
- 12 smoke-тестов passed на production.
- Monitoring работает (logs + stats + daily report).
- PO получил инструкцию как пользоваться.
- Recovery procedure документирована.
- Privacy disclaimer виден на странице.
