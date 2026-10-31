"""Raw and semantic agreement, reported side by side."""

from __future__ import annotations

from types import SimpleNamespace

from laix_integration.compare import compare, normalise_native, summarise


def native(action: str, reason: str, *, deliver: bool = True, record: bool = True, score: float = 63.0):
    return SimpleNamespace(action=action, reason=reason, deliver=deliver, record=record, score=score)


def decision(
    verb: str,
    reason_code: str,
    *,
    deliver: bool = True,
    record: bool = True,
    requires_approval: bool = False,
    score: float = 63.0,
):
    return SimpleNamespace(
        verb=verb,
        reason_code=reason_code,
        deliver=deliver,
        record=record,
        requires_approval=requires_approval,
        score=score,
    )


def test_notify_is_guide_semantically_but_not_raw() -> None:
    result = compare(native("notify", "notify"), decision("guide", "worth_surfacing"), "s-1")

    assert result.raw_agreement is False
    assert result.semantic_agreement is True
    assert result.raw_pair == "notify->guide"
    assert result.semantic_pair == "guide->guide"
    assert result.laix_requires_approval is False


def test_ask_approval_is_act_with_approval_semantically() -> None:
    result = compare(native("ask", "ask_approval"), decision("act", "act", requires_approval=True), "s-2")

    assert result.mapped_verb == "act"
    assert result.mapped_requires_approval is True
    assert result.raw_agreement is False
    assert result.semantic_agreement is True


def test_ask_approval_without_the_flag_is_not_semantically_equal() -> None:
    result = compare(native("ask", "ask_approval"), decision("act", "act", requires_approval=False), "s-3")

    assert result.semantic_agreement is False


def test_a_plain_ask_is_not_rewritten_into_act() -> None:
    assert normalise_native("ask", "ask_the_user") == ("ask", None)
    result = compare(native("ask", "ask_the_user"), decision("act", "act", requires_approval=True), "s-4")
    assert result.semantic_agreement is False


def test_wait_agrees_raw_and_semantic() -> None:
    result = compare(native("wait", "quiet_hours", deliver=False), decision("wait", "quiet_hours", deliver=False))
    assert result.raw_agreement is True
    assert result.semantic_agreement is True


def test_a_real_disagreement_is_visible_in_both_numbers() -> None:
    result = compare(native("notify", "notify"), decision("wait", "below_floor", deliver=False, record=False))
    assert result.raw_agreement is False
    assert result.semantic_agreement is False


def test_summary_keeps_the_raw_and_semantic_counts_apart() -> None:
    rows = [
        compare(native("notify", "notify"), decision("guide", "worth_surfacing")),
        compare(native("wait", "quiet_hours", deliver=False), decision("wait", "quiet_hours", deliver=False)),
        compare(native("escalate", "overdue_escalation"), decision("wait", "budget", deliver=False)),
    ]
    summary = summarise(rows)

    assert summary.signals == 3
    assert summary.raw_agreement == 1
    assert summary.semantic_agreement == 2
    assert summary.raw_ratio == 1 / 3
    assert summary.semantic_ratio == 2 / 3
    assert summary.disagreements == {"notify->guide": 1, "escalate->wait": 1}


def test_summary_of_nothing_is_zero_not_an_error() -> None:
    summary = summarise([])
    assert summary.signals == 0
    assert summary.raw_ratio == 0.0
    assert summary.semantic_ratio == 0.0
