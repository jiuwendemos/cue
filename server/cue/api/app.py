"""FastAPI surface for CUE.

Small and boring on purpose: the pilot must run behind a production firewall for
90 days. The SPA is static; this API keeps the human decisions (signatures,
approvals, readiness lifecycle) and exposes the same deterministic checks as the
web app. No live control, no DMX, no automatic cue release.
"""

from __future__ import annotations

import json
import os
from contextlib import asynccontextmanager
from contextvars import ContextVar
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, Response
from fastapi.staticfiles import StaticFiles

from .. import config
from ..agent.runtime import GUARDRAILS, AgentRuntime
from ..engine.show import (
    budget_addons,
    budget_base,
    budget_for_look,
    budget_rows,
    checks_for,
    cue_conflicts,
    cue_rows,
    cue_sheet_csv,
    cue_sheet_html,
    look_stats,
    missing_asset_cues,
    risk_brief,
    risk_stats,
)
from ..models import ApproveVersionRequest, AskRequest, RenderSettings, RiskActionRequest, SignCueRequest, now_iso
from ..store.db import Store

TENANT_HEADER = "X-CUE-Tenant"
tenant_var: ContextVar[str] = ContextVar("tenant", default=config.DEFAULT_TENANT)


def current_tenant() -> str:
    return tenant_var.get()


def signature_for(actor: str) -> str:
    initials = "".join(part[0] for part in actor.split() if part)[:2].upper() or "CV"
    stamp = datetime.now().strftime("%m%d")
    return f"{initials}-{stamp}"


def load_pack() -> dict[str, Any]:
    path = Path(os.getenv("CUE_PACK", str(config.PACK_PATH)))
    if not path.exists():
        raise RuntimeError(f"CUE pack not found at {path}. Run `npm run pack` in web/.")
    return json.loads(path.read_text(encoding="utf-8"))


def merged_risks(pack: dict[str, Any], store: Store, tenant: str) -> list[dict[str, Any]]:
    states = store.risk_states(tenant)
    checks = store.risk_checks(tenant)
    out = []
    for risk in pack["risks"]:
        override = states.get(risk["id"], {})
        done = set(checks.get(risk["id"], []))
        out.append(
            {
                **risk,
                "state": override.get("state", risk["state"]),
                "owner": override.get("owner") or risk["owner"],
                "dismissedReason": override.get("dismissed_reason") or risk.get("dismissedReason"),
                "verifiedAt": override.get("verified_at") or risk.get("verifiedAt"),
                "checks": [{**c, "done": c.get("done", False) or c["id"] in done} for c in risk["checks"]],
            }
        )
    return out


def create_app(db_path: str | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.pack = load_pack()
        app.state.store = Store(db_path or os.getenv("CUE_DB", str(config.DB_PATH)))
        app.state.agent = AgentRuntime(app.state.pack)
        app.state.render = {"device": config.RENDER_DEVICE, "quality": "high", "frame_ms": 8.2, "export_s": 2.4}
        yield
        app.state.store.close()

    app = FastAPI(title="CUE", version="1.0.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.cors_origins(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def tenant_middleware(request: Request, call_next):
        header = request.headers.get(TENANT_HEADER, config.DEFAULT_TENANT).strip().lower()
        # Row-level isolation for the pilot. Production can whitelist tenants in config;
        # an unknown or malformed header falls back to the configured default.
        tenant = header if header and len(header) <= 40 and all(ch.isalnum() or ch in "-_" for ch in header) else config.DEFAULT_TENANT
        token = tenant_var.set(tenant)
        try:
            response = await call_next(request)
            response.headers[TENANT_HEADER] = tenant
            return response
        finally:
            tenant_var.reset(token)

    def state(request: Request) -> Any:
        return request.app.state

    def tenant() -> str:
        return current_tenant()

    def pack_of(request: Request) -> dict[str, Any]:
        return state(request).pack

    def require_risk(request: Request, risk_id: str) -> dict[str, Any]:
        risks = merged_risks(pack_of(request), state(request).store, tenant())
        risk = next((r for r in risks if r["id"] == risk_id), None)
        if not risk:
            raise HTTPException(404, f"risk {risk_id} not found")
        return risk

    @app.get("/api/health")
    def health(request: Request) -> dict[str, Any]:
        pack = pack_of(request)
        return {
            "ok": True,
            "version": "1.0.0",
            "show": pack["project"]["id"],
            "version_label": pack["project"]["version"],
            "agent": state(request).agent.status().as_dict(),
            "storage": state(request).store.counts(tenant()),
            "tenant": tenant(),
            "render": state(request).render,
            "at": now_iso(),
        }

    @app.get("/api/tenants")
    def tenants() -> dict[str, Any]:
        return {
            "default": config.DEFAULT_TENANT,
            "tenants": config.TENANTS,
            "header": TENANT_HEADER,
            "note": "Every query is scoped by tenant. The production store uses one file or schema per tenant.",
        }

    @app.get("/api/agent/status")
    def agent_status(request: Request) -> dict[str, Any]:
        return state(request).agent.status().as_dict()

    @app.get("/api/agent/tools")
    def agent_tools(request: Request) -> dict[str, Any]:
        return {"tools": state(request).agent.tools(), "guardrails": GUARDRAILS, "trace": pack_of(request)["agentTrace"]}

    @app.post("/api/agent/ask")
    def agent_ask(body: AskRequest, request: Request) -> dict[str, Any]:
        if not body.question.strip():
            raise HTTPException(400, "question is required")
        result = state(request).agent.ask(body.question, body.active_look_id, body.rejected_looks)
        state(request).store.audit(tenant(), "CUE agent", "agent.answer", body.active_look_id or "show", body.question[:240], ["agent"])
        return result

    @app.get("/api/show")
    def show(request: Request) -> dict[str, Any]:
        pack = pack_of(request)
        return {
            "meta": pack["meta"],
            "project": pack["project"],
            "concept": pack["concept"],
            "setlist": pack["setlist"],
            "stage": pack["stage"],
            "rig": pack["rig"],
            "counts": {
                "looks": len(pack["looks"]),
                "cues": len(pack["cues"]),
                "venues": len(pack["venues"]),
                "dates": len(pack["dates"]),
                "risks": len(pack["risks"]),
                "rights": len(pack["rights"]),
            },
        }

    @app.get("/api/pack")
    def full_pack(request: Request) -> dict[str, Any]:
        return pack_of(request)

    @app.get("/api/looks")
    def looks(request: Request) -> dict[str, Any]:
        pack = pack_of(request)
        return {
            "active": "look-aerial-12",
            "looks": [look_stats(pack, look["id"]) | {"created_by": look["createdBy"], "impact": look["impact"], "status": look["status"]} for look in pack["looks"]],
        }

    @app.get("/api/checks")
    def checks(request: Request, look_id: str = "look-aerial-12", venue_id: str | None = None, date_id: str = "d-home") -> dict[str, Any]:
        pack = pack_of(request)
        if not any(look["id"] == look_id for look in pack["looks"]):
            raise HTTPException(404, "look not found")
        results = checks_for(pack, look_id, venue_id, date_id)
        return {
            "look_id": look_id,
            "checks": results,
            "summary": {
                "pass": sum(1 for c in results if c["status"] == "pass"),
                "warn": sum(1 for c in results if c["status"] == "warn"),
                "fail": sum(1 for c in results if c["status"] == "fail"),
                "total": len(results),
            },
        }

    @app.get("/api/budget")
    def budget(request: Request, look_id: str = "look-aerial-12") -> dict[str, Any]:
        pack = pack_of(request)
        if not any(look["id"] == look_id for look in pack["looks"]):
            raise HTTPException(404, "look not found")
        return {
            "look_id": look_id,
            "base": budget_base(pack),
            "addons": budget_addons(pack, look_id),
            "rows": budget_rows(pack, look_id),
            "total": budget_for_look(pack, look_id),
            "approved": pack["budget"]["approved"],
            "currency": pack["budget"]["currency"],
            "contingency_pct": pack["budget"]["contingencyPct"],
        }

    @app.get("/api/cues")
    def cues(request: Request, look_id: str | None = None, rejected: str = "", accepted: str | None = None) -> dict[str, Any]:
        pack = pack_of(request)
        rejected_list = [r for r in rejected.split(",") if r]
        rows = cue_rows(pack, rejected_list, accepted)
        signatures = state(request).store.cue_signatures(tenant())
        return {
            "rows": [{**row, "signature": signatures.get(row["id"])} for row in rows],
            "conflicts": [{"a": c["a"]["id"], "b": c["b"]["id"], "gap": c["gap"]} for c in cue_conflicts(pack)],
            "missing": [c["id"] for c in missing_asset_cues(pack)],
            "signed": signatures,
        }

    @app.post("/api/cues/{cue_id}/sign")
    def sign_cue(cue_id: str, body: SignCueRequest, request: Request) -> dict[str, Any]:
        pack = pack_of(request)
        cue = next((c for c in pack["cues"] if c["id"] == cue_id), None)
        if not cue:
            raise HTTPException(404, "cue not found")
        if not cue["safety"]:
            raise HTTPException(400, "only safety cues require a signature")
        return state(request).store.sign_cue(tenant(), cue_id, body.actor, signature_for(body.actor))

    @app.get("/api/cues/export.csv")
    def export_cues_csv(request: Request, rejected: str = "", accepted: str | None = None) -> Response:
        pack = pack_of(request)
        data = cue_sheet_csv(pack, [r for r in rejected.split(",") if r], accepted)
        return Response(data, media_type="text/csv", headers={"Content-Disposition": 'attachment; filename="cue-sheet.csv"'})

    @app.get("/api/cues/export.html", response_class=HTMLResponse)
    def export_cues_html(request: Request, rejected: str = "", accepted: str | None = None, signed_by: str = "Mara Voss") -> str:
        return cue_sheet_html(pack_of(request), [r for r in rejected.split(",") if r], accepted, signed_by)

    @app.get("/api/readiness")
    def readiness(request: Request) -> dict[str, Any]:
        pack = pack_of(request)
        store = state(request).store
        risks = merged_risks(pack, store, tenant())
        next_date = pack["dates"][0]
        brief = risk_brief(pack, risks, next_date)
        signatures = store.cue_signatures(tenant())
        unsigned = [c["id"] for c in pack["cues"] if c["safety"] and c["id"] not in signatures]
        approvals = store.version_approvals(tenant())
        brief["approvals_due"] = [
            f"{len(unsigned)} safety cue(s) unsigned: {', '.join(unsigned)}" if unsigned else "",
            f"Show {pack['project']['version']} awaiting producer sign-off" if pack["project"]["version"] not in approvals else "",
        ]
        brief["approvals_due"] = [a for a in brief["approvals_due"] if a]
        return {
            "risks": risks,
            "stats": risk_stats(risks),
            "brief": brief,
            "settings": {**pack["readiness"], "mode": "shadow"},
            "coverage": [
                {"venue_id": v["id"], "name": v["name"], "status": v["status"], "last_verified": v["lastVerified"], "verified_by": v["verifiedBy"]}
                for v in pack["venues"]
            ],
            "metrics": {
                **pack["metrics"],
                "risk_stats": risk_stats(risks),
                "signed_cues": len(signatures),
                "safety_cues": len([c for c in pack["cues"] if c["safety"]]),
            },
            "provenance": pack["provenance"],
        }

    @app.post("/api/readiness/{risk_id}/{action}")
    def readiness_action(risk_id: str, action: str, body: RiskActionRequest, request: Request) -> dict[str, Any]:
        require_risk(request, risk_id)
        store = state(request).store
        actions = {
            "ack": "acknowledged",
            "acknowledge": "acknowledged",
            "assign": "assigned",
            "investigate": "investigating",
            "resolve": "resolved",
            "verify": "resolved",
            "reopen": "investigating",
            "dismiss": "dismissed",
        }
        if action not in actions:
            raise HTTPException(400, "unknown risk action")
        if action == "assign" and not body.owner:
            raise HTTPException(400, "owner is required to assign")
        if action == "dismiss" and not body.reason:
            raise HTTPException(400, "a dismissal reason is required")
        result = store.set_risk_state(
            tenant(),
            risk_id,
            actions[action],
            owner=body.owner,
            reason=body.reason,
            verified=action == "verify",
        )
        store.audit(
            tenant(),
            body.actor,
            f"risk.{action}",
            risk_id,
            (body.reason or body.note or f"{action} by {body.actor}").strip(),
            ["human"],
        )
        merged = require_risk(request, risk_id)
        return {"state": result, "risk": merged}

    @app.post("/api/readiness/{risk_id}/checks/{check_id}")
    def readiness_check(risk_id: str, check_id: str, request: Request) -> dict[str, Any]:
        risk = require_risk(request, risk_id)
        if not any(c["id"] == check_id for c in risk["checks"]):
            raise HTTPException(404, "check not found")
        state(request).store.complete_check(tenant(), risk_id, check_id)
        return require_risk(request, risk_id)

    @app.get("/api/versions")
    def versions(request: Request) -> dict[str, Any]:
        pack = pack_of(request)
        approvals = state(request).store.version_approvals(tenant())
        out = []
        for version in pack["versions"]:
            approval = approvals.get(version["id"])
            out.append(
                {
                    **version,
                    "status": "approved" if approval else version["status"],
                    "approvedBy": approval["actor"] if approval else version.get("approvedBy"),
                    "approvedAt": approval["at"] if approval else version.get("approvedAt"),
                    "signature": approval["signature"] if approval else version.get("signature"),
                }
            )
        return {"versions": out, "current": pack["project"]["version"]}

    @app.post("/api/versions/{version_id}/approve")
    def approve_version(version_id: str, body: ApproveVersionRequest, request: Request) -> dict[str, Any]:
        pack = pack_of(request)
        if not any(v["id"] == version_id for v in pack["versions"]):
            raise HTTPException(404, "version not found")
        approval = state(request).store.approve_version(tenant(), version_id, body.actor, body.note, signature_for(body.actor))
        return {"version_id": version_id, "approval": approval}

    @app.get("/api/audits")
    def audits(request: Request, limit: int = 100) -> dict[str, Any]:
        pack = pack_of(request)
        stored = state(request).store.audits(tenant(), limit=limit)
        merged = [{**a, "sources": a.get("sources", [])} for a in stored] + [
            {
                "id": a["id"],
                "at": a["at"],
                "actor": a["actor"],
                "action": a["action"],
                "object": a["object"],
                "detail": a["detail"],
                "modelVersion": a["modelVersion"],
                "sources": a["sources"],
            }
            for a in pack["audits"]
        ]
        merged.sort(key=lambda a: a["at"], reverse=True)
        return {"events": merged[:limit]}

    @app.get("/api/integrations")
    def integrations(request: Request) -> dict[str, Any]:
        pack = pack_of(request)
        connected = [i for i in pack["integrations"] if i["status"] == "connected"]
        simulated = [i for i in pack["integrations"] if i["status"] == "simulated"]
        ready = bool(connected) and state(request).agent.status().configured
        return {
            "integrations": pack["integrations"],
            "counts": {"total": len(pack["integrations"]), "connected": len(connected), "simulated": len(simulated), "available": len(pack["integrations"]) - len(connected) - len(simulated)},
            "strict": config.STRICT_INTEGRATIONS,
            "ready": ready,
            "note": "The public demo reports reference adapters. No live console, previz or DAM is attached.",
        }

    @app.get("/api/render/status")
    def render_status(request: Request) -> dict[str, Any]:
        render = state(request).render
        npu_ready = bool(config.NPU_ENDPOINT)
        if render["device"] == "npu" and not npu_ready:
            return {"device": "npu", "ready": False, "error": "No NPU endpoint configured. Refusing a silent CPU fallback.", "frame_ms": None}
        return {
            "device": render["device"],
            "quality": render["quality"],
            "ready": True,
            "frame_ms": render["frame_ms"] if render["device"] != "cpu" else 24.0,
            "export_s": render["export_s"],
            "npu": {"ready": npu_ready, "backend": "onnx" if npu_ready else "none", "endpoint": config.NPU_ENDPOINT or None},
            "note": "The public demo is a static SPA; these are the pilot settings, not a live GPU broker.",
        }

    @app.post("/api/render/settings")
    def render_settings(body: RenderSettings, request: Request) -> dict[str, Any]:
        if body.device == "npu" and not config.NPU_ENDPOINT:
            raise HTTPException(409, "No NPU endpoint configured. CUE refuses to pretend the CPU is an NPU.")
        state(request).render.update({"device": body.device, "quality": body.quality})
        state(request).store.audit(tenant(), "Site Admin", "render.settings", "show", f"{body.device}/{body.quality}", ["settings"])
        return render_status(request)

    @app.get("/api/npu/health")
    def npu_health() -> dict[str, Any]:
        return {
            "ready": bool(config.NPU_ENDPOINT),
            "backend": "onnx" if config.NPU_ENDPOINT else "none",
            "endpoint": config.NPU_ENDPOINT or None,
            "detail": "Optional local inference for unreleased artist content. Never sold as the hero." if config.NPU_ENDPOINT else "No NPU configured. The product runs on CPU/GPU.",
        }

    @app.get("/api/provenance")
    def provenance(request: Request) -> dict[str, Any]:
        pack = pack_of(request)
        return {
            "provenance": pack["provenance"],
            "rights": pack["rights"],
            "model": {"name": "CUE Looksmith", "version": "1.4.0", "inference": pack["provenance"]["inference"]},
            "guardrails": GUARDRAILS,
            "show": pack["project"],
        }

    @app.get("/api/ready")
    def ready(request: Request) -> dict[str, Any]:
        integrations_data = integrations(request)
        if config.STRICT_INTEGRATIONS and not integrations_data["ready"]:
            raise HTTPException(
                503,
                detail={
                    "ready": False,
                    "agent": state(request).agent.status().as_dict(),
                    "integrations": integrations_data["counts"],
                    "note": "CUE_STRICT_INTEGRATIONS=1: configure the agent and at least one live connector.",
                },
            )
        return {"ready": integrations_data["ready"], "strict": config.STRICT_INTEGRATIONS, "agent": state(request).agent.status().as_dict()}

    @app.post("/api/reset")
    def reset(request: Request) -> dict[str, Any]:
        state(request).store.reset(tenant())
        return {"reset": True, "tenant": tenant(), "at": now_iso()}

    if config.WEB_DIST.exists():
        app.mount("/", StaticFiles(directory=str(config.WEB_DIST), html=True), name="web")

    return app


app = create_app()
