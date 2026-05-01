# F8-01: Pipeline TD-17g — production-ready

**Команда:** IS-Петя (backend)
**Effort:** 1-2 дня
**Зависимости:** нет (можно делать параллельно с 02, 04)

---

## Цель

Перенести TD-17g pipeline (recognition) с локальной dev-машины на
production-готовый docker image и развернуть на нашей инфраструктуре
как новый контейнер `recognition-public:8004`. Старый контейнер
`ismeta-recognition:8003` оставить — он обслуживает внутреннюю
ISMeta MVP (port 3001).

## Текущее состояние

- TD-17g код: branch `recognition/td-17g-llm-targeted @ d8bce21`,
  worktree `ERP_Avgust_td17g/`.
- Локальный test-контейнер: `rec-td17g` на порту 8033, образ
  `rec-td17:test` + runtime pip install (camelot-py, opencv-python-headless,
  ghostscript).
- Dependencies НЕ в Dockerfile (runtime install).
- Memory limit 14 GB.
- API key: OpenAI GPT-4o из LLMProfile в ismeta-postgres.
- Regression на 10 spec: TOTAL 99.7%, 5/10 на 100%.

## Целевое состояние

- Новый docker image `recognition-public:1.0` с **всеми deps в Dockerfile**
  (Docling 2.92, Camelot 1.0, opencv-python-headless, ghostscript,
  onnxruntime, transformers, timm).
- Новый контейнер `recognition-public:8004` развёрнут на production-сервере
  216.57.110.41 (или dev-стенд для начала).
- Memory: 14 GB.
- Volume mount для PDF storage: `/storage/ismeta-uploads/` → внутри
  контейнера `/uploads/`.
- ENV configurable через ISMeta-настройки в ERP (см. F8-02).
- Регрессионный тест 10 spec проходит на production-стенде.

## Файлы которые меняем

### `recognition/Dockerfile`
Добавить в систему:
```dockerfile
RUN apt-get update && apt-get install -y \
    libxcb1 libxext6 libsm6 libgl1 libglib2.0-0 \
    ghostscript \
    && rm -rf /var/lib/apt/lists/*
```

В requirements.txt:
```
docling>=2.92
docling-core>=2.74
camelot-py>=1.0
opencv-python-headless>=4.13
ghostscript>=0.8
onnxruntime>=1.17
transformers>=4.x
timm>=0.9
```

### `recognition/requirements.txt`
Заменить runtime pip install на permanent deps в этом файле.

### `docker-compose.yml` (root) или новый `docker-compose.public.yml`
Добавить service `recognition-public`:
```yaml
recognition-public:
  build:
    context: ./recognition
    dockerfile: Dockerfile
  image: recognition-public:1.0
  container_name: recognition-public
  ports: ["8004:8003"]
  mem_limit: 14g
  volumes:
    - ./storage/ismeta-uploads:/uploads:rw
  environment:
    - PDF_EXTRACT_VIA_DOCLING=true
    - PDF_DOCLING_BYPASS_LLM=true
    - PDF_EXTRACT_VIA_CAMELOT=true
    - PDF_DOCLING_INJECT_HEADER=true
    - PDF_DOCLING_HEADER_HEIGHT_PT=110.0
    - PDF_LLM_VISION_FALLBACK=true
    - PDF_LLM_SCANNED_THRESHOLD=200
    - PDF_LLM_CYRILLIC_RATIO_THRESHOLD=0.3
    - PDF_LLM_VISION_COUNT_TOLERANCE=2
    - LLM_API_KEY=${LLM_API_KEY_OPENAI}
    - OPENAI_API_BASE=https://api.openai.com
    - LLM_MULTIMODAL_MODEL=gpt-4o
    - LLM_EXTRACT_MODEL=gpt-4o
    - RECOGNITION_API_KEY=${RECOGNITION_API_KEY}
    - PARSE_TIMEOUT_SECONDS=3600
    - LOG_LEVEL=INFO
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8003/v1/healthz"]
    interval: 30s
```

### `recognition/app/services/spec_parser.py`
Уже содержит TD-17g код. Изменения не требуются, кроме одного:
- Добавить параметр `pdf_storage_path: str` в config (для PDF copies).
- Если path задан — копировать загруженный PDF в этот path с
  timestamp-prefix перед обработкой.

### `recognition/app/config.py`
Добавить:
```python
pdf_storage_path: str = ""  # если "" — не копируем
```

### `recognition/app/api/parse.py` (или wrapper)
В обработчике POST `/v1/parse/spec` — если `settings.pdf_storage_path` задан,
скопировать `content` в `{pdf_storage_path}/{timestamp}-{filename}` ДО
парсинга.

## Acceptance criteria

- [ ] Docker image `recognition-public:1.0` собирается без runtime
      pip install.
- [ ] Контейнер `recognition-public` стартует с healthcheck=healthy.
- [ ] PDF storage volume mount работает (загруженный PDF копируется
      в `/storage/ismeta-uploads/`).
- [ ] Endpoint `POST /v1/parse/spec` отвечает за разумное время для
      небольших PDF (Spec-1 153 поз < 3 мин).
- [ ] Regression script `/tmp/td17/regression_10spec.sh 8004` даёт
      результат:
      - TOTAL ≥ 99.5%
      - Spec-1, 2, 3, 6, 9 на 100%
      - Spec-4, 5, 7, 8, 11 в пределах baseline ±2%
- [ ] LLM Vision intervention работает (Spec-7 ≥ 95%).
- [ ] Логи в JSON, log level INFO.
- [ ] Memory peak < 13 GB на Spec-9 (multi-page Camelot routing).

## Тест-план

1. **Build:** `docker compose -f docker-compose.public.yml build recognition-public`
2. **Up:** `docker compose -f docker-compose.public.yml up -d recognition-public`
3. **Healthcheck:** `curl http://localhost:8004/v1/healthz` → `{"status":"ok",...}`
4. **Smoke test:** загрузить Spec-1 → проверить items count = 153.
5. **Storage test:** загрузить Spec-2 → проверить что в
   `/storage/ismeta-uploads/` появился файл `<timestamp>-Спецификация 2.pdf`.
6. **Full regression:** `/tmp/td17/regression_10spec.sh 8004 prod_check`
   → результат как в [REGRESSION-RESULTS.md](../../recognition/REGRESSION-RESULTS.md).
7. **Memory monitoring:** `docker stats recognition-public` во время
   обработки Spec-9 (max ≤ 13 GB).

## Риски

- **Image size:** TD-17g имеет много deps (Docling+Camelot+Vision libs),
  итоговый image может быть 6-8 GB. Время первой выкачки = долгое.
  Mitigation: multi-stage build, layer caching.
- **Memory OOM:** Docling+Camelot+Vision одновременно — 14 GB memory limit
  может быть тесно на больших PDF. Mitigation: monitor + если упрёмся в OOM
  → переход на 18 GB либо отдельные контейнеры per pipeline (ML + Vision).
- **Hugging Face download:** Docling models скачиваются с HF при первом
  запуске (~1.2 GB). Если интернет упадёт — startup fail. Mitigation:
  pre-download на build phase (сохранять weights в image).

## Definition of Done

- Production контейнер `recognition-public:8004` живой, healthcheck OK.
- Regression test passing.
- PDF storage работает.
- Логи нормальные, без warnings.
- Memory peak < 13 GB.
- ENV variables documented в `recognition/.env.example`.
