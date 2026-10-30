from __future__ import annotations

from fastapi.testclient import TestClient

from cue.api.app import create_app


def client() -> TestClient:
    return TestClient(create_app(":memory:"))


def test_health_and_agent_status() -> None:
    with client() as c:
        health = c.get("/api/health")
        assert health.status_code == 200
        body = health.json()
        assert body["ok"] is True
        assert body["show"] == "show-ns-001"
        status = c.get("/api/agent/status").json()
        assert status["available"] is True
        assert status["backend"] == "deterministic-local"


def test_agent_answers_with_citations() -> None:
    with client() as c:
        answer = c.post("/api/agent/ask", json={"question": "why is the front truss over?", "active_look_id": "look-aerial-12"}).json()
        assert answer["tool"] == "rig.weight_check"
        assert "front truss" in answer["title"].lower()
        assert answer["citations"]


def test_checks_and_budget() -> None:
    with client() as c:
        checks = c.get("/api/checks", params={"look_id": "look-aerial-12"}).json()
        assert checks["summary"]["fail"] >= 3
        budget = c.get("/api/budget", params={"look_id": "look-aerial-12"}).json()
        assert budget["total"] == 29577
        assert budget["approved"] == 29000


def test_cue_signature_and_export() -> None:
    with client() as c:
        signed = c.post("/api/cues/LX%207/sign", json={"actor": "Mara Voss"}).json()
        assert signed["signature"].startswith("MV-")
        signatures = c.get("/api/cues").json()["signed"]
        assert "LX 7" in signatures
        export = c.get("/api/cues/export.csv")
        assert export.status_code == 200
        assert "LX 7" in export.text
        unsafe = c.post("/api/cues/LX%201/sign", json={"actor": "Mara Voss"})
        assert unsafe.status_code == 400


def test_readiness_lifecycle_and_audit() -> None:
    with client() as c:
        readiness = c.get("/api/readiness").json()
        assert readiness["stats"]["open"] == 11
        acknowledged = c.post("/api/readiness/R-001/ack", json={"actor": "Mara Voss"}).json()
        assert acknowledged["state"]["state"] == "acknowledged"
        no_reason = c.post("/api/readiness/R-001/dismiss", json={"actor": "Mara Voss"})
        assert no_reason.status_code == 400
        dismissed = c.post("/api/readiness/R-001/dismiss", json={"actor": "Mara Voss", "reason": "False alarm — re-metered."})
        assert dismissed.status_code == 200
        audits = c.get("/api/audits").json()["events"]
        assert any(a["action"] == "risk.dismiss" for a in audits)


def test_version_approval_is_human_and_immutable() -> None:
    with client() as c:
        approved = c.post("/api/versions/v5/approve", json={"actor": "Jonas Reed", "note": "Cue sheet and budget match."})
        assert approved.status_code == 200
        assert approved.json()["approval"]["signature"].startswith("JR-")
        versions = c.get("/api/versions").json()["versions"]
        v5 = next(v for v in versions if v["id"] == "v5")
        assert v5["status"] == "approved"


def test_render_refuses_missing_npu() -> None:
    with client() as c:
        bad = c.post("/api/render/settings", json={"device": "npu", "quality": "high"})
        assert bad.status_code == 409
        ok = c.post("/api/render/settings", json={"device": "gpu", "quality": "show"})
        assert ok.status_code == 200
        assert ok.json()["device"] == "gpu"


def test_tenant_isolation() -> None:
    with client() as c:
        c.post("/api/cues/LX%207/sign", json={"actor": "Mara Voss"}, headers={"X-CUE-Tenant": "halcyon"})
        other = c.get("/api/cues", headers={"X-CUE-Tenant": "another"})
        assert other.status_code == 200
        assert "LX 7" not in other.json()["signed"]
        unknown = c.get("/api/health", headers={"X-CUE-Tenant": "bad tenant!"})
        assert unknown.headers["X-CUE-Tenant"] == "halcyon"


def test_reset() -> None:
    with client() as c:
        c.post("/api/cues/LX%207/sign", json={"actor": "Mara Voss"})
        c.post("/api/reset")
        assert c.get("/api/cues").json()["signed"] == {}
