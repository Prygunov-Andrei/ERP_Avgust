# Задача: починить main CI (Bot Tests + Backend pytest)

**Тип:** infra / tech debt
**Команда:** TBD (любой backend-агент после F8 финиша)
**Приоритет:** medium — не блокирует разработку, но "красная" main мешает делать вердикт по PR
**Effort:** 2-4 часа

---

## Контекст

На 2026-05-01 main CI красный по двум независимым причинам — обе
**pre-existing** на момент мерджей F8-04/F8-00/F8-02. Из-за этого
review F8 PR'ов не может опираться на «зелёный CI» — приходится
проверять руками что упало pre-existing, а что новое. Стоит почистить.

Все три F8 PR были смержены при таком CI:
- ❌ Bot Tests — `pytest --timeout=30` упал за 18s
- ❌ Backend (pytest) — exceeded 10m max execution time
- ✓ Frontend (typecheck + tests) — 1m30s
- ✓ Mini App (typecheck + tests) — 17s
- ✓ Env keys drift check — 7s

Симметричные runs для подтверждения pre-existing:
- `25215177217` (F8-04 merge `614f343`) — Backend pytest 10m17s timeout, Bot fail
- `25214970514` (F8-00 docs `79a8a5a`) — оба упали
- `25125793623` (Polish 3.5 от AC, до F8) — failure тоже

---

## Что чинить

### 1. Backend pytest — 10m timeout

**Текущее:** `pytest` на 28 apps в `backend/pytest.ini`, `timeout-minutes: 10`
в `.github/workflows/ci.yml`. После F8-02 список apps вырос до 28
(`core, payments, supply, banking, ..., ac_*, hvac_ismeta`).

**Корень:** медленные тесты + большой `--cov` (≥20 apps под coverage)
+ нет параллельности.

**Опции (в порядке предпочтения):**

#### Опция A: pytest-xdist (параллельный прогон)
Добавить `pytest-xdist>=3.5` в `backend/requirements.txt`, в `pytest.ini`
addopts добавить `-n auto`. Большинство тестов изолированы по transactional
test cases — должно работать. Отдельные slow-tests перенести в маркер
`@pytest.mark.slow` и исключать через `-m "not slow"` в CI fast-pass.

**Риск:** некоторые тесты могут зависеть от global state (Django settings,
celery eager mode) — могут начать flaky. Нужен прогон + диагностика.

#### Опция B: разделить на два job'а
В `.github/workflows/ci.yml` сделать `backend-fast` (core/api/llm/marketing/...)
и `backend-slow` (estimates/contracts/payments). Каждый в своём 10m
бюджете.

**Риск:** дубль setup (БД, миграции) → +2-3 минуты на каждый.
Но решит timeout без рефакторинга тестов.

#### Опция C: bump timeout до 15m + сократить --cov
Самый простой fix без изменения тестов. `--cov` оставить только для
3-5 ключевых apps (core, payments, estimates) — не на все.

**Риск:** coverage report не покрывает всё, при regression coverage
не упадёт публично.

**Рекомендация:** A первым попыткой, B как fallback если A flaky.
C — временный bandaid если A/B не успеваем.

### 2. Bot Tests — pytest fail за 18s

**Текущее:** `pytest --timeout=30` в `bot/`. Падает за 18s — какой-то
тест мгновенно фейлится, не дотягивает до timeout.

**Корень:** unknown — нужно посмотреть лог последнего main run.

```bash
gh run view --job=<latest_bot_job_id> --log-failed | tail -100
```

Возможные причины:
- Зависимость от ENV переменной которая не задана в CI (Telegram token, прод-БД)
- Тест дёргает реальный API (который недоступен в CI runner)
- Импорт сломан после рефакторинга в shared utils

**Рекомендация:** прочитать лог → определить failing test → починить
либо мокирование, либо переменную ENV в workflow yaml.

---

## Файлы которые меняем

- `backend/requirements.txt` — добавить `pytest-xdist` (Опция A)
- `backend/pytest.ini` — `addopts -n auto` либо разделение на маркеры
- `.github/workflows/ci.yml` — может быть split на два job'а (Опция B),
  bump timeout-minutes (Опция C), fix Bot ENV
- `bot/tests/...` — починка failing test (зависит от диагностики)

## Acceptance criteria

- [ ] Backend pytest проходит < 10 минут на CI (или < 15 минут с
      bumped timeout, если выбрана Опция C).
- [ ] Bot Tests зелёный на main.
- [ ] Все остальные jobs (Frontend, Mini App, Env keys, Backend) тоже
      зелёные.
- [ ] CI run на свежий main commit полностью зелёный.

## Workflow

1. Создать worktree от свежего main (после F8 финиша):
   ```bash
   git worktree add -b infra/fix-main-ci ../ERP_Avgust_fix_ci origin/main
   ```
2. Локально диагностировать:
   ```bash
   cd backend && time pytest -q  # сколько занимает локально?
   cd bot && pytest --timeout=30 -q  # что падает?
   ```
3. Применить фикс по выбранной опции.
4. Push, открыть PR, дождаться зелёного CI.
5. Merge.

## Не делать

- ❌ НЕ skip бот-тесты через `if: false` в workflow — это hide, не fix.
- ❌ НЕ удалять testpaths из `backend/pytest.ini` — coverage упадёт.
- ❌ НЕ убирать `timeout-minutes` совсем — runner может зависнуть на час.
- ❌ НЕ комментировать failing tests как «TODO fix later» без issue.

## Связанные memory

- `feedback_main_ci_debt.md` — фиксация состояния на 2026-05-01
- `feedback_pytest_ssh_tunnel.md` — pytest в локальной разработке (не CI)
