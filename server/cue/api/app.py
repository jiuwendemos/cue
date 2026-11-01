"""FastAPI surface for CUE.

Small and boring on purpose: the pilot must run behind a production firewall for
90 days. The SPA is static; this API keeps the human decisions (signatures,
approvals, readiness lifecycle) and exposes the same deterministic checks as the
web app. No live control, no DMX, no automatic cue release.
"""

from __future__ import annotations

import asyncio
import csv
import io
import json
import os
from contextlib import asynccontextmanager
from contextvars import ContextVar
from datetime import datetime
from pathlib import Path
from typing import Annotated, Any

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, PlainTextResponse, Response
from fastapi.staticfiles import StaticFiles
from laix.core.attention import precision_recall

from .. import config
from ..agent.runtime import GUARDRAILS, AgentRuntime, AgentUnavailable
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
    risk_open,
    risk_stats,
)
from ..integrations import dam, exporters
from ..mcp import server as mcp_server
from ..models import ApproveVersionRequest, AskRequest, RenderSettings, RiskActionRequest, SignCueRequest, now_iso
from ..proactive import history as proactive_history
from ..proactive import scanner
from ..proactive.signing import signed_link, verify_payload
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
    for risk in pack["risks"] + store.dynamic_risks(tenant):
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
    async def scheduler_loop(app: FastAPI) -> None:
        await asyncio.sleep(2)
        while True:
            try:
                for tenant_id in config.TENANTS:
                    settings = app.state.store.proactive_settings(tenant_id) or scanner.default_settings(app.state.pack)
                    if settings.get("stopSwitch"):
                        continue
                    await asyncio.to_thread(scanner.run_scan, app.state.pack, app.state.store, tenant_id, settings)
            except asyncio.CancelledError:
                raise
            except Exception:  # noqa: BLE001
                # A scan failure must not take down the show. The next tick retries;
                # the audit and the scan history keep the evidence.
                await asyncio.sleep(60)
            interval = max(5, int((app.state.store.proactive_settings(config.DEFAULT_TENANT) or scanner.default_settings(app.state.pack)).get("intervalMinutes", 1440)))
            await asyncio.sleep(interval * 60)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.pack = load_pack()
        app.state.store = Store(db_path or os.getenv("CUE_DB", str(config.DB_PATH)))
        app.state.agent = AgentRuntime(app.state.pack, app.state.store, config.DEFAULT_TENANT)
        app.state.render = {"device": config.RENDER_DEVICE, "quality": "high", "frame_ms": 8.2, "export_s": 2.4}
        app.state.scheduler = None
        app.state.warmup = None
        if config.OPENJIUWEN_WARMUP:
            # Do not block startup, but have the runtime hot before the first click.
            app.state.warmup = asyncio.create_task(asyncio.to_thread(app.state.agent.warm))
        if config.SCHEDULER_ENABLED:
            app.state.scheduler = asyncio.create_task(scheduler_loop(app))
        yield
        if app.state.scheduler:
            app.state.scheduler.cancel()
        app.state.store.close()

    app = FastAPI(title="CUE", version="1.0.0", lifespan=lifespan)

    @app.middleware("http")
    async def live_data_is_never_cached(request: Request, call_next: Any) -> Any:
        """A stale readiness board or agent status is worse than a slow one."""
        response = await call_next(request)
        path = request.url.path
        if path.startswith(("/api/", "/mcp/")) or path == "/mcp":
            response.headers["Cache-Control"] = "no-store, max-age=0"
        elif path.endswith(".html") or path == "/":
            response.headers["Cache-Control"] = "no-cache"
        return response

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
        pack_override = None
        if body.pack is not None:
            pack_override = body.pack
            required = {"project", "looks", "cues", "venues", "dates", "budget", "rig"}
            if not isinstance(pack_override, dict) or not required.issubset(pack_override):
                raise HTTPException(400, detail="the workspace pack is missing required show keys")
            if len(json.dumps(pack_override)) > 2_000_000:
                raise HTTPException(413, detail="the workspace pack is too large (2 MB limit)")
        try:
            result = state(request).agent.ask(
                body.question,
                body.active_look_id,
                body.rejected_looks,
                tenant=tenant(),
                pack=pack_override,
            )
        except AgentUnavailable as exc:
            raise HTTPException(502, detail=f"the configured agent backend is unavailable: {exc}") from exc
        backend = result.get("backend", "deterministic-local")
        detail = f"{body.question[:200]} · {backend} · {len(result.get('citations', []))} citations"
        state(request).store.audit(tenant(), "CUE agent", "agent.answer", body.active_look_id or "show", detail, ["agent"])
        return result

    @app.post("/api/agent/probe")
    def agent_probe(request: Request) -> dict[str, Any]:
        try:
            result = state(request).agent.probe()
        except AgentUnavailable as exc:
            raise HTTPException(502, detail=f"the agent probe failed: {exc}") from exc
        state(request).store.audit(tenant(), "Site Admin", "agent.probe", "agent", f"latency {result.get('latency_ms')} ms", ["agent"])
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

    # ---------------------------------------------------------------- proactive

    @app.get("/api/proactive")
    def proactive(request: Request) -> dict[str, Any]:
        pack = pack_of(request)
        store = state(request).store
        settings = store.proactive_settings(tenant()) or scanner.default_settings(pack)
        risks = merged_risks(pack, store, tenant())
        scans = store.scan_runs(tenant(), limit=30)
        notifications = store.notifications(tenant(), limit=50)
        if not notifications:
            notifications = [
                {
                    "id": n["id"],
                    "at": n["at"],
                    "kind": n["kind"],
                    "severity": n["severity"],
                    "title": n["title"],
                    "detail": n["detail"],
                    "risk_id": n.get("riskId"),
                    "channels": [n.get("channel", "in_app")],
                    "delivered": True,
                    "read": n.get("read", False),
                    "dedup_key": n["id"],
                }
                for n in pack["notifications"]
            ]
        deliveries = store.deliveries(tenant(), limit=50)
        watchers = [
            {
                "id": kind,
                "label": {
                    "venue": "Venue and stage",
                    "rig": "Rig and power",
                    "rights": "Music, video and likeness",
                    "asset": "Content delivery",
                    "budget": "Budget and approval",
                    "schedule": "Load-in and rehearsal",
                    "data": "Venue data freshness",
                }.get(kind, kind),
                "status": "watching" if not settings.get("stopSwitch") else "stopped",
                "checked": len(risks),
                "open": len([r for r in risks if r.get("kind") == kind and risk_open(r)]),
                "last_scan": scans[0]["at"] if scans else None,
            }
            for kind in settings.get("watchTypes", [])
        ]
        return {
            "settings": settings,
            "scheduler": {
                "enabled": config.SCHEDULER_ENABLED,
                "interval_minutes": settings.get("intervalMinutes", 1440),
                "last_scan": scans[0]["at"] if scans else None,
                "next_scan": settings.get("nextScan"),
                "mode": settings.get("mode", "shadow"),
                "stop_switch": bool(settings.get("stopSwitch")),
            },
            "watchers": watchers,
            "risks": risks,
            "stats": risk_stats(risks),
            "scans": scans,
            "notifications": notifications,
            "deliveries": deliveries,
            "queue": {
                "pending": len([d for d in deliveries if d["status"] == "error"]),
                "simulated": len([d for d in deliveries if d["status"] == "simulated"]),
                "offline": False,
                "detail": "The queue is local to this tenant. A show-week outage retries on the next scan.",
            },
            "digest": scanner.build_digest(pack, risks, settings),
            "backtest": proactive_backtest(request),
            "outcomes": proactive_history.outcomes_summary(risks),
            "coverage": [
                {"venue_id": v["id"], "name": v["name"], "status": v["status"], "last_verified": v["lastVerified"], "verified_by": v["verifiedBy"]}
                for v in pack["venues"]
            ],
        }

    @app.post("/api/proactive/scan")
    async def proactive_scan(request: Request) -> dict[str, Any]:
        pack = pack_of(request)
        store = state(request).store
        try:
            body = await request.json()
        except (json.JSONDecodeError, ValueError):
            body = {}
        settings = store.proactive_settings(tenant()) or scanner.default_settings(pack)
        if body.get("settings"):
            settings.update(body["settings"])
        mode = body.get("mode") or settings.get("mode", "shadow")
        result = await asyncio.to_thread(scanner.run_scan, pack, store, tenant(), settings, mode=mode, active_look_id=body.get("look_id", "look-aerial-12"))
        return result

    @app.post("/api/proactive/settings")
    async def proactive_settings(request: Request) -> dict[str, Any]:
        pack = pack_of(request)
        store = state(request).store
        settings = store.proactive_settings(tenant()) or scanner.default_settings(pack)
        try:
            body = await request.json()
        except (json.JSONDecodeError, ValueError):
            body = {}
        allowed = {"mode", "stopSwitch", "intervalMinutes", "channels", "quietHours", "digest", "coverageFloor", "watchTypes", "email_to", "sms_to", "riskBudget"}
        settings.update({key: value for key, value in body.items() if key in allowed})
        if settings.get("mode") not in {"shadow", "live"}:
            settings["mode"] = "shadow"
        settings["intervalMinutes"] = max(5, int(settings.get("intervalMinutes", 1440)))
        store.save_proactive_settings(tenant(), settings)
        store.audit(tenant(), body.get("actor", "Site Admin"), "proactive.settings", "tour", "Readiness settings updated.", ["settings"])
        return settings

    @app.post("/api/proactive/stop")
    async def proactive_stop(request: Request) -> dict[str, Any]:
        pack = pack_of(request)
        store = state(request).store
        settings = store.proactive_settings(tenant()) or scanner.default_settings(pack)
        try:
            body = await request.json()
        except (json.JSONDecodeError, ValueError):
            body = {}
        settings["stopSwitch"] = True
        settings.setdefault("stopReasons", []).append(f"{now_iso()}: {body.get('reason', 'Stopped by the production office')}")
        store.save_proactive_settings(tenant(), settings)
        store.audit(tenant(), body.get("actor", "Site Admin"), "proactive.stop", "tour", body.get("reason", "Stopped by the production office"), ["settings"])
        return settings

    @app.post("/api/proactive/start")
    async def proactive_start(request: Request) -> dict[str, Any]:
        pack = pack_of(request)
        store = state(request).store
        settings = store.proactive_settings(tenant()) or scanner.default_settings(pack)
        settings["stopSwitch"] = False
        store.save_proactive_settings(tenant(), settings)
        store.audit(tenant(), "Site Admin", "proactive.start", "tour", "Readiness resumed.", ["settings"])
        return settings

    @app.post("/api/proactive/digest")
    async def proactive_digest(request: Request) -> dict[str, Any]:
        pack = pack_of(request)
        store = state(request).store
        settings = store.proactive_settings(tenant()) or scanner.default_settings(pack)
        digest = scanner.build_digest(pack, merged_risks(pack, store, tenant()), settings)
        try:
            body = await request.json()
        except (json.JSONDecodeError, ValueError):
            body = {}
        if body.get("send"):
            for channel in settings.get("channels", []):
                store.record_delivery(tenant(), f"DIGEST-{digest['at']}", channel, "simulated" if channel != "in_app" else "delivered", "Digest delivery.")
        return digest

    @app.get("/api/proactive/backtest")
    def proactive_backtest(request: Request) -> dict[str, Any]:
        pack = pack_of(request)
        detected = scanner.detect_candidates(pack)
        known = pack["risks"]
        rows = []
        for date in pack["dates"]:
            known_for_date = [r for r in known if r.get("dateId") == date["id"]]
            detected_for_date = [r for r in detected if r.get("dateId") == date["id"]]
            stats = precision_recall(
                [str(r.get("groupKey")) for r in detected_for_date if r.get("groupKey")],
                [str(r.get("groupKey")) for r in known_for_date if r.get("groupKey")],
            )
            rows.append(
                {
                    "date_id": date["id"],
                    "city": date["city"],
                    "detected": len(detected_for_date),
                    "known": len(known_for_date),
                    "matched": stats["matched"],
                    "precision_est": stats["precision"],
                    "recall_est": stats["recall"],
                    "would_have_fired": len(detected_for_date) > 0,
                }
            )
        overall = precision_recall(
            [str(r.get("groupKey")) for r in detected if r.get("groupKey")],
            [str(r.get("groupKey")) for r in known if r.get("groupKey")],
        )
        return {
            "rows": rows,
            "overall": {
                "detected": overall["detected"],
                "known": len(known),
                "matched": overall["matched"],
                "precision_est": overall["precision"],
                "recall_est": overall["recall"],
            },
            "note": "Synthetic backtest over the demo pack. A real backtest uses past tours and confirmed issues.",
        }

    @app.get("/api/notifications")
    def notifications(request: Request) -> dict[str, Any]:
        store = state(request).store
        items = store.notifications(tenant(), limit=100)
        return {"notifications": items, "unread": len([n for n in items if not n.get("read")])}

    @app.post("/api/notifications/{notification_id}/read")
    def read_notification(notification_id: str, request: Request) -> dict[str, Any]:
        state(request).store.mark_notification(tenant(), notification_id, True)
        return {"id": notification_id, "read": True}

    @app.post("/api/notifications/read-all")
    def read_all_notifications(request: Request) -> dict[str, Any]:
        state(request).store.mark_all_notifications(tenant())
        return {"read": True}

    @app.post("/api/share")
    async def share(request: Request) -> dict[str, Any]:
        try:
            body = await request.json()
        except (json.JSONDecodeError, ValueError):
            body = {}
        path = body.get("path", "/#/cues")
        return signed_link(path, actor=body.get("actor", "Mara Voss"), risk_id=body.get("risk_id"), ttl_hours=body.get("ttl_hours"))

    @app.get("/api/share/cue-sheet", response_class=HTMLResponse)
    def shared_cue_sheet(request: Request, token: str = "") -> str:
        if not token:
            raise HTTPException(401, "a signed token is required")
        payload = verify_payload(token)
        if not payload:
            raise HTTPException(401, "the signed link is invalid or expired")
        return cue_sheet_html(pack_of(request), [], None, signed_by=payload.get("actor", "Mara Voss"))

    # ---------------------------------------------------------------- exports & MCP

    @app.get("/api/export/ics")
    def export_ics(request: Request) -> Response:
        return Response(
            exporters.ics(pack_of(request)),
            media_type="text/calendar; charset=utf-8",
            headers={"Content-Disposition": 'attachment; filename="night-signal.ics"'},
        )

    @app.get("/api/export/grandma3.csv")
    def export_grandma3_csv(request: Request) -> Response:
        return Response(
            exporters.grandma3_csv(pack_of(request)),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": 'attachment; filename="night-signal-grandma3.csv"'},
        )

    @app.get("/api/export/grandma3.xml")
    def export_grandma3_xml(request: Request) -> Response:
        return Response(
            exporters.grandma3_xml(pack_of(request)),
            media_type="application/xml; charset=utf-8",
            headers={"Content-Disposition": 'attachment; filename="night-signal-grandma3.xml"'},
        )

    @app.get("/api/export/resolume.csv")
    def export_resolume(request: Request) -> Response:
        return Response(
            exporters.resolume_csv(pack_of(request)),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": 'attachment; filename="night-signal-resolume.csv"'},
        )

    @app.get("/api/export/vectorworks.csv")
    def export_vectorworks(request: Request) -> Response:
        return Response(
            exporters.vectorworks_csv(pack_of(request)),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": 'attachment; filename="night-signal-vectorworks.csv"'},
        )

    @app.get("/api/export/mvr.zip")
    def export_mvr(request: Request) -> Response:
        return Response(
            exporters.mvr_zip(pack_of(request)),
            media_type="application/zip",
            headers={"Content-Disposition": 'attachment; filename="night-signal-exchange.mvr.zip"'},
        )

    @app.get("/api/export/bundle")
    def export_bundle(request: Request) -> dict[str, Any]:
        return exporters.export_bundle(pack_of(request))

    @app.post("/api/import/vectorworks")
    async def import_vectorworks(request: Request, file: Annotated[UploadFile, File()]) -> dict[str, Any]:
        text = (await file.read()).decode("utf-8", "replace")
        rows = exporters.parse_vectorworks_csv(text)
        state(request).store.audit(tenant(), "Mara Voss", "import.vectorworks", "rig", f"Parsed {len(rows)} fixture rows from {file.filename}.", ["integration"])
        return {"filename": file.filename, "fixtures": rows, "count": len(rows), "note": "Preview only. The rig is not mutated without a designer approval."}

    @app.post("/api/import/grandma3")
    async def import_grandma3(request: Request, file: Annotated[UploadFile, File()]) -> dict[str, Any]:
        text = (await file.read()).decode("utf-8", "replace")
        rows = exporters.parse_grandma3_csv(text)
        state(request).store.audit(tenant(), "Mara Voss", "import.grandma3", "cue-sheet", f"Parsed {len(rows)} cue rows from {file.filename}.", ["integration"])
        return {"filename": file.filename, "cues": rows, "count": len(rows), "note": "Preview only. Cue changes require a human review and a new version."}

    @app.get("/api/dam/scan")
    def dam_scan(request: Request) -> dict[str, Any]:
        expected = [video["clip"] for video in pack_of(request)["videos"]]
        return dam.scan(config.ASSET_DIR, expected)

    @app.get("/api/audits.csv")
    def audits_csv(request: Request) -> Response:
        data = audits(request, limit=1000)["events"]
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(["id", "at", "actor", "action", "object", "detail", "model_version", "sources"])
        for event in data:
            writer.writerow([event["id"], event["at"], event["actor"], event["action"], event["object"], event["detail"], event["modelVersion"], "|".join(event.get("sources", []))])
        return Response(buf.getvalue(), media_type="text/csv", headers={"Content-Disposition": 'attachment; filename="cue-audit.csv"'})

    @app.post("/api/admin/backup")
    def admin_backup(request: Request) -> dict[str, Any]:
        store = state(request).store
        target = config.BACKUP_DIR / f"cue-{datetime.now().strftime('%Y%m%d-%H%M%S')}.sqlite3"
        result = store.backup(target)
        store.audit(tenant(), "Site Admin", "backup.created", "store", f"Backup written to {target}.", ["ops"])
        return result

    @app.get("/api/admin/backups")
    def admin_backups() -> dict[str, Any]:
        folder = config.BACKUP_DIR
        items = []
        if folder.exists():
            for path in sorted(folder.glob("*.sqlite3"), key=lambda p: p.stat().st_mtime, reverse=True)[:20]:
                items.append({"name": path.name, "bytes": path.stat().st_size, "at": datetime.fromtimestamp(path.stat().st_mtime).astimezone().isoformat()})
        return {"backups": items, "folder": str(folder)}

    @app.get("/api/metrics", response_class=PlainTextResponse)
    def metrics(request: Request) -> str:
        pack = pack_of(request)
        store = state(request).store
        risks = merged_risks(pack, store, tenant())
        scans = store.scan_runs(tenant(), limit=1)
        counts = store.counts(tenant())
        lag = 0
        if scans:
            try:
                lag = max(0, int((datetime.now().astimezone() - datetime.fromisoformat(scans[0]["at"])).total_seconds()))
            except ValueError:
                lag = 0
        lines = [
            "# HELP cue_risks_open Open readiness risks for the tenant.",
            "# TYPE cue_risks_open gauge",
            f'cue_risks_open{{tenant="{tenant()}"}} {len([r for r in risks if risk_open(r)])}',
            f'cue_cues_total{{tenant="{tenant()}"}} {len(pack["cues"])}',
            f'cue_cues_signed{{tenant="{tenant()}"}} {counts["signatures"]}',
            f'cue_versions_approved{{tenant="{tenant()}"}} {counts["approvals"]}',
            f'cue_scans_total{{tenant="{tenant()}"}} {len(store.scan_runs(tenant(), limit=1000))}',
            f'cue_scan_lag_seconds{{tenant="{tenant()}"}} {lag}',
            f'cue_agent_configured{{tenant="{tenant()}"}} {1 if state(request).agent.status().configured else 0}',
            f'cue_npu_ready{{tenant="{tenant()}"}} {1 if config.NPU_ENDPOINT else 0}',
            "",
        ]
        return "\n".join(lines)

    @app.get("/mcp")
    def mcp_info() -> dict[str, Any]:
        return {
            "name": "cue",
            "protocol": mcp_server.PROTOCOL,
            "transport": "json-rpc over POST /mcp",
            "tools": [tool["name"] for tool in mcp_server.TOOLS],
            "note": "Read-only tools. No cue change, no safety signature, no release.",
        }

    @app.post("/mcp")
    async def mcp(request: Request) -> dict[str, Any]:
        try:
            payload = await request.json()
        except (json.JSONDecodeError, ValueError):
            raise HTTPException(400, "a JSON-RPC body is required") from None
        return mcp_server.handle(pack_of(request), state(request).store, tenant(), state(request).agent, payload)

    @app.post("/api/reset")
    def reset(request: Request) -> dict[str, Any]:
        state(request).store.reset(tenant())
        return {"reset": True, "tenant": tenant(), "at": now_iso()}

    if config.WEB_DIST.exists():
        app.mount("/", StaticFiles(directory=str(config.WEB_DIST), html=True), name="web")

    return app


app = create_app()
