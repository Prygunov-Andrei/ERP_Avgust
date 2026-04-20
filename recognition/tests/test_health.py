"""Test /v1/healthz."""


def test_healthz(client):
    resp = client.get("/v1/healthz")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert "version" in body
    assert "provider" in body


def test_healthz_no_auth_required(client):
    resp = client.get("/v1/healthz")
    assert resp.status_code == 200
