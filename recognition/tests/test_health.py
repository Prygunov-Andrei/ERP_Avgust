"""Test /v1/healthz."""


def test_healthz(client):
    resp = client.get("/v1/healthz")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
    assert resp.json()["service"] == "recognition"


def test_healthz_no_auth_required(client):
    """Healthz does NOT require X-API-Key."""
    resp = client.get("/v1/healthz")  # no headers
    assert resp.status_code == 200
