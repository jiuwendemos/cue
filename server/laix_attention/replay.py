"""Replay: run recorded cases against the policy, for tests and benchmarks.

The vectors are plain JSON so a second implementation in another language can
consume the same file. That is the point: one contract, many runtimes.
"""

from __future__ import annotations

import json
from collections.abc import Iterable, Mapping
from datetime import datetime
from pathlib import Path
from typing import Any

from .model import Context, Signal
from .policy import decide
from .timing import parse_range

FIELDS = ("action", "reason", "deliver", "record", "score")


def context_from(payload: Mapping[str, Any]) -> Context:
    raw = payload.get("now")
    if not raw:
        raise ValueError("a case context needs `now`")
    now = datetime.fromisoformat(str(raw))
    sent = payload.get("sent") or []
    return Context(
        now=now,
        quiet_hours=parse_range(payload.get("quietHours", "22:00-06:00")),
        mode=str(payload.get("mode", "shadow")),
        stopped=bool(payload.get("stopped", False)),
        min_severity=str(payload.get("minSeverity", "high")),
        min_confidence=float(payload.get("minConfidence", 0.0)),
        muted_kinds=tuple(payload.get("mutedKinds", ())),
        interruption_budget=payload.get("interruptionBudget"),
        sent=frozenset(str(item) for item in sent),
        escalate_after_hours=payload.get("escalateAfterHours"),
        learned=dict(payload.get("learned", {})),
    )


def signal_from(payload: Mapping[str, Any]) -> Signal:
    return Signal(
        id=str(payload["id"]),
        kind=str(payload.get("kind", "signal")),
        title=str(payload.get("title", "")),
        detail=str(payload.get("detail", "")),
        severity=str(payload.get("severity", "low")),
        confidence=float(payload.get("confidence", 0.5)),
        due=payload.get("due"),
        evidence_refs=tuple(str(item) for item in payload.get("evidenceRefs", ())),
        group_key=payload.get("groupKey"),
        interruption_cost=float(payload.get("interruptionCost", 0.0)),
        requires_approval=bool(payload.get("requiresApproval", False)),
    )


def run_case(case: Mapping[str, Any]) -> list[dict[str, Any]]:
    context = context_from(case["context"])
    signals = [signal_from(item) for item in case.get("signals", [])]
    return [decision.as_dict() for decision in decide(signals, context)]


def compare(case: Mapping[str, Any]) -> list[str]:
    """Return a list of human-readable mismatches; empty means the case passed."""
    expected = case.get("expected", [])
    actual = run_case(case)
    problems: list[str] = []
    if len(expected) != len(actual):
        problems.append(f"{case.get('id')}: expected {len(expected)} decisions, got {len(actual)}")
        return problems
    for want, got in zip(expected, actual):
        for field in FIELDS:
            if want.get(field) != got.get(field):
                problems.append(
                    f"{case.get('id')} · {want.get('signalId')}: {field} expected {want.get(field)!r}, got {got.get(field)!r}"
                )
    return problems


def run_vectors(document: Mapping[str, Any]) -> list[str]:
    problems: list[str] = []
    for case in document.get("cases", []):
        problems.extend(compare(case))
    return problems


def load_vectors(path: str | Path) -> dict[str, Any]:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def precision_recall(detected: Iterable[str], known: Iterable[str]) -> dict[str, float | int]:
    """Generic detection quality, used by a replay/backtest over past runs."""
    detected_set = set(detected)
    known_set = set(known)
    matched = len(detected_set & known_set)
    precision = matched / len(detected_set) if detected_set else 1.0
    recall = matched / len(known_set) if known_set else 1.0
    return {
        "detected": len(detected_set),
        "known": len(known_set),
        "matched": matched,
        "precision": round(precision, 2),
        "recall": round(recall, 2),
    }
