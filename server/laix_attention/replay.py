"""Replay and benchmark: run recorded cases against the policy.

The vectors are plain JSON so a second implementation in another language can
consume the same file. That is the point: one contract, many runtimes.
"""

from __future__ import annotations

import json
from collections.abc import Iterable, Mapping
from datetime import datetime
from pathlib import Path
from typing import Any

from .model import ACTIONS, FEEDBACK_STATES, SEVERITY_RANK, Context, Escalation, Feedback, Intent, Signal
from .policy import REASONS, decide
from .timing import parse_range

FIELDS = ("action", "reason", "deliver", "record", "score")


def context_from(payload: Mapping[str, Any]) -> Context:
    raw = payload.get("now")
    if not raw:
        raise ValueError("a case context needs `now`")
    now = datetime.fromisoformat(str(raw))
    sent = payload.get("sent") or []
    feedback = {
        str(key): Feedback(state=str(value.get("state", "")), at=value.get("at"), until=value.get("until"), note=value.get("note"))
        for key, value in (payload.get("feedback") or {}).items()
    }
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
        feedback=feedback,
        escalate_after_hours=payload.get("escalateAfterHours"),
        learned=dict(payload.get("learned", {})),
        allow_act=bool(payload.get("allowAct", False)),
    )


def signal_from(payload: Mapping[str, Any]) -> Signal:
    intent = payload.get("intent")
    escalation = payload.get("escalation")
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
        intent=Intent(str(intent["capability"]), dict(intent.get("args", {}))) if intent else None,
        reversible=bool(payload.get("reversible", False)),
        escalation=Escalation(str(escalation["target"]), str(escalation.get("reason", ""))) if escalation else None,
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
            if field in want and want.get(field) != got.get(field):
                problems.append(
                    f"{case.get('id')} · {want.get('signalId')}: {field} expected {want.get(field)!r}, got {got.get(field)!r}"
                )
    return problems


def run_vectors(document: Mapping[str, Any]) -> list[str]:
    return [problem for case in document.get("cases", []) for problem in compare(case)]


def load_vectors(path: str | Path) -> dict[str, Any]:
    return json.loads(Path(path).read_text(encoding="utf-8"))


# --------------------------------------------------------------------------- validation


def _check_signal(payload: Mapping[str, Any], where: str, problems: list[str]) -> None:
    severity = payload.get("severity", "low")
    if severity not in SEVERITY_RANK:
        problems.append(f"{where}: unknown severity {severity!r}")
    if not isinstance(payload.get("id"), str) or not payload["id"]:
        problems.append(f"{where}: signal id must be a non-empty string")
    intent = payload.get("intent")
    if intent is not None and not isinstance(intent.get("capability"), str):
        problems.append(f"{where}: intent needs a string capability")
    escalation = payload.get("escalation")
    if escalation is not None and not isinstance(escalation.get("target"), str):
        problems.append(f"{where}: escalation needs a string target")


def _check_context(payload: Mapping[str, Any], where: str, problems: list[str]) -> None:
    if "now" not in payload:
        problems.append(f"{where}: context needs `now`")
    feedback = payload.get("feedback") or {}
    for key, value in feedback.items():
        state = value.get("state")
        if state not in FEEDBACK_STATES:
            problems.append(f"{where}: feedback[{key}] has unknown state {state!r}")


def validate_document(document: Mapping[str, Any]) -> list[str]:
    """Checks the vector file against the vocabulary in this module.

    Deliberately small and dependency-free: a second implementation can copy it.
    """
    problems: list[str] = []
    if document.get("contract") != "laix-attention":
        problems.append("not a laix-attention contract file")
    if not document.get("version"):
        problems.append("missing contract version")
    cases = document.get("cases")
    if not isinstance(cases, list) or not cases:
        problems.append("cases must be a non-empty list")
        return problems

    for case in cases:
        where = str(case.get("id", "?"))
        if not isinstance(case.get("context"), Mapping):
            problems.append(f"{where}: missing context")
            continue
        _check_context(case["context"], where, problems)
        signals = case.get("signals")
        if not isinstance(signals, list) or not signals:
            problems.append(f"{where}: signals must be a non-empty list")
            continue
        for signal in signals:
            _check_signal(signal, where, problems)
        expected = case.get("expected")
        if not isinstance(expected, list) or len(expected) != len(signals):
            problems.append(f"{where}: expected must have one decision per signal")
            continue
        for want in expected:
            if want.get("action") not in ACTIONS:
                problems.append(f"{where}: unknown action {want.get('action')!r}")
            if want.get("reason") not in REASONS:
                problems.append(f"{where}: unknown reason {want.get('reason')!r}")
            if not isinstance(want.get("score"), (int, float)):
                problems.append(f"{where}: expected score must be numeric")
            for field in ("deliver", "record"):
                if not isinstance(want.get(field), bool):
                    problems.append(f"{where}: expected {field} must be a boolean")
    return problems


# --------------------------------------------------------------------------- benchmark


def _delivers(name: str, signal: Signal, context: Context) -> bool:
    if name == "always_notify":
        return True
    if name == "severity_only":
        return SEVERITY_RANK.get(signal.severity, 9) <= SEVERITY_RANK.get(context.min_severity, 9)
    return decide([signal], context)[0].deliver


POLICIES: tuple[str, ...] = ("policy", "severity_only", "always_notify")


def benchmark(document: Mapping[str, Any]) -> dict[str, Any]:
    """Score the policy against two baselines on labelled cases.

    A label is what the app later learned: ``helpful``, ``harmful`` or ``neutral``.
    """
    cases = document.get("cases", [])
    rows: dict[str, dict[str, float | int]] = {}
    for name in POLICIES:
        raised = helped = harmful = neutral = missed = 0
        for case in cases:
            context = context_from(case["context"])
            signal = signal_from(case["signal"])
            label = str(case.get("label", "neutral"))
            if _delivers(name, signal, context):
                raised += 1
                if label == "helpful":
                    helped += 1
                elif label == "harmful":
                    harmful += 1
                else:
                    neutral += 1
            elif label == "helpful":
                missed += 1
        rows[name] = {
            "raised": raised,
            "helped": helped,
            "harmful": harmful,
            "neutral": neutral,
            "missed_helpful": missed,
            "precision": round(helped / raised, 3) if raised else 0.0,
            "hazard": round(harmful / raised, 3) if raised else 0.0,
            "recall": round(helped / (helped + missed), 3) if (helped + missed) else 0.0,
        }
    return {
        "contract": "laix-attention-bench",
        "version": document.get("version", ""),
        "cases": len(cases),
        "rows": rows,
        "note": document.get("note", ""),
    }


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
