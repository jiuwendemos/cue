"""The contract: behaviour, determinism and isolation of laix_attention."""

from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

import laix_attention as laix
from laix_attention import (
    Context,
    Outcome,
    OutcomeLog,
    Signal,
    compare,
    decide,
    dedupe_key,
    is_quiet,
    load_vectors,
    precision_recall,
    rollup,
)

PACKAGE = Path(laix.__file__).resolve().parent
VECTORS = load_vectors(PACKAGE / "contract" / "attention.v1.json")
TZ = timezone(timedelta(hours=2))


def at(hour: int, minute: int = 0, day: int = 1) -> datetime:
    return datetime(2026, 11, day, hour, minute, tzinfo=TZ)


def test_every_contract_vector_passes() -> None:
    problems = laix.run_vectors(VECTORS)
    assert problems == []
    assert len(VECTORS["cases"]) >= 20


def test_contract_version_is_declared() -> None:
    assert VECTORS["version"] == laix.__version__


def test_decisions_keep_input_order_and_identity() -> None:
    signals = [Signal(id=f"s-{i}", kind="k", severity="high", confidence=0.9) for i in range(3)]
    decisions = decide(signals, Context(now=at(10), quiet_hours=None))
    assert [d.signal_id for d in decisions] == ["s-0", "s-1", "s-2"]
    assert all(d.action == "notify" for d in decisions)


def test_trace_ids_are_stable_and_distinct_per_action() -> None:
    signal = Signal(id="s-1", kind="k", severity="high", confidence=0.9)
    first = decide([signal], Context(now=at(10), quiet_hours=None))[0]
    second = decide([signal], Context(now=at(10), quiet_hours=None))[0]
    assert first.trace_id == second.trace_id
    assert first.trace_id.startswith("tr-") and len(first.trace_id) == 15


def test_score_breakdown_adds_up() -> None:
    signal = Signal(id="s", kind="k", severity="high", confidence=0.5, due=at(12).isoformat(), interruption_cost=0.5)
    decision = decide([signal], Context(now=at(10), quiet_hours=None))[0]
    breakdown = decision.breakdown
    assert breakdown.total == pytest.approx(
        breakdown.severity + breakdown.due + breakdown.confidence + breakdown.interruption + breakdown.learned
    )
    assert decision.score == pytest.approx(breakdown.total)


def test_dedupe_key_is_signal_and_day() -> None:
    signal = Signal(id="D-123", kind="k")
    assert dedupe_key(signal, at(23, 59)) == "D-123:2026-11-01"
    assert dedupe_key(signal, at(0, 1, day=2)) == "D-123:2026-11-02"


@pytest.mark.parametrize(
    "hour,minute,expected",
    [(21, 59, False), (22, 0, True), (23, 59, True), (0, 0, True), (6, 0, True), (6, 1, False), (12, 0, False)],
)
def test_quiet_hours_are_inclusive(hour: int, minute: int, expected: bool) -> None:
    assert is_quiet(at(hour, minute), ("22:00", "06:00")) is expected


def test_bad_quiet_hours_are_never_quiet() -> None:
    assert is_quiet(at(23), "not-a-window") is False
    assert is_quiet(at(23), None) is False


def test_rollup_orders_by_severity_then_due() -> None:
    signals = [
        Signal(id="low", kind="k", severity="low", due="2026-11-02"),
        Signal(id="critical-late", kind="k", severity="critical", due="2026-11-09"),
        Signal(id="critical-soon", kind="k", severity="critical", due="2026-11-03"),
    ]
    assert [s.id for s in rollup(signals)] == ["critical-soon", "critical-late", "low"]


def test_outcome_log_precision_needs_evidence() -> None:
    log = OutcomeLog()
    assert log.precision() is None
    log.record(Outcome("a", "power", "notify", laix.HELPED, score=80))
    log.record(Outcome("b", "power", "notify", laix.HURT, reason_code="false_alarm", score=70))
    log.record(Outcome("c", "schedule", "notify", laix.NO_EFFECT, reason_code="design_change", score=40))
    assert log.precision() == pytest.approx(1 / 3)
    assert log.hazard_rate() == pytest.approx(1 / 3)
    assert log.precision("power") == pytest.approx(0.5)
    assert log.adjustment("power") == pytest.approx(0.0)


def test_reason_codes_map_to_labels() -> None:
    assert laix.result_for_reason("false_alarm") == laix.HURT
    assert laix.result_for_reason("data_error") == laix.HURT
    assert laix.result_for_reason("design_change") == laix.NO_EFFECT
    assert laix.result_for_reason("no_action") == laix.NO_EFFECT
    assert laix.result_for_reason(None) == laix.UNKNOWN
    assert laix.label_for_feedback("accepted") == laix.HELPED
    assert laix.label_for_feedback("dismissed", "false_alarm") == laix.HURT


def test_calibration_has_one_row_per_bucket() -> None:
    log = OutcomeLog()
    log.record(Outcome("a", "k", "notify", laix.HELPED, score=10))
    log.record(Outcome("b", "k", "notify", laix.HURT, score=90))
    rows = log.calibration()
    assert len(rows) == 4
    assert rows[0]["n"] == 1 and rows[0]["rate"] == 1.0
    assert rows[3]["n"] == 1 and rows[3]["rate"] == 0.0


def test_precision_recall_is_generic() -> None:
    result = precision_recall({"a", "b"}, {"b", "c"})
    assert result == {"detected": 2, "known": 2, "matched": 1, "precision": 0.5, "recall": 0.5}
    assert precision_recall([], [])["precision"] == 1.0


def test_null_sink_records_without_delivering() -> None:
    sink = laix.NullSink()
    assert sink.emit({"title": "x"}) == [{"channel": "none", "status": "dropped"}]
    assert sink.seen == [{"title": "x"}]


def test_compare_reports_a_mismatch() -> None:
    case = {
        "id": "tampered",
        "context": {"now": "2026-11-01T10:00:00+02:00", "quietHours": None},
        "signals": [{"id": "s", "kind": "k", "severity": "high", "confidence": 0.9}],
        "expected": [{"signalId": "s", "action": "wait", "reason": "no", "deliver": False, "record": False, "score": 1}],
    }
    problems = compare(case)
    assert problems and "tampered" in problems[0]


def test_the_package_does_not_know_the_app() -> None:
    offenders: list[str] = []
    banned = re.compile(r"^\s*(from|import)\s+cue\b", re.MULTILINE)
    nouns = re.compile(r"\b(venue|rig|look_id|show_pack|cue_sheet)\b")
    for path in PACKAGE.rglob("*.py"):
        text = path.read_text(encoding="utf-8")
        if banned.search(text):
            offenders.append(f"{path.name}: imports cue")
        if nouns.search(text):
            offenders.append(f"{path.name}: knows an app noun")
        if path.name != "ports.py" and "datetime.now(" in text:
            offenders.append(f"{path.name}: reads the clock directly")
    assert offenders == []


def test_the_contract_file_ships_with_the_package() -> None:
    assert (PACKAGE / "contract" / "attention.v1.json").is_file()
    assert (PACKAGE / "contract" / "bench.v1.json").is_file()
    assert (PACKAGE / "contract" / "schema.json").is_file()


# --------------------------------------------------------------------------- feedback


def test_a_snooze_holds_until_it_expires() -> None:
    signal = Signal(id="s", kind="k", severity="high", confidence=0.9)
    future = Context(now=at(10), quiet_hours=None, feedback={"s": laix.Feedback("snoozed", until="2026-11-02T08:00:00+02:00")})
    past = Context(now=at(10), quiet_hours=None, feedback={"s": laix.Feedback("snoozed", until="2026-10-31T08:00:00+02:00")})
    assert decide([signal], future)[0].reason == "snoozed"
    assert decide([signal], past)[0].action == "notify"


def test_a_snooze_without_an_expiry_stays_closed() -> None:
    signal = Signal(id="s", kind="k", severity="high", confidence=0.9)
    context = Context(now=at(10), quiet_hours=None, feedback={"s": laix.Feedback("snoozed")})
    assert decide([signal], context)[0].reason == "snoozed"


@pytest.mark.parametrize("state,reason", [("wrong", "wrong"), ("assigned", "assigned"), ("dismissed", "dismissed")])
def test_negative_feedback_suppresses(state: str, reason: str) -> None:
    signal = Signal(id="s", kind="k", severity="high", confidence=0.9)
    context = Context(now=at(10), quiet_hours=None, feedback={"s": laix.Feedback(state)})
    decision = decide([signal], context)[0]
    assert (decision.action, decision.reason, decision.record) == ("wait", reason, False)


def test_accepted_feedback_does_not_suppress() -> None:
    signal = Signal(id="s", kind="k", severity="high", confidence=0.9)
    context = Context(now=at(10), quiet_hours=None, feedback={"s": laix.Feedback("accepted")})
    assert decide([signal], context)[0].action == "notify"


# --------------------------------------------------------------------------- execution seam


def intent_signal(**overrides) -> Signal:
    base = {
        "id": "s",
        "kind": "k",
        "severity": "high",
        "confidence": 0.9,
        "intent": laix.Intent("apply_variant", {"v": "b"}),
        "reversible": True,
    }
    base.update(overrides)
    return Signal(**base)


def test_act_needs_an_explicit_opt_in() -> None:
    signal = intent_signal()
    off = decide([signal], Context(now=at(10), quiet_hours=None))[0]
    on = decide([signal], Context(now=at(10), quiet_hours=None, allow_act=True))[0]
    assert (off.action, off.intent) == ("notify", None)
    assert on.action == "act" and on.intent is not None and on.intent.capability == "apply_variant"


def test_an_irreversible_intent_is_only_notified() -> None:
    signal = intent_signal(reversible=False)
    decision = decide([signal], Context(now=at(10), quiet_hours=None, allow_act=True))[0]
    assert decision.action == "notify"


def test_approval_turns_act_into_ask() -> None:
    signal = intent_signal(requires_approval=True)
    decision = decide([signal], Context(now=at(10), quiet_hours=None, allow_act=True))[0]
    assert (decision.action, decision.reason, decision.requires_approval) == ("ask", "ask_approval", True)


def test_a_blocked_signal_never_acts() -> None:
    signal = intent_signal()
    context = Context(now=at(23, 30), quiet_hours=("22:00", "06:00"), allow_act=True)
    assert decide([signal], context)[0].action == "wait"


def test_escalation_is_carried_only_when_escalating() -> None:
    signal = intent_signal(
        severity="critical",
        requires_approval=False,
        intent=None,
        reversible=False,
        escalation=laix.Escalation("tour_manager", "stop-work"),
    )
    context = Context(now=at(10), quiet_hours=None, escalate_after_hours=24)
    decision = decide([signal], context)[0]
    assert decision.action == "notify" and decision.escalation is None

    overdue = {"due": "2026-10-30T10:00:00+02:00"}
    signal = intent_signal(severity="critical", intent=None, reversible=False, escalation=laix.Escalation("tour_manager", "stop-work"), **overdue)
    decision = decide([signal], context)[0]
    assert decision.action == "escalate" and decision.escalation is not None
    assert decision.escalation.target == "tour_manager"


# --------------------------------------------------------------------------- cost and undo


def test_cost_of_waiting_scales_with_deadline_and_severity() -> None:
    critical = Signal(id="a", kind="k", severity="critical", due="2026-11-02T09:00:00+02:00")
    high = Signal(id="b", kind="k", severity="high", due="2026-11-02T09:00:00+02:00")
    distant = Signal(id="c", kind="k", severity="critical", due="2026-12-01T09:00:00+02:00")
    none = Signal(id="d", kind="k", severity="critical")
    context = Context(now=at(10), quiet_hours=None)
    assert laix.cost_of_waiting(critical, context) == pytest.approx(40.0)
    assert laix.cost_of_waiting(high, context) == pytest.approx(30.0)
    assert laix.cost_of_waiting(distant, context) == 0.0
    assert laix.cost_of_waiting(none, context) == 0.0


def test_undo_hint_matches_the_action() -> None:
    assert laix.undo_hint("notify", False) == "withdraw"
    assert laix.undo_hint("ask", False) == "withdraw"
    assert laix.undo_hint("act", True) == "cancel"
    assert laix.undo_hint("act", False) is None
    assert laix.undo_hint("wait", True) is None
    assert laix.undo_hint("escalate", True) is None


def test_every_decision_carries_cost_and_undo() -> None:
    signal = Signal(id="s", kind="k", severity="high", confidence=0.9, due="2026-11-02T09:00:00+02:00")
    decision = decide([signal], Context(now=at(10), quiet_hours=None))[0]
    assert decision.cost_of_waiting > 0
    assert decision.undo_hint == "withdraw"
    assert decision.as_dict()["cost_of_waiting"] == round(decision.cost_of_waiting, 2)


# --------------------------------------------------------------------------- schema and bench


def test_the_schema_and_the_module_agree() -> None:
    import json

    document = json.loads((PACKAGE / "contract" / "schema.json").read_text(encoding="utf-8"))
    defs = document["$defs"]
    assert tuple(defs["action"]["enum"]) == laix.ACTIONS
    assert tuple(defs["reason"]["enum"]) == laix.REASONS
    assert tuple(defs["feedbackState"]["enum"]) == laix.FEEDBACK_STATES
    assert tuple(defs["severity"]["enum"]) == tuple(laix.SEVERITY_RANK)


def test_validate_document_accepts_the_contract() -> None:
    assert laix.validate_document(VECTORS) == []


def test_validate_document_rejects_an_invented_action() -> None:
    broken = {
        "contract": "laix-attention",
        "version": "1.1.0",
        "cases": [
            {
                "id": "broken",
                "context": {"now": "2026-11-01T10:00:00+02:00"},
                "signals": [{"id": "s", "kind": "k", "severity": "high"}],
                "expected": [{"action": "notify_now", "reason": "notify", "deliver": True, "record": True, "score": 1}],
            }
        ],
    }
    problems = laix.validate_document(broken)
    assert any("unknown action" in problem for problem in problems)


def test_the_bench_beats_both_baselines() -> None:
    document = load_vectors(PACKAGE / "contract" / "bench.v1.json")
    result = laix.benchmark(document)
    rows = result["rows"]
    assert result["cases"] == 12
    assert rows["policy"]["precision"] > rows["severity_only"]["precision"]
    assert rows["policy"]["precision"] > rows["always_notify"]["precision"]
    assert rows["policy"]["hazard"] == 0.0
    assert rows["always_notify"]["recall"] == 1.0
    assert rows["policy"]["missed_helpful"] >= 1
    assert rows["always_notify"]["raised"] == 12
