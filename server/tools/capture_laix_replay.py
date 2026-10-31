"""Capture the golden replay fixture from the current CUE deployment.

This script is **not** part of the package: it needs CUE, and the package must
never import the app. It records what the shipped policy actually decides, so a
later change to the golden file shows up as a diff.

    cd server
    PYTHONPATH=. python tools/capture_laix_replay.py

Determinism: the bench cases are copied verbatim, and the CUE signals are reduced
to stable fields. Wall-clock values are stripped:

- ``due`` is removed from scan candidates, because most candidates default it to
  ``now_iso()`` at detection time;
- every case gets the same frozen ``now``;
- only severity, confidence, kind, group key and evidence ids are kept.

Scores are therefore recomputed against the frozen clock and are stable.
"""

from __future__ import annotations

import json
from pathlib import Path

from cue.proactive import scanner
from laix_attention import context_from, decide, signal_from

ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / "cue" / "data" / "show.json"
BENCH = ROOT / "laix_attention" / "contract" / "bench.v1.json"
OUT = ROOT / "laix_attention" / "fixtures" / "replay.json"

NOW = "2026-11-01T10:00:00+02:00"
CONTEXT = {"now": NOW, "quietHours": "22:00-06:00"}
CAPTURED_FROM = "cue@a4c6bef"


def bench_cases() -> list[dict]:
    document = json.loads(BENCH.read_text(encoding="utf-8"))
    return [
        {"id": f"bench:{case['id']}", "context": case["context"], "signals": [case["signal"]]}
        for case in document["cases"]
    ]


def cue_cases() -> list[dict]:
    pack = json.loads(PACK.read_text(encoding="utf-8"))
    cases: list[dict] = []

    for candidate in scanner.detect_candidates(pack):
        case_id = f"cue:{candidate['kind']}:{candidate['groupKey']}"
        cases.append(
            {
                "id": case_id,
                "context": dict(CONTEXT),
                "signals": [
                    {
                        "id": candidate["id"],
                        "kind": candidate["kind"],
                        "title": candidate["title"],
                        "severity": candidate["severity"],
                        "confidence": round(float(candidate["confidence"]), 2),
                        "groupKey": candidate["groupKey"],
                        "evidenceRefs": [item["id"] for item in candidate["evidence"]],
                    }
                ],
            }
        )

    # Two closed-form risks from the demo pack, for severity variety.
    ordered = sorted(
        pack["risks"],
        key=lambda risk: ({"critical": 0, "high": 1, "medium": 2, "low": 3}.get(risk.get("severity"), 9), risk["id"]),
    )
    seen_kinds = {case["signals"][0]["kind"] for case in cases}
    picked = []
    for risk in ordered:
        if risk.get("kind") in seen_kinds:
            continue
        picked.append(risk)
        seen_kinds.add(risk.get("kind"))
        if len(picked) == 2:
            break
    if len(picked) < 2:
        picked = ordered[:2]

    for risk in picked:
        cases.append(
            {
                "id": f"cue:risk:{risk['id']}",
                "context": dict(CONTEXT),
                "signals": [
                    {
                        "id": risk["id"],
                        "kind": risk.get("kind", "risk"),
                        "title": risk["title"],
                        "severity": risk["severity"],
                        "confidence": round(float(risk.get("confidence", 0.8)), 2),
                        "groupKey": risk.get("groupKey"),
                        "evidenceRefs": [],
                    }
                ],
            }
        )
    return cases


def with_expected(cases: list[dict]) -> list[dict]:
    for case in cases:
        context = context_from(case["context"])
        signals = [signal_from(payload) for payload in case["signals"]]
        decision = decide(signals, context)[0]
        case["expected"] = [
            {
                "action": decision.action,
                "reason": decision.reason,
                "deliver": decision.deliver,
                "record": decision.record,
                "score": round(decision.score, 2),
                "cost_of_waiting": round(decision.cost_of_waiting, 2),
                "undo_hint": decision.undo_hint,
            }
        ]
    return cases


def main() -> None:
    cases = with_expected(bench_cases() + cue_cases())
    cases.sort(key=lambda case: case["id"])
    document = {
        "contract": "laix-replay",
        "version": "1",
        "capturedFrom": CAPTURED_FROM,
        "cases": cases,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(document, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
    bench = sum(1 for case in cases if case["id"].startswith("bench:"))
    cue = sum(1 for case in cases if case["id"].startswith("cue:"))
    print(f"wrote {OUT.relative_to(ROOT)}: {len(cases)} cases ({bench} bench, {cue} cue) at {CAPTURED_FROM}")


if __name__ == "__main__":
    main()
