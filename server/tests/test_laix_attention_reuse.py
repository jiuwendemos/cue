"""A second consumer, in a different domain, on the same contract.

This is the reuse proof: nothing here imports the app, and the module does not
change. If this file needed a special case, the extraction would be a lie.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from laix_attention import Context, NullSink, Outcome, OutcomeLog, Signal, decide, rollup

TZ = timezone(timedelta(hours=2))


class StudyDesk:
    """A thirty-line app: remind a student about drills, respect the evening."""

    kind = "study"

    def __init__(self) -> None:
        self.log = OutcomeLog()
        self.sink = NullSink()
        self.sent: set[str] = set()

    def cycle(self, drills: list[Signal], now: datetime) -> list[dict]:
        context = Context(
            now=now,
            quiet_hours=("21:00", "07:30"),
            min_severity="medium",
            sent=frozenset(self.sent),
            learned={self.kind: self.log.adjustment(self.kind)},
        )
        decisions = decide(drills, context)
        delivered = []
        for decision in decisions:
            if not decision.deliver:
                continue
            self.sent.add(f"{decision.signal_id}:{now.date().isoformat()}")
            delivered.extend(self.sink.emit({"signal": decision.signal_id, "at": decision.trace_id}))
        return [d.as_dict() for d in decisions]

    def dismiss(self, decision: dict, reason_code: str) -> None:
        self.log.record(
            Outcome(
                signal_id=str(decision["signal_id"]),
                kind=self.kind,
                action=str(decision["action"]),
                result="hurt" if reason_code in {"false_alarm", "data_error"} else "no_effect",
                reason_code=reason_code,
                score=float(decision["score"]),
            )
        )


def drill(name: str, severity: str = "medium", due: str | None = None) -> Signal:
    return Signal(id=name, kind="study", title=name, severity=severity, confidence=0.9, due=due)


def test_the_same_policy_serves_a_different_app() -> None:
    desk = StudyDesk()
    evening = datetime(2026, 11, 2, 22, 0, tzinfo=TZ)

    decisions = desk.cycle([drill("drill-1")], evening)
    assert decisions[0]["action"] == "wait"
    assert decisions[0]["reason"] == "quiet_hours"
    assert desk.sink.seen == []

    morning = datetime(2026, 11, 3, 8, 0, tzinfo=TZ)
    decisions = desk.cycle([drill("drill-2")], morning)
    assert decisions[0]["action"] == "notify"
    assert len(desk.sink.seen) == 1


def test_dismissals_lower_the_score_and_are_measured() -> None:
    desk = StudyDesk()
    morning = datetime(2026, 11, 3, 8, 0, tzinfo=TZ)

    first = desk.cycle([drill("drill-3")], morning)[0]
    desk.dismiss(first, "false_alarm")
    desk.sink.seen.clear()
    desk.sent.clear()

    second = desk.cycle([drill("drill-4")], morning)[0]
    assert second["score"] < first["score"]
    assert desk.log.precision() == 0.0
    assert desk.log.hazard_rate() == 1.0


def test_the_digest_is_the_same_generic_rollup() -> None:
    items = [drill("later", "medium", "2026-11-09"), drill("now", "critical", "2026-11-03")]
    assert [item.id for item in rollup(items, limit=1)] == ["now"]


def test_no_app_specific_behaviour_was_needed() -> None:
    desk = StudyDesk()
    decisions = desk.cycle([drill("drill-5", "low")], datetime(2026, 11, 3, 8, 0, tzinfo=TZ))
    assert decisions[0]["action"] == "wait"
    assert decisions[0]["reason"] == "below_floor"
    assert decisions[0]["confidence"] == pytest.approx(0.9)
