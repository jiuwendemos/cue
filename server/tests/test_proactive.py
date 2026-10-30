from __future__ import annotations

import json
from pathlib import Path

from fastapi.testclient import TestClient

from cue.api.app import create_app
from cue.proactive import scanner
from cue.proactive.signing import sign_payload, signed_link, verify_payload
from cue.store.db import Store

PACK = json.loads((Path(__file__).resolve().parents[1] / "cue" / "data" / "show.json").read_text(encoding="utf-8"))


def test_scan_raises_one_grouped_variant_and_is_idempotent() -> None:
    store = Store(":memory:")
    settings = scanner.default_settings(PACK)
    first = scanner.run_scan(PACK, store, "halcyon", settings)
    assert first["run"]["status"] == "ok"
    assert first["run"]["raised"] >= 1
    assert any(c["groupKey"] == "tour:venue-variant" for c in first["candidates"])
    assert first["notifications"]
    second = scanner.run_scan(PACK, store, "halcyon", first["settings"])
    assert second["run"]["raised"] == 0
    assert second["run"]["suppressed"] >= 1


def test_scan_honours_kill_switch() -> None:
    store = Store(":memory:")
    settings = scanner.default_settings(PACK)
    settings["stopSwitch"] = True
    result = scanner.run_scan(PACK, store, "halcyon", settings)
    assert result["run"]["status"] == "stopped"
    assert result["candidates"] == []


def test_signed_link_round_trip_and_expiry() -> None:
    payload = sign_payload({"path": "/#/cues", "actor": "Mara Voss"}, ttl_hours=1)
    assert verify_payload(payload) is not None
    expired = sign_payload({"path": "/#/cues"}, ttl_hours=-1)
    assert verify_payload(expired) is None
    assert verify_payload("not-a-token") is None
    link = signed_link("/#/cues")
    assert link["url"].startswith("http")
    assert link["token"]


def test_webhook_signature_is_hmac() -> None:
    import hashlib
    import hmac

    secret = "secret"
    body = b'{"a":1}'
    sig = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    assert len(sig) == 64


def test_proactive_api_scan_share_and_notifications() -> None:
    with TestClient(create_app(":memory:")) as client:
        proactive = client.get("/api/proactive").json()
        assert proactive["scheduler"]["mode"] == "shadow"
        assert proactive["watchers"]
        assert proactive["backtest"]["rows"]

        scan = client.post("/api/proactive/scan", json={"mode": "shadow"}).json()
        assert scan["run"]["status"] == "ok"
        assert scan["candidates"]

        readiness = client.get("/api/readiness").json()
        dynamic_ids = {r["id"] for r in readiness["risks"] if r["id"].startswith("D-")}
        assert dynamic_ids

        risk = scan["candidates"][0]
        ack = client.post(f"/api/readiness/{risk['id']}/ack", json={"actor": "Mara Voss"})
        assert ack.status_code == 200
        assert client.get("/api/readiness").json()["stats"]["open"] >= 1

        notifications = client.get("/api/notifications").json()
        assert notifications["notifications"]
        first = notifications["notifications"][0]
        assert client.post(f"/api/notifications/{first['id']}/read").json()["read"] is True
        assert client.post("/api/notifications/read-all").json()["read"] is True

        settings = client.post("/api/proactive/settings", json={"mode": "live", "intervalMinutes": 60}).json()
        assert settings["mode"] == "live"
        stopped = client.post("/api/proactive/stop", json={"reason": "Test stop"}).json()
        assert stopped["stopSwitch"] is True
        started = client.post("/api/proactive/start").json()
        assert started["stopSwitch"] is False

        digest = client.post("/api/proactive/digest", json={}).json()
        assert "readiness digest" in digest["markdown"].lower()

        share = client.post("/api/share", json={"path": "/#/cues"}).json()
        assert share["token"]
        page = client.get("/api/share/cue-sheet", params={"token": share["token"]})
        assert page.status_code == 200
        assert "CUE" in page.text
        assert client.get("/api/share/cue-sheet", params={"token": "bad"}).status_code == 401

        backtest = client.get("/api/proactive/backtest").json()
        assert backtest["rows"]
        assert "precision_est" in backtest["overall"]
