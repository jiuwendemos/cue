"""The CUE show engine.

The public demo and the on-site API share one JSON pack. These functions are
the server's copy of the same deterministic math: power, weight, glare, budget,
cue resolution, rights and the readiness checks. They never mutate the pack.
"""

from __future__ import annotations

import csv
import io
import json
from datetime import date, datetime
from typing import Any

ALWAYS_ON_W = 9000 + 3600 + 900
GLARE_LIMIT = 0.55
CUE_GAP_S = 0.5
FRESHNESS_MONTHS = 12


def _look(pack: dict[str, Any], look_id: str | None) -> dict[str, Any] | None:
    return next((look for look in pack["looks"] if look["id"] == look_id), None)


def _venue(pack: dict[str, Any], venue_id: str | None) -> dict[str, Any] | None:
    return next((v for v in pack["venues"] if v["id"] == venue_id), None)


def _date(pack: dict[str, Any], date_id: str | None) -> dict[str, Any] | None:
    return next((d for d in pack["dates"] if d["id"] == date_id), None)


def fmt_clock(seconds: float) -> str:
    s = max(0, int(seconds))
    return f"{s // 60}:{s % 60:02d}"


def fmt_timecode(seconds: float) -> str:
    s = max(0.0, float(seconds))
    return f"{int(s // 60):02d}:{s % 60:04.1f}"


def fmt_money(value: float, currency: str = "EUR") -> str:
    sign = "+" if value > 0 else ""
    return f"{sign}{value:,.0f} {currency}"


def fixture_load(pack: dict[str, Any], look: dict[str, Any]) -> dict[str, Any]:
    fixtures = [f for f in pack["rig"]["fixtures"] if f["id"] in look["fixtureIds"]]
    watts = sum(f["watts"] for f in fixtures)
    per_truss: dict[str, float] = {}
    for f in fixtures:
        if f["truss"] in {"foh", "deck"}:
            continue
        per_truss[f["truss"]] = per_truss.get(f["truss"], 0) + f["weightKg"]
    for truss, kg in list(per_truss.items()):
        if kg:
            per_truss[truss] = kg + 60
    return {"watts": watts, "per_truss": per_truss, "fixtures": len(fixtures)}


def power_kw_for_look(pack: dict[str, Any], look: dict[str, Any]) -> float:
    return (fixture_load(pack, look)["watts"] + ALWAYS_ON_W) / 1000


def glare_for_look(look: dict[str, Any]) -> float:
    return min(1.0, look.get("audienceAim", 0) / 8 + look.get("energy", 0) * 0.18)


def look_stats(pack: dict[str, Any], look_id: str | None) -> dict[str, Any]:
    look = _look(pack, look_id)
    if not look:
        raise KeyError(f"look {look_id} not found")
    load = fixture_load(pack, look)
    front = next((t for t in pack["rig"]["trusses"] if t["id"] == "front"), {"capacityKg": 520})
    total = budget_for_look(pack, look_id)
    return {
        "look_id": look_id,
        "name": look["name"],
        "power_kw": round((load["watts"] + ALWAYS_ON_W) / 1000, 2),
        "supply_kw": pack["rig"]["power"]["kw"],
        "supply_pct": round((load["watts"] + ALWAYS_ON_W) / 1000 / pack["rig"]["power"]["kw"], 4),
        "front_kg": load["per_truss"].get("front", 0),
        "front_capacity_kg": front["capacityKg"],
        "weight_pct": round(load["per_truss"].get("front", 0) / front["capacityKg"], 4),
        "glare": round(glare_for_look(look), 4),
        "fixture_count": load["fixtures"],
        "budget_total": total,
        "budget_pct": round(total / pack["budget"]["approved"], 4),
        "cost_delta": look.get("costDelta", 0),
    }


# ------------------------------------------------------------------ budget


def budget_base(pack: dict[str, Any]) -> int:
    base = sum(line["qty"] * line["unitCost"] for line in pack["budget"]["lines"] if not line.get("optional"))
    return base + round(base * pack["budget"]["contingencyPct"])


def budget_addons(pack: dict[str, Any], look_id: str | None) -> list[dict[str, Any]]:
    look = _look(pack, look_id)
    video_id = look.get("videoId") if look else None
    out = []
    for line in pack["budget"]["lines"]:
        if not line.get("optional"):
            continue
        if (look_id and look_id in (line.get("lookIds") or [])) or (video_id and line.get("videoId") == video_id):
            out.append(line)
    return out


def budget_for_look(pack: dict[str, Any], look_id: str | None) -> int:
    return budget_base(pack) + sum(line["qty"] * line["unitCost"] for line in budget_addons(pack, look_id))


def budget_rows(pack: dict[str, Any], look_id: str | None) -> list[dict[str, Any]]:
    active = {line["id"] for line in budget_addons(pack, look_id)}
    rows = []
    for line in pack["budget"]["lines"]:
        rows.append(
            {
                **line,
                "amount": line["qty"] * line["unitCost"],
                "active": (not line.get("optional")) or line["id"] in active,
            }
        )
    return rows


def budget_total(pack: dict[str, Any], look_id: str | None) -> int:
    rows = budget_rows(pack, look_id)
    active = [r for r in rows if r["active"]]
    base = sum(r["amount"] for r in active if not r.get("optional"))
    extras = sum(r["amount"] for r in active if r.get("optional"))
    return base + round(base * pack["budget"]["contingencyPct"]) + extras


# ------------------------------------------------------------------ cues


def effective_look(
    pack: dict[str, Any],
    look_id: str | None,
    rejected: list[str] | None = None,
    accepted: str | None = None,
) -> dict[str, Any] | None:
    rejected = rejected or []
    base = _look(pack, look_id)
    if not base:
        return None
    if base["id"] in rejected:
        return _look(pack, accepted) or _look(pack, "look-six-beam") or base
    return base


def cue_conflicts(pack: dict[str, Any]) -> list[dict[str, Any]]:
    out = []
    cues = pack["cues"]
    for i, a in enumerate(cues):
        for b in cues[i + 1 :]:
            if a["kind"] != b["kind"]:
                continue
            if abs(a["at"] - b["at"]) < CUE_GAP_S:
                out.append({"a": a, "b": b, "gap": round(abs(a["at"] - b["at"]), 2)})
    return out


def missing_asset_cues(pack: dict[str, Any]) -> list[dict[str, Any]]:
    missing = {v["id"] for v in pack["videos"] if v["status"] == "missing"}
    return [c for c in pack["cues"] if c.get("videoId") in missing]


def cue_rows(pack: dict[str, Any], rejected: list[str] | None = None, accepted: str | None = None) -> list[dict[str, Any]]:
    rows = []
    for cue in pack["cues"]:
        look = effective_look(pack, cue.get("lookId"), rejected, accepted)
        video = next((v for v in pack["videos"] if v["id"] == cue.get("videoId")), None)
        rows.append(
            {
                **cue,
                "look_name": look["name"] if look else "—",
                "video_name": video["name"] if video else "—",
                "scene": next(
                    (s["title"] for s in pack["setlist"] if s["start"] <= cue["at"] < s["end"]),
                    pack["setlist"][-1]["title"],
                ),
            }
        )
    return rows


def cue_sheet_csv(pack: dict[str, Any], rejected: list[str] | None, accepted: str | None) -> str:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["number", "cue", "at", "timecode", "kind", "scene", "title", "detail", "look", "video", "fade_s", "owner", "status", "safety"])
    for c in cue_rows(pack, rejected, accepted):
        writer.writerow(
            [c["number"], c["id"], c["at"], fmt_timecode(c["at"]), c["kind"], c["scene"], c["title"], c["detail"], c["look_name"], c["video_name"], c["fade"], c["owner"], c["status"], "yes" if c["safety"] else "no"]
        )
    return buf.getvalue()


def cue_sheet_html(
    pack: dict[str, Any],
    rejected: list[str] | None,
    accepted: str | None,
    signed_by: str = "Mara Voss",
) -> str:
    rows = cue_rows(pack, rejected, accepted)

    def esc(value: Any) -> str:
        return str(value).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    body = "".join(
        f"<tr class=\"{'warn' if c['safety'] else ''}\"><td>{c['number']}</td><td>{esc(c['id'])}</td>"
        f"<td>{fmt_timecode(c['at'])}</td><td>{esc(c['scene'])}</td><td><b>{esc(c['title'])}</b> — {esc(c['detail'])}"
        f"{' <b>SAFETY</b>' if c['safety'] else ''}</td><td>{esc(c['look_name'])}</td><td>{esc(c['video_name'])}</td>"
        f"<td>{c['fade']}s</td><td>{esc(c['owner'])}</td><td>{c['status']}</td></tr>"
        for c in rows
    )
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><title>CUE — {esc(pack['project']['artist'])} — Cue sheet</title>
<style>@page{{size:A4 landscape;margin:12mm}}body{{font:10px/1.45 Arial,sans-serif;color:#111}}h1{{font-size:20px;letter-spacing:.08em;margin:0}}
header{{display:flex;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:8px;margin-bottom:10px}}table{{width:100%;border-collapse:collapse}}
th{{text-align:left;font-size:8px;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #111;padding:5px 4px}}
td{{border-bottom:.5px solid #ccc;padding:5px 4px;vertical-align:top}}.warn{{background:#fff3cd}}.foot{{display:flex;justify-content:space-between;margin-top:12px;font-size:8px;color:#555}}</style></head>
<body><header><div><h1>CUE — {esc(pack['project']['artist'])} / {esc(pack['project']['title'])}</h1>
<div style="font-size:10px;color:#444;margin-top:4px">{esc(pack['project']['tour'])} · {esc(pack['project']['productionCompany'])} · {esc(pack['project']['version'])}</div></div>
<div style="text-align:right;font-size:9px;color:#444">Designer {esc(pack['project']['designer'])}<br>Producer {esc(pack['project']['producer'])}<br>Safety sign-off: {esc(signed_by)}</div></header>
<table><thead><tr><th>#</th><th>Cue</th><th>At</th><th>Scene</th><th>Title and action</th><th>Look</th><th>Video</th><th>Fade</th><th>Owner</th><th>Status</th></tr></thead><tbody>{body}</tbody></table>
<div class="foot"><span>No cue is released to the venue without a human signature.</span><span>Generated by CUE · {datetime.now().date().isoformat()}</span></div></body></html>"""


# ------------------------------------------------------------------ checks


def _check(
    cid: str,
    kind: str,
    status: str,
    title: str,
    detail: str,
    metric: float,
    limit: float,
    unit: str,
    evidence: list[dict[str, Any]] | None = None,
    look_id: str | None = None,
) -> dict[str, Any]:
    return {
        "id": cid,
        "kind": kind,
        "status": status,
        "title": title,
        "detail": detail,
        "metric": metric,
        "limit": limit,
        "unit": unit,
        "evidence": evidence or [],
        "look_id": look_id,
    }


def rights_check(pack: dict[str, Any], date_id: str | None) -> dict[str, Any]:
    d = _date(pack, date_id) or _date(pack, "d-home")
    rights = next((r for r in pack["rights"] if r["kind"] == "video" and r["status"] != "expired"), None)
    if not d or not rights:
        return _check("rights", "rights", "pass", "No rights window applies", "No dated content.", 0, 0, "days")
    days = (date.fromisoformat(rights["to"]) - date.fromisoformat(d["date"])).days
    status = "fail" if days < 0 else "warn" if days < 7 else "pass"
    return _check(
        "rights",
        "rights",
        status,
        "Content rights expire before this show" if days < 0 else "Content rights cover this show",
        f"{rights['asset']} is cleared to {rights['to']}. {d['city']} is {d['date']}.",
        days,
        0,
        "days",
        [{"id": rights["id"], "label": rights["licence"], "source": rights["source"], "kind": "rights"}],
    )


def schedule_check(pack: dict[str, Any], date_id: str | None) -> dict[str, Any]:
    d = _date(pack, date_id) or _date(pack, "d-home")
    venue = _venue(pack, d["venueId"]) if d else None
    if not d or not venue:
        return _check("schedule", "schedule", "pass", "Schedule", "No date selected.", 0, 0, "cues")
    per_hour = len(pack["cues"]) / venue["loadInHours"]
    status = "fail" if per_hour > 5.5 else "warn" if per_hour > 4.5 else "pass"
    return _check(
        "schedule",
        "schedule",
        status,
        "Load-in time fits the cue sheet",
        f"{len(pack['cues'])} cues in a {venue['loadInHours']} h load-in ({per_hour:.1f} cues/h). Benchmark 4.5.",
        round(per_hour, 2),
        4.5,
        "cues/h",
        [{"id": d["id"], "label": f"{d['city']} load-in {venue['loadInHours']} h", "source": "Tour calendar", "kind": "schedule"}],
    )


def venue_fit_check(pack: dict[str, Any], venue_id: str | None) -> dict[str, Any]:
    venue = _venue(pack, venue_id) or _venue(pack, pack["project"]["venueId"])
    if not venue:
        return _check("venue", "venue", "pass", "Venue fit", "No venue selected.", 0, 0, "m")
    dw = venue["stage"]["width"] - pack["stage"]["width"]
    dd = venue["stage"]["depth"] - pack["stage"]["depth"]
    dt = venue["stage"]["trim"] - pack["stage"]["trim"]
    status = "fail" if dw < -0.5 or dd < -0.5 else "warn" if dw < 0 or dd < 0 or dt < 0 else "pass"
    return _check(
        "venue",
        "venue",
        status,
        "Stage geometry fits the design" if status == "pass" else "Stage is smaller than the design",
        f"Venue {venue['stage']['width']} × {venue['stage']['depth']} m / {venue['stage']['trim']} m trim vs design "
        f"{pack['stage']['width']} × {pack['stage']['depth']} m / {pack['stage']['trim']} m.",
        min(dw, dd, dt),
        0,
        "m",
        [{"id": venue["id"], "label": f"{venue['name']} · {venue['stage']['width']} × {venue['stage']['depth']} m", "source": venue["lastVerified"], "kind": "venue"}],
    )


def data_freshness_check(pack: dict[str, Any], venue_id: str | None, anchor: str | None = None) -> dict[str, Any]:
    venue = _venue(pack, venue_id) or _venue(pack, pack["project"]["venueId"])
    if not venue:
        return _check("data", "data", "pass", "Venue data", "No venue selected.", 0, 0, "months")
    anchor_date = date.fromisoformat((anchor or pack["project"]["anchor"])[:10])
    months = (anchor_date - date.fromisoformat(venue["lastVerified"])).days / 30.4
    status = "fail" if venue["status"] == "missing" or months > FRESHNESS_MONTHS * 2 else "warn" if months > FRESHNESS_MONTHS else "pass"
    return _check(
        "data",
        "data",
        status,
        "Venue data is inside the freshness contract",
        f"{venue['name']} last verified {venue['lastVerified']} by {venue['verifiedBy']} ({months:.0f} months).",
        round(months, 1),
        FRESHNESS_MONTHS,
        "months",
        [{"id": venue["id"], "label": f"Verified {venue['lastVerified']}", "source": venue["verifiedBy"], "kind": "venue"}],
    )


def sightline_check(pack: dict[str, Any], venue_id: str | None) -> dict[str, Any]:
    venue = _venue(pack, venue_id) or _venue(pack, pack["project"]["venueId"])
    if not venue:
        return _check("sightline", "sightline", "pass", "Sightlines", "No venue selected.", 0, 0, "m")
    clearance = pack["stage"]["screen"]["z"] - venue["frontRow"]["eyeHeight"]
    status = "fail" if clearance < 0 else "warn" if clearance < 0.2 else "pass"
    return _check(
        "sightline",
        "sightline",
        status,
        "Front row can see the artist and the screen edge",
        f"Screen bottom {pack['stage']['screen']['z']:.2f} m, front-row eye {venue['frontRow']['eyeHeight']:.2f} m at "
        f"{venue['frontRow']['distance']} m. Clearance {clearance:.2f} m.",
        round(clearance, 2),
        0.2,
        "m",
        [{"id": venue["id"], "label": f"Front row {venue['frontRow']['distance']} m", "source": "Venue profile", "kind": "venue"}],
    )


def checks_for(
    pack: dict[str, Any],
    look_id: str | None,
    venue_id: str | None = None,
    date_id: str | None = "d-home",
) -> list[dict[str, Any]]:
    look = _look(pack, look_id)
    stats = look_stats(pack, look_id) if look else None
    out: list[dict[str, Any]] = []
    if look and stats:
        status = "fail" if stats["supply_pct"] > 1 else "warn" if stats["supply_pct"] > 0.9 else "pass"
        out.append(
            _check(
                "power",
                "power",
                status,
                "The look exceeds the house supply" if status == "fail" else "Power is inside the house supply",
                f"{stats['power_kw']:.1f} kW drawn of {pack['rig']['power']['kw']} kW ({stats['supply_pct'] * 100:.0f}%).",
                stats["supply_pct"],
                1,
                "×",
                [{"id": "cit-power", "label": "63 A three-phase supply", "source": "Venue profile — Halcyon Hall", "kind": "venue"}],
                look["id"],
            )
        )
        status = "fail" if stats["weight_pct"] > 1 else "warn" if stats["weight_pct"] > 0.9 else "pass"
        out.append(
            _check(
                "weight",
                "weight",
                status,
                "The front truss is over its rating" if status == "fail" else "Truss loads are inside the rating",
                f"{stats['front_kg']} kg on the front truss of {stats['front_capacity_kg']} kg ({stats['weight_pct'] * 100:.0f}%). Cable included.",
                stats["weight_pct"],
                1,
                "×",
                [{"id": "cit-rig", "label": "Front truss capacity", "source": "Rig schedule v3", "kind": "rig"}],
                look["id"],
            )
        )
        status = "fail" if stats["glare"] > GLARE_LIMIT else "warn" if stats["glare"] > GLARE_LIMIT * 0.8 else "pass"
        out.append(
            _check(
                "glare",
                "glare",
                status,
                "The look blinds the front row" if status == "fail" else "No fixture aims below the eyeline",
                f"Glare index {stats['glare']:.2f} against a limit of {GLARE_LIMIT:.2f}. {look['audienceAim']} fixture(s) aimed at the audience.",
                stats["glare"],
                GLARE_LIMIT,
                "index",
                [{"id": "cit-eye", "label": "Front row eye height and distance", "source": "Sightline model v2", "kind": "venue"}],
                look["id"],
            )
        )
    out.extend(
        [
            sightline_check(pack, venue_id),
            venue_fit_check(pack, venue_id),
            data_freshness_check(pack, venue_id),
            rights_check(pack, date_id),
            schedule_check(pack, date_id),
        ]
    )
    conflicts = cue_conflicts(pack)
    out.append(
        _check(
            "cue-timing",
            "cue",
            "warn" if conflicts else "pass",
            "Two cue numbers collide" if conflicts else "Cue timing is clean",
            f"{conflicts[0]['a']['id']} and {conflicts[0]['b']['id']} are {conflicts[0]['gap']} s apart." if conflicts else f"{len(pack['cues'])} cues, no collision.",
            len(conflicts),
            0,
            "collisions",
            [{"id": "cit-cue", "label": "Cue sheet v4", "source": "Show v5", "kind": "cue"}],
        )
    )
    missing = missing_asset_cues(pack)
    out.append(
        _check(
            "asset",
            "asset",
            "fail" if missing else "pass",
            "A cue references a missing clip" if missing else "Every cue asset is delivered",
            f"{', '.join(c['id'] for c in missing)} reference a missing clip." if missing else f"{len(pack['videos'])} clips delivered.",
            len(missing),
            0,
            "cues",
            [{"id": "cit-asset", "label": "Asset register", "source": "DAM link", "kind": "asset"}],
        )
    )
    if look and stats:
        over = stats["budget_total"] - pack["budget"]["approved"]
        out.append(
            _check(
                "budget",
                "budget",
                "warn" if over > 0 else "pass",
                "The active look puts the show over budget" if over > 0 else "The show is inside the approved budget",
                f"{fmt_money(stats['budget_total'])} against {fmt_money(pack['budget']['approved'])} approved ({fmt_money(over)}).",
                stats["budget_total"],
                pack["budget"]["approved"],
                "EUR",
                [{"id": "cit-budget", "label": "Budget model v2", "source": "Rate card 2026", "kind": "budget"}],
                look["id"],
            )
        )
    return out


# ------------------------------------------------------------------ readiness


def risk_open(risk: dict[str, Any]) -> bool:
    return risk.get("state") not in {"resolved", "dismissed"}


def risk_stats(risks: list[dict[str, Any]]) -> dict[str, int]:
    open_risks = [r for r in risks if risk_open(r)]
    return {
        "open": len(open_risks),
        "critical": sum(1 for r in open_risks if r["severity"] == "critical"),
        "high": sum(1 for r in open_risks if r["severity"] == "high"),
        "medium": sum(1 for r in open_risks if r["severity"] == "medium"),
        "low": sum(1 for r in open_risks if r["severity"] == "low"),
        "resolved": sum(1 for r in risks if r["state"] == "resolved"),
        "dismissed": sum(1 for r in risks if r["state"] == "dismissed"),
        "exposure": sum(int(r.get("fix", {}).get("cost", 0)) for r in open_risks),
    }


def risk_brief(pack: dict[str, Any], risks: list[dict[str, Any]], next_date: dict[str, Any]) -> dict[str, Any]:
    open_risks = sorted(
        [r for r in risks if risk_open(r)],
        key=lambda r: ({"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}.get(r["severity"], 5), r["due"]),
    )
    return {
        "title": f"Show-week brief · {next_date['city']} · {next_date['date']}",
        "summary": f"{len(open_risks)} open risks, {sum(1 for r in open_risks if r['severity'] == 'critical')} critical. {next_date['date']}.",
        "top": open_risks[:5],
        "approvals_due": [],
        "fixed_not_verified": [r for r in risks if r["state"] == "resolved" and not r.get("verifiedAt")],
        "coverage": [
            v["name"] for v in pack["venues"] if v["status"] != "verified"
        ],
        "generated_by": "CUE readiness · shadow mode",
    }


def pack_json(pack: dict[str, Any]) -> str:
    return json.dumps(pack, ensure_ascii=False)
