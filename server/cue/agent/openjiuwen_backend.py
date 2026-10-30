"""The real OpenJiuwen agent backend.

This is the same runtime CoachMe uses: an openjiuwen ``Model`` over an
OpenAI-compatible endpoint, a ``DeepAgent`` built with read-only tools, and the
global ``Runner``. The only difference is what the tools read: CUE's own show
pack, venue profiles, rig, rights register, risk board and budget.

Design rules:

* **Read-only.** No tool writes. The model cannot change a cue, approve a
  version, sign safety or release a show.
* **Cited.** Every tool result carries evidence records. Only evidence from
  tools the model actually called is returned to the client.
* **Explicit.** A configured but unreachable runtime raises ``AgentUnavailable``
  instead of quietly pretending to be the local engine. ``CUE_AGENT_FALLBACK=1``
  opts into a labelled local answer instead.
* **Off the public path.** The import is lazy. The static demo never loads it.
"""

from __future__ import annotations

import asyncio
import importlib.util
import json
import threading
import time
from concurrent.futures import TimeoutError as FutureTimeout
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any
from urllib.parse import urlparse
from uuid import uuid4

from .. import config
from ..engine.show import (
    _venue,
    budget_for_look,
    budget_rows,
    checks_for,
    cue_conflicts,
    cue_rows,
    missing_asset_cues,
    rights_check,
    risk_open,
    schedule_check,
    venue_fit_check,
)
from .runtime import GUARDRAILS, AgentUnavailable

MAX_ITERATIONS = 8
CITATION_LIMIT = 12
ANSWER_CITATION_LIMIT = 20
NO_ANSWER_MARKERS = ("max iterations reached", "without completion")
_SEVERITY = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}


def runtime_installed() -> bool:
    """True when the openjiuwen package is importable in this interpreter."""
    try:
        return importlib.util.find_spec("openjiuwen") is not None
    except (ImportError, ValueError):
        return False


def connection_configured() -> bool:
    return bool(config.LLM_API_BASE and config.LLM_API_KEY and config.LLM_MODEL)


def _endpoint_label() -> str:
    try:
        parsed = urlparse(config.LLM_API_BASE)
        return parsed.netloc or config.LLM_API_BASE
    except ValueError:
        return "unknown"


def _friendly_error(exc: Exception) -> str:
    text = str(exc).strip() or exc.__class__.__name__
    lowered = text.lower()
    if "401" in text or "403" in text or "unauthorized" in lowered or "invalid api key" in lowered:
        return "the model endpoint rejected the credentials (401/403)"
    if "429" in text or "rate limit" in lowered:
        return "the model endpoint rate-limited the request (429)"
    if "timed out" in lowered or isinstance(exc, (TimeoutError, FutureTimeout)):
        return "the model call timed out"
    if "connection" in lowered or "getaddrinfo" in lowered or "ssl" in lowered:
        return f"the model endpoint could not be reached ({_endpoint_label()})"
    return text[:300]


def _output_text(result: Any) -> str:
    if result is None:
        return ""
    if isinstance(result, dict):
        for key in ("output", "content", "answer", "result"):
            value = result.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        return json.dumps(result, ensure_ascii=False, default=str)
    content = getattr(result, "content", None)
    return str(content or result).strip()


def _no_answer(text: str) -> bool:
    lowered = text.lower().strip()
    return not lowered or any(marker in lowered for marker in NO_ANSWER_MARKERS)


def _dedupe(citations: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for citation in citations:
        cid = str(citation.get("id", ""))
        if not cid or cid in seen:
            continue
        seen.add(cid)
        out.append(
            {
                "id": cid,
                "label": str(citation.get("label", cid)),
                "source": str(citation.get("source", "Show pack")),
                "kind": str(citation.get("kind", "asset")),
            }
        )
    return out


@dataclass
class _Capture:
    """Evidence and tool steps for one run. Guarded by the backend lock."""

    steps: list[dict[str, Any]] = field(default_factory=list)
    citations: list[dict[str, Any]] = field(default_factory=list)


def _evidence(records: Any) -> list[dict[str, Any]]:
    out = []
    for record in records or []:
        if isinstance(record, dict) and record.get("id"):
            out.append(
                {
                    "id": str(record["id"]),
                    "label": str(record.get("label", record["id"])),
                    "source": str(record.get("source", "Show pack")),
                    "kind": str(record.get("kind", "asset")),
                }
            )
    return out


def tool_functions(
    pack: dict[str, Any],
    store: Any,
    tenant: str,
    capture: _Capture,
    active_look_id: str | None = None,
) -> dict[str, Any]:
    """The read-only tool closures, as plain callables.

    Kept separate from :func:`build_tools` so the tool contract is testable
    without importing openjiuwen at all.
    """
    default_look = active_look_id or pack["looks"][0]["id"]

    def finish(
        name: str,
        args: dict[str, Any],
        started: float,
        data: Any,
        citations: list[dict[str, Any]],
        limit: int = CITATION_LIMIT,
    ) -> str:
        # Tools put the most relevant evidence first. The limit keeps the answer
        # readable; the full ids remain inside the tool data.
        clean = _evidence(citations)[:limit]
        capture.steps.append(
            {
                "tool": name,
                "args": args,
                "ms": int((time.perf_counter() - started) * 1000),
                "ok": True,
                "citations": [c["id"] for c in clean],
            }
        )
        capture.citations.extend(clean)
        return json.dumps({"data": data, "citations": clean}, ensure_ascii=False, default=str)

    def show_summary() -> str:
        """Summarise the show: artist, tour, version, counts and tour dates.

        Call this first when you need the shape of the show or a date id.
        """
        started = time.perf_counter()
        project = pack["project"]
        dates = []
        for date in pack["dates"]:
            venue = _venue(pack, date["venueId"]) or {}
            dates.append({"id": date["id"], "city": date["city"], "date": date["date"], "venue": venue.get("name")})
        data = {
            "artist": project["artist"],
            "title": project["title"],
            "tour": project["tour"],
            "version": project["version"],
            "looks": len(pack["looks"]),
            "cues": len(pack["cues"]),
            "venues": len(pack["venues"]),
            "dates": dates,
            "look_ids": [look["id"] for look in pack["looks"]],
        }
        citations = [{"id": project["id"], "label": f"{project['title']} · {project['version']}", "source": "Show pack", "kind": "asset"}]
        return finish("show_summary", {}, started, data, citations)

    def look_checks(look_id: str = "", venue_id: str = "", date_id: str = "") -> str:
        """Read the rig, power, weight, glare, rights, venue and budget checks for a look.

        The asset line only says a clip is missing. For the missing clip itself and
        its recorded fallback, use cue_sheet or open_risks.

        Args:
            look_id: The look id, for example look-aerial-12. Empty means the active look.
            venue_id: Optional venue id, for example v-apolo. Empty means the home venue.
            date_id: Optional tour date id, for example d-bcn. Empty means the home date.
        """
        started = time.perf_counter()
        lid = look_id or default_look
        checks = checks_for(pack, lid, venue_id or None, date_id or None)
        look = next((item for item in pack["looks"] if item["id"] == lid), {})
        data = [
            {
                "id": check["id"],
                "kind": check["kind"],
                "status": check["status"],
                "title": check["title"],
                "detail": check["detail"],
                "metric": check["metric"],
                "limit": check["limit"],
                "unit": check["unit"],
                "evidence": [record["id"] for record in check.get("evidence", [])],
            }
            for check in checks
        ]
        citations = [{"id": look.get("id", lid), "label": look.get("name", lid), "source": "Look sheet", "kind": "rig"}]
        for check in checks:
            citations.extend(check.get("evidence", []))
        return finish("look_checks", {"look_id": lid, "venue_id": venue_id, "date_id": date_id}, started, data, citations)

    def look_budget(look_id: str = "") -> str:
        """Read the cost of a look against the approved budget, with the line items.

        Args:
            look_id: The look id. Empty means the active look.
        """
        started = time.perf_counter()
        lid = look_id or default_look
        look = next((item for item in pack["looks"] if item["id"] == lid), {})
        total = budget_for_look(pack, lid)
        approved = int(pack["budget"]["approved"])
        data = {
            "look_id": lid,
            "look_name": look.get("name", lid),
            "total_eur": total,
            "approved_eur": approved,
            "delta_eur": total - approved,
            "rows": budget_rows(pack, lid),
        }
        citations = [
            {"id": "cit-budget", "label": f"Budget model · {total:,} EUR of {approved:,} EUR", "source": "Rate card 2026", "kind": "budget"},
            {"id": look.get("id", lid), "label": look.get("name", lid), "source": "Look sheet", "kind": "rig"},
        ]
        return finish("look_budget", {"look_id": lid}, started, data, citations)

    def open_risks() -> str:
        """Read the open readiness risks with severity, owner, due date and evidence.

        Use this for "what is blocking load-in" and "why is this a risk" questions.
        """
        started = time.perf_counter()
        dynamic = store.dynamic_risks(tenant) if store is not None else []
        states = store.risk_states(tenant) if store is not None else {}
        merged_open = []
        for risk in pack["risks"] + dynamic:
            override = states.get(risk["id"], {})
            merged = {**risk, "state": override.get("state", risk["state"]), "owner": override.get("owner") or risk["owner"]}
            if risk_open(merged):
                merged_open.append(merged)
        merged_open.sort(key=lambda item: (_SEVERITY.get(item.get("severity", "low"), 9), item.get("due", "")))
        risks = [
            {
                "id": risk["id"],
                "severity": risk["severity"],
                "kind": risk["kind"],
                "state": risk["state"],
                "title": risk["title"],
                "detail": risk["detail"],
                "owner": risk["owner"],
                "due": risk.get("due"),
                "why_now": risk.get("whyNow"),
                "fix": risk.get("fix"),
                "open_checks": [check["label"] for check in risk.get("checks", []) if not check.get("done")],
                "evidence": [record["id"] for record in risk.get("evidence", [])],
            }
            for risk in merged_open
        ]
        citations: list[dict[str, Any]] = []
        for risk in merged_open:
            citations.extend(risk.get("evidence", []))
            if len(citations) >= CITATION_LIMIT:
                break
        return finish("open_risks", {}, started, {"count": len(risks), "risks": risks}, citations)

    def cue_sheet() -> str:
        """Read the cue sheet: cue rows, timing conflicts, missing clips and the recorded asset fix.

        Use this for any question about a cue, the video drop, a clip, an asset or
        the running order. It includes the fallback or remediation recorded against
        a missing asset, so it is usually the only tool such a question needs.
        """
        started = time.perf_counter()
        rows = cue_rows(pack)
        conflicts = cue_conflicts(pack)
        missing = missing_asset_cues(pack)
        dynamic = store.dynamic_risks(tenant) if store is not None else []
        asset_pairs = [
            (risk, risk.get("evidence", []))
            for risk in pack["risks"] + dynamic
            if risk.get("kind") == "asset" and risk_open(risk)
        ]
        asset_risks = [
            {
                "id": risk["id"],
                "state": risk["state"],
                "owner": risk["owner"],
                "title": risk["title"],
                "detail": risk["detail"],
                "fix": risk.get("fix"),
                "open_checks": [check["label"] for check in risk.get("checks", []) if not check.get("done")],
                "evidence": [record["id"] for record in evidence if isinstance(record, dict)],
            }
            for risk, evidence in asset_pairs
        ]
        data = {
            "count": len(rows),
            "first": rows[0] if rows else None,
            "last": rows[-1] if rows else None,
            "conflicts": conflicts,
            "missing_assets": [
                {"id": cue["id"], "number": cue.get("number"), "title": cue.get("title"), "detail": cue.get("detail")}
                for cue in missing
            ],
            "clips": [
                {"name": video.get("name"), "clip": video.get("clip"), "status": video.get("status"), "note": video.get("note")}
                for video in pack.get("videos", [])
            ],
            "asset_risks": asset_risks,
        }
        citations = [{"id": "cue-sheet", "label": f"Cue sheet · {pack['project']['version']}", "source": "Cue sheet", "kind": "cue"}]
        citations.extend(
            {"id": cue["id"], "label": cue.get("title", cue["id"]), "source": "Cue sheet", "kind": "cue"} for cue in missing
        )
        citations.extend(
            {"id": conflict["id"], "label": conflict.get("detail", "Cue conflict"), "source": "Cue sheet", "kind": "cue"}
            for conflict in conflicts
            if conflict.get("id")
        )
        for _, evidence in asset_pairs:
            citations.extend(record for record in evidence if isinstance(record, dict))
        return finish("cue_sheet", {}, started, data, citations)

    def find_venue(query: str) -> str:
        """Look up a venue by name or city and report its stage, power, rig rating and fit.

        Args:
            query: A venue name or city, for example Sala Apolo or Barcelona.
        """
        started = time.perf_counter()
        needle = query.strip().lower()
        matches = [
            venue
            for venue in pack["venues"]
            if needle in venue["name"].lower() or needle in venue["city"].lower() or needle in venue["id"].lower()
        ]
        if not matches:
            return finish(
                "find_venue",
                {"query": query},
                started,
                {"found": False, "venues": [{"id": v["id"], "name": v["name"], "city": v["city"]} for v in pack["venues"]]},
                [],
            )
        venue = matches[0]
        date = next((item for item in pack["dates"] if item["venueId"] == venue["id"]), None)
        fit = venue_fit_check(pack, venue["id"])
        data = {
            "found": True,
            "venue": venue,
            "fit": fit,
            "date": date,
            "load_in_hours": venue.get("loadInHours"),
            "curfew": date.get("curfew") if date else None,
        }
        citations = [
            {"id": venue["id"], "label": f"{venue['name']} · {venue['city']}", "source": "Venue profile", "kind": "venue"},
        ]
        citations.extend(fit.get("evidence", []))
        if date:
            citations.append({"id": date["id"], "label": f"{date['city']} · {date['date']}", "source": "Tour calendar", "kind": "schedule"})
        return finish("find_venue", {"query": query}, started, data, citations)

    def rights_windows() -> str:
        """Read the music, video and likeness rights windows and which tour dates fall outside them.

        Use this for any licence, territory or expiry question.
        """
        started = time.perf_counter()
        rows = []
        citations: list[dict[str, Any]] = []
        for right in pack["rights"]:
            affected = []
            for date in pack["dates"]:
                check = rights_check(pack, date["id"])
                if check["status"] == "fail" and date["date"] > right.get("to", ""):
                    affected.append({"id": date["id"], "city": date["city"], "date": date["date"]})
            rows.append({**right, "dates_outside_window": affected})
            citations.append({"id": right["id"], "label": right.get("licence", right["id"]), "source": right.get("source", "Rights register"), "kind": "rights"})
        return finish("rights_windows", {}, started, {"rights": rows}, citations)

    def next_show() -> str:
        """Read the next tour date: city, venue, load-in, curfew and schedule check."""
        started = time.perf_counter()
        date = pack["dates"][0]
        venue = _venue(pack, date["venueId"]) or {}
        schedule = schedule_check(pack, date["id"])
        data = {"date": date, "venue": venue, "schedule": schedule}
        citations = [
            {"id": date["id"], "label": f"{date['city']} · {date['date']}", "source": "Tour calendar", "kind": "schedule"},
            {"id": venue.get("id", "venue"), "label": venue.get("name", "Venue"), "source": "Venue profile", "kind": "venue"},
        ]
        citations.extend(schedule.get("evidence", []))
        return finish("next_show", {}, started, data, citations)

    return {
        "show_summary": show_summary,
        "look_checks": look_checks,
        "look_budget": look_budget,
        "open_risks": open_risks,
        "cue_sheet": cue_sheet,
        "find_venue": find_venue,
        "rights_windows": rights_windows,
        "next_show": next_show,
    }


def build_tools(
    pack: dict[str, Any],
    store: Any,
    tenant: str,
    capture: _Capture,
    active_look_id: str | None = None,
) -> list[Any]:
    """Decorate the plain tool callables for openjiuwen (imported lazily)."""
    from openjiuwen.core.foundation.tool import tool

    return [tool(fn) for fn in tool_functions(pack, store, tenant, capture, active_look_id).values()]


class _EventLoopThread:
    """A dedicated asyncio loop, because the API endpoints are synchronous."""

    def __init__(self) -> None:
        self._loop = asyncio.new_event_loop()
        self._thread: threading.Thread | None = None
        self._guard = threading.Lock()

    def _ensure(self) -> None:
        with self._guard:
            if self._thread is None or not self._thread.is_alive():
                self._thread = threading.Thread(target=self._run, name="cue-openjiuwen", daemon=True)
                self._thread.start()

    def _run(self) -> None:
        asyncio.set_event_loop(self._loop)
        self._loop.run_forever()

    def run(self, coro: Any, timeout: float) -> Any:
        self._ensure()
        future = asyncio.run_coroutine_threadsafe(coro, self._loop)
        try:
            return future.result(timeout=timeout)
        except FutureTimeout as exc:
            future.cancel()
            raise AgentUnavailable(f"the model call timed out after {timeout:.0f}s") from exc


class OpenJiuwenBackend:
    def __init__(self, pack: dict[str, Any], store: Any = None) -> None:
        self.pack = pack
        self.store = store
        self._loop = _EventLoopThread()
        self._run_guard = threading.Lock()
        self._runner_started = False
        self._last_error: str | None = None
        self._last_latency_ms: int | None = None
        self._probe: dict[str, Any] | None = None
        self._warmup: dict[str, Any] | None = None

    # ------------------------------------------------------------------ status

    def enabled(self) -> bool:
        if config.OPENJIUWEN_MODE in {"0", "false", "off", "no"}:
            return False
        if not connection_configured():
            return False
        if config.OPENJIUWEN_MODE in {"1", "true", "on", "yes"}:
            return True
        return runtime_installed()

    def status(self) -> dict[str, Any]:
        installed = runtime_installed()
        configured = connection_configured()
        usable = self.enabled()
        if not installed:
            detail = "The openjiuwen package is not installed in this interpreter. Start the service with the OpenJiuwen venv, or set CUE_OPENJIUWEN=0."
        elif not configured:
            detail = "openjiuwen is installed but no model connection is configured. Set CUE_LLM_API_BASE, CUE_LLM_API_KEY and CUE_LLM_MODEL, or CUE_ENV_FILE."
        elif not usable:
            detail = "openjiuwen is disabled by CUE_OPENJIUWEN=0; using the deterministic local agent."
        else:
            detail = f"OpenJiuwen DeepAgent over {config.LLM_PROVIDER} at {_endpoint_label()}. Read-only tools; answers cite the show records."
        return {
            "configured": usable,
            "available": installed,
            "backend": "openjiuwen" if usable else "deterministic-local",
            "model": config.LLM_MODEL or "cue-looksmith-1.4.0",
            "detail": detail,
            "provider": config.LLM_PROVIDER,
            "endpoint": _endpoint_label(),
            "runtime_version": _runtime_version() if installed else None,
            "ready": bool(self._probe and self._probe.get("ok")),
            "last_error": self._last_error,
            "last_latency_ms": self._last_latency_ms,
            "probe": self._probe,
            "warmup": self._warmup,
        }

    def warm(self) -> dict[str, Any]:
        """Import the runtime and start the Runner before the first question."""
        if not self.enabled():
            self._warmup = {"ok": False, "reason": "the OpenJiuwen runtime is not enabled"}
            return self._warmup
        started = time.perf_counter()
        try:
            self._loop.run(self._ensure_runner(), timeout=180)
            self._warmup = {
                "ok": self._runner_started,
                "ms": int((time.perf_counter() - started) * 1000),
                "at": datetime.now().astimezone().isoformat(),
            }
        except Exception as exc:  # noqa: BLE001 - warm-up reports, it does not crash the app
            self._warmup = {
                "ok": False,
                "error": _friendly_error(exc),
                "ms": int((time.perf_counter() - started) * 1000),
            }
        return self._warmup

    # --------------------------------------------------------------------- ask

    def ask(
        self,
        question: str,
        active_look_id: str | None = None,
        rejected_looks: list[str] | None = None,
        tenant: str | None = None,
    ) -> dict[str, Any]:
        if not self.enabled():
            raise AgentUnavailable("the OpenJiuwen runtime is not enabled")
        tenant_id = tenant or config.DEFAULT_TENANT
        capture = _Capture()
        started = time.perf_counter()
        with self._run_guard:
            try:
                build_started = time.perf_counter()
                tools = build_tools(self.pack, self.store, tenant_id, capture, active_look_id)
                agent = self._build_agent(tools)
                build_ms = int((time.perf_counter() - build_started) * 1000)
                run_started = time.perf_counter()
                result = self._loop.run(
                    self._run_agent(agent, self._prompt(question, active_look_id, rejected_looks)),
                    timeout=config.LLM_TIMEOUT,
                )
                run_ms = int((time.perf_counter() - run_started) * 1000)
            except AgentUnavailable:
                raise
            except Exception as exc:  # normalise every runtime failure
                message = _friendly_error(exc)
                self._last_error = message
                raise AgentUnavailable(message) from exc
        elapsed = int((time.perf_counter() - started) * 1000)
        body = _output_text(result)
        if _no_answer(body):
            # The framework returns a placeholder when the tool budget runs out.
            # That is not an answer; never show it as one.
            message = "the agent used its tool budget without producing an answer"
            self._last_error = message
            raise AgentUnavailable(message)
        self._last_error = None
        self._last_latency_ms = elapsed
        citations = _dedupe(capture.citations)[:ANSWER_CITATION_LIMIT]
        return {
            "question": question,
            "tool": "openjiuwen.deepagent",
            "title": "Cited answer",
            "body": body,
            "citations": citations,
            "links": [{"label": "Readiness board", "to": "/readiness"}, {"label": "Cue sheet", "to": "/cues"}],
            "steps": capture.steps,
            "backend": "openjiuwen",
            "model": config.LLM_MODEL,
            "elapsed_ms": elapsed,
            "timings": {"build_ms": build_ms, "run_ms": run_ms, "total_ms": elapsed},
            "notice": (
                "Read-only tools. No cue changed, no approval signed, no show released. "
                f"{len(capture.steps)} tool read(s), {len(citations)} citation(s)."
            ),
        }

    def probe(self) -> dict[str, Any]:
        """A real, small model call. Used by /api/agent/probe and the admin surface."""
        if not self.enabled():
            raise AgentUnavailable("the OpenJiuwen runtime is not enabled")
        started = time.perf_counter()
        try:
            agent = self._build_agent([])
            result = self._loop.run(
                self._run_agent(agent, "Reply with the single word: ready"),
                timeout=min(config.LLM_TIMEOUT, 60),
            )
            answer = _output_text(result)
            latency = int((time.perf_counter() - started) * 1000)
            self._probe = {"ok": True, "at": datetime.now().astimezone().isoformat(), "latency_ms": latency, "answer": answer[:200]}
            self._last_latency_ms = latency
            self._last_error = None
            return self._probe
        except Exception as exc:  # a probe reports, it does not crash
            message = _friendly_error(exc)
            self._last_error = message
            self._probe = {"ok": False, "at": datetime.now().astimezone().isoformat(), "error": message}
            raise AgentUnavailable(message) from exc

    # ----------------------------------------------------------------- internals

    def _build_agent(self, tools: list[Any]) -> Any:
        if not runtime_installed():
            raise AgentUnavailable("the openjiuwen package is not installed")
        from openjiuwen.core.foundation.llm import Model, ModelClientConfig, ModelRequestConfig
        from openjiuwen.harness import create_deep_agent

        client = ModelClientConfig(
            client_provider=config.LLM_PROVIDER,
            api_key=config.LLM_API_KEY,
            api_base=config.LLM_API_BASE,
            timeout=config.LLM_TIMEOUT,
            verify_ssl=config.LLM_SSL_VERIFY,
            max_retries=1,
        )
        request = ModelRequestConfig(model=config.LLM_MODEL, temperature=config.LLM_TEMPERATURE, top_p=0.9)
        model = Model(model_client_config=client, model_config=request)
        workspace = config.RUNTIME_DIR / "agent"
        workspace.mkdir(parents=True, exist_ok=True)
        return create_deep_agent(
            model=model,
            system_prompt=self._system_prompt(),
            tools=tools,
            max_iterations=MAX_ITERATIONS,
            workspace=str(workspace),
            restrict_to_work_dir=False,
            parallel_tool_calls=False,
            # CUE owns the system prompt and the guardrails. The generic rail
            # preamble is not part of this product's voice.
            enable_security_rail=False,
            enable_model_anomaly_detection_rail=False,
        )

    async def _ensure_runner(self) -> None:
        from openjiuwen.core.runner import Runner

        if self._runner_started:
            return
        started = True
        try:
            await Runner.start()
        except Exception:  # noqa: BLE001 - the run below reports the real failure
            started = False
        # Keep retrying if the start failed; never claim a runner that is not up.
        self._runner_started = started

    async def _run_agent(self, agent: Any, prompt: str) -> Any:
        from openjiuwen.core.runner import Runner

        await self._ensure_runner()
        return await Runner.run_agent(agent, {"query": prompt}, session=f"cue-{uuid4().hex}")

    def _system_prompt(self) -> str:
        project = self.pack["project"]
        rules = "\n".join(f"{index + 1}. {rule}" for index, rule in enumerate(GUARDRAILS))
        return (
            f"You are CUE, the design agent for {project['artist']} — {project['title']} ({project['tour']}, {project['version']}).\n"
            "You answer questions about the current show using only the tools. The tools are read-only.\n\n"
            "How to answer:\n"
            "- Call the relevant tools before you claim a number, a date, a status or an owner.\n"
            "- Use the fewest tools that answer the question. Two or three is usually enough; do not read every tool.\n"
            "- Answer as soon as the evidence is enough. A compound question does not need a tool per noun.\n"
            "- For a cue, clip, video asset or running-order question, cue_sheet is the right tool.\n"
            "- Never end with a status message. End with the answer.\n"
            "- If the tools do not contain the answer, say what is missing instead of reading another tool.\n"
            "- Cite the record in plain text, for example (Rig schedule v3) or (Venue profile — Sala Apolo).\n"
            "- If a tool returns no evidence, say the evidence is missing. Never fill the gap with a guess.\n"
            "- Be concise: a short verdict first, then the reasons. Use a small table only when comparing numbers.\n"
            "- You may propose a fix. You may not apply it.\n\n"
            f"Guardrails:\n{rules}\n"
        )

    def _prompt(self, question: str, active_look_id: str | None, rejected_looks: list[str] | None) -> str:
        active = active_look_id or self.pack["looks"][0]["id"]
        rejected = ", ".join(rejected_looks or []) or "none"
        return (
            f"Active look: {active}. Rejected looks: {rejected}.\n"
            f"Today: {datetime.now().date().isoformat()}.\n"
            f"Question: {question}"
        )


def _runtime_version() -> str | None:
    try:
        from importlib.metadata import version

        return version("openjiuwen")
    except Exception:  # noqa: BLE001 - a missing version is not an error
        return None
