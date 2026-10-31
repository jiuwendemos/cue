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
    assert len(VECTORS["cases"]) >= 12


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
