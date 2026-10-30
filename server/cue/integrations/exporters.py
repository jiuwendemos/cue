"""Real export files for the tools crews already use.

These are deliberately small and documented formats: iCalendar, CSV, XML and a
minimal MVR exchange ZIP. They are not vendor-certified; the pilot replaces a
reference adapter with the vendor's own schema and a round-trip test.
"""

from __future__ import annotations

import csv
import io
import json
import zipfile
from datetime import datetime, timedelta
from typing import Any

from ..engine.show import cue_rows, fmt_clock


def _csv(rows: list[list[Any]]) -> str:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerows(rows)
    return buf.getvalue()


def ics(pack: dict[str, Any]) -> str:
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//CUE//Night Signal//EN",
        "CALSCALE:GREGORIAN",
    ]
    for date in pack["dates"]:
        venue = next((v for v in pack["venues"] if v["id"] == date["venueId"]), None)
        start = datetime.fromisoformat(date["show"])
        end = start + timedelta(hours=2)
        lines += [
            "BEGIN:VEVENT",
            f"UID:{date['id']}@cue.local",
            f"DTSTAMP:{datetime.now().strftime('%Y%m%dT%H%M%SZ')}",
            f"DTSTART:{start.strftime('%Y%m%dT%H%M%S')}",
            f"DTEND:{end.strftime('%Y%m%dT%H%M%S')}",
            f"SUMMARY:{pack['project']['artist']} — {pack['project']['title']} — {date['city']}",
            f"LOCATION:{venue['name'] + ', ' + venue['city'] if venue else date['city']}",
            f"DESCRIPTION:Load-in {date['loadIn']}. Curfew {date['curfew']}. Cue sheet version {pack['project']['version']}.",
            "END:VEVENT",
        ]
    lines.append("END:VCALENDAR")
    return "\r\n".join(lines) + "\r\n"


def grandma3_csv(pack: dict[str, Any], rejected: list[str] | None = None, accepted: str | None = None) -> str:
    rows = [["Cue", "Name", "Trigger", "Fade", "Delay", "Command", "Page", "Executor", "Note"]]
    for cue in cue_rows(pack, rejected, accepted):
        rows.append(
            [
                cue["number"],
                cue["title"],
                f"Time {fmt_clock(cue['at'])}",
                cue["fade"],
                0,
                cue["detail"],
                cue["kind"],
                1,
                f"{cue['id']} · {cue['look_name']}",
            ]
        )
    return _csv(rows)


def grandma3_xml(pack: dict[str, Any], rejected: list[str] | None = None, accepted: str | None = None) -> str:
    cues = []
    for cue in cue_rows(pack, rejected, accepted):
        cues.append(
            f'  <Cue number="{cue["number"]}" name="{_xml(cue["title"])}" time="{cue["at"]}" fade="{cue["fade"]}" kind="{cue["kind"]}" look="{_xml(cue["look_name"])}" />'
        )
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<CueSheet show="{_xml(pack["project"]["title"])}" artist="{_xml(pack["project"]["artist"])}" version="{pack["project"]["version"]}">\n'
        + "\n".join(cues)
        + "\n</CueSheet>\n"
    )


def resolume_csv(pack: dict[str, Any]) -> str:
    rows = [["Clip", "Layer", "Mapping", "In", "Out", "Transition", "Status", "Note"]]
    for video in pack["videos"]:
        rows.append([video["clip"], video["name"], video["mapping"], 0, video["duration"], video["transition"], video["status"], video["note"]])
    return _csv(rows)


def vectorworks_csv(pack: dict[str, Any]) -> str:
    rows = [["id", "label", "kind", "truss", "x", "y", "z", "watts", "weight_kg", "beam_angle", "universe", "address", "rental"]]
    for fixture in pack["rig"]["fixtures"]:
        rows.append(
            [
                fixture["id"],
                fixture["label"],
                fixture["kind"],
                fixture["truss"],
                fixture["x"],
                fixture["y"],
                fixture["z"],
                fixture["watts"],
                fixture["weightKg"],
                fixture["beamAngle"],
                fixture["universe"],
                fixture["address"],
                fixture["rental"],
            ]
        )
    return _csv(rows)


def mvr_zip(pack: dict[str, Any]) -> bytes:
    """A minimal exchange package.

    MVR is a ZIP with an XML scene description. This package speaks the same
    shape for a pilot handoff but is not certified by a vendor.
    """
    scene = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<GeneralSceneDescription version="1.0">\n'
        f'  <Scene name="{_xml(pack["project"]["title"])}">\n'
        f'    <Stage width="{pack["stage"]["width"]}" depth="{pack["stage"]["depth"]}" trim="{pack["stage"]["trim"]}" />\n'
        + "".join(
            f'    <Fixture id="{f["id"]}" name="{_xml(f["label"])}" type="{f["kind"]}" truss="{f["truss"]}" x="{f["x"]}" y="{f["y"]}" z="{f["z"]}" />\n'
            for f in pack["rig"]["fixtures"]
        )
        + "  </Scene>\n</GeneralSceneDescription>\n"
    )
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("GeneralSceneDescription.xml", scene)
        archive.writestr("CueSheet.csv", grandma3_csv(pack))
        archive.writestr("Fixtures.csv", vectorworks_csv(pack))
        archive.writestr(
            "README.txt",
            "CUE exchange package for a pilot handoff. Not vendor-certified. "
            f"Show {pack['project']['version']} · {len(pack['rig']['fixtures'])} fixtures · {len(pack['cues'])} cues.\n",
        )
    return buf.getvalue()


def parse_vectorworks_csv(text: str) -> list[dict[str, Any]]:
    reader = csv.DictReader(io.StringIO(text))
    required = {"id", "label", "kind", "truss"}
    rows = []
    for row in reader:
        if not required.issubset({key.strip() for key in row if key}):
            continue
        rows.append(
            {
                "id": row.get("id", "").strip(),
                "label": row.get("label", "").strip(),
                "kind": row.get("kind", "").strip(),
                "truss": row.get("truss", "").strip(),
                "x": _float(row.get("x")),
                "y": _float(row.get("y")),
                "z": _float(row.get("z")),
                "watts": _float(row.get("watts")),
                "weight_kg": _float(row.get("weight_kg")),
                "universe": _float(row.get("universe")),
                "address": _float(row.get("address")),
            }
        )
    return rows


def parse_grandma3_csv(text: str) -> list[dict[str, Any]]:
    reader = csv.DictReader(io.StringIO(text))
    rows = []
    for row in reader:
        if not row.get("Cue"):
            continue
        rows.append(
            {
                "cue": _float(row.get("Cue")),
                "name": row.get("Name", "").strip(),
                "trigger": row.get("Trigger", "").strip(),
                "fade": _float(row.get("Fade")),
                "command": row.get("Command", "").strip(),
                "page": row.get("Page", "").strip(),
                "note": row.get("Note", "").strip(),
            }
        )
    return rows


def _float(value: Any) -> float:
    try:
        return float(str(value).strip())
    except (TypeError, ValueError):
        return 0.0


def export_bundle(pack: dict[str, Any]) -> dict[str, Any]:
    return {
        "show": pack["project"],
        "fixtures": len(pack["rig"]["fixtures"]),
        "cues": len(pack["cues"]),
        "ics": ics(pack),
        "grandma3_csv": grandma3_csv(pack),
        "grandma3_xml": grandma3_xml(pack),
        "resolume_csv": resolume_csv(pack),
        "vectorworks_csv": vectorworks_csv(pack),
        "mvr_bytes": len(mvr_zip(pack)),
        "schema": json.loads(json.dumps({"version": "pilot-1", "note": "CSV/XML/ICS/MVR exchange; no live control."})),
    }


def _xml(value: Any) -> str:
    return str(value).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")
