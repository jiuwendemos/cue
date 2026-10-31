"""Translate CUE's data into LAIX types.

LAIX receives generic fields only: no venue, no look, no cue. The mapping is
deliberately lossless for the fields LAIX models, and silent about the rest.

The adapter is one-way on purpose. LAIX returns a decision; it never returns a
CUE notification, and nothing here writes to the show store.
"""

from __future__ import annotations

from collections.abc import Mapping
from datetime import datetime
from typing import Any

from laix import Context, Feedback, Signal
from laix.attention import Escalation, Intent

#: LAIX and CUE use the same five levels. The mapping is identity, kept explicit
#: so an unknown value is visible instead of silently passed through.
SEVERITY_LEVELS: tuple[str, ...] = ("critical", "high", "medium", "low", "info")


def _field(source: Any, name: str, default: Any = None) -> Any:
    """Read a mapping key or an object attribute, so dicts and models both work."""
    if isinstance(source, Mapping):
        return source.get(name, default)
    return getattr(source, name, default)


def _severity(value: Any) -> str:
    text = str(value or "low").strip().lower()
    return text if text in SEVERITY_LEVELS else "low"


def _evidence_refs(candidate: Any) -> tuple[str, ...]:
    refs = _field(candidate, "evidence_refs")
    if refs is None:
        refs = _field(candidate, "evidenceRefs")
    if refs is not None:
        return tuple(str(ref) for ref in refs if ref)
    # CUE's scan candidates carry `evidence` as objects with an id.
    items = _field(candidate, "evidence") or ()
    ids = []
    for item in items:
        if isinstance(item, Mapping):
            identifier = item.get("id")
        else:
            identifier = item
        if identifier:
            ids.append(str(identifier))
    return tuple(ids)


def _intent(value: Any) -> Intent | None:
    if value is None:
        return None
    if isinstance(value, Mapping):
        return Intent(str(value.get("capability", "")), dict(value.get("args") or {}))
    return Intent(str(getattr(value, "capability", "")), dict(getattr(value, "args", {}) or {}))


def _escalation(value: Any) -> Escalation | None:
    if value is None:
        return None
    if isinstance(value, Mapping):
        return Escalation(str(value.get("target", "")), str(value.get("reason", "")))
    return Escalation(str(getattr(value, "target", "")), str(getattr(value, "reason", "")))


def to_signal(candidate: Any, now: datetime) -> Signal:
    """One CUE candidate (a dict from the scan, or any object) to one LAIX signal.

    ``now`` is accepted for symmetry with :func:`to_context`; the signal itself
    carries only absolute values, so nothing here reads the clock.
    """
    due = _field(candidate, "due")
    if isinstance(due, datetime):
        due = due.isoformat()

    confidence = _field(candidate, "confidence", 0.5)
    interruption = _field(candidate, "interruption_cost")
    if interruption is None:
        interruption = _field(candidate, "interruptionCost", 0.0)
    approval = _field(candidate, "requires_approval")
    if approval is None:
        approval = _field(candidate, "requiresApproval", False)

    return Signal(
        id=str(_field(candidate, "id", "")),
        kind=str(_field(candidate, "kind", "signal")),
        title=str(_field(candidate, "title", "") or ""),
        detail=str(_field(candidate, "detail", "") or ""),
        severity=_severity(_field(candidate, "severity", "low")),
        confidence=float(confidence if confidence is not None else 0.5),
        due=str(due) if due else None,
        evidence_refs=_evidence_refs(candidate),
        group_key=_field(candidate, "group_key") or _field(candidate, "groupKey"),
        interruption_cost=float(interruption or 0.0),
        requires_approval=bool(approval),
        intent=_intent(_field(candidate, "intent")),
        reversible=bool(_field(candidate, "reversible", False)),
        escalation=_escalation(_field(candidate, "escalation")),
    )


def _quiet_hours(raw: Any) -> tuple[str, str] | None:
    if raw is None:
        return None
    if isinstance(raw, (tuple, list)) and len(raw) == 2:
        return str(raw[0]), str(raw[1])
    text = str(raw).strip()
    if "-" not in text:
        return None
    start, _, end = text.partition("-")
    start, end = start.strip(), end.strip()
    return (start, end) if start and end else None


def to_context(settings: Mapping[str, Any], now: datetime) -> Context:
    """CUE's scan settings to a LAIX context.

    The scanner maps only what its native path applies (quiet hours, mode, stop
    switch, severity floor, already-sent keys, learned points). The optional
    limits are passed through when present — the replay fixture uses them — and
    left at LAIX's defaults otherwise.
    """
    sent = settings.get("sent") or ()
    learned = settings.get("learned") or {}
    feedback = {
        str(key): Feedback(
            state=str(value.get("state", "")),
            at=value.get("at"),
            until=value.get("until"),
            note=value.get("note"),
        )
        for key, value in (settings.get("feedback") or {}).items()
    }
    return Context(
        now=now,
        quiet_hours=_quiet_hours(settings.get("quietHours", "22:00-06:00")),
        mode=str(settings.get("mode", "shadow")),
        stopped=bool(settings.get("stopSwitch", False)),
        min_severity=_severity(settings.get("minSeverity", "high")),
        min_confidence=float(settings.get("minConfidence", 0.0)),
        muted_kinds=tuple(str(kind) for kind in (settings.get("mutedKinds") or ())),
        interruption_budget=settings.get("interruptionBudget"),
        sent=frozenset(str(key) for key in sent if key),
        feedback=feedback,
        escalate_after_hours=settings.get("escalateAfterHours"),
        learned={str(kind): float(points) for kind, points in learned.items()},
        allow_act=bool(settings.get("allowAct", False)),
    )
