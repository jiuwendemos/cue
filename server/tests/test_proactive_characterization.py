"""Characterization tests for the proactive scanner.

These describe what the scanner does *today*, so the extraction of
``laix_attention`` can move code without changing behaviour. They are
deliberately written against observable output (notifications, counters) and a
frozen clock, not against internals.
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from cue.proactive import scanner
from cue.store.db import Store

PACK = json.loads((Path(__file__).resolve().parents[1] / "cue" / "data" / "show.json").read_text(encoding="utf-8"))


class FrozenDateTime(datetime):
    """A datetime whose ``now()`` is fixed, so quiet hours and dedupe are testable.

    The moment is naive and is read as *local* wall-clock time, exactly like
    ``datetime.now().astimezone()`` in the scanner. That keeps the test independent
    of the runner's timezone.
    """

    fixed: datetime | None = None

    @classmethod
    def now(cls, tz=None):  # type: ignore[no-untyped-def]
        moment = (cls.fixed or datetime(2026, 10, 30, 10, 0)).replace(tzinfo=None)
        return moment.astimezone(tz) if tz else moment.astimezone()


def freeze(monkeypatch, moment: datetime) -> None:
    FrozenDateTime.fixed = moment
    monkeypatch.setattr(scanner, "datetime", FrozenDateTime)


def test_the_frozen_clock_is_timezone_independent() -> None:
    FrozenDateTime.fixed = datetime(2026, 10, 30, 23, 30)
    assert FrozenDateTime.now().hour == 23
    assert FrozenDateTime.now().astimezone().hour == 23


def settings(**overrides):
    base = scanner.default_settings(PACK)
    base.update(overrides)
    return base


def test_notifications_only_for_critical_and_high() -> None:
    result = scanner.run_scan(PACK, Store(":memory:"), "halcyon", settings(mode="live", quietHours="22:00-06:00"))
    assert result["notifications"]
    assert {n["severity"] for n in result["notifications"]} <= {"critical", "high"}


def test_quiet_hours_hold_non_critical_but_let_critical_through(monkeypatch) -> None:
    freeze(monkeypatch, datetime(2026, 10, 30, 23, 30))
    result = scanner.run_scan(PACK, Store(":memory:"), "halcyon", settings(mode="live", quietHours="22:00-06:00"))
    assert result["notifications"]
    for notification in result["notifications"]:
        if notification["severity"] == "critical":
            assert notification["delivered"] is True
        else:
            assert notification["delivered"] is False
            assert notification["detail"].endswith("Held for the quiet-hours digest.")


def test_quiet_hours_boundaries_are_inclusive(monkeypatch) -> None:
    store = Store(":memory:")
    for moment, expected_quiet in [
        (datetime(2026, 10, 30, 21, 59), False),
        (datetime(2026, 10, 30, 22, 0), True),
        (datetime(2026, 10, 30, 6, 0), True),
        (datetime(2026, 10, 30, 6, 1), False),
    ]:
        freeze(monkeypatch, moment)
        fresh = Store(":memory:")
        result = scanner.run_scan(PACK, fresh, "halcyon", settings(mode="live", quietHours="22:00-06:00"))
        held = [n for n in result["notifications"] if n["delivered"] is False]
        non_critical = [n for n in result["notifications"] if n["severity"] != "critical"]
        assert bool(held) is (expected_quiet and bool(non_critical))
    del store


def test_a_second_scan_notifies_nothing_new(monkeypatch) -> None:
    freeze(monkeypatch, datetime(2026, 10, 30, 10, 0))
    store = Store(":memory:")
    first = scanner.run_scan(PACK, store, "halcyon", settings(mode="live"))
    assert first["notifications"]
    second = scanner.run_scan(PACK, store, "halcyon", first["settings"])
    assert second["run"]["raised"] == 0
    assert second["notifications"] == []
    assert second["run"]["suppressed"] >= 1


def test_a_held_notification_is_not_repeated_same_day(monkeypatch) -> None:
    freeze(monkeypatch, datetime(2026, 10, 30, 23, 30))
    store = Store(":memory:")
    first = scanner.run_scan(PACK, store, "halcyon", settings(mode="live", quietHours="22:00-06:00"))
    assert first["notifications"]
    second = scanner.run_scan(PACK, store, "halcyon", first["settings"])
    assert second["notifications"] == []


def test_kill_switch_stops_detection_and_raising() -> None:
    result = scanner.run_scan(PACK, Store(":memory:"), "halcyon", settings(stopSwitch=True))
    assert result["run"]["status"] == "stopped"
    assert result["candidates"] == []
    assert result["notifications"] == []
    assert result["run"]["raised"] == 0


def test_scan_counters_add_up() -> None:
    result = scanner.run_scan(PACK, Store(":memory:"), "halcyon", settings(mode="live"))
    run = result["run"]
    # `candidates` in the result is the *new* list; `checked` counts every detection.
    assert run["checked"] == run["raised"] + run["suppressed"] + len(PACK["risks"])
    assert run["raised"] == len(result["candidates"])
    assert run["status"] == "ok"
    assert str(len(result["notifications"])) in run["note"]


def test_candidates_are_deduplicated_by_group_key() -> None:
    candidates = scanner.detect_candidates(PACK)
    keys = [c["groupKey"] for c in candidates]
    assert len(keys) == len(set(keys))
    assert all(c["evidence"] for c in candidates)
    assert all(0.0 <= c["confidence"] <= 1.0 for c in candidates)


def test_digest_lists_top_open_risks_only() -> None:
    risks = PACK["risks"]
    digest = scanner.build_digest(PACK, risks, settings())
    assert digest["markdown"].startswith("# CUE readiness digest")
    assert "Recommendations only" in digest["markdown"]
    assert len(digest["risks"]) <= 5
