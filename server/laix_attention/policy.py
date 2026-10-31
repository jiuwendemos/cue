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
from datetime import datetime

from .model import SEVERITY_RANK, Breakdown, Context, Decision, Feedback, Signal
from .timing import hours_until, is_quiet

SEVERITY_POINTS = {"critical": 60.0, "high": 45.0, "medium": 30.0, "low": 15.0, "info": 5.0}
#: How much an hour of silence costs, relative to severity.
WAIT_FACTOR = {"critical": 2.0, "high": 1.5, "medium": 1.0, "low": 0.5, "info": 0.25}

#: Order in which the gates are applied. The first gate that fires decides.
GATES: tuple[str, ...] = (
    "kill_switch",
    "muted",
    "feedback",
    "low_confidence",
    "below_floor",
    "already_sent",
    "quiet_hours",
    "budget",
    "overdue_escalation",
)


#: Every reason a decision can carry. A contract file may not invent one.
REASONS: tuple[str, ...] = (
    "notify",
    "kill_switch",
    "muted",
    "snoozed",
    "wrong",
    "assigned",
    "dismissed",
    "low_confidence",
    "below_floor",
    "already_sent",
    "quiet_hours",
    "budget",
    "overdue_escalation",
    "act",
    "ask_approval",
)


def dedupe_key(signal: Signal, now) -> str:
    """One interruption per signal per day, by default."""
    return f"{signal.id}:{now.date().isoformat()}"


def trace_id(signal: Signal, now, action: str) -> str:
    raw = f"{signal.id}|{now.date().isoformat()}|{action}".encode()
    return "tr-" + hashlib.sha1(raw).hexdigest()[:12]


def _due_points(now: datetime, due: str | None) -> float:
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


def _rank(severity: str) -> int:
    return SEVERITY_RANK.get(severity, 9)


def _snoozed_until_future(until: str | None, now: datetime) -> bool:
    """A snooze with no expiry, or one we cannot read, keeps the signal silent."""
    if not until:
        return True
    try:
        moment = datetime.fromisoformat(until)
    except (TypeError, ValueError):
        return True
    if moment.tzinfo is None and now.tzinfo is not None:
        moment = moment.replace(tzinfo=now.tzinfo)
    return moment > now


FEEDBACK_REASONS = {"snoozed": "snoozed", "wrong": "wrong", "assigned": "assigned", "dismissed": "dismissed"}


def _feedback_blocks(feedback: Feedback | None, now: datetime) -> str | None:
    """Return the blocking reason, or None when the signal may proceed."""
    if feedback is None or feedback.state == "accepted":
        return None
    if feedback.state == "snoozed":
        return "snoozed" if _snoozed_until_future(feedback.until, now) else None
    return FEEDBACK_REASONS.get(feedback.state)


def score(signal: Signal, context: Context) -> Breakdown:
    severity = SEVERITY_POINTS.get(signal.severity, 5.0)
    due = _due_points(context.now, signal.due)
    confidence = max(0.0, min(1.0, signal.confidence)) * 20.0
    interruption = -max(0.0, min(1.0, signal.interruption_cost)) * 20.0
    learned = float(context.learned.get(signal.kind, 0.0))
    total = severity + due + confidence + interruption + learned
    return Breakdown(severity, due, confidence, interruption, learned, total)


def cost_of_waiting(signal: Signal, context: Context) -> float:
    """Points at stake if the decision is silence. Zero without a deadline."""
    factor = WAIT_FACTOR.get(signal.severity, 0.25)
    return round(_due_points(context.now, signal.due) * factor, 2)


def undo_hint(action: str, reversible: bool) -> str | None:
    if action in {"notify", "ask"}:
        return "withdraw"
    if action == "act":
        return "cancel" if reversible else None
    return None


def _decide_one(signal: Signal, context: Context, delivered: int) -> Decision:
    breakdown = score(signal, context)
    blocked = _feedback_blocks(context.feedback.get(signal.id), context.now)

    action, reason, record, deliver = "notify", "notify", True, True
    delivered_now = delivered

    if context.stopped:
        action, reason, record, deliver = "wait", "kill_switch", False, False
    elif signal.kind in context.muted_kinds:
        action, reason, record, deliver = "wait", "muted", False, False
    elif blocked is not None:
        action, reason, record, deliver = "wait", blocked, False, False
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
    elif context.allow_act and signal.intent is not None and signal.reversible:
        # The app declared a reversible action it is prepared to take. The policy
        # may execute it, or ask first when approval is required.
        action, reason = ("ask", "ask_approval") if signal.requires_approval else ("act", "act")
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
        intent=signal.intent if action in {"act", "ask"} else None,
        escalation=signal.escalation if action == "escalate" else None,
        cost_of_waiting=cost_of_waiting(signal, context),
        reversible=signal.reversible,
        undo_hint=undo_hint(action, signal.reversible),
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
