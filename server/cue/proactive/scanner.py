"""The proactive scanner.

Detection is pure and testable. The scanner compares the show, the venue, the
rights, the assets and the budget against the current dates, raises only new
group keys, records the run, and delivers a notification. It never changes a
cue, a look or a signature.
"""

from __future__ import annotations

import hashlib
import time
from datetime import datetime, timedelta
from typing import Any

from laix import DecisionRequest, Layer, Signal
from laix.attention import SEVERITY_RANK, dedupe_key, rollup

from laix_integration.mapper import to_context, to_cue_decision, to_signal

from ..engine.show import (
    _venue,
    budget_for_look,
    data_freshness_check,
    look_stats,
    missing_asset_cues,
    rights_check,
    risk_open,
    schedule_check,
    venue_fit_check,
)
from ..store.db import Store, now_iso
from .delivery import CueSink
from .history import learned_adjustments


def default_settings(pack: dict[str, Any]) -> dict[str, Any]:
    base = dict(pack.get("readiness", {}))
    base.update(
        {
            "mode": base.get("mode", "shadow"),
            "stopSwitch": False,
            "intervalMinutes": 24 * 60,
            "channels": base.get("channels", ["in_app", "email", "slack"]),
            "quietHours": base.get("quietHours", "22:00-06:00"),
            "digest": base.get("digest", "daily"),
            "coverageFloor": base.get("coverageFloor", 0.9),
            "watchTypes": ["venue", "rig", "rights", "asset", "budget", "schedule", "data"],
            "lastScan": None,
            "nextScan": None,
            "scanCount": 0,
        }
    )
    return base


def _id(group_key: str) -> str:
    return "D-" + hashlib.sha1(group_key.encode("utf-8")).hexdigest()[:8].upper()


def _due(date_iso: str, hours_before: int = 24) -> str:
    try:
        day = datetime.fromisoformat(date_iso)
        return (day - timedelta(hours=hours_before)).isoformat()
    except (ValueError, TypeError):
        return date_iso


def _evidence(cid: str, label: str, source: str, kind: str) -> dict[str, str]:
    return {"id": cid, "label": label, "source": source, "kind": kind}


def _candidate(
    *,
    kind: str,
    group_key: str,
    title: str,
    detail: str,
    severity: str,
    owner: str,
    role: str,
    date_id: str | None,
    venue_id: str | None,
    why_now: str,
    checks: list[str],
    fix: str,
    effort: str,
    cost: int,
    evidence: list[dict[str, str]],
    estimate: str,
    confidence: float = 0.82,
    look_id: str | None = None,
    due: str | None = None,
) -> dict[str, Any]:
    now = now_iso()
    return {
        "id": _id(group_key),
        "kind": kind,
        "title": title,
        "detail": detail,
        "severity": severity,
        "state": "new",
        "owner": owner,
        "role": role,
        "dateId": date_id,
        "venueId": venue_id,
        "lookId": look_id,
        "due": due or now_iso(),
        "slaHours": 24 if severity in {"critical", "high"} else 48,
        "confidence": confidence,
        "whyNow": why_now,
        "checks": [{"id": f"c{i + 1}", "label": label, "done": False} for i, label in enumerate(checks)],
        "fix": {"label": fix, "effort": effort, "cost": cost, "owner": owner},
        "evidence": evidence,
        "history": [{"at": now, "actor": "CUE readiness", "action": "risk.opened", "detail": f"Detected by the proactive scan ({group_key})."}],
        "estimate": estimate,
        "groupKey": group_key,
        "provenance": f"Pinned to {datetime.now().date().isoformat()} · engine {_engine_version()} · source pack {_pack_version()}",
    }


def _engine_version() -> str:
    return "cue-readiness-1.3"


def _pack_version() -> str:
    return "show-pack"


def detect_candidates(pack: dict[str, Any], active_look_id: str = "look-aerial-12") -> list[dict[str, Any]]:
    """Pure detection over the current show.

    The look-level risks are grouped once for the leg. Venue-specific risks are
    raised per room. That keeps the board readable and the alert budget honest.
    """
    candidates: list[dict[str, Any]] = []
    look = next((item for item in pack["looks"] if item["id"] == active_look_id), None)
    dates = pack["dates"]
    if look:
        stats = look_stats(pack, active_look_id)
        venues = [(date, _venue(pack, date["venueId"])) for date in dates]
        venues = [(date, venue) for date, venue in venues if venue]

        low_power = [venue for _, venue in venues if venue["power"]["kw"] < stats["power_kw"]]
        if low_power:
            names = ", ".join(v["name"] for v in low_power)
            candidates.append(
                _candidate(
                    kind="power",
                    group_key="home:power",
                    title="The active look is over the house supply on this leg",
                    detail=f"{look['name']} draws {stats['power_kw']:.1f} kW. Below the supply in: {names}.",
                    severity="critical",
                    owner="Mara Voss",
                    role="Lighting designer",
                    date_id="d-home",
                    venue_id="v-halcyon",
                    why_now="The look is still attached to the drop cue and the leg includes rooms with a lower supply.",
                    checks=["Confirm each house supply", "Drop beams or split the look", "Attach the meter reading"],
                    fix="Use the six-beam landing look or a venue variant",
                    effort="1 h",
                    cost=0,
                    evidence=[
                        _evidence("cit-power", f"{stats['power_kw']:.1f} kW look draw", "Rig schedule v3", "rig"),
                        _evidence("cit-venues", names, "Venue profiles", "venue"),
                    ],
                    estimate="One or more load-ins cannot start with this look on this supply.",
                    look_id=active_look_id,
                )
            )

        low_rig = [venue for _, venue in venues if venue["rigCapacityKg"] < stats["front_kg"]]
        if low_rig:
            names = ", ".join(v["name"] for v in low_rig)
            candidates.append(
                _candidate(
                    kind="weight",
                    group_key="home:weight",
                    title="The active look is over the rig rating on this leg",
                    detail=f"{stats['front_kg']} kg on the front truss. Below the rating in: {names}.",
                    severity="critical",
                    owner="R. Okafor",
                    role="Venue crew",
                    date_id="d-home",
                    venue_id="v-halcyon",
                    why_now="The look is attached to the drop cue and the leg includes rooms with a lower rig rating.",
                    checks=["Re-weigh the front truss", "Move fixtures to the mid truss", "Attach the revised load certificate"],
                    fix="Reduce the front truss load",
                    effort="2 h",
                    cost=0,
                    evidence=[_evidence("cit-rig", f"{stats['front_kg']} kg front load", "Rig schedule v3", "rig")],
                    estimate="A stop-work item until the rigger signs.",
                    look_id=active_look_id,
                )
            )

        if stats["glare"] > 0.55:
            candidates.append(
                _candidate(
                    kind="glare",
                    group_key="home:glare",
                    title=f"{look['name']} aims below the front-row eyeline",
                    detail=f"Glare index {stats['glare']:.2f} against a 0.55 limit; {look['audienceAim']} fixture(s) aimed at the audience.",
                    severity="high",
                    owner="Mara Voss",
                    role="Lighting designer",
                    date_id="d-home",
                    venue_id="v-halcyon",
                    why_now="The look is still attached to the drop cue.",
                    checks=["Re-aim the audience-facing fixtures", "Walk the front row during focus", "Replace with a stage-only look"],
                    fix="Use the six-beam landing look",
                    effort="30 min",
                    cost=0,
                    evidence=[_evidence("cit-glare", f"Glare {stats['glare']:.2f}", "Sightline model v2", "venue")],
                    estimate="The front row is unusable for the drop.",
                    look_id=active_look_id,
                )
            )

        covered_venue_risks = {
            risk.get("venueId")
            for risk in pack["risks"]
            if risk.get("kind") == "venue" and risk.get("state") not in {"resolved", "dismissed"}
        }
        fit_problems = []
        for date, venue in venues:
            fit = venue_fit_check(pack, venue["id"])
            if fit["status"] != "pass" and venue["id"] not in covered_venue_risks:
                fit_problems.append((date, venue, fit))
            freshness = data_freshness_check(pack, venue["id"], pack["project"]["anchor"])
            if freshness["status"] != "pass":
                candidates.append(
                    _candidate(
                        kind="data",
                        group_key=f"venue:data:{venue['id']}",
                        title=f"{venue['name']} data is outside the freshness contract",
                        detail=freshness["detail"],
                        severity="medium",
                        owner="Priya Nair",
                        role="Tour manager",
                        date_id=date["id"],
                        venue_id=venue["id"],
                        why_now=f"The profile is older than the 12-month contract and {date['city']} is on the tour.",
                        checks=["Request the current rig drawing", "Verify on site", "Update the profile with the source"],
                        fix="Re-verify the venue profile",
                        effort="1 day",
                        cost=0,
                        evidence=freshness["evidence"],
                        estimate="Rig decisions for this city are low confidence until verified.",
                    )
                )

        if fit_problems:
            first_date, _first_venue, first_fit = fit_problems[0]
            names = ", ".join(venue["name"] for _, venue, _ in fit_problems)
            candidates.append(
                _candidate(
                    kind="venue",
                    group_key="tour:venue-variant",
                    title="The leg needs venue variants",
                    detail=f"{len(fit_problems)} room(s) are smaller than the home stage: {names}. {first_fit['detail']}",
                    severity="high" if any(fit["status"] == "fail" for _, _, fit in fit_problems) else "medium",
                    owner="Priya Nair",
                    role="Tour manager",
                    date_id=first_date["id"],
                    venue_id=None,
                    why_now="The current show version still uses the home stage on a leg with smaller rooms.",
                    checks=["Cut a venue variant per room", "Confirm screen and runway", "Re-check the trim"],
                    fix="Create venue variants from the show",
                    effort="3 h per room",
                    cost=0,
                    evidence=first_fit["evidence"],
                    estimate="A smaller room is a different show, not a smaller invoice.",
                    confidence=0.9,
                )
            )

        tight = []
        for date in dates:
            schedule = schedule_check(pack, date["id"])
            if schedule["status"] != "pass":
                tight.append((date, schedule))
        if tight:
            first_date, first_check = tight[0]
            cities = ", ".join(date["city"] for date, _ in tight)
            candidates.append(
                _candidate(
                    kind="schedule",
                    group_key="tour:schedule",
                    title="Load-in is tight against the cue complexity",
                    detail=f"{cities}. {first_check['detail']}",
                    severity="high" if any(s["status"] == "fail" for _, s in tight) else "medium",
                    owner="Priya Nair",
                    role="Tour manager",
                    date_id=first_date["id"],
                    venue_id=first_date["venueId"],
                    why_now=f"The show has {len(pack['cues'])} cues and at least one advance was written for fewer.",
                    checks=["Cut a smaller cue variant", "Add local crew", "Move the focus call earlier"],
                    fix="Add crew or reduce the cue count",
                    effort="2 h",
                    cost=640,
                    evidence=first_check["evidence"],
                    estimate="Estimated 1 h 20 min short on the tightest date.",
                )
            )

        bad_rights = []
        for date in dates:
            rights = rights_check(pack, date["id"])
            if rights["status"] == "fail":
                bad_rights.append((date, rights))
        if bad_rights:
            first_date, first_rights = bad_rights[0]
            cities = ", ".join(date["city"] for date, _ in bad_rights)
            candidates.append(
                _candidate(
                    kind="rights",
                    group_key="tour:rights",
                    title="Video rights expire before part of the tour",
                    detail=f"{first_rights['detail']} Affected: {cities}.",
                    severity="critical",
                    owner="Jonas Reed",
                    role="Producer",
                    date_id=first_date["id"],
                    venue_id=first_date["venueId"],
                    why_now=f"The rights window ends before {first_date['date']}.",
                    checks=["Get a written extension", "Swap to a cleared clip", "Update the cue sheet"],
                    fix="Extend the licence or use RAIN",
                    effort="1 day",
                    cost=0,
                    evidence=first_rights["evidence"],
                    estimate="The affected shows would use an expired content package.",
                    due=_due(first_date["date"], 72),
                )
            )

    missing = missing_asset_cues(pack)
    if missing:
        candidates.append(
            _candidate(
                kind="asset",
                group_key="tour:asset",
                title="A cue references a missing clip",
                detail=f"{', '.join(c['id'] for c in missing)} reference a clip that is not in the asset register.",
                severity="high",
                owner="Priya Nair",
                role="Tour manager",
                date_id="d-bcn",
                venue_id="v-apolo",
                why_now="The asset has not arrived and the cue is still on the sheet.",
                checks=["Confirm delivery in writing", "Prepare the fallback", "Rehearse the fallback"],
                fix="Deliver the clip or point the cue at MONOLITH",
                effort="4 h",
                cost=0,
                evidence=[_evidence("cit-asset", "Asset register", "DAM link", "asset")],
                estimate="The video drop is not playable.",
                confidence=0.96,
            )
        )

    total = budget_for_look(pack, active_look_id)
    if total > pack["budget"]["approved"]:
        candidates.append(
            _candidate(
                kind="budget",
                group_key="home:budget",
                title="The active look puts the show over budget",
                detail=f"{total:,} EUR against {pack['budget']['approved']:,} EUR approved.",
                severity="medium",
                owner="Jonas Reed",
                role="Producer",
                date_id="d-home",
                venue_id="v-halcyon",
                why_now="The active look is still the agent's first proposal.",
                checks=["Choose the landing look", "Re-approve the budget"],
                fix="Use the landing look and re-approve",
                effort="15 min",
                cost=0,
                evidence=[_evidence("cit-budget", "Budget model v2", "Rate card 2026", "budget")],
                estimate="A creative decision has a cost line.",
                confidence=0.9,
                look_id=active_look_id,
            )
        )

    by_key: dict[str, dict[str, Any]] = {}
    for candidate in candidates:
        existing = by_key.get(candidate["groupKey"])
        if not existing or SEVERITY_RANK.get(candidate["severity"], 9) < SEVERITY_RANK.get(existing["severity"], 9):
            by_key[candidate["groupKey"]] = candidate
    return list(by_key.values())


def build_digest(pack: dict[str, Any], risks: list[dict[str, Any]], settings: dict[str, Any]) -> dict[str, Any]:
    open_risks = [risk for risk in risks if risk.get("state") not in {"resolved", "dismissed"}]
    # The selection rule is generic; the wording below is the app's.
    ordered = rollup(
        [
            Signal(
                id=str(risk.get("id", "")),
                kind=str(risk.get("kind", "risk")),
                severity=str(risk.get("severity", "low")),
                due=risk.get("due"),
            )
            for risk in open_risks
        ],
        limit=5,
    )
    by_id = {str(risk.get("id", "")): risk for risk in open_risks}
    top = [by_id[item.id] for item in ordered if item.id in by_id]
    next_date = pack["dates"][0]
    lines = [
        f"# CUE readiness digest · {next_date['city']} · {next_date['date']}",
        "",
        f"{len(open_risks)} open risks · {sum(1 for r in open_risks if r.get('severity') == 'critical')} critical · {settings.get('mode', 'shadow')} mode",
        "",
        "## Top risks",
        *[
            f"- **{risk['id']} · {risk['title']}** — {risk['owner']} · {risk.get('fix', {}).get('label', 'Triage')} · {risk.get('due', '')}"
            for risk in top
        ],
        "",
        "Recommendations only. No live control, no automatic cue release. Safety sign-off remains human.",
    ]
    return {
        "title": f"CUE readiness digest · {next_date['city']}",
        "summary": f"{len(open_risks)} open risks, {sum(1 for r in open_risks if r.get('severity') == 'critical')} critical.",
        "markdown": "\n".join(lines),
        "risks": top,
        "generated_by": "CUE proactive scheduler",
        "at": now_iso(),
    }


def run_scan(
    pack: dict[str, Any],
    store: Store,
    tenant: str,
    settings: dict[str, Any] | None = None,
    *,
    mode: str | None = None,
    actor: str = "CUE readiness",
    active_look_id: str = "look-aerial-12",
) -> dict[str, Any]:
    started = time.perf_counter()
    settings = {**default_settings(pack), **(settings or {})}
    mode = mode or settings.get("mode", "shadow")
    now = datetime.now().astimezone()

    if settings.get("stopSwitch"):
        run = {
            "id": f"SCAN-{now.strftime('%Y%m%d%H%M%S%f')}",
            "at": now_iso(),
            "mode": mode,
            "checked": 0,
            "raised": 0,
            "suppressed": 0,
            "duration_ms": 0,
            "status": "stopped",
            "note": "Readiness is stopped by the kill switch. The show and cue sheet are unaffected.",
        }
        store.save_scan_run(tenant, run)
        return {"run": run, "candidates": [], "notifications": [], "deliveries": [], "settings": settings}

    existing = pack["risks"] + store.dynamic_risks(tenant)
    existing_keys = {risk.get("groupKey") for risk in existing if risk.get("groupKey")}
    # A resolved risk does not block a new one. An open risk of the same kind
    # in the same room does: it is the same operational problem, restated.
    existing_pairs = {
        (risk.get("kind"), risk.get("venueId"))
        for risk in existing
        if risk_open(risk) and risk.get("venueId")
    }
    candidates = detect_candidates(pack, active_look_id=active_look_id)
    new = [
        candidate
        for candidate in candidates
        if candidate["groupKey"] not in existing_keys
        and (candidate["kind"], candidate.get("venueId")) not in existing_pairs
    ]
    for candidate in new:
        store.save_dynamic_risk(tenant, candidate)

    # LAIX is the only decision engine: CUE detects, LAIX decides, CUE delivers.
    recent = store.notifications(tenant, limit=100)
    dedupe = {n.get("dedup_key") for n in recent}
    learned = learned_adjustments(pack["risks"] + store.dynamic_risks(tenant))
    signals = [to_signal(candidate, now) for candidate in new]
    signal_by_id = {signal.id: signal for signal in signals}
    context = to_context({**settings, "mode": mode, "sent": dedupe, "learned": learned}, now)
    request = DecisionRequest(
        subject="CUE readiness scan",
        at=now.isoformat(),
        signals=tuple(signals),
        context=context,
    )
    decisions = [to_cue_decision(item, signal.id) for item, signal in zip(Layer().decide(request), signals)]
    by_id = {candidate["id"]: candidate for candidate in new}
    sink = CueSink(store, tenant, settings)

    notifications: list[dict[str, Any]] = []
    deliveries: list[dict[str, Any]] = []
    for decision in decisions:
        if not decision.record:
            continue
        candidate = by_id[decision.signal_id]
        dedup_key = dedupe_key(signal_by_id[candidate["id"]], now)
        notification = {
            "id": f"NT-{candidate['id']}-{now.strftime('%H%M%S')}",
            "at": now_iso(),
            "kind": "risk",
            "severity": candidate["severity"],
            "title": candidate["title"],
            "detail": candidate["detail"],
            "risk_id": candidate["id"],
            "channels": settings.get("channels", ["in_app"]),
            "delivered": decision.deliver and bool(settings.get("channels")),
            "read": False,
            "dedup_key": dedup_key,
            "trace_id": decision.trace_id,
            "score": round(decision.score, 2),
        }
        if decision.reason == "quiet_hours":
            notification["detail"] += " Held for the quiet-hours digest."
        store.save_notification(tenant, notification)
        notifications.append(notification)
        if decision.deliver:
            deliveries.extend(sink.emit(notification))
            dedupe.add(dedup_key)

    duration = int((time.perf_counter() - started) * 1000)
    run = {
        "id": f"SCAN-{now.strftime('%Y%m%d%H%M%S%f')}",
        "at": now_iso(),
        "mode": mode,
        "checked": len(candidates) + len(pack["risks"]),
        "raised": len(new),
        "suppressed": max(0, len(candidates) - len(new)),
        "duration_ms": duration,
        "status": "ok",
        "note": f"{len(new)} new · {max(0, len(candidates) - len(new))} already known · {len(notifications)} notified.",
    }
    store.save_scan_run(tenant, run)
    settings["lastScan"] = run["at"]
    settings["scanCount"] = int(settings.get("scanCount", 0)) + 1
    settings["nextScan"] = (now + timedelta(minutes=int(settings.get("intervalMinutes", 1440)))).isoformat()
    store.save_proactive_settings(tenant, settings)
    store.audit(tenant, actor, "proactive.scan", "tour", run["note"], ["readiness", "venue", "rights", "asset", "budget"])
    return {
        "run": run,
        "candidates": new,
        "notifications": notifications,
        "deliveries": deliveries,
        "settings": settings,
        "digest": build_digest(pack, pack["risks"] + store.dynamic_risks(tenant), settings),
    }
