"""F8-03: тесты публичного API /api/hvac/ismeta/* и Celery task.

Recognition + ismeta-postgres mocked — тесты гоняются на ERP test-DB.
Smoke на живом стенде — отдельно (test-plan в BRIEF.md).
"""
from __future__ import annotations

import io
import tempfile
from decimal import Decimal
from unittest import mock

import pytest
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from . import tasks as tasks_module
from .models import HvacIsmetaSettings, IsmetaFeedback, IsmetaJob


PIPELINE_DEFAULT = "td17g"


def _make_pdf(name: str = "test.pdf", size_bytes: int = 2048) -> io.BytesIO:
    """Минимальный PDF-bytes (header + padding) для UploadedFile."""
    buf = io.BytesIO(b"%PDF-1.4\n%fake-binary\n" + b"x" * (size_bytes - 22))
    buf.name = name
    return buf


@pytest.fixture
def storage_dir(tmp_path):
    """Изолированная директория для PDF copies."""
    path = tmp_path / "ismeta-uploads"
    path.mkdir()
    return str(path)


@pytest.fixture
def configured_settings(db, storage_dir):
    """Singleton HvacIsmetaSettings с локальным storage_path."""
    obj = HvacIsmetaSettings.get_settings()
    obj.pdf_storage_path = storage_dir
    obj.default_pipeline = PIPELINE_DEFAULT
    obj.default_llm_profile_id = 1
    obj.concurrency_limit_enabled = True
    obj.max_file_size_mb = 5
    obj.enabled = True
    obj.save()
    return obj


@pytest.fixture
def client():
    return APIClient()


# ---------------------------------------------------------------------------
# /options
# ---------------------------------------------------------------------------


def test_options_returns_pipelines_and_profiles(client, configured_settings):
    fake_profiles = [
        {
            "id": 1,
            "name": "DeepSeek",
            "base_url": "https://api.deepseek.com",
            "extract_model": "deepseek-chat",
            "multimodal_model": "",
            "classify_model": "deepseek-chat",
            "vision_supported": False,
            "is_default": True,
        },
        {
            "id": 2,
            "name": "OpenAI GPT-4o",
            "base_url": "https://api.openai.com",
            "extract_model": "gpt-4o",
            "multimodal_model": "gpt-4o",
            "classify_model": "gpt-4o-mini",
            "vision_supported": True,
            "is_default": False,
        },
    ]
    with mock.patch(
        "hvac_ismeta.public_views.list_llm_profiles",
        return_value=fake_profiles,
    ):
        resp = client.get(reverse("ismeta-public-options"))
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()
    assert data["enabled"] is True
    assert data["max_file_size_mb"] == configured_settings.max_file_size_mb
    pipeline_ids = [p["id"] for p in data["pipelines"]]
    assert pipeline_ids == ["main", "td17g"]
    default_pipeline = next(p for p in data["pipelines"] if p["default"])
    assert default_pipeline["id"] == PIPELINE_DEFAULT
    assert len(data["llm_profiles"]) == 2
    assert data["llm_profiles"][0]["id"] == 1


def test_options_works_without_ismeta_db(client, configured_settings):
    """Если ismeta-postgres недоступен — list_llm_profiles вернёт [] (graceful)."""
    with mock.patch("hvac_ismeta.public_views.list_llm_profiles", return_value=[]):
        resp = client.get(reverse("ismeta-public-options"))
    assert resp.status_code == status.HTTP_200_OK
    assert resp.json()["llm_profiles"] == []


# ---------------------------------------------------------------------------
# /parse — concurrency, validation, file storage
# ---------------------------------------------------------------------------


def _post_parse(client: APIClient, file_obj, **extra):
    return client.post(
        reverse("ismeta-public-parse"),
        data={"file": file_obj, **extra},
        format="multipart",
    )


def test_parse_returns_job_id_and_creates_pdf(client, configured_settings):
    pdf = _make_pdf("spec1.pdf", size_bytes=4096)
    with mock.patch.object(tasks_module.process_ismeta_job, "delay") as delay_mock:
        resp = _post_parse(client, pdf, pipeline="td17g", llm_profile_id="2")
    assert resp.status_code == status.HTTP_202_ACCEPTED
    body = resp.json()
    job_id = body["job_id"]
    assert body["pipeline"] == "td17g"
    assert body["llm_profile_id"] == 2
    delay_mock.assert_called_once_with(job_id)

    job = IsmetaJob.objects.get(id=job_id)
    assert job.status == IsmetaJob.STATUS_QUEUED
    assert job.pdf_filename == "spec1.pdf"
    assert job.pdf_size_bytes == 4096
    assert job.session_key
    # PDF скопирован в storage
    import os as _os

    assert _os.path.exists(job.pdf_storage_path)
    # Cookie выставлена
    assert "ismeta_session" in resp.cookies


def test_parse_rejects_when_disabled(client, configured_settings):
    configured_settings.enabled = False
    configured_settings.save()
    resp = _post_parse(client, _make_pdf())
    assert resp.status_code == status.HTTP_503_SERVICE_UNAVAILABLE


def test_parse_rejects_non_pdf_extension(client, configured_settings):
    bad = io.BytesIO(b"not pdf")
    bad.name = "file.docx"
    resp = _post_parse(client, bad)
    assert resp.status_code == status.HTTP_400_BAD_REQUEST


def test_parse_rejects_oversize(client, configured_settings):
    # 5 MB лимит, шлём 6 MB
    big = _make_pdf("big.pdf", size_bytes=6 * 1024 * 1024)
    resp = _post_parse(client, big)
    assert resp.status_code == status.HTTP_400_BAD_REQUEST


def test_parse_rejects_unknown_pipeline(client, configured_settings):
    resp = _post_parse(client, _make_pdf(), pipeline="bogus-pipeline")
    assert resp.status_code == status.HTTP_400_BAD_REQUEST


def test_parse_rejects_invalid_llm_profile_id(client, configured_settings):
    resp = _post_parse(client, _make_pdf(), llm_profile_id="not-a-number")
    assert resp.status_code == status.HTTP_400_BAD_REQUEST


def test_parse_concurrency_blocks_second_attempt(client, configured_settings):
    """Активный job с того же session/IP → 429 при второй попытке."""
    with mock.patch.object(tasks_module.process_ismeta_job, "delay"):
        first = _post_parse(client, _make_pdf("a.pdf"))
    assert first.status_code == status.HTTP_202_ACCEPTED
    cookie = first.cookies["ismeta_session"].value

    client.cookies["ismeta_session"] = cookie
    with mock.patch.object(tasks_module.process_ismeta_job, "delay"):
        second = _post_parse(client, _make_pdf("b.pdf"))
    assert second.status_code == status.HTTP_429_TOO_MANY_REQUESTS


def test_parse_concurrency_disabled_allows_second(client, configured_settings):
    configured_settings.concurrency_limit_enabled = False
    configured_settings.save()
    with mock.patch.object(tasks_module.process_ismeta_job, "delay"):
        first = _post_parse(client, _make_pdf("a.pdf"))
    cookie = first.cookies["ismeta_session"].value
    client.cookies["ismeta_session"] = cookie
    with mock.patch.object(tasks_module.process_ismeta_job, "delay"):
        second = _post_parse(client, _make_pdf("b.pdf"))
    assert second.status_code == status.HTTP_202_ACCEPTED


def test_parse_concurrency_allows_after_completion(client, configured_settings):
    with mock.patch.object(tasks_module.process_ismeta_job, "delay"):
        first = _post_parse(client, _make_pdf("a.pdf"))
    job_id = first.json()["job_id"]
    job = IsmetaJob.objects.get(id=job_id)
    job.status = IsmetaJob.STATUS_DONE
    job.save()

    cookie = first.cookies["ismeta_session"].value
    client.cookies["ismeta_session"] = cookie
    with mock.patch.object(tasks_module.process_ismeta_job, "delay"):
        second = _post_parse(client, _make_pdf("b.pdf"))
    assert second.status_code == status.HTTP_202_ACCEPTED


# ---------------------------------------------------------------------------
# /progress + /result + /excel
# ---------------------------------------------------------------------------


def _make_job(**overrides) -> IsmetaJob:
    defaults = dict(
        session_key="sess-x",
        ip_address="127.0.0.1",
        pdf_filename="spec.pdf",
        pdf_storage_path="/tmp/spec.pdf",
        pdf_size_bytes=1024,
        pipeline=PIPELINE_DEFAULT,
        llm_profile_id=1,
        status=IsmetaJob.STATUS_DONE,
        pages_total=3,
        pages_processed=3,
        items_count=2,
        result_json={
            "items": [
                {
                    "name": "Кондиционер",
                    "model_name": "ASYG09KMCC",
                    "brand": "Fujitsu",
                    "manufacturer": "",
                    "unit": "шт",
                    "quantity": 1,
                    "section_name": "Раздел 1",
                    "page_number": 1,
                    "sort_order": 1,
                },
                {
                    "name": "Дренажный насос",
                    "model_name": "DP-200",
                    "brand": "",
                    "manufacturer": "Sauermann",
                    "unit": "шт",
                    "quantity": 2,
                    "section_name": "Раздел 1",
                    "page_number": 2,
                    "sort_order": 2,
                },
            ],
            "pages_stats": {"total": 3, "processed": 3, "skipped": 0, "error": 0},
            "pages_summary": [],
            "errors": [],
            "llm_costs": {"total_usd": 0.0123},
        },
        cost_usd=Decimal("0.0123"),
    )
    defaults.update(overrides)
    return IsmetaJob.objects.create(**defaults)


def test_progress_returns_status(db, client):
    job = _make_job(status=IsmetaJob.STATUS_PROCESSING, pages_processed=1)
    resp = client.get(reverse("ismeta-public-progress", kwargs={"pk": str(job.id)}))
    assert resp.status_code == status.HTTP_200_OK
    body = resp.json()
    assert body["status"] == "processing"
    assert body["pages_processed"] == 1
    # F8-Sprint4: live-state поля присутствуют в ответе (пустые при отсутствии Redis).
    for key in (
        "phase",
        "current_page_label",
        "elapsed_seconds",
        "eta_seconds",
        "last_event_ts",
    ):
        assert key in body


def test_progress_merges_redis_live_state(db, client, monkeypatch):
    """F8-Sprint4: /progress должен слить БД + Redis live-state.

    Redis в тестовом окружении нет, поэтому monkeypatch'им helper и
    проверяем, что поля live-state попадают в ответ и переопределяют
    БД-нули pages_processed/items_count.
    """
    job = _make_job(
        status=IsmetaJob.STATUS_PROCESSING,
        pages_processed=0,
        pages_total=0,
        items_count=0,
    )

    fake_live = {
        "phase": "llm_normalize",
        "pages_processed": 4,
        "pages_total": 10,
        "items_count": 57,
        "current_page_label": "Страница 4 из 10",
        "elapsed_seconds": 22,
        "eta_seconds": 38,
        "last_event_ts": "2026-05-03T10:30:00+00:00",
    }
    monkeypatch.setattr(
        "hvac_ismeta.public_views.read_live_progress",
        lambda job_id: fake_live,
    )
    resp = client.get(reverse("ismeta-public-progress", kwargs={"pk": str(job.id)}))
    assert resp.status_code == status.HTTP_200_OK
    body = resp.json()
    assert body["phase"] == "llm_normalize"
    assert body["pages_processed"] == 4
    assert body["pages_total"] == 10
    assert body["items_count"] == 57
    assert body["current_page_label"] == "Страница 4 из 10"
    assert body["eta_seconds"] == 38


def test_progress_ignores_live_state_when_done(db, client, monkeypatch):
    """Финальное состояние — БД источник истины. Live даже если протух,
    не должен сбить статус done."""
    job = _make_job(status=IsmetaJob.STATUS_DONE, pages_processed=10, pages_total=10)
    monkeypatch.setattr(
        "hvac_ismeta.public_views.read_live_progress",
        lambda job_id: {"phase": "llm_normalize", "pages_processed": 1},
    )
    resp = client.get(reverse("ismeta-public-progress", kwargs={"pk": str(job.id)}))
    assert resp.status_code == status.HTTP_200_OK
    body = resp.json()
    assert body["status"] == "done"
    assert body["phase"] == "done"
    # БД-значения сохранены, не перетёрты Redis-snapshot'ом.
    assert body["pages_processed"] == 10


def test_progress_no_redis_returns_db_only(db, client, monkeypatch):
    """Redis недоступен → /progress всё равно отвечает (БД-данные)."""
    job = _make_job(status=IsmetaJob.STATUS_PROCESSING, pages_processed=2)
    monkeypatch.setattr(
        "hvac_ismeta.public_views.read_live_progress",
        lambda job_id: None,
    )
    resp = client.get(reverse("ismeta-public-progress", kwargs={"pk": str(job.id)}))
    assert resp.status_code == status.HTTP_200_OK
    body = resp.json()
    assert body["pages_processed"] == 2
    assert body["phase"] == ""


def test_progress_404_for_unknown(db, client):
    resp = client.get(
        reverse(
            "ismeta-public-progress",
            kwargs={"pk": "00000000-0000-0000-0000-000000000000"},
        )
    )
    assert resp.status_code == status.HTTP_404_NOT_FOUND


def test_result_returns_items_when_done(db, client):
    job = _make_job()
    resp = client.get(reverse("ismeta-public-result", kwargs={"pk": str(job.id)}))
    assert resp.status_code == status.HTTP_200_OK
    body = resp.json()
    assert len(body["items"]) == 2
    assert body["pages_stats"]["total"] == 3
    assert body["cost_usd"] == pytest.approx(0.0123)


def test_result_409_when_not_done(db, client):
    job = _make_job(status=IsmetaJob.STATUS_PROCESSING)
    resp = client.get(reverse("ismeta-public-result", kwargs={"pk": str(job.id)}))
    assert resp.status_code == status.HTTP_409_CONFLICT


def test_excel_returns_xlsx_when_done(db, client):
    job = _make_job()
    resp = client.get(reverse("ismeta-public-excel", kwargs={"pk": str(job.id)}))
    assert resp.status_code == status.HTTP_200_OK
    assert "spreadsheetml" in resp["Content-Type"]
    assert "attachment" in resp["Content-Disposition"]
    # Реально валидный XLSX (zip)
    assert resp.content[:2] == b"PK"


def test_excel_409_when_not_done(db, client):
    job = _make_job(status=IsmetaJob.STATUS_ERROR)
    resp = client.get(reverse("ismeta-public-excel", kwargs={"pk": str(job.id)}))
    assert resp.status_code == status.HTTP_409_CONFLICT


# ---------------------------------------------------------------------------
# /feedback
# ---------------------------------------------------------------------------


def test_feedback_with_job(db, client):
    job = _make_job()
    resp = client.post(
        reverse("ismeta-public-feedback"),
        data={"job_id": str(job.id), "helpful": True, "comment": "ok"},
        format="json",
    )
    assert resp.status_code == status.HTTP_201_CREATED
    fb = IsmetaFeedback.objects.get(id=resp.json()["id"])
    assert fb.job_id == job.id
    assert fb.helpful is True
    assert fb.comment == "ok"


def test_feedback_without_job(db, client):
    resp = client.post(
        reverse("ismeta-public-feedback"),
        data={"helpful": False, "comment": "плохо"},
        format="json",
    )
    assert resp.status_code == status.HTTP_201_CREATED
    fb = IsmetaFeedback.objects.get(id=resp.json()["id"])
    assert fb.job_id is None
    assert fb.helpful is False


def test_feedback_requires_helpful(db, client):
    resp = client.post(reverse("ismeta-public-feedback"), data={}, format="json")
    assert resp.status_code == status.HTTP_400_BAD_REQUEST


def test_feedback_helpful_string_truthy(db, client):
    resp = client.post(
        reverse("ismeta-public-feedback"),
        data={"helpful": "true"},
        format="json",
    )
    assert resp.status_code == status.HTTP_201_CREATED
    fb = IsmetaFeedback.objects.get(id=resp.json()["id"])
    assert fb.helpful is True


# ---------------------------------------------------------------------------
# Celery task — process_ismeta_job (HTTP к recognition мокается)
# ---------------------------------------------------------------------------


@pytest.fixture
def pdf_on_disk(tmp_path):
    pdf = tmp_path / "spec.pdf"
    pdf.write_bytes(b"%PDF-1.4\nfake")
    return str(pdf)


def _build_recognition_response(items_count: int = 3, total_usd: float = 0.05) -> dict:
    return {
        "status": "done",
        "items": [
            {
                "name": f"item {i}",
                "model_name": "M",
                "brand": "",
                "manufacturer": "",
                "unit": "шт",
                "quantity": 1,
                "section_name": "S",
                "page_number": 1,
                "sort_order": i,
            }
            for i in range(items_count)
        ],
        "errors": [],
        "pages_stats": {"total": 2, "processed": 2, "skipped": 0, "error": 0},
        "pages_summary": [],
        "llm_costs": {"total_usd": total_usd},
    }


def test_process_ismeta_job_success(db, pdf_on_disk):
    job = _make_job(
        status=IsmetaJob.STATUS_QUEUED,
        result_json=None,
        pages_total=0,
        pages_processed=0,
        items_count=0,
        cost_usd=Decimal("0"),
        pdf_storage_path=pdf_on_disk,
    )
    fake_response = mock.MagicMock(status_code=200)
    fake_response.json.return_value = _build_recognition_response(items_count=3, total_usd=0.0421)

    creds = {
        "id": 1,
        "name": "Test",
        "base_url": "https://api.test",
        "api_key": "sk-test",
        "extract_model": "extract-m",
        "multimodal_model": "vision-m",
        "classify_model": "classify-m",
        "vision_supported": True,
    }
    with (
        mock.patch.object(tasks_module, "fetch_llm_credentials", return_value=creds),
        mock.patch.object(tasks_module.requests, "post", return_value=fake_response) as post_mock,
    ):
        result = tasks_module.process_ismeta_job(str(job.id))

    assert result == "done"
    job.refresh_from_db()
    assert job.status == IsmetaJob.STATUS_DONE
    assert job.items_count == 3
    assert job.pages_total == 2
    assert job.pages_processed == 2
    assert job.cost_usd == Decimal("0.0421")
    # Headers
    call_kwargs = post_mock.call_args.kwargs
    headers = call_kwargs["headers"]
    assert headers["X-LLM-API-Key"] == "sk-test"
    assert headers["X-LLM-Base-URL"] == "https://api.test"
    assert headers["X-LLM-Multimodal-Model"] == "vision-m"


def test_process_ismeta_job_recognition_error(db, pdf_on_disk):
    job = _make_job(
        status=IsmetaJob.STATUS_QUEUED,
        result_json=None,
        pdf_storage_path=pdf_on_disk,
    )
    fake_response = mock.MagicMock(status_code=502, text="bad gateway")
    creds = {
        "id": 1,
        "name": "Test",
        "base_url": "https://api.test",
        "api_key": "sk-test",
        "extract_model": "",
        "multimodal_model": "",
        "classify_model": "",
        "vision_supported": False,
    }
    with (
        mock.patch.object(tasks_module, "fetch_llm_credentials", return_value=creds),
        mock.patch.object(tasks_module.requests, "post", return_value=fake_response),
    ):
        result = tasks_module.process_ismeta_job(str(job.id))

    assert result == "error"
    job.refresh_from_db()
    assert job.status == IsmetaJob.STATUS_ERROR
    assert "502" in job.error_message


def test_process_ismeta_job_pipeline_routing(db, pdf_on_disk):
    job = _make_job(
        status=IsmetaJob.STATUS_QUEUED,
        result_json=None,
        pdf_storage_path=pdf_on_disk,
        pipeline="main",
        llm_profile_id=None,
    )
    fake_response = mock.MagicMock(status_code=200)
    fake_response.json.return_value = _build_recognition_response()

    with (
        mock.patch.object(tasks_module, "fetch_llm_credentials") as fetch_mock,
        mock.patch.object(tasks_module.requests, "post", return_value=fake_response) as post_mock,
        override_settings(
            RECOGNITION_PUBLIC_URL="http://recognition-public:8003",
            RECOGNITION_MAIN_URL="http://ismeta-recognition:8003",
        ),
    ):
        result = tasks_module.process_ismeta_job(str(job.id))

    assert result == "done"
    fetch_mock.assert_not_called()  # llm_profile_id=None → fetch skip
    url_called = post_mock.call_args.args[0]
    assert url_called.startswith("http://ismeta-recognition:8003")


def test_process_ismeta_job_missing(db):
    """job_id с несуществующим UUID → no crash, возврат missing."""
    result = tasks_module.process_ismeta_job("00000000-0000-0000-0000-000000000000")
    assert result == "missing"
