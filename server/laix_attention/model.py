"""Domain-neutral types for the attention policy.

Nothing in this file knows what the app is about. An app supplies signals; the
policy returns decisions; the app records outcomes.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

SEVERITY_RANK: dict[str, int] = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
ACTIONS: tuple[str, ...] = ("wait", "notify", "ask", "act", "verify", "escalate")
RESULTS: tuple[str, ...] = ("helped", "no_effect", "hurt", "unknown")
REASON_CODES: tuple[str, ...] = (
    "false_alarm",
    "design_change",
    "operational",
    "duplicate",
    "no_action",
    "data_error",
)


@dataclass(frozen=True, slots=True)
class Signal:
    """One thing that might deserve the user's attention."""

    id: str
    kind: str
    title: str = ""
    detail: str = ""
    severity: str = "low"
    confidence: float = 0.5
    due: str | None = None
    evidence_refs: tuple[str, ...] = ()
    group_key: str | None = None
    interruption_cost: float = 0.0
    requires_approval: bool = False


@dataclass(slots=True)
class Context:
    """Everything the policy needs that is not the signal itself."""

    now: datetime
    quiet_hours: tuple[str, str] | None = ("22:00", "06:00")
    mode: str = "shadow"
    stopped: bool = False
    min_severity: str = "high"
    min_confidence: float = 0.0
    muted_kinds: tuple[str, ...] = ()
    # Deliver at most this many signals per decision cycle. None means no cap.
    interruption_budget: int | None = None
    # Dedupe keys already delivered in this period, for example "risk-1:2026-11-14".
    sent: frozenset[str] = frozenset()
    # Escalate a critical signal that is older than this many hours. None disables it.
    escalate_after_hours: float | None = None
    # Learned per-kind point adjustment, supplied by the app or a bandit.
    learned: dict[str, float] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class Breakdown:
    severity: float
    due: float
    confidence: float
    interruption: float
    learned: float
    total: float

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
class Decision:
    """What the product should do about one signal, and why."""

    signal_id: str
    action: str
    score: float
    reason: str
    confidence: float
    deliver: bool
    record: bool
    requires_approval: bool
    evidence_refs: tuple[str, ...]
    breakdown: Breakdown
    trace_id: str

    def as_dict(self) -> dict[str, object]:
        return {
            "signal_id": self.signal_id,
            "action": self.action,
            "score": round(self.score, 2),
            "reason": self.reason,
            "confidence": round(self.confidence, 3),
            "deliver": self.deliver,
            "record": self.record,
            "requires_approval": self.requires_approval,
            "evidence_refs": list(self.evidence_refs),
            "trace_id": self.trace_id,
            "breakdown": self.breakdown.as_dict(),
        }


@dataclass(frozen=True, slots=True)
class Outcome:
    """What happened after a decision. The label the learner needs."""

    signal_id: str
    kind: str
    action: str
    result: str
    reason_code: str | None = None
    score: float | None = None
    at: str | None = None

    def as_dict(self) -> dict[str, object]:
        return {
            "signal_id": self.signal_id,
            "kind": self.kind,
            "action": self.action,
            "result": self.result,
            "reason_code": self.reason_code,
            "score": self.score,
            "at": self.at,
        }
