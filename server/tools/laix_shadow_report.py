"""Read a LAIX shadow JSONL log and print what the two layers agreed on.

Read-only: no database, no API, no writes.

    py server/tools/laix_shadow_report.py shadow.jsonl
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path
from typing import Any


def read_lines(path: Path) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    with path.open(encoding="utf-8") as handle:
        for number, raw in enumerate(handle, start=1):
            line = raw.strip()
            if not line:
                continue
            try:
                event = json.loads(line)
            except json.JSONDecodeError as exc:
                raise SystemExit(f"{path}:{number}: not JSON ({exc})") from exc
            if isinstance(event, dict):
                events.append(event)
    return events


def ratio(part: int, whole: int) -> str:
    return f"{part}/{whole} ({part / whole:.0%})" if whole else f"{part}/{whole} (-)"


def build_report(events: list[dict[str, Any]]) -> dict[str, Any]:
    scans = [event for event in events if event.get("event") == "laix.shadow.scan"]
    signals = [event for event in events if event.get("event") == "laix.shadow.signal"]
    errors = [event for event in events if event.get("error")]

    raw = sum(1 for event in signals if event.get("raw_agreement") is True)
    semantic = sum(1 for event in signals if event.get("semantic_agreement") is True)

    groups: Counter[str] = Counter()
    examples: dict[str, str] = {}
    for event in signals:
        if event.get("raw_agreement") is True:
            continue
        native = event.get("native", {})
        laix = event.get("laix", {})
        pair = f"{native.get('action', '?')}->{laix.get('verb', '?')}"
        groups[pair] += 1
        examples.setdefault(pair, str(event.get("signal_id", "")))

    return {
        "scans": len(scans),
        "signals": len(signals),
        "raw_agreement": raw,
        "semantic_agreement": semantic,
        "groups": dict(groups.most_common()),
        "examples": examples,
        "errors": [str(event.get("error")) for event in errors],
        "versions": sorted({json.dumps(event.get("policy_versions", {}), sort_keys=True) for event in signals + scans}),
    }


def render(report: dict[str, Any]) -> str:
    lines = [
        f"scans               {report['scans']}",
        f"signals compared    {report['signals']}",
        f"raw agreement       {ratio(report['raw_agreement'], report['signals'])}",
        f"semantic agreement  {ratio(report['semantic_agreement'], report['signals'])}",
    ]
    if report["groups"]:
        lines.append("")
        lines.append("disagreements (native -> laix)")
        for pair, count in report["groups"].items():
            lines.append(f"  {pair:<28} {count:>4}   e.g. {report['examples'].get(pair, '')}")
    if report["errors"]:
        lines.append("")
        lines.append("errors")
        for error in report["errors"]:
            lines.append(f"  {error}")
    if report["versions"]:
        lines.append("")
        lines.append("policy versions")
        for version in report["versions"]:
            lines.append(f"  {version}")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Summarise a LAIX shadow JSONL log.")
    parser.add_argument("path", type=Path, help="JSONL file written through CUE_LAIX_LOG")
    parser.add_argument("--json", action="store_true", help="print the summary as JSON")
    args = parser.parse_args(argv)

    if not args.path.is_file():
        print(f"no such file: {args.path}", file=sys.stderr)
        return 2

    report = build_report(read_lines(args.path))
    print(json.dumps(report, indent=2, sort_keys=True) if args.json else render(report))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
