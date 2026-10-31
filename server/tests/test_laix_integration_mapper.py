"""The adapter: a CUE candidate becomes a LAIX signal without losing anything."""

from __future__ import annotations

from datetime import UTC, datetime

import pytest

from laix_integration.mapper import to_context, to_cue_decision, to_signal

NOW = datetime(2026, 11, 1, 10, 0, tzinfo=UTC)


def full_candidate() -> dict:
    return {
        "id": "D-9DB0B6A3",
        "kind": "power",
        "title": "The active look is over the house supply on this leg",
        "detail": "27.3 kW drawn of 23 kW at The Foundry.",
        "severity": "critical",
        "confidence": 0.92,
        "due": "2026-11-02T09:00:00+02:00",
        "evidence": [
            {"id": "cit-power", "label": "27.3 kW look draw", "source": "Rig schedule v3", "kind": "rig"},
            {"id": "cit-venues", "label": "The Foundry", "source": "Venue profiles", "kind": "venue"},
        ],
        "groupKey": "home:power",
        "interruptionCost": 0.25,
        "requiresApproval": True,
        "reversible": True,
        "intent": {"capability": "apply_venue_variant", "args": {"variation": "foundry-cut"}},
        "escalation": {"target": "tour_manager", "reason": "stop-work item"},
    }


def test_signal_preserves_every_modelled_field() -> None:
    signal = to_signal(full_candidate(), NOW)

    assert signal.id == "D-9DB0B6A3"
    assert signal.kind == "power"
    assert signal.title.startswith("The active look")
    assert signal.severity == "critical"
    assert signal.confidence == pytest.approx(0.92)
    assert signal.due == "2026-11-02T09:00:00+02:00"
    assert signal.evidence_refs == ("cit-power", "cit-venues")
    assert signal.group_key == "home:power"
    assert signal.interruption_cost == pytest.approx(0.25)
    assert signal.requires_approval is True
    assert signal.reversible is True
    assert signal.intent is not None and signal.intent.capability == "apply_venue_variant"
    assert signal.intent.args == {"variation": "foundry-cut"}
    assert signal.escalation is not None and signal.escalation.target == "tour_manager"
    assert signal.escalation.reason == "stop-work item"


@pytest.mark.parametrize("level", ["critical", "high", "medium", "low", "info"])
def test_the_five_severity_levels_map_directly(level: str) -> None:
    assert to_signal({"id": "s", "kind": "k", "severity": level}, NOW).severity == level


def test_an_unknown_severity_falls_back_instead_of_leaking() -> None:
    assert to_signal({"id": "s", "kind": "k", "severity": "urgent"}, NOW).severity == "low"


def test_a_cue_scan_candidate_shape_is_understood() -> None:
    candidate = {
        "id": "D-1",
        "kind": "schedule",
        "severity": "high",
        "confidence": 0.88,
        "groupKey": "tour:schedule",
        "evidence": [{"id": "cit-schedule"}],
    }
    signal = to_signal(candidate, NOW)
    assert signal.group_key == "tour:schedule"
    assert signal.evidence_refs == ("cit-schedule",)
    assert signal.due is None
    assert signal.interruption_cost == 0.0
    assert signal.requires_approval is False
    assert signal.reversible is False
    assert signal.intent is None
    assert signal.escalation is None


def test_snake_case_and_datetime_due_are_accepted() -> None:
    signal = to_signal(
        {
            "id": "s",
            "kind": "k",
            "severity": "medium",
            "evidence_refs": ("e-1",),
            "group_key": "g",
            "interruption_cost": 0.5,
            "requires_approval": True,
            "due": datetime(2026, 11, 2, 9, 0, tzinfo=UTC),
        },
        NOW,
    )
    assert signal.evidence_refs == ("e-1",)
    assert signal.group_key == "g"
    assert signal.interruption_cost == pytest.approx(0.5)
    assert signal.requires_approval is True
    assert signal.due == "2026-11-02T09:00:00+00:00"


def test_context_maps_the_scanner_settings() -> None:
    settings = {
        "quietHours": "22:00-06:00",
        "mode": "live",
        "stopSwitch": True,
        "sent": {"D-1:2026-11-01", None},
        "learned": {"power": -12.5},
    }
    context = to_context(settings, NOW)

    assert context.now == NOW
    assert context.quiet_hours == ("22:00", "06:00")
    assert context.mode == "live"
    assert context.stopped is True
    assert context.min_severity == "high"
    assert context.min_confidence == 0.0
    assert context.sent == frozenset({"D-1:2026-11-01"})
    assert context.learned == {"power": -12.5}
    assert context.muted_kinds == ()
    assert context.allow_act is False


def test_context_passes_the_optional_limits_through() -> None:
    settings = {
        "now": "2026-11-01T10:00:00+02:00",
        "quietHours": None,
        "minSeverity": "medium",
        "minConfidence": 0.6,
        "mutedKinds": ["glare"],
        "interruptionBudget": 2,
        "escalateAfterHours": 48,
        "allowAct": True,
        "feedback": {"D-1": {"state": "snoozed", "until": "2026-11-02T08:00:00+02:00"}},
    }
    context = to_context(settings, NOW)

    assert context.quiet_hours is None
    assert context.min_severity == "medium"
    assert context.min_confidence == pytest.approx(0.6)
    assert context.muted_kinds == ("glare",)
    assert context.interruption_budget == 2
    assert context.escalate_after_hours == 48
    assert context.allow_act is True
    assert context.feedback["D-1"].state == "snoozed"


def test_an_unreadable_quiet_window_is_never_quiet() -> None:
    from laix.attention import is_quiet

    context = to_context({"quietHours": "not-a-window"}, NOW)
    assert is_quiet(NOW.replace(hour=23), context.quiet_hours) is False


# --------------------------------------------------------------------------- LAIX -> CUE


def laix_decision(signals, context):
    from laix import DecisionRequest, Layer

    return Layer().decide(DecisionRequest(subject="mapper test", at=NOW.isoformat(), signals=tuple(signals), context=context))


def test_a_guide_decision_becomes_cue_notify() -> None:
    from laix import Context, Signal

    decision = laix_decision([Signal(id="s-1", kind="power", severity="critical", confidence=0.9)], Context(now=NOW))[0]
    cue = to_cue_decision(decision, "s-1")

    assert (cue.action, cue.reason, cue.signal_id) == ("notify", "notify", "s-1")
    assert cue.deliver is True
    assert cue.record is True
    assert cue.score == pytest.approx(decision.score)
    assert cue.confidence == pytest.approx(decision.confidence)
    assert cue.trace_id == decision.trace_id
    assert cue.breakdown.total == pytest.approx(decision.breakdown.total)
    assert cue.evidence_refs == ()


def test_a_wait_decision_keeps_its_reason() -> None:
    from laix import Context, Signal

    decision = laix_decision([Signal(id="s-2", kind="data", severity="medium", confidence=0.8)], Context(now=NOW))[0]
    cue = to_cue_decision(decision, "s-2")

    assert (cue.action, cue.reason) == ("wait", "below_floor")
    assert cue.deliver is False
    assert cue.record is False


def test_an_act_decision_carries_approval_and_intent() -> None:
    from laix import Context, Signal
    from laix.attention import Intent

    signal = Signal(
        id="s-3",
        kind="rights",
        severity="high",
        confidence=0.9,
        intent=Intent("extend_licence", {"asset": "rain-02"}),
        reversible=True,
        requires_approval=True,
    )
    decision = laix_decision([signal], Context(now=NOW, allow_act=True))[0]
    cue = to_cue_decision(decision, "s-3")

    assert (cue.action, cue.requires_approval) == ("act", True)
    assert cue.intent is not None and cue.intent.capability == "extend_licence"
    assert cue.reversible is True
    assert cue.undo_hint == "cancel"


def test_an_escalation_is_carried_through() -> None:
    from laix import Context, Signal
    from laix.attention import Escalation

    signal = Signal(
        id="s-4",
        kind="safety",
        severity="critical",
        confidence=0.95,
        due="2026-10-30T10:00:00+00:00",
        escalation=Escalation("tour_manager", "stop-work item"),
    )
    decision = laix_decision([signal], Context(now=NOW, escalate_after_hours=24))[0]
    cue = to_cue_decision(decision, "s-4")

    assert cue.action == "escalate"
    assert cue.escalation is not None
    assert cue.escalation.target == "tour_manager"
    assert cue.cost_of_waiting > 0


def test_evidence_refs_are_flattened_to_ids() -> None:
    from laix import Context, Signal

    signal = Signal(
        id="s-5",
        kind="power",
        severity="high",
        confidence=0.9,
        evidence_refs=("cit-power", "cit-venues"),
    )
    cue = to_cue_decision(laix_decision([signal], Context(now=NOW))[0], "s-5")

    assert cue.evidence_refs == ("cit-power", "cit-venues")
