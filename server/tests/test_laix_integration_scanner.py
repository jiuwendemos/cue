"""The scanner decides through LAIX; this pins parity with the removed local engine.

The baseline in ``fixtures/laix_parity.json`` was captured on the last commit that
used the removed local engine. It is the evidence that the replacement did not
change detection, decisions or notification fields. Do not edit it to make a
failure go away.
"""

from __future__ import annotations

import importlib.util
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest


from laix import DecisionRequest, Layer

from cue.proactive import scanner
from cue.store.db import Store
from laix_integration.mapper import to_context, to_cue_decision, to_signal

SERVER = Path(__file__).resolve().parents[1]
FIXTURE = json.loads((Path(__file__).parent / "fixtures" / "laix_parity.json").read_text(encoding="utf-8"))
PACK = json.loads((SERVER / "cue" / "data" / "show.json").read_text(encoding="utf-8"))
NOW = datetime(2026, 11, 1, 10, 0, tzinfo=timezone(timedelta(hours=2)))

NOTIFICATION_KEYS = {
    "id",
    "at",
    "kind",
    "severity",
    "title",
    "detail",
    "risk_id",
    "channels",
    "delivered",
    "read",
    "dedup_key",
    "trace_id",
    "score",
}


def cue_rows(decisions, signals) -> list[dict]:
    return [
        {
            "signal_id": row.signal_id,
            "action": row.action,
            "reason": row.reason,
            "deliver": row.deliver,
            "record": row.record,
            "score": round(row.score, 2),
            "requires_approval": row.requires_approval,
            "evidence_refs": list(row.evidence_refs),
        }
        for row in (to_cue_decision(decision, signal.id) for decision, signal in zip(decisions, signals))
    ]


def test_the_laix_path_reproduces_the_native_decisions() -> None:
    pack = dict(PACK)
    pack["risks"] = []
    candidates = scanner.detect_candidates(pack)
    signals = [to_signal({**candidate, "due": None}, NOW) for candidate in candidates]
    context = to_context({"quietHours": "22:00-06:00", "sent": set(), "learned": {}}, NOW)

    decisions = Layer().decide(
        DecisionRequest(subject="parity", at=NOW.isoformat(), signals=tuple(signals), context=context)
    )

    assert len(decisions) == len(FIXTURE["decisions"])
    assert cue_rows(decisions, signals) == FIXTURE["decisions"]


def test_a_scan_produces_the_same_notifications_and_counters() -> None:
    settings = scanner.default_settings(PACK)
    settings.update(mode="live", quietHours="22:00-06:00")

    result = scanner.run_scan(PACK, Store(":memory:"), "parity", settings)

    assert set(result) == {"run", "candidates", "notifications", "deliveries", "settings", "digest"}
    assert {key: result["run"][key] for key in ("checked", "raised", "suppressed", "status", "note")} == FIXTURE["run"]

    notifications = [
        {
            "risk_id": item["risk_id"],
            "severity": item["severity"],
            "title": item["title"],
            "detail": item["detail"],
            "delivered": item["delivered"],
            "channels": item["channels"],
        }
        for item in result["notifications"]
    ]
    assert notifications == FIXTURE["notifications"]
    for item in result["notifications"]:
        assert set(item) == NOTIFICATION_KEYS


def test_the_local_engine_is_not_installed() -> None:
    assert importlib.util.find_spec("laix_attention") is None


def test_the_shadow_flag_and_hook_are_gone() -> None:
    assert not hasattr(scanner, "LAIX_MODE")
    assert not hasattr(scanner, "_shadow_compare")


def test_there_is_no_fallback_when_laix_fails(monkeypatch) -> None:
    import laix

    def boom(self, request):
        raise RuntimeError("laix is unavailable")

    monkeypatch.setattr(laix.Layer, "decide", boom)
    settings = scanner.default_settings(PACK)
    settings.update(mode="live", quietHours="22:00-06:00")

    with pytest.raises(RuntimeError, match="laix is unavailable"):
        scanner.run_scan(PACK, Store(":memory:"), "parity", settings)
