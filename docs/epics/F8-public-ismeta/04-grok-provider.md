# F8-04: Grok как 4-я ИИ-модель

**Команда:** IS-Петя
**Effort:** 1 день
**Зависимости:** нет (можно делать параллельно с другими этапами).

---

## Цель

Подключить xAI Grok как 4-й LLM provider в recognition сервисе.
Появится в выпадающем списке выбора ИИ-модели в UI публичного
сайта (наряду с DeepSeek, OpenAI, Gemini).

## Текущее состояние

- Recognition сервис имеет 3 провайдера в `recognition/app/providers/`:
  - DeepSeek (через OpenAI-compat API base)
  - OpenAI (gpt-4o, gpt-4o-mini)
  - Gemini (через OpenAI-compat endpoint `/v1beta/openai/`)
- LLMProfile в `ismeta-postgres`: 4 записи (DeepSeek, OpenAI GPT-5.4,
  OpenAI GPT-4o, Gemini 3.1 Pro). Grok нет.
- xAI API: `https://api.x.ai/v1`, OpenAI-compatible. Models:
  - `grok-4` (text)
  - `grok-2-vision-1212` (multimodal)
  - `grok-2-1212` (text fast)

## Целевое состояние

- Новый provider class `XaiProvider` в `recognition/app/providers/xai.py`
  (или reuse `OpenAICompatProvider` если у нас generic).
- 5-я запись в `llm_profile` table (через ismeta-backend admin).
- Test connection endpoint работает для Grok profile.
- В UI выбора (F8-05) Grok появляется в dropdown.

## Файлы которые меняем

### Recognition

#### `recognition/app/providers/xai.py` (новый или reuse)

Если у нас уже generic OpenAI-compat provider — просто параметризуем
через `base_url`. Иначе — новый class:

```python
from .base import BaseLLMProvider, TextCompletion
from openai import AsyncOpenAI

class XaiProvider(BaseLLMProvider):
    """xAI Grok provider (OpenAI-compatible API)."""

    name = "xai"
    base_url = "https://api.x.ai/v1"

    def __init__(self, api_key: str, text_model: str = "grok-4",
                 multimodal_model: str = "grok-2-vision-1212"):
        self.client = AsyncOpenAI(api_key=api_key, base_url=self.base_url)
        self.text_model = text_model
        self.multimodal_model = multimodal_model

    async def text_complete(self, prompt: str, **kwargs) -> TextCompletion:
        # Same as OpenAI provider — единый OpenAI-compat protocol
        ...

    async def multimodal_complete(self, prompt: str, image_b64: str, **kwargs) -> TextCompletion:
        # OpenAI-compat vision call
        ...
```

#### `recognition/app/providers/__init__.py`

Добавить `xai` в registry/factory:
```python
PROVIDERS = {
    "openai": OpenAIProvider,
    "deepseek": DeepSeekProvider,
    "gemini": GeminiProvider,
    "xai": XaiProvider,  # NEW
}
```

Detection по `base_url`:
```python
def detect_provider(base_url: str) -> str:
    if "api.x.ai" in base_url:
        return "xai"
    if "deepseek.com" in base_url:
        return "deepseek"
    if "googleapis.com" in base_url:
        return "gemini"
    return "openai"
```

### ISMeta backend (LLMProfile)

#### Создание записи через Django admin или management command

PO добавит profile вручную через ISMeta UI после deploy. Либо
management command:

```bash
docker exec ismeta-backend python manage.py create_llm_profile \
    --name "Grok 4" \
    --base-url "https://api.x.ai/v1" \
    --extract-model "grok-4" \
    --multimodal-model "grok-2-vision-1212" \
    --classify-model "grok-2-1212" \
    --vision-supported true \
    --api-key "$XAI_API_KEY"
```

XAI_API_KEY возьмётся из ENV или ввод вручную.

### Recognition

#### `recognition/app/api/parse.py` (или wrapper)

Endpoint должен корректно обрабатывать `X-LLM-Base-URL: https://api.x.ai/v1`
header — детектить `xai` provider, инстанцировать `XaiProvider`.

Уже работает через generic detection. Изменения только если есть
hardcoded провайдер в коде.

#### `recognition/app/providers/base.py`

Verify что abstraction `multimodal_complete` совместима с Grok ответами
(JSON format, headers).

### Frontend (опционально, F8-05 это сделает)

В выпадающем списке LLM models — Grok появится автоматически когда
profile создан в БД (LLMProfile).

## Acceptance criteria

- [ ] `XaiProvider` (или generic) корректно работает с api.x.ai/v1.
- [ ] Test connection из ISMeta UI → green check для Grok profile.
- [ ] Grok profile с api_key создан в `llm_profile` table.
- [ ] Recognition POST /v1/parse/spec с `X-LLM-Base-URL=https://api.x.ai/v1`
      работает (text + multimodal).
- [ ] Vision LLM intervention (TD-17g) на Spec-7 с Grok даёт результат
      (может быть хуже OpenAI — это OK, главное не падает).
- [ ] LLM cost tracking работает для Grok (use the same protocol).

## Тест-план

1. **API check:** `curl https://api.x.ai/v1/models -H "Authorization: Bearer $XAI_API_KEY"`
   → list of available models.
2. **Provider unit test:** mock XaiProvider, call `text_complete("hello")`
   → returns TextCompletion.
3. **Profile create:** через ISMeta UI создать «Grok 4» profile с
   `https://api.x.ai/v1` + key.
4. **Test connection:** из UI → проверить connection success.
5. **Live recognition:** загрузить Spec-1 через recognition с Grok
   profile → should parse normally.
6. **Vision:** загрузить Spec-7 (scanned) с Grok profile →
   `multimodal_complete` returns image-extracted text.

## Risks

- **Quality variability:** Grok может давать разные результаты на
  русском OВиК тексте чем OpenAI. На production не switch'em default
  на Grok — оставим OpenAI/DeepSeek default. Grok — опция.
- **Rate limits:** xAI имеет свои rate limits. На production — мониторим.
- **Pricing:** Grok ~$5/1M tokens (input), $15/1M output. Сравнимо с
  GPT-4o. Cost tracking через стандартный mechanism работает.

## Definition of Done

- Grok provider работает для text + vision calls.
- Profile в `llm_profile` table.
- Test connection passing.
- Recognition test на 1 spec с Grok успешен.
- Появляется в выпадающем списке UI публичного сайта (после F8-05).
