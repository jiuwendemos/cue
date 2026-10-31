"""Shadow mode: LAIX is asked, recorded, and never allowed to change CUE."""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from pathlib import Path

import pytest

pytest.importorskip("laix")

import laix
from laix import Context, Signal

from laix_attention import Context as NativeContext
from laix_attention import Signal as NativeSignal
from laix_attention import decide as native_decide
from laix_integration import shadow

NOW = datetime(2026, 11, 1, 10, 0, tzinfo=UTC)
AT = "2026-11-01T10:00:00+00:00"


def laix_signals() -> list[Signal]:
    return [
        Signal(id="s-1", kind="power", severity="critical", confidence=0.9),
        Signal(id="s-2", kind="glare", severity="high", confidence=0.7),
    ]


def native_decisions(signals: list[Signal]):
    context = NativeContext(now=NOW, quiet_hours=("22:00", "06:00"))
    return native_decide(
        [
            NativeSignal(id=item.id, kind=item.kind, severity=item.severity, confidence=item.confidence)
            for item in signals
        ],
        context,
    )


def test_native_decisions_are_returned_unchanged() -> None:
    signals = laix_signals()
    native = native_decisions(signals)
    before = [(item.signal_id, item.action, item.reason, item.deliver, item.record, item.score) for item in native]

    report = shadow.run_shadow(native, signals, Context(now=NOW), scan_id="scan-1", at=AT)

    after = [(item.signal_id, item.action, item.reason, item.deliver, item.record, item.score) for item in native]
    assert before == after
    assert report.error is None
    assert report.signals == 2
    assert len(report.comparisons) == 2
    assert report.raw_agreement == 0  # notify vs guide
    assert report.semantic_agreement == 2
    assert {item.signal_id for item in report.comparisons} == {"s-1", "s-2"}


def test_a_laix_error_is_caught_reported_and_logged_once(monkeypatch, tmp_path) -> None:
    def boom(self, request):
        raise RuntimeError("laix exploded")

    monkeypatch.setattr(laix.Layer, "decide", boom)
    report = shadow.run_shadow(native_decisions(laix_signals()), laix_signals(), Context(now=NOW), scan_id="scan-err", at=AT)

    assert report.error == "RuntimeError: laix exploded"
    assert report.comparisons == ()
    assert report.raw_agreement == 0
    assert report.semantic_agreement == 0

    log_path = tmp_path / "shadow.jsonl"
    lines = shadow.emit(report, path=str(log_path))
    assert len(lines) == 1  # one scan line, no signal lines
    assert json.loads(lines[0])["error"] == "RuntimeError: laix exploded"


def test_emit_writes_one_scan_line_and_one_line_per_signal(tmp_path, caplog) -> None:
    signals = laix_signals()
    report = shadow.run_shadow(native_decisions(signals), signals, Context(now=NOW), scan_id="scan-2", at=AT)
    log_path = tmp_path / "shadow.jsonl"

    with caplog.at_level(logging.INFO, logger="cue.laix.shadow"):
        lines = shadow.emit(report, path=str(log_path))

    assert len(lines) == 1 + len(report.comparisons)
    records = [json.loads(line) for line in log_path.read_text(encoding="utf-8").splitlines()]
    assert [record["event"] for record in records] == ["laix.shadow.scan"] + ["laix.shadow.signal"] * 2

    scan, *signal_lines = records
    assert scan["signal_id"] is None
    assert scan["signals"] == 2
    assert scan["error"] is None
    assert scan["policy_versions"]["laix"] != "missing"
    assert scan["policy_versions"]["native_laix_attention"]
    for record in signal_lines:
        for key in (
            "scan_id",
            "at",
            "policy_versions",
            "signal_id",
            "native",
            "laix",
            "raw_agreement",
            "semantic_agreement",
            "error",
        ):
            assert key in record
        assert record["native"]["action"] in {"notify", "wait", "ask", "act", "escalate"}
        assert record["laix"]["verb"] in {"wait", "observe", "guide", "ask", "act", "verify", "escalate"}

    assert any("laix.shadow.scan" in item.message for item in caplog.records)
    assert any("laix.shadow.signal" in item.message for item in caplog.records)


def test_no_signals_still_produces_a_valid_report(tmp_path) -> None:
    report = shadow.run_shadow([], [], Context(now=NOW), scan_id="scan-empty", at=AT)
    assert report.error is None
    assert report.signals == 0
    assert report.raw_ratio == 0.0
    assert len(shadow.emit(report, path=str(tmp_path / "empty.jsonl"))) == 1


def test_the_scan_survives_an_unexpected_integration_error(monkeypatch, caplog) -> None:
    from cue.proactive import scanner

    def boom(*args, **kwargs):
        raise RuntimeError("integration exploded")

    monkeypatch.setattr(shadow, "run_shadow", boom)
    monkeypatch.setattr(scanner, "LAIX_MODE", "shadow")

    with caplog.at_level(logging.INFO, logger="cue.laix.shadow"):
        scanner._shadow_compare(
            candidates=[],
            settings={},
            now=NOW,
            native_decisions=[],
            sent=frozenset(),
            learned={},
            scan={"id": "SCAN-ERR", "at": AT},
        )

    assert any("integration exploded" in item.message for item in caplog.records)
    assert any("SCAN-ERR" in item.message for item in caplog.records)


def test_a_shadow_scan_produces_the_same_notifications(tmp_path, monkeypatch) -> None:
    from cue.proactive import scanner
    from cue.store.db import Store

    pack_path = Path(__file__).resolve().parents[1] / "cue" / "data" / "show.json"
    pack = json.loads(pack_path.read_text(encoding="utf-8"))
    settings = scanner.default_settings(pack)
    settings.update(mode="live", quietHours="22:00-06:00")

    def shape(result):
        return [
            (item["severity"], item["title"], item["delivered"], item["dedup_key"])
            for item in result["notifications"]
        ]

    monkeypatch.delenv("CUE_LAIX_LOG", raising=False)
    monkeypatch.setattr(scanner, "LAIX_MODE", "off")
    baseline = scanner.run_scan(pack, Store(":memory:"), "compare", settings)

    monkeypatch.setattr(scanner, "LAIX_MODE", "shadow")
    monkeypatch.setenv("CUE_LAIX_LOG", str(tmp_path / "shadow.jsonl"))
    shadowed = scanner.run_scan(pack, Store(":memory:"), "compare", settings)

    assert shape(shadowed) == shape(baseline)
    assert shadowed["run"]["raised"] == baseline["run"]["raised"]
    assert shadowed["run"]["checked"] == baseline["run"]["checked"]
    assert (tmp_path / "shadow.jsonl").is_file()
