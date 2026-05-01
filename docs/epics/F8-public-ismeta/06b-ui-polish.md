# F8-06b: UI polish на локальном стенде

**Команда:** PO + Tech Lead (Claude) + IS-Федя при необходимости
**Effort:** 0.5-2 дня (зависит от объёма находок)
**Зависимости:** F8-06 (полный стек end-to-end на локальном стенде)

---

## Цель

После того как полный стек F8 работает локально (F8-00 → F8-06 merged),
PO активно работает с UI публичной страницы `/ismeta` на локальном
стенде, находит мелкие неудобства / баги визуала / полировки UX, и
команда фиксит их **до production launch** (F8-07).

Это отдельный этап потому что PO явно решил: «хочу сначала позаниматься
мелкой полировкой UI на локальном стенде» (2026-05-01). Не смешивать
с launch'ем — сначала UX отшлифовать, потом DNS/deploy/smoke.

## Workflow

1. **Поднять локальный стенд:**
   ```bash
   cp .env.local.example .env.local  # заполнить LLM keys
   ./scripts/bootstrap_local_f8.sh
   ./dev-local.sh --f8
   open http://localhost:3000/ismeta
   ```

2. **PO работает с UI в режиме pet-testing:**
   - Загружает реальные PDF (Spec-1..11 из `Downloads/ТЕСТЫ РАСПОЗНАВАНИЯ/`)
   - Тестирует на разных pipelines / LLM
   - Замечает мелкие неудобства, dark theme контраст, mobile,
     стилистику, тексты, ETA accuracy, превью таблицы и т.д.

3. **Фиксы батчами (см. memory `feedback_batch_prod_fixes`):**
   - PO кидает 3-5 замечаний в чат
   - Tech Lead (Claude) фиксит мини-PR'ом либо передаёт IS-Феде
     если scope крупный
   - Один коммит на батч, один merge, один локальный re-test
   - Не делать одно замечание = один коммит — это churn

4. **Когда PO явно говорит «всё устраивает, можно в прод»** —
   переход к F8-07 (Launch).

## Что НЕ входит в scope

- ❌ Большая переработка архитектуры (это отдельный эпик)
- ❌ Новые features которых нет в ТЗ F8 (например, авторизация —
  это уже F9)
- ❌ Production deploy (это F8-07)
- ❌ Performance оптимизации без измеренной проблемы

## Что входит в scope

- ✅ Тексты, копирайтинг, формулировки
- ✅ Цвета, контрасты, отступы, типографика
- ✅ Mobile responsive fine-tuning
- ✅ ETA accuracy для прогресса
- ✅ Tooltips, hover states, loading skeletons
- ✅ Privacy disclaimer wording
- ✅ Toast messages
- ✅ Error states UX
- ✅ Удобство dropdown'ов / settings panel
- ✅ Семантика заголовков / breadcrumbs

## Acceptance criteria

- [ ] PO явно подтверждает: «UI готов к prod».
- [ ] Все ранее замеченные баги починены либо вынесены в follow-up
      backlog.
- [ ] Локальный стенд работает end-to-end без visible UX-проблем
      на 5-10 реальных PDF.
- [ ] Mobile (Chrome DevTools emulation iPhone, Android) — usable.

## Definition of Done

- PO даёт go на F8-07 launch.
- UI без блокирующих UX-проблем.
- Всё что не critical вынесено в `docs/runbooks/ismeta-ui-backlog.md`
  (если нужно отдельной задачей — память `project_ismeta_ui_backlog`).

## Risks

- **Scope creep:** мелкие правки превращаются в большие. Mitigation:
  PO держит фокус на «полировка», не «переработка».
- **Bottleneck PO:** только PO может оценить «достаточно ли отполировано».
  Mitigation: timebox 2 дня max.
