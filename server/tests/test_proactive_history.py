"""The app's outcome labels, and the measured block the API returns."""

from __future__ import annotations

from fastapi.testclient import TestClient

from cue.api.app import create_app
from cue.proactive import history


def test_the_six_ui_sentences_map_to_contract_codes() -> None:
    cases = {
        "False alarm — the evidence was wrong": "false_alarm",
        "Design change — the show was updated": "design_change",
        "Operational — the crew handled it on site": "operational",
        "Duplicate — already covered by another risk": "duplicate",
        "No action — accepted as designed": "no_action",
        "Data error — the source was wrong": "data_error",
        "False alarm — the evidence was wrong - checked with the venue": "false_alarm",
        "false_alarm": "false_alarm",
        "the crew sorted it out": None,
        "": None,
        None: None,
    }
    for text, expected in cases.items():
        assert history.code_for_reason(text) == expected


def test_resolved_counts_as_helped_and_dismissed_as_labeled() -> None:
    risks = [
        {"id": "R-1", "kind": "power", "state": "resolved"},
        {"id": "R-2", "kind": "power", "state": "dismissed", "dismissedReason": "False alarm — wrong reading"},
        {"id": "R-3", "kind": "schedule", "state": "dismissed", "dismissedReason": "Design change — the show moved"},
        {"id": "R-4", "kind": "rights", "state": "new"},
    ]
    log = history.build_outcome_log(risks)
    assert log.total() == 3
    assert log.precision() == 1 / 3
    assert log.hazard_rate() == 1 / 3
    assert log.by_kind()["power"]["helped"] == 1
    assert log.by_kind()["schedule"]["no_effect"] == 1


def test_learned_adjustment_is_negative_when_dismissals_dominate() -> None:
    risks = [
        {"id": "R-1", "kind": "glare", "state": "dismissed", "dismissedReason": "False alarm"},
        {"id": "R-2", "kind": "glare", "state": "dismissed", "dismissedReason": "False alarm"},
        {"id": "R-3", "kind": "power", "state": "resolved"},
    ]
    learned = history.learned_adjustments(risks)
    assert learned["glare"] < 0
    assert learned["power"] > 0
    assert "schedule" not in learned


def test_open_risks_are_not_evidence() -> None:
    assert history.build_outcome_log([{"id": "R-1", "kind": "power", "state": "acknowledged"}]).total() == 0
    assert history.outcomes_summary([])["precision"] is None


def test_the_api_reports_measured_outcomes_and_calibration() -> None:
    with TestClient(create_app(":memory:")) as client:
        before = client.get("/api/proactive").json()["outcomes"]
        assert before["labelled"] >= 1
        assert 0.0 <= before["precision"] <= 1.0
        assert len(before["calibration"]) == 4
        assert "label_source" in before

        risks = [r for r in client.get("/api/readiness").json()["risks"] if r["state"] not in {"resolved", "dismissed"}]
        target = risks[0]
        dismissed = client.post(
            f"/api/readiness/{target['id']}/dismiss",
            json={"actor": "Mara Voss", "reason": "False alarm — the evidence was wrong"},
        )
        assert dismissed.status_code == 200

        after = client.get("/api/proactive").json()["outcomes"]
        assert after["labelled"] == before["labelled"] + 1
        assert after["hazard"] > before["hazard"]
        assert after["by_kind"][target["kind"]]["hurt"] >= 1
