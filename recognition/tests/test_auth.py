"""Test X-API-Key authentication."""

import io


def _fake_pdf():
    return io.BytesIO(b"%PDF-1.4 fake content for test")


def test_missing_api_key_401(client):
    resp = client.post(
        "/v1/parse/spec",
        files={"file": ("test.pdf", _fake_pdf(), "application/pdf")},
    )
    assert resp.status_code == 401
    assert resp.json()["detail"]["error"] == "invalid_api_key"


def test_wrong_api_key_401(client):
    resp = client.post(
        "/v1/parse/spec",
        files={"file": ("test.pdf", _fake_pdf(), "application/pdf")},
        headers={"X-API-Key": "wrong-key"},
    )
    assert resp.status_code == 401


def test_valid_api_key_not_401(client, auth_headers):
    """Valid key should NOT return 401 (may return other errors like 415 for non-real PDF)."""
    resp = client.post(
        "/v1/parse/spec",
        files={"file": ("test.pdf", _fake_pdf(), "application/pdf")},
        headers=auth_headers,
    )
    assert resp.status_code != 401
