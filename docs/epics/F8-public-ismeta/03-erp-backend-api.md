# F8-03: ERP backend API для публичного recognition

**Команда:** IS-Петя
**Effort:** 2 дня
**Зависимости:** 01 (recognition-public контейнер) + 02 (HvacIsmetaSettings model)

---

## Цель

Создать в ERP backend (Django) endpoints под префиксом `/api/hvac/ismeta/`
для публичного использования с hvac-info.com. Backend проксирует к
recognition сервису (8004), отслеживает прогресс, копирует PDF в
storage, проверяет concurrency limit, читает настройки из
`HvacIsmetaSettings` (созданный в F8-02).

## Текущее состояние

- ERP backend Django (`backend/`) уже имеет публичные endpoints
  `/api/public/v1/` (используется AC Rating) и `/api/hvac/`
  (hvac-info новости).
- Recognition service standalone на порту 8003 (старый ISMeta MVP)
  и 8004 (новый public, после F8-01).
- LLMProfile model в `ismeta-postgres` (отдельная база), не
  доступна напрямую из ERP backend Django.
- Async jobs: ERP не имеет worker для long-running tasks (recognition
  занимает 3-30 мин).

## Целевое состояние

### API Endpoints (публичные, без auth)

| Method | Path | Описание |
|--------|------|---------|
| `GET` | `/api/hvac/ismeta/options` | Список доступных pipelines + LLM profiles для UI |
| `POST` | `/api/hvac/ismeta/parse` | Загрузка PDF + старт обработки. Returns `job_id`. |
| `GET` | `/api/hvac/ismeta/jobs/<job_id>/progress` | SSE или polling: прогресс (страница X/Y) |
| `GET` | `/api/hvac/ismeta/jobs/<job_id>/result` | Финальный результат (items + статистика) |
| `GET` | `/api/hvac/ismeta/jobs/<job_id>/excel` | Скачать Excel с items |
| `POST` | `/api/hvac/ismeta/feedback` | Форма обратной связи («помогло / не помогло») |

### Async обработка

Long-running parsing (3-30 мин) нельзя в HTTP request-response.
Нужен async job system:

- Запуск parse → создаёт `IsmetaJob` запись в БД с `status=queued`
- Celery task / lightweight worker → берёт job → вызывает recognition
  service → updates `status=processing`, `pages_processed`
- По окончании → `status=done`, `result_json`, `excel_path`
- Frontend опрашивает `progress` endpoint раз в 2-5 секунд

## Файлы которые меняем

### `backend/hvac_ismeta/models.py`

Добавить рядом с `HvacIsmetaSettings`:

```python
class IsmetaJob(models.Model):
    STATUS_CHOICES = [
        ("queued", "В очереди"),
        ("processing", "Обработка"),
        ("done", "Готово"),
        ("error", "Ошибка"),
        ("cancelled", "Отменено"),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    session_key = models.CharField(max_length=64, db_index=True)  # cookie value
    ip_address = models.GenericIPAddressField(db_index=True)
    user_agent = models.TextField(blank=True)
    pdf_filename = models.CharField(max_length=255)
    pdf_storage_path = models.CharField(max_length=500)  # абсолютный path к скопированному PDF
    pdf_size_bytes = models.IntegerField()
    pipeline = models.CharField(max_length=20)  # "main" / "td17g"
    llm_profile_id = models.IntegerField(null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="queued")
    pages_total = models.IntegerField(default=0)
    pages_processed = models.IntegerField(default=0)
    items_count = models.IntegerField(default=0)
    result_json = models.JSONField(null=True, blank=True)
    error_message = models.TextField(blank=True)
    cost_usd = models.DecimalField(max_digits=10, decimal_places=4, default=0)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    started_at = models.DateTimeField(null=True)
    completed_at = models.DateTimeField(null=True)
    feedback_email = models.EmailField(blank=True)  # опционально

    class Meta:
        indexes = [
            models.Index(fields=["session_key", "status"]),
            models.Index(fields=["created_at"]),
        ]


class IsmetaFeedback(models.Model):
    job = models.ForeignKey(IsmetaJob, on_delete=models.CASCADE, related_name="feedbacks")
    helpful = models.BooleanField()  # True = helped, False = not
    comment = models.TextField(blank=True)
    contact_email = models.EmailField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
```

### `backend/hvac_ismeta/views.py`

```python
class IsmetaPublicViewSet(viewsets.ViewSet):
    """Public endpoints без auth для hvac-info.com."""
    permission_classes = []

    @action(detail=False, methods=["get"], url_path="options")
    def options(self, request):
        """Return available pipelines + LLM profiles."""
        # Проксирование в ismeta-postgres LLMProfile (через ismeta-backend
        # API, не прямой DB access — кросс-app dependency).
        return Response({
            "pipelines": [
                {"id": "main", "label": "Точный (DeepSeek pure-LLM)", "default": False},
                {"id": "td17g", "label": "Быстрый (Docling+Camelot+Vision)", "default": True},
            ],
            "llm_profiles": [
                {"id": 4, "name": "DeepSeek V4-Pro", "vision": False},
                {"id": 5, "name": "OpenAI GPT-5.4", "vision": True},
                {"id": 6, "name": "OpenAI GPT-4o", "vision": True, "default": True},
                {"id": 7, "name": "Gemini 3.1 Pro", "vision": True},
                # 8 — Grok (после F8-04)
            ],
        })

    @action(detail=False, methods=["post"], url_path="parse")
    def parse(self, request):
        """Загрузка PDF + старт обработки."""
        settings_obj = HvacIsmetaSettings.get_settings()
        if not settings_obj.enabled:
            return Response({"error": "Сервис временно недоступен"}, status=503)

        # 1. Concurrency check
        session_key = self._get_or_set_session_key(request)
        ip = self._get_client_ip(request)
        if settings_obj.concurrency_limit_enabled:
            active = IsmetaJob.objects.filter(
                Q(session_key=session_key) | Q(ip_address=ip),
                status__in=["queued", "processing"],
            ).exists()
            if active:
                return Response(
                    {"error": "У вас уже идёт обработка. Дождитесь завершения."},
                    status=429,
                )

        # 2. File validation
        pdf_file = request.FILES.get("file")
        if not pdf_file:
            return Response({"error": "PDF не приложен"}, status=400)
        if pdf_file.size > settings_obj.max_file_size_mb * 1024 * 1024:
            return Response({"error": f"Размер > {settings_obj.max_file_size_mb} MB"}, status=400)
        if not pdf_file.name.lower().endswith(".pdf"):
            return Response({"error": "Только PDF файлы"}, status=400)

        # 3. Copy PDF to storage
        storage_path = settings_obj.pdf_storage_path
        os.makedirs(storage_path, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_name = sanitize_filename(pdf_file.name)
        local_path = os.path.join(storage_path, f"{timestamp}-{safe_name}")
        with open(local_path, "wb") as f:
            for chunk in pdf_file.chunks():
                f.write(chunk)

        # 4. Create IsmetaJob
        job = IsmetaJob.objects.create(
            session_key=session_key,
            ip_address=ip,
            user_agent=request.META.get("HTTP_USER_AGENT", "")[:500],
            pdf_filename=pdf_file.name,
            pdf_storage_path=local_path,
            pdf_size_bytes=pdf_file.size,
            pipeline=request.data.get("pipeline") or settings_obj.default_pipeline,
            llm_profile_id=request.data.get("llm_profile_id") or settings_obj.default_llm_profile_id,
            feedback_email=request.data.get("email", ""),
        )

        # 5. Trigger async processing
        process_ismeta_job.delay(str(job.id))  # Celery task

        return Response({"job_id": str(job.id)})

    @action(detail=True, methods=["get"], url_path="progress")
    def progress(self, request, pk=None):
        try:
            job = IsmetaJob.objects.get(id=pk)
        except IsmetaJob.DoesNotExist:
            return Response({"error": "Not found"}, status=404)
        return Response({
            "status": job.status,
            "pages_total": job.pages_total,
            "pages_processed": job.pages_processed,
            "items_count": job.items_count,
            "started_at": job.started_at,
            "error_message": job.error_message,
        })

    @action(detail=True, methods=["get"], url_path="result")
    def result(self, request, pk=None):
        try:
            job = IsmetaJob.objects.get(id=pk)
        except IsmetaJob.DoesNotExist:
            return Response({"error": "Not found"}, status=404)
        if job.status != "done":
            return Response({"error": "Not ready"}, status=400)
        return Response({
            "items": job.result_json.get("items", []),
            "pages_stats": job.result_json.get("pages_stats", {}),
            "cost_usd": float(job.cost_usd),
        })

    @action(detail=True, methods=["get"], url_path="excel")
    def excel(self, request, pk=None):
        # Generate xlsx from result_json и вернуть как download
        ...
```

### `backend/hvac_ismeta/tasks.py` (Celery)

```python
@shared_task(bind=True)
def process_ismeta_job(self, job_id):
    job = IsmetaJob.objects.get(id=job_id)
    job.status = "processing"
    job.started_at = timezone.now()
    job.save()

    try:
        # Determine recognition service URL based on pipeline
        if job.pipeline == "td17g":
            recognition_url = "http://recognition-public:8003"
        else:
            recognition_url = "http://ismeta-recognition:8003"

        # Read LLM profile credentials from ismeta-postgres
        llm_creds = fetch_llm_profile(job.llm_profile_id)

        # Open PDF and POST to recognition
        with open(job.pdf_storage_path, "rb") as f:
            files = {"file": (job.pdf_filename, f, "application/pdf")}
            headers = {
                "X-API-Key": settings.RECOGNITION_API_KEY,
                "X-LLM-API-Key": llm_creds["api_key"],
                "X-LLM-Base-URL": llm_creds["base_url"],
                "X-LLM-Multimodal-Model": llm_creds["multimodal_model"],
            }
            resp = requests.post(
                f"{recognition_url}/v1/parse/spec",
                files=files, headers=headers, timeout=3600,
            )

        if resp.status_code != 200:
            raise Exception(f"Recognition error: {resp.status_code} {resp.text[:500]}")

        data = resp.json()
        job.result_json = data
        job.items_count = len(data.get("items", []))
        job.pages_total = data.get("pages_stats", {}).get("total", 0)
        job.pages_processed = data.get("pages_stats", {}).get("processed", 0)
        job.cost_usd = sum(float(c.get("cost_usd", 0)) for c in data.get("llm_costs", []))
        job.status = "done"
        job.completed_at = timezone.now()
        job.save()

        # If feedback_email задан → send notification
        if job.feedback_email:
            send_completion_email(job)

    except Exception as e:
        job.status = "error"
        job.error_message = str(e)[:2000]
        job.completed_at = timezone.now()
        job.save()
```

### `backend/hvac_ismeta/urls.py`

```python
from rest_framework.routers import DefaultRouter
from .views import IsmetaPublicViewSet

router = DefaultRouter()
router.register("", IsmetaPublicViewSet, basename="ismeta-public")
urlpatterns = router.urls
```

### `backend/finans_assistant/urls.py` (shared)

```python
path("api/hvac/ismeta/", include("hvac_ismeta.urls")),
```

## Acceptance criteria

- [ ] `GET /api/hvac/ismeta/options` возвращает 2 pipelines + N LLM profiles.
- [ ] `POST /api/hvac/ismeta/parse` с валидным PDF создаёт IsmetaJob,
      возвращает `job_id`.
- [ ] PDF копируется в `pdf_storage_path` с timestamp prefix.
- [ ] Concurrency limit:
      - При активной обработке с того же session_key/IP → 429.
      - Если `concurrency_limit_enabled=False` → не блокирует.
- [ ] Celery task запускается, обновляет `pages_processed` инкрементально.
- [ ] `GET /api/hvac/ismeta/jobs/<id>/progress` возвращает текущий статус.
- [ ] `GET /api/hvac/ismeta/jobs/<id>/result` возвращает items
      когда status=done.
- [ ] `GET /api/hvac/ismeta/jobs/<id>/excel` возвращает .xlsx файл.
- [ ] Errors handled gracefully: invalid file, oversize, recognition
      service down.
- [ ] PDF size limit `max_file_size_mb` соблюдается.
- [ ] Cost tracking: `job.cost_usd` заполняется из recognition response.

## Тест-план

1. **Options:** `curl /api/hvac/ismeta/options` → JSON с 2 pipelines.
2. **Upload Spec-1:** `curl -F file=@spec1.pdf /api/hvac/ismeta/parse`
   → 200 с job_id.
3. **PDF stored:** проверить файл в `/storage/ismeta-uploads/`.
4. **Progress polling:** опрашивать `progress` каждые 2 сек → видим
   рост `pages_processed`.
5. **Result:** когда status=done → `result` возвращает 153 items.
6. **Excel:** GET excel → скачивается .xlsx с items.
7. **Concurrency:** запустить 2 parses подряд из одного browser →
   second должен получить 429.
8. **Concurrency disabled:** в settings выключить
   `concurrency_limit_enabled` → second parse работает.
9. **Oversize:** загрузить 100 MB PDF (> 50 MB limit) → 400.
10. **Invalid file:** загрузить .docx → 400.
11. **Recognition down:** остановить recognition-public → status=error
    с сообщением.

## Риски

- **Cross-DB:** LLMProfile в ismeta-postgres, не доступна Django ORM.
  Mitigation: HTTP fetch к ismeta-backend `/api/llm-profiles/` или
  shared FastAPI proxy. Решить через design call с командой ISMeta.
- **Celery infrastructure:** ERP backend сейчас не имеет Celery
  worker (только sync requests). Нужно добавить worker container.
  Memory: текущий ERP уже имеет Redis (для AC Rating ratelimit) —
  reuse.
- **Storage growth:** PDFs хранятся бессрочно, могут накопиться.
  Mitigation: cron task удаляющий files старше 90 дней (сделать в
  отдельной задаче после launch).
- **Disk space:** PDF до 50 MB × N запусков/день — нужно резервировать
  место. Default 100 GB volume.

## Definition of Done

- 6 endpoints живы и работают.
- Celery worker обрабатывает jobs.
- IsmetaJob model + migration applied.
- PDF storage работает.
- Concurrency limit работает.
- All acceptance criteria passing.
- Error handling без 500 на любых invalid inputs.
