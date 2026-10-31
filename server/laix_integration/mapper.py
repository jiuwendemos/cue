"""Translate CUE's data into LAIX types.

LAIX receives generic fields only: no venue, no look, no cue. The mapping is
deliberately lossless for the fields LAIX models, and silent about the rest.

The adapter is one-way on purpose. LAIX returns a decision; it never returns a
CUE notification, and nothing here writes to the show store.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from laix import Context, Feedback, Signal
from laix.attention import SEVERITY_RANK, Escalation, Intent, parse_range


def _field(source: Any, name: str, default: Any = None) -> Any:
    """Read a mapping key or an object attribute, so dicts and models both work."""
    if isinstance(source, Mapping):
        return source.get(name, default)
    return getattr(source, name, default)


def _severity(value: Any) -> str:
    text = str(value or "low").strip().lower()
    return text if text in SEVERITY_RANK else "low"


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


def to_context(settings: Mapping[str, Any], now: datetime) -> Context:
    """CUE's scan settings to a LAIX context.

    The scanner maps only what the CUE path applies (quiet hours, mode, stop
    switch, severity floor, already-sent keys, learned points). The optional
    limits are passed through when present and left at LAIX's defaults otherwise.
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
        quiet_hours=parse_range(settings.get("quietHours", "22:00-06:00")),
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


#: LAIX's word for "show it to the user".
VERB_TO_ACTION: dict[str, str] = {"guide": "notify"}
#: LAIX's name for the rule that says the signal is worth showing.
REASON_TO_CUE: dict[str, str] = {"worth_surfacing": "notify"}


@dataclass(frozen=True, slots=True)
class CueBreakdown:
    """The six score terms CUE's scanner has always exposed."""

    severity: float = 0.0
    due: float = 0.0
    confidence: float = 0.0
    interruption: float = 0.0
    learned: float = 0.0
    total: float = 0.0

    def as_dict(self) -> dict[str, float]:
        return {
            "severity": round(self.severity, 2),
            "due": round(self.due, 2),
            "confidence": round(self.confidence, 2),
            "interruption": round(self.interruption, 2),
            "learned": round(self.learned, 2),
            "total": round(self.total, 2),
        }


@dataclass(frozen=True, slots=True)
class CueDecision:
    """The decision shape the scanner consumes. Field names are CUE's."""

    signal_id: str
    action: str
    reason: str
    score: float
    confidence: float
    deliver: bool
    record: bool
    requires_approval: bool
    evidence_refs: tuple[str, ...]
    breakdown: CueBreakdown
    trace_id: str
    intent: Any = None
    escalation: Any = None
    cost_of_waiting: float = 0.0
    reversible: bool = False
    undo_hint: str | None = None


def _cue_breakdown(value: Any) -> CueBreakdown:
    if value is None:
        return CueBreakdown()
    return CueBreakdown(
        severity=float(getattr(value, "severity", 0.0)),
        due=float(getattr(value, "due", 0.0)),
        confidence=float(getattr(value, "confidence", 0.0)),
        interruption=float(getattr(value, "interruption", 0.0)),
        learned=float(getattr(value, "learned", 0.0)),
        total=float(getattr(value, "total", 0.0)),
    )


def to_cue_decision(decision: Any, signal_id: str = "") -> CueDecision:
    """Map one LAIX decision back to the shape the scanner already used.

    LAIX is the only decision engine now. The two vocabulary differences are
    applied here, so the rest of CUE keeps its own words: LAIX says ``guide``
    where CUE says ``notify``, and ``worth_surfacing`` where CUE says ``notify``.
    """
    verb = str(getattr(decision, "verb", "") or "")
    reason = str(getattr(decision, "reason_code", "") or "")
    evidence = tuple(str(getattr(ref, "id", ref)) for ref in (getattr(decision, "evidence", ()) or ()))
    score = getattr(decision, "score", None)

    return CueDecision(
        signal_id=signal_id,
        action=VERB_TO_ACTION.get(verb, verb),
        reason=REASON_TO_CUE.get(reason, reason),
        score=float(score) if score is not None else 0.0,
        confidence=float(getattr(decision, "confidence", 0.0)),
        deliver=bool(getattr(decision, "deliver", False)),
        record=bool(getattr(decision, "record", False)),
        requires_approval=bool(getattr(decision, "requires_approval", False)),
        evidence_refs=evidence,
        breakdown=_cue_breakdown(getattr(decision, "breakdown", None)),
        trace_id=str(getattr(decision, "trace_id", "") or ""),
        intent=getattr(decision, "intent", None),
        escalation=getattr(decision, "escalation", None),
        cost_of_waiting=float(getattr(decision, "cost_of_waiting", 0.0) or 0.0),
        reversible=bool(getattr(decision, "reversible", False)),
        undo_hint=getattr(decision, "undo_hint", None),
    )
