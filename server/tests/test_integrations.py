from __future__ import annotations

import io
import json
import threading
import zipfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from cue import config
from cue.agent.runtime import AgentRuntime, AgentUnavailable
from cue.api.app import create_app
from cue.integrations import exporters
from cue.proactive.delivery import deliver
from cue.store.db import Store

PACK = json.loads((Path(__file__).resolve().parents[1] / "cue" / "data" / "show.json").read_text(encoding="utf-8"))


def test_export_files_are_real() -> None:
    calendar = exporters.ics(PACK)
    assert calendar.startswith("BEGIN:VCALENDAR")
    assert "SUMMARY:" in calendar
    assert "Night Signal" in calendar

    csv = exporters.grandma3_csv(PACK)
    assert "Cue,Name,Trigger" in csv
    assert "THE DROP" in csv
    assert "<CueSheet" in exporters.grandma3_xml(PACK)
    assert "RAIN" in exporters.resolume_csv(PACK)
    assert "B1" in exporters.vectorworks_csv(PACK)

    data = exporters.mvr_zip(PACK)
    assert data.startswith(b"PK")
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        names = set(archive.namelist())
        assert "GeneralSceneDescription.xml" in names
        assert "CueSheet.csv" in names
        assert "README.txt" in names


def test_export_and_mcp_endpoints() -> None:
    with TestClient(create_app(":memory:")) as client:
        assert client.get("/api/export/ics").status_code == 200
        assert client.get("/api/export/grandma3.csv").status_code == 200
        assert client.get("/api/export/grandma3.xml").status_code == 200
        assert client.get("/api/export/resolume.csv").status_code == 200
        assert client.get("/api/export/vectorworks.csv").status_code == 200
        mvr = client.get("/api/export/mvr.zip")
        assert mvr.status_code == 200
        assert mvr.content.startswith(b"PK")

        info = client.get("/mcp").json()
        assert "show_summary" in info["tools"]
        init = client.post("/mcp", json={"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}}).json()
        assert init["result"]["serverInfo"]["name"] == "cue"
        listed = client.post("/mcp", json={"jsonrpc": "2.0", "id": 2, "method": "tools/list"}).json()
        assert any(tool["name"] == "checks" for tool in listed["result"]["tools"])
        called = client.post(
            "/mcp",
            json={"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": "checks", "arguments": {"look_id": "look-aerial-12"}}},
        ).json()
        assert "power" in called["result"]["content"][0]["text"]
        unknown = client.post("/mcp", json={"jsonrpc": "2.0", "id": 4, "method": "nope"}).json()
        assert unknown["error"]["code"] == -32601


def test_delivery_is_simulated_without_credentials() -> None:
    store = Store(":memory:")
    notification = {
        "id": "NT-TEST",
        "at": "2026-10-30T10:00:00+01:00",
        "kind": "risk",
        "severity": "high",
        "title": "Test risk",
        "detail": "A test.",
        "risk_id": "R-001",
        "channels": ["in_app", "slack", "email", "sms", "webhook"],
        "delivered": True,
        "read": False,
        "dedup_key": "NT-TEST",
    }
    store.save_notification("halcyon", notification)
    results = deliver(store, "halcyon", notification, {"channels": ["in_app", "slack", "email", "sms", "webhook"]})
    assert len(results) == 5
    assert all(r["status"] in {"delivered", "simulated"} for r in results)
    assert len(store.deliveries("halcyon")) == 5


class _Handler(BaseHTTPRequestHandler):
    def do_POST(self) -> None:
        length = int(self.headers.get("Content-Length", "0"))
        self.rfile.read(length)
        body = json.dumps(
            {
                "title": "Remote answer",
                "body": "The front truss is over the rating.",
                "tool": "remote.test",
                "citations": [{"id": "cit-rig", "label": "Rig", "source": "Rig schedule", "kind": "rig"}],
                "links": [{"label": "Readiness", "to": "/readiness"}],
            }
        ).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args) -> None:
        return


def test_remote_agent_adapter() -> None:
    server = ThreadingHTTPServer(("127.0.0.1", 0), _Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    old = config.AGENT_ENDPOINT
    try:
        config.AGENT_ENDPOINT = f"http://127.0.0.1:{server.server_address[1]}/ask"
        runtime = AgentRuntime(PACK)
        assert runtime.status().configured is True
        answer = runtime.ask("why is the truss over?")
        assert answer["title"] == "Remote answer"
        assert answer["citations"]
    finally:
        config.AGENT_ENDPOINT = old
        server.shutdown()
        thread.join(timeout=2)


def test_import_previews_dam_scan_and_audit_csv(tmp_path, monkeypatch) -> None:
    asset_dir = tmp_path / "dam"
    asset_dir.mkdir()
    (asset_dir / "rain_loop_v3.mp4").write_bytes(b"demo clip")
    monkeypatch.setattr(config, "ASSET_DIR", str(asset_dir))
    with TestClient(create_app(":memory:")) as client:
        vw = client.post(
            "/api/import/vectorworks",
            files={"file": ("fixtures.csv", "id,label,kind,truss,x,y,z,watts,weight_kg\nB1,Beam 1,beam,front,-7.5,1.4,8,1600,42\n", "text/csv")},
        )
        assert vw.status_code == 200
        assert vw.json()["count"] == 1
        gm = client.post(
            "/api/import/grandma3",
            files={"file": ("cues.csv", "Cue,Name,Trigger,Fade,Command,Page,Note\n1,Blackout,Time 0:00,2,--,,opening\n", "text/csv")},
        )
        assert gm.status_code == 200
        assert gm.json()["count"] == 1
        dam = client.get("/api/dam/scan").json()
        assert dam["status"] in {"ok", "missing"}
        assert dam["found"][0]["checksum"]
        audit = client.get("/api/audits.csv")
        assert audit.status_code == 200
        assert "import.vectorworks" in audit.text


def test_backup_restore_drill(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(config, "BACKUP_DIR", tmp_path)
    with TestClient(create_app(":memory:")) as client:
        client.post("/api/cues/LX%207/sign", json={"actor": "Mara Voss"})
        backup = client.post("/api/admin/backup").json()
        restored = Store(backup["path"])
        try:
            assert restored.cue_signatures("halcyon")
            assert restored.audits("halcyon")
        finally:
            restored.close()


def test_backup_and_metrics(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(config, "BACKUP_DIR", tmp_path)
    with TestClient(create_app(":memory:")) as client:
        backup = client.post("/api/admin/backup").json()
        assert Path(backup["path"]).exists()
        assert backup["bytes"] > 0
        listed = client.get("/api/admin/backups").json()["backups"]
        assert listed
        metrics = client.get("/api/metrics")
        assert metrics.status_code == 200
        assert "cue_risks_open" in metrics.text
        assert "cue_cues_total" in metrics.text


def test_remote_agent_failure_is_explicit() -> None:
    old = config.AGENT_ENDPOINT
    try:
        config.AGENT_ENDPOINT = "http://127.0.0.1:1/ask"
        with pytest.raises(AgentUnavailable):
            AgentRuntime(PACK).ask("why?")
    finally:
        config.AGENT_ENDPOINT = old
