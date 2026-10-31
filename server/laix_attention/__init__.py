"""LAIX attention — a small, domain-free decision layer for the right moment.

Given a candidate intervention, the current context and the user's limits,
should the product **wait, notify, ask, act, verify or escalate**?

Extracted from a production-readiness desk so LAIX can take it later. No framework, no
agent runtime, no app types, no network, no database, no clock of its own.
"""

from __future__ import annotations

from .model import (
    ACTIONS,
    FEEDBACK_STATES,
    REASON_CODES,
    RESULTS,
    SEVERITY_RANK,
    Breakdown,
    Context,
    Decision,
    Escalation,
    Feedback,
    Intent,
    Outcome,
    Signal,
)
from .outcomes import (
    HELPED,
    HURT,
    NO_EFFECT,
    UNKNOWN,
    OutcomeLog,
    label_for_feedback,
    result_for_reason,
)
from .policy import GATES, REASONS, cost_of_waiting, decide, dedupe_key, rollup, score, trace_id, undo_hint
from .ports import Clock, NullSink, Recorder, Sink, SystemClock
from .replay import (
    POLICIES,
    benchmark,
    compare,
    context_from,
    load_vectors,
    precision_recall,
    run_case,
    run_vectors,
    signal_from,
    validate_document,
)
from .timing import hours_until, is_quiet, parse_range

__version__ = "1.1.0"

__all__ = [
    "ACTIONS",
    "FEEDBACK_STATES",
    "GATES",
    "HELPED",
    "HURT",
    "NO_EFFECT",
    "POLICIES",
    "REASONS",
    "REASON_CODES",
    "RESULTS",
    "SEVERITY_RANK",
    "UNKNOWN",
    "Breakdown",
    "Clock",
    "Context",
    "Decision",
    "Escalation",
    "Feedback",
    "Intent",
    "NullSink",
    "Outcome",
    "OutcomeLog",
    "Recorder",
    "Signal",
    "Sink",
    "SystemClock",
    "benchmark",
    "compare",
    "context_from",
    "cost_of_waiting",
    "decide",
    "dedupe_key",
    "hours_until",
    "is_quiet",
    "label_for_feedback",
    "load_vectors",
    "parse_range",
    "precision_recall",
    "result_for_reason",
    "rollup",
    "run_case",
    "run_vectors",
    "score",
    "signal_from",
    "trace_id",
    "undo_hint",
    "validate_document",
]
