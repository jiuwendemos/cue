"""Replay CUE's golden fixture through the real LAIX layer.

This records what actually happens at LAIX v0.1.1. It does not ask the two layers
to agree, and it must never be "fixed" by editing the LAIX contract or CUE's
vectors. The numbers below are an observation; a LAIX upgrade is a deliberate
change that re-records them.
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace

import pytest

pytest.importorskip("laix")

from laix import DecisionRequest, Layer

import laix_attention
from laix_integration.compare import compare, summarise
from laix_integration.mapper import to_context, to_signal

REPLAY_PATH = Path(laix_attention.__file__).resolve().parent / "fixtures" / "replay.json"
REPLAY = json.loads(REPLAY_PATH.read_text(encoding="utf-8"))


def replay_one(case: dict):
    payload = case["context"]
    now = datetime.fromisoformat(payload["now"])
    context = to_context(payload, now)
    signals = tuple(to_signal(item, now) for item in case["signals"])
    decisions = Layer().decide(
        DecisionRequest(subject="CUE golden replay", at=payload["now"], signals=signals, context=context)
    )
    return decisions


@pytest.fixture(scope="module")
def rows():
    out = []
    for case in REPLAY["cases"]:
        decisions = replay_one(case)
        assert len(decisions) == 1, case["id"]
        expected = case["expected"][0]
        native = SimpleNamespace(
            action=expected["action"],
            reason=expected["reason"],
            deliver=expected["deliver"],
            record=expected["record"],
            score=expected["score"],
        )
        out.append((case, native, decisions[0], compare(native, decisions[0], case["signals"][0]["id"])))
    return out


def test_every_fixture_case_replays(rows) -> None:
    assert len(rows) == 22
    assert all(decision is not None for _, _, decision, _ in rows)


def test_the_recorded_differences_at_laix_0_1_1(rows) -> None:
    summary = summarise([comparison for *_, comparison in rows])

    assert summary.signals == 22
    # Recorded observation, not a requirement: 11 notify/notify decisions become
    # guide/worth_surfacing. Re-record deliberately on a LAIX upgrade.
    assert summary.raw_agreement == 11
    assert summary.semantic_agreement == 22
    assert summary.disagreements == {"notify->guide": 11}


def test_no_case_disagrees_once_the_vocabulary_is_normalised(rows) -> None:
    for case, _, _, comparison in rows:
        assert comparison.semantic_agreement is True, case["id"]


def test_scores_and_delivery_flags_are_identical(rows) -> None:
    for case, native, decision, _ in rows:
        assert decision.score == pytest.approx(native.score), case["id"]
        assert decision.deliver is native.deliver, case["id"]
        assert decision.record is native.record, case["id"]


def test_the_only_rename_is_notify_to_guide(rows) -> None:
    renames = {
        (comparison.native_action, comparison.laix_verb)
        for _, _, _, comparison in rows
        if not comparison.raw_agreement
    }
    assert renames == {("notify", "guide")}


def test_the_fixture_was_not_edited_to_make_the_layers_agree(rows) -> None:
    actions = {case["expected"][0]["action"] for case, *_ in rows}
    verbs = {decision.verb for _, _, decision, _ in rows}
    assert actions == {"notify", "wait"}  # CUE's vocabulary, untouched
    assert "guide" in verbs  # LAIX's, produced by the layer, not copied into the fixture
