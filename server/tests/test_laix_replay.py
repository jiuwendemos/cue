"""The golden replay: what the shipped policy actually decided.

The contract says what a runtime *must* do. This fixture records what CUE's
deployment *did* on 2026-11-01, so a change to the policy shows up as a diff even
when no vector covers the case.
"""

from __future__ import annotations

import json
from pathlib import Path

import laix_attention as laix

REPLAY_PATH = Path(laix.__file__).resolve().parent / "fixtures" / "replay.json"
REPLAY = json.loads(REPLAY_PATH.read_text(encoding="utf-8"))

STABLE = ("action", "reason", "deliver", "record", "score", "cost_of_waiting", "undo_hint")


def run(case: dict) -> dict:
    context = laix.context_from(case["context"])
    signals = [laix.signal_from(payload) for payload in case["signals"]]
    decision = laix.decide(signals, context)[0]
    return {
        "action": decision.action,
        "reason": decision.reason,
        "deliver": decision.deliver,
        "record": decision.record,
        "score": round(decision.score, 2),
        "cost_of_waiting": round(decision.cost_of_waiting, 2),
        "undo_hint": decision.undo_hint,
    }


def test_the_fixture_has_the_documented_shape() -> None:
    assert REPLAY["contract"] == "laix-replay"
    assert REPLAY["version"] == "1"
    assert REPLAY["capturedFrom"].startswith("cue@")
    assert REPLAY["capturedFrom"].split("@")[1].strip()


def test_the_fixture_covers_the_bench_and_the_app() -> None:
    cases = REPLAY["cases"]
    assert len(cases) == 22
    assert sum(1 for case in cases if case["id"].startswith("bench:")) == 12
    assert sum(1 for case in cases if case["id"].startswith("cue:")) == 10
    assert len({case["id"] for case in cases}) == len(cases)


def test_every_case_declares_one_expected_decision() -> None:
    for case in REPLAY["cases"]:
        assert len(case["signals"]) == 1, case["id"]
        assert len(case["expected"]) == 1, case["id"]
        assert set(case["expected"][0]) == set(STABLE), case["id"]


def test_every_case_replays_without_a_diff() -> None:
    problems = []
    for case in REPLAY["cases"]:
        actual = run(case)
        expected = {field: case["expected"][0][field] for field in STABLE}
        if actual != expected:
            problems.append(f"{case['id']}: expected {expected}, got {actual}")
    assert problems == []


def test_replay_is_deterministic() -> None:
    for case in REPLAY["cases"]:
        assert run(case) == run(case), case["id"]


def test_no_wall_clock_leaked_into_the_captured_signals() -> None:
    for case in REPLAY["cases"]:
        if not case["id"].startswith("cue:"):
            continue
        signal = case["signals"][0]
        assert "due" not in signal, f"{case['id']} kept a detected timestamp"
        assert "createdAt" not in signal and "at" not in signal
        # Every CUE case shares the frozen capture moment.
        assert case["context"]["now"] == "2026-11-01T10:00:00+02:00"


def test_the_fixture_ships_with_the_package() -> None:
    import tomllib

    assert REPLAY_PATH.is_file()
    pyproject = tomllib.loads((REPLAY_PATH.parents[2] / "pyproject.toml").read_text(encoding="utf-8"))
    package_data = pyproject["tool"]["setuptools"]["package-data"]["laix_attention"]
    assert "fixtures/*.json" in package_data
    assert "contract/*.json" in package_data


def test_the_replay_does_not_contradict_the_contract() -> None:
    # Every action and reason in the golden file must be legal in the contract.
    for case in REPLAY["cases"]:
        expected = case["expected"][0]
        assert expected["action"] in laix.ACTIONS, case["id"]
        assert expected["reason"] in laix.REASONS, case["id"]
