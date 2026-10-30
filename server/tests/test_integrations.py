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


def test_remote_agent_failure_is_explicit() -> None:
    old = config.AGENT_ENDPOINT
    try:
        config.AGENT_ENDPOINT = "http://127.0.0.1:1/ask"
        with pytest.raises(AgentUnavailable):
            AgentRuntime(PACK).ask("why?")
    finally:
        config.AGENT_ENDPOINT = old
