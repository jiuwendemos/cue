"""Deterministic design agent.

The public demo answers locally so the booth runs offline. The same interface is
the DeepAgent adapter seam: set CUE_AGENT_BACKEND to a configured JiuwenSwarm
runtime in a pilot deployment. The guardrails are the product: cite, admit
missing evidence, never change a cue, never sign safety.
"""

from __future__ import annotations

import json
import re
import threading
from dataclasses import asdict, dataclass
from typing import Any
from urllib import error, request

from .. import config
from ..engine.show import _venue, budget_base, budget_for_look, look_stats


class AgentUnavailable(RuntimeError):
    """The configured agent backend is not reachable or returned an error."""

GUARDRAILS = [
    "Cite the source record for every claim. If the evidence is missing, say so.",
    "Never change a cue, approve a version or sign safety. Those are human actions.",
    "Never release a cue to the venue. The venue team runs the show.",
    "The designer is the author. The agent proposes; it does not design the show.",
    "If the rig, power or glare evidence conflicts with a spectacular idea, say the conflict first.",
]

TOOLS = [
    {"id": "show.read", "detail": "Setlist, energy curve and cue count."},
    {"id": "stage.read", "detail": "Stage, rig, fixtures and venue."},
    {"id": "rig.check", "detail": "Power, weight and trim."},
    {"id": "sightline.check", "detail": "Front-row eyeline and glare."},
    {"id": "look.generate", "detail": "Propose looks from the library and the constraints."},
    {"id": "safety.check", "detail": "Flag power, weight and glare before ranking."},
    {"id": "cue.draft", "detail": "Draft cue numbers against the setlist."},
    {"id": "human.review", "detail": "Wait for the designer. Never automate the decision."},
]


@dataclass
class Status:
    configured: bool
    available: bool
    backend: str
    model: str
    detail: str
    provider: str | None = None
    endpoint: str | None = None
    runtime_version: str | None = None
    ready: bool | None = None
    last_error: str | None = None
    last_latency_ms: int | None = None
    warmup: dict[str, Any] | None = None

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


class AgentRuntime:
    """Chooses the real runtime, the HTTP adapter or the local engine.

    The local engine is not a stub: it is the offline path and the public demo's
    answer set. The OpenJiuwen path is the on-site one.
    """

    def __init__(self, pack: dict[str, Any], store: Any = None, tenant: str | None = None) -> None:
        self.pack = pack
        self.store = store
        self.tenant = tenant or config.DEFAULT_TENANT
        self._openjiuwen: Any = None
        self._openjiuwen_tried = False
        self._backend_lock = threading.Lock()

    def _backend(self) -> Any:
        """Lazily construct the OpenJiuwen backend; ``None`` means not enabled."""
        with self._backend_lock:
            if not self._openjiuwen_tried:
                self._openjiuwen_tried = True
                try:
                    from .openjiuwen_backend import OpenJiuwenBackend

                    backend = OpenJiuwenBackend(self.pack, self.store)
                    self._openjiuwen = backend if backend.enabled() else None
                except Exception:  # noqa: BLE001 - a missing optional runtime must not break the app
                    self._openjiuwen = None
            return self._openjiuwen

    def status(self) -> Status:
        backend = self._backend()
        if backend is not None:
            data = backend.status()
            return Status(
                configured=bool(data["configured"]),
                available=bool(data["available"]),
                backend=str(data["backend"]),
                model=str(data["model"]),
                detail=str(data["detail"]),
                provider=data.get("provider"),
                endpoint=data.get("endpoint"),
                runtime_version=data.get("runtime_version"),
                ready=data.get("ready"),
                last_error=data.get("last_error"),
                last_latency_ms=data.get("last_latency_ms"),
                warmup=data.get("warmup"),
            )
        configured = bool(config.AGENT_ENDPOINT)
        return Status(
            configured=configured,
            available=True,
            backend=config.AGENT_BACKEND or ("remote" if config.AGENT_ENDPOINT else "deterministic-local"),
            model=config.AGENT_MODEL,
            detail=(
                f"Remote agent configured at {config.AGENT_ENDPOINT}."
                if config.AGENT_ENDPOINT
                else (
                    "A backend is named but no endpoint is configured; using the deterministic local agent."
                    if config.AGENT_BACKEND
                    else "Deterministic local answers over the show pack. No cloud model call in the public demo."
                )
            ),
        )

    def tools(self) -> list[dict[str, Any]]:
        return TOOLS

    def _remote_ask(self, question: str, active_look_id: str | None, rejected_looks: list[str] | None) -> dict[str, Any]:
        endpoint = config.AGENT_ENDPOINT
        if not endpoint:
            raise AgentUnavailable("no CUE_AGENT_ENDPOINT configured")
        if endpoint.endswith("/chat/completions"):
            payload: dict[str, Any] = {
                "model": config.AGENT_MODEL,
                "temperature": 0.1,
                "messages": [
                    {"role": "system", "content": "You are the CUE design agent. Cite show records, admit missing evidence, never change a cue, never sign safety."},
                    {"role": "user", "content": question},
                ],
            }
        else:
            payload = {
                "question": question,
                "show": self.pack["project"],
                "active_look_id": active_look_id or "look-aerial-12",
                "rejected_looks": rejected_looks or [],
                "tools": TOOLS,
            }
        req = request.Request(
            endpoint,
            data=json.dumps(payload).encode("utf-8"),
            method="POST",
            headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {config.AGENT_API_KEY}"} if config.AGENT_API_KEY else {})},
        )
        try:
            with request.urlopen(req, timeout=12) as response:
                body = json.loads(response.read().decode("utf-8", "replace"))
        except (error.URLError, TimeoutError, ValueError, OSError) as exc:
            raise AgentUnavailable(str(exc)) from exc
        if "choices" in body:
            try:
                content = body["choices"][0]["message"]["content"]
            except (KeyError, IndexError, TypeError) as exc:
                raise AgentUnavailable("the remote agent returned an unexpected chat shape") from exc
            return {
                "question": question,
                "tool": "remote.chat",
                "title": "Agent answer",
                "body": content,
                "citations": [],
                "links": [{"label": "Readiness", "to": "/readiness"}],
            }
        return {
            "question": question,
            "tool": body.get("tool", "remote.agent"),
            "title": body.get("title", "Agent answer"),
            "body": body.get("body") or body.get("answer", ""),
            "citations": body.get("citations", []),
            "links": body.get("links", []),
        }

    def ask(
        self,
        question: str,
        active_look_id: str | None = None,
        rejected_looks: list[str] | None = None,
        tenant: str | None = None,
        pack: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        backend = self._backend()
        if backend is None and pack is not None:
            raise AgentUnavailable("the OpenJiuwen runtime is required to analyse a workspace pack")
        if backend is not None:
            try:
                return backend.ask(question, active_look_id, rejected_looks, tenant=tenant or self.tenant, pack=pack)
            except AgentUnavailable as exc:
                # The deterministic fallback only knows the demo show; never
                # answer a different show with it.
                if pack is not None or not config.AGENT_FALLBACK:
                    raise
                local = self._local_ask(question, active_look_id, rejected_looks)
                local["degraded"] = True
                local["backend"] = "deterministic-local"
                local["notice"] = (
                    f"OpenJiuwen is configured but did not answer ({exc}). "
                    "This is the deterministic local answer, not the model."
                )
                return local
        if config.AGENT_ENDPOINT:
            return self._remote_ask(question, active_look_id, rejected_looks)
        return self._local_ask(question, active_look_id, rejected_looks)

    def warm(self) -> dict[str, Any]:
        """Pay the import and Runner start once, at boot rather than on a click."""
        backend = self._backend()
        if backend is None:
            return {"ok": False, "reason": "the OpenJiuwen runtime is not enabled"}
        return backend.warm()

    def probe(self) -> dict[str, Any]:
        """A real model call, so on-site staff can check the runtime in one click."""
        backend = self._backend()
        if backend is None:
            raise AgentUnavailable("the OpenJiuwen runtime is not enabled")
        return backend.probe()

    def _local_ask(
        self,
        question: str,
        active_look_id: str | None = None,
        rejected_looks: list[str] | None = None,
    ) -> dict[str, Any]:
        q = question.lower().strip()
        pack = self.pack
        active = next((look for look in pack["looks"] if look["id"] == active_look_id), None) or pack["looks"][4]

        def link(label: str, to: str) -> dict[str, str]:
            return {"label": label, "to": to}

        def cite(cid: str, label: str, source: str, kind: str) -> dict[str, str]:
            return {"id": cid, "label": label, "source": source, "kind": kind}

        if not q:
            return {
                "question": question,
                "tool": "agent.hint",
                "title": "Ask the show",
                "body": "Ask about power, weight, rights, a venue, the missing clip, the budget or the drop. Answers cite the source record and never change a cue.",
                "citations": [],
                "links": [link("Open the show", "/show"), link("Readiness board", "/readiness")],
            }

        if re.search(r"power|supply|amp|kw|electric|breaker", q):
            stats = look_stats(pack, active["id"])
            return {
                "question": question,
                "tool": "rig.power_check",
                "title": "Power: the hero look is over the house supply",
                "body": (
                    f"{active['name']} draws {stats['power_kw']:.1f} kW against the {pack['rig']['power']['kw']} kW three-phase supply. "
                    f"The six-beam landing look draws 34.5 kW, 79% of supply. The house breaker is not a safety margin."
                ),
                "citations": [
                    cite("cit-power", f"Supply {pack['rig']['power']['kw']} kW · {active['name']} {stats['power_kw']:.1f} kW", "Venue profile — Halcyon Hall", "venue"),
                    cite("cit-look", "AERIAL 12 add-on: six beams", "Look sheet AI 01", "rig"),
                ],
                "links": [link("Open R-001", "/readiness?risk=R-001"), link("See the checks", "/show")],
            }

        if re.search(r"weight|truss|rig|load|kg|rigging", q):
            stats = look_stats(pack, active["id"])
            return {
                "question": question,
                "tool": "rig.weight_check",
                "title": "Weight: over the front truss rating",
                "body": (
                    f"{active['name']} puts {stats['front_kg']} kg on the front truss. The truss is rated {stats['front_capacity_kg']} kg. "
                    "The load test certificate covers the base rig, not the add-on. This is a stop-work item until the rigger signs."
                ),
                "citations": [
                    cite("cit-rig", f"Front truss rated {stats['front_capacity_kg']} kg; look {stats['front_kg']} kg", "Rig schedule v3", "rig"),
                    cite("cit-load", "Load test certificate 2026-10-12", "Rigging pack", "rig"),
                ],
                "links": [link("Open R-002", "/readiness?risk=R-002"), link("Rig and budget", "/budget")],
            }

        if re.search(r"glare|blind|eye|front row|sight", q):
            return {
                "question": question,
                "tool": "sightline.glare_check",
                "title": "Glare: the audience is never the target",
                "body": "Six fixtures in AERIAL 12 are focused below the 1.15 m eyeline. The glare index is 0.92 against a 0.55 limit. The six-beam landing look has no audience-aimed fixture.",
                "citations": [
                    cite("cit-eye", "Front row eye 1.15 m at 2.2 m", "Venue profile — Halcyon Hall", "venue"),
                    cite("cit-glare", "Glare index 0.92 vs 0.55", "Sightline model v2", "venue"),
                ],
                "links": [link("Open R-003", "/readiness?risk=R-003"), link("Previz", "/show")],
            }

        if re.search(r"right|licen|expire|territor|legal|contract", q):
            video = next((r for r in pack["rights"] if r["kind"] == "video"), None)
            return {
                "question": question,
                "tool": "rights.window_check",
                "title": "Rights: the video licence expires before Paris",
                "body": (
                    f"{video['asset'] if video else 'The video content'} is cleared to {video['to'] if video else 'an unknown date'}. "
                    "Paris, London and Copenhagen fall outside the window. The fallback is RAIN, which is cleared worldwide."
                ),
                "citations": [
                    cite(video["id"] if video else "right-monolith", f"Licence expires {video['to'] if video else '—'}", "Content licence v2", "rights"),
                    cite("right-rain", "RAIN cleared worldwide", "Provenance sheet v1", "rights"),
                ],
                "links": [link("Open R-004", "/readiness?risk=R-004"), link("Rights register", "/provenance")],
            }

        if re.search(r"asset|missing|clip|signal bars|deliver|video", q):
            return {
                "question": question,
                "tool": "asset.drift_check",
                "title": "Asset: SIGNAL BARS v4 is not delivered",
                "body": "Cue VID 14 references signal_bars_v4.mp4, which is not in the asset register. The content studio has confirmed 2026-11-01. Until it lands, the video drop is not playable; MONOLITH is the fallback.",
                "citations": [
                    cite("cit-asset", "signal_bars_v4.mp4 missing", "Asset register", "asset"),
                    cite("cit-cue14", "Cue VID 14 references SIGNAL BARS", "Cue sheet v4", "cue"),
                ],
                "links": [link("Open R-005", "/readiness?risk=R-005"), link("Cue sheet", "/cues")],
            }

        if re.search(r"budget|cost|money|euro|expensive|price", q):
            base = budget_base(pack)
            aerial = budget_for_look(pack, "look-aerial-12")
            landing = budget_for_look(pack, "look-six-beam")
            return {
                "question": question,
                "tool": "budget.incremental",
                "title": "Budget: the hero look is over, the landing look is under",
                "body": (
                    f"The base show and contingency is {base:,} EUR. AERIAL 12 adds 3,900 EUR and lands at {aerial:,} EUR against the "
                    f"{pack['budget']['approved']:,} EUR approved. SIX BEAM + MONOLITH lands at {landing:,} EUR."
                ),
                "citations": [
                    cite("cit-budget", "Budget model v2", "Rate card 2026", "budget"),
                    cite("cit-addon", "AERIAL add-on 3,900 EUR", "Rate card 2026", "budget"),
                ],
                "links": [link("Rig and budget", "/budget"), link("Open R-007", "/readiness?risk=R-007")],
            }

        if re.search(r"warm|warmer|colour|color|afterglow|mood", q):
            return {
                "question": question,
                "tool": "design.command",
                "title": "Warmer: one step to amber, no new fixture",
                "body": "Warm the drop by moving the wash palette from 3fa7a0 to ffb454 at 25% and keeping the six beams white. That reads warmer without adding a fixture or a cue; the afterglow already owns the amber.",
                "citations": [
                    cite("cit-concept", "Concept rule: one silhouette, one horizon, one hit", "Concept note v3", "asset"),
                    cite("look-afterglow", "AFTERGLOW palette ffb454", "Look sheet LX 20", "asset"),
                ],
                "links": [link("Open the looks", "/show?tab=looks"), link("Ask the agent", "/agent")],
            }

        if re.search(r"drop|look|hero|aerial|six|beam", q):
            return {
                "question": question,
                "tool": "look.rank",
                "title": "The drop: the safe look is the better look",
                "body": "AERIAL 12 scores 97 on impact but fails power, weight and glare. SIX BEAM + MONOLITH scores 89, lands 1,373 EUR under budget and keeps the front row. The designer rejected the spectacular answer; the ranking was recomputed.",
                "citations": [
                    cite("cit-human", "Designer rejected AERIAL 12", "Human decision, 2026-10-30", "human"),
                    cite("cit-eye-ok", "No fixture below the eyeline", "Sightline model v2", "venue"),
                ],
                "links": [link("Open the show", "/show"), link("Why this look?", "/agent")],
            }

        if re.search(r"next|date|tour|travel|load-in|load in|schedule", q):
            next_date = pack["dates"][0]
            venue = _venue(pack, next_date["venueId"])
            return {
                "question": question,
                "tool": "tour.next_show",
                "title": f"Next: {next_date['city']}",
                "body": f"{venue['name'] if venue else next_date['city']} on {next_date['date']}. Load-in {venue['loadInHours']} h, changeover {venue['changeoverHours']} h, curfew {next_date['curfew']}.",
                "citations": [
                    cite(next_date["id"], f"{next_date['city']} · {next_date['date']}", "Tour calendar", "schedule"),
                    cite(venue["id"] if venue else "venue", f"{venue['name']} · {venue['stage']['width']} × {venue['stage']['depth']} m" if venue else "Venue", "Venue profile", "venue"),
                ],
                "links": [link("Readiness board", "/readiness"), link("Venues", "/venues")],
            }

        if re.search(r"who|approve|sign|owner|responsible", q):
            return {
                "question": question,
                "tool": "org.roles",
                "title": "Who signs what",
                "body": "Mara Voss owns the looks and the cue-sheet safety sign-off. Jonas Reed approves the show version and the budget. Priya Nair owns the venue advances, crew and travel. The venue crew signs the rig and power at load-in. CUE never signs for them.",
                "citations": [
                    cite("u-mara", "Mara Voss · designer", "Project team", "human"),
                    cite("u-jonas", "Jonas Reed · producer", "Project team", "human"),
                    cite("u-priya", "Priya Nair · tour manager", "Project team", "human"),
                ],
                "links": [link("Versions and approvals", "/versions"), link("Cue sheet", "/cues")],
            }

        if re.search(r"risk|conflict|problem|wrong|ready", q):
            return {
                "question": question,
                "tool": "readiness.summary",
                "title": "Four risks would stop the load-in",
                "body": "Power, weight and glare sit on the AERIAL 12 drop; the video rights expire before Paris. The missing SIGNAL BARS clip blocks the video drop. Everything else is recoverable with a variant, a call or a crew day.",
                "citations": [
                    cite("R-001", "Power over supply", "Readiness check", "venue"),
                    cite("R-002", "Weight over truss", "Readiness check", "rig"),
                    cite("R-003", "Glare at the front row", "Readiness check", "venue"),
                    cite("R-004", "Rights expiry", "Readiness check", "rights"),
                ],
                "links": [link("Readiness board", "/readiness"), link("Show-week brief", "/readiness?brief=1")],
            }

        return {
            "question": question,
            "tool": "agent.fallback",
            "title": "I can answer from the show records",
            "body": (
                f"The show is {pack['project']['artist']} — {pack['project']['title']}, {pack['project']['version']}, "
                f"{len(pack['cues'])} cues, {len(pack['dates'])} dates. I can check power, weight, glare, rights, the missing clip, "
                "the budget, the next show or the drop. I will cite the record and I will not change a cue."
            ),
            "citations": [cite(pack["project"]["id"], f"{pack['project']['title']} · {pack['project']['version']}", "Show pack", "asset")],
            "links": [link("Open the show", "/show"), link("Readiness", "/readiness"), link("Agent", "/agent")],
        }
