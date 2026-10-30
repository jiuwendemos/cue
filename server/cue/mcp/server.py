"""A small MCP-compatible JSON-RPC surface.

The full MCP transport can be added later; this is the tool contract the agent
and external design tools can call now. Every tool is read-only. No tool can
change a cue, sign safety or release a show.
"""

from __future__ import annotations

import json
from typing import Any

from ..agent.runtime import AgentRuntime
from ..engine.show import budget_for_look, checks_for, cue_rows, risk_open, risk_stats
from ..store.db import Store

PROTOCOL = "2024-11-05"

TOOLS = [
    {
        "name": "show_summary",
        "description": "The show, artist, tour, version and counts.",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "checks",
        "description": "Power, weight, glare, rights, asset and budget checks for a look.",
        "inputSchema": {"type": "object", "properties": {"look_id": {"type": "string"}, "venue_id": {"type": "string"}, "date_id": {"type": "string"}}},
    },
    {
        "name": "budget",
        "description": "The cost of a look against the approved budget.",
        "inputSchema": {"type": "object", "properties": {"look_id": {"type": "string"}}},
    },
    {
        "name": "readiness",
        "description": "Open readiness risks, evidence and stats.",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "cue_sheet",
        "description": "Cue rows, conflicts and missing assets.",
        "inputSchema": {"type": "object", "properties": {"rejected": {"type": "array", "items": {"type": "string"}}, "accepted": {"type": "string"}}},
    },
    {
        "name": "ask",
        "description": "Ask the design agent; the answer cites the show records.",
        "inputSchema": {"type": "object", "properties": {"question": {"type": "string"}, "active_look_id": {"type": "string"}}, "required": ["question"]},
    },
]


def _merged(pack: dict[str, Any], store: Store, tenant: str) -> list[dict[str, Any]]:
    states = store.risk_states(tenant)
    checks = store.risk_checks(tenant)
    out = []
    for risk in pack["risks"] + store.dynamic_risks(tenant):
        override = states.get(risk["id"], {})
        done = set(checks.get(risk["id"], []))
        out.append(
            {
                **risk,
                "state": override.get("state", risk["state"]),
                "owner": override.get("owner") or risk["owner"],
                "verifiedAt": override.get("verified_at") or risk.get("verifiedAt"),
                "checks": [{**c, "done": c.get("done", False) or c["id"] in done} for c in risk["checks"]],
            }
        )
    return out


def call_tool(pack: dict[str, Any], store: Store, tenant: str, agent: AgentRuntime, name: str, arguments: dict[str, Any]) -> Any:
    if name == "show_summary":
        return {
            "project": pack["project"],
            "counts": {
                "looks": len(pack["looks"]),
                "cues": len(pack["cues"]),
                "venues": len(pack["venues"]),
                "dates": len(pack["dates"]),
                "risks": len(pack["risks"]),
            },
        }
    if name == "checks":
        return checks_for(pack, arguments.get("look_id", "look-aerial-12"), arguments.get("venue_id"), arguments.get("date_id", "d-home"))
    if name == "budget":
        look_id = arguments.get("look_id", "look-aerial-12")
        return {"look_id": look_id, "total": budget_for_look(pack, look_id), "approved": pack["budget"]["approved"]}
    if name == "readiness":
        risks = _merged(pack, store, tenant)
        return {"risks": risks, "stats": risk_stats(risks), "open": [r for r in risks if risk_open(r)]}
    if name == "cue_sheet":
        rows = cue_rows(pack, arguments.get("rejected") or [], arguments.get("accepted"))
        return {"rows": rows, "signed": store.cue_signatures(tenant)}
    if name == "ask":
        return agent.ask(arguments.get("question", ""), arguments.get("active_look_id"), arguments.get("rejected_looks") or [])
    raise ValueError(f"unknown tool {name}")


def handle(pack: dict[str, Any], store: Store, tenant: str, agent: AgentRuntime, payload: dict[str, Any]) -> dict[str, Any]:
    rid = payload.get("id")
    method = payload.get("method", "")
    params = payload.get("params") or {}
    if method == "initialize":
        return {
            "jsonrpc": "2.0",
            "id": rid,
            "result": {
                "protocolVersion": PROTOCOL,
                "serverInfo": {"name": "cue", "version": "1.0.0"},
                "capabilities": {"tools": {"listChanged": False}},
                "instructions": "Read-only show tools. CUE recommends; the human decides and signs.",
            },
        }
    if method == "tools/list":
        return {"jsonrpc": "2.0", "id": rid, "result": {"tools": TOOLS}}
    if method == "tools/call":
        name = params.get("name", "")
        try:
            value = call_tool(pack, store, tenant, agent, name, params.get("arguments") or {})
            return {
                "jsonrpc": "2.0",
                "id": rid,
                "result": {"content": [{"type": "text", "text": json.dumps(value, ensure_ascii=False, default=str)}], "isError": False},
            }
        except Exception as exc:  # noqa: BLE001 - a tool error is a JSON-RPC error
            return {"jsonrpc": "2.0", "id": rid, "error": {"code": -32602, "message": str(exc)}}
    if method == "ping":
        return {"jsonrpc": "2.0", "id": rid, "result": {}}
    return {"jsonrpc": "2.0", "id": rid, "error": {"code": -32601, "message": f"method {method} not found"}}
