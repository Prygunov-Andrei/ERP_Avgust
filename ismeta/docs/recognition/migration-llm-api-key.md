# Migration: OPENAI_API_KEY → LLM_API_KEY

**TD-04, recognition/td-04-determinism-rename-cosmetics.**

Recognition-сервис работает не только с OpenAI: реально prod крутит DeepSeek
V4 thinking, dev — gpt-5.x, тесты — локальные mock'и. Имя `OPENAI_API_KEY`
вводило в заблуждение. Переименовали на нейтральное `LLM_API_KEY`.

## TL;DR — что сделать в .env

```diff
- OPENAI_API_KEY=sk-...
+ LLM_API_KEY=sk-...
```

Старое имя продолжает работать как **alias** ещё минимум одну minor-version
(удаление — N+2, ориентировочно E22+).

## Что произошло в коде

`recognition/app/config.py::Settings`:

```python
class Settings(BaseSettings):
    llm_api_key: str = ""           # ← новое основное поле
    openai_api_key: str = ""        # ← deprecated alias

    @model_validator(mode="after")
    def _resolve_api_key(self) -> "Settings":
        if not self.llm_api_key and self.openai_api_key:
            self.llm_api_key = self.openai_api_key
        return self
```

`OpenAIVisionProvider.__init__` теперь читает `settings.llm_api_key`. На
живом процессе это даёт корректный ключ независимо от того, какое имя
переменной задано в .env.

`ismeta/docker-compose.yml::recognition.environment` явно пробрасывает:

```yaml
LLM_API_KEY: ${LLM_API_KEY:-${OPENAI_API_KEY:-}}
```

→ если на хосте экспортирован любой из двух — контейнер получает рабочий ключ.

## Deprecation timeline

- **Текущая версия (E20-2 / TD-04)** — alias работает, оба имени читаются.
- **N+1 (E18-E20)** — alias продолжает работать; в логах warning при пустом
  `LLM_API_KEY` + непустом `OPENAI_API_KEY` (планируется добавить).
- **N+2 (E22+)** — `openai_api_key` поле и fallback удаляются. CI ругается
  на использование `OPENAI_API_KEY` в `.env.example`.

## Что не меняем

- `OPENAI_API_BASE` — остаётся как есть. Это URL endpoint'а, и имя «OpenAI
  base» точно описывает контракт (OpenAI-compatible API URL).
- `recognition/.env.example` хранит `LLM_API_KEY=sk-...` как primary;
  `# OPENAI_API_KEY=...` остаётся в комментарии.
- Корневой `.env.example` (общий проектный) не трогаем — там `OPENAI_API_KEY`
  используется для других сервисов (backend ERP, не recognition).
