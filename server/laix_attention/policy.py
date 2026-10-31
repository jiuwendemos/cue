"""The decision policy: should this signal reach the user now, later, or never?

The engine is deliberately inspectable. A score is computed for every signal
and kept in the record, but the *action* in v1 comes from explicit gates, in a
fixed order. That is what makes the behaviour reproducible and testable; a
learned scorer can replace the gate at threshold time without changing the
contract.
"""

from __future__ import annotations

import hashlib
from collections.abc import Iterable, Sequence

from .model import SEVERITY_RANK, Breakdown, Context, Decision, Signal
from .timing import hours_until, is_quiet

SEVERITY_POINTS = {"critical": 60.0, "high": 45.0, "medium": 30.0, "low": 15.0, "info": 5.0}

#: Order in which the gates are applied. The first gate that fires decides.
GATES: tuple[str, ...] = (
    "kill_switch",
    "muted",
    "low_confidence",
    "below_floor",
    "already_sent",
    "quiet_hours",
    "budget",
    "overdue_escalation",
)


def dedupe_key(signal: Signal, now) -> str:
    """One interruption per signal per day, by default."""
    return f"{signal.id}:{now.date().isoformat()}"


def trace_id(signal: Signal, now, action: str) -> str:
    raw = f"{signal.id}|{now.date().isoformat()}|{action}".encode()
    return "tr-" + hashlib.sha1(raw).hexdigest()[:12]


def _due_points(now, due: str | None) -> float:
    hours = hours_until(now, due)
    if hours is None:
        return 0.0
    if hours < 0:
        return 30.0
    if hours <= 24:
        return 20.0
    if hours <= 72:
        return 12.0
    if hours <= 168:
        return 6.0
    return 0.0


def score(signal: Signal, context: Context) -> Breakdown:
    severity = SEVERITY_POINTS.get(signal.severity, 5.0)
    due = _due_points(context.now, signal.due)
    confidence = max(0.0, min(1.0, signal.confidence)) * 20.0
    interruption = -max(0.0, min(1.0, signal.interruption_cost)) * 20.0
    learned = float(context.learned.get(signal.kind, 0.0))
    total = severity + due + confidence + interruption + learned
    return Breakdown(severity, due, confidence, interruption, learned, total)


def _rank(severity: str) -> int:
    return SEVERITY_RANK.get(severity, 9)


def _decide_one(signal: Signal, context: Context, delivered: int) -> Decision:
    breakdown = score(signal, context)
    delivered_now = delivered

    action, reason, record, deliver = "notify", "notify", True, True

    if context.stopped:
        action, reason, record, deliver = "wait", "kill_switch", False, False
    elif signal.kind in context.muted_kinds:
        action, reason, record, deliver = "wait", "muted", False, False
    elif signal.confidence < context.min_confidence:
        action, reason, record, deliver = "wait", "low_confidence", False, False
    elif _rank(signal.severity) > _rank(context.min_severity):
        action, reason, record, deliver = "wait", "below_floor", False, False
    elif dedupe_key(signal, context.now) in context.sent:
        action, reason, record, deliver = "wait", "already_sent", False, False
    elif is_quiet(context.now, context.quiet_hours) and signal.severity != "critical":
        action, reason, record, deliver = "wait", "quiet_hours", True, False
    elif context.interruption_budget is not None and delivered_now >= context.interruption_budget:
        action, reason, record, deliver = "wait", "budget", False, False
    elif context.escalate_after_hours is not None and signal.severity == "critical":
        hours = hours_until(context.now, signal.due)
        if hours is not None and -hours > context.escalate_after_hours:
            action, reason, record, deliver = "escalate", "overdue_escalation", True, True
    else:
        delivered_now += 1

    return Decision(
        signal_id=signal.id,
        action=action,
        score=breakdown.total,
        reason=reason,
        confidence=signal.confidence,
        deliver=deliver,
        record=record,
        requires_approval=signal.requires_approval,
        evidence_refs=signal.evidence_refs,
        breakdown=breakdown,
        trace_id=trace_id(signal, context.now, action),
    )


def decide(signals: Iterable[Signal], context: Context) -> list[Decision]:
    """Return one decision per signal, in input order."""
    out: list[Decision] = []
    delivered = 0
    for signal in signals:
        decision = _decide_one(signal, context, delivered)
        if decision.deliver:
            delivered += 1
        out.append(decision)
    return out


def rollup(signals: Sequence[Signal], limit: int = 5) -> list[Signal]:
    """The most severe signals first, then the soonest due. Used for digests."""
    return sorted(signals, key=lambda s: (_rank(s.severity), s.due or "9999"))[:limit]
