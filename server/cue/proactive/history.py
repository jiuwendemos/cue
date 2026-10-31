"""Turn closed risks into labelled outcomes for the decision layer.

A risk that was resolved is evidence the interruption helped. A risk that was
dismissed carries the reason it was wrong. That is the only label source the app
has today, and it is enough to measure precision, hazard and calibration.
"""

from __future__ import annotations

from typing import Any

from laix.attention import HELPED, Outcome, OutcomeLog, result_for_reason

#: The six sentences the readiness UI writes into ``dismissedReason``.
REASON_CODES: dict[str, str] = {
    "false alarm": "false_alarm",
    "design change": "design_change",
    "operational": "operational",
    "duplicate": "duplicate",
    "no action": "no_action",
    "data error": "data_error",
}


def code_for_reason(text: str | None) -> str | None:
    """Map a free-text dismissal to a contract reason code.

    The UI writes ``"False alarm — the evidence was wrong"`` or the same sentence
    with a note appended. The first matching keyword wins; an exact code passes
    through. Anything else is unknown, not guessed.
    """
    if not text:
        return None
    lowered = text.strip().lower()
    if lowered in set(REASON_CODES.values()):
        return lowered
    for phrase, code in REASON_CODES.items():
        if phrase in lowered:
            return code
    return None


def build_outcome_log(risks: list[dict[str, Any]]) -> OutcomeLog:
    """One outcome per closed risk; open risks are not evidence yet."""
    log = OutcomeLog()
    for risk in risks:
        state = risk.get("state")
        if state == "resolved":
            log.record(
                Outcome(
                    signal_id=str(risk.get("id", "")),
                    kind=str(risk.get("kind", "risk")),
                    action="notify",
                    result=HELPED,
                    score=risk.get("score"),
                    at=str(risk.get("due") or "") or None,
                )
            )
            continue
        if state != "dismissed":
            continue
        code = code_for_reason(risk.get("dismissedReason") or risk.get("reason"))
        log.record(
            Outcome(
                signal_id=str(risk.get("id", "")),
                kind=str(risk.get("kind", "risk")),
                action="notify",
                result=result_for_reason(code),
                reason_code=code,
                score=risk.get("score"),
                at=str(risk.get("due") or "") or None,
            )
        )
    return log


def outcomes_summary(risks: list[dict[str, Any]]) -> dict[str, Any]:
    """The block the API returns: measured, with the label source stated."""
    log = build_outcome_log(risks)
    return {
        "labelled": log.total(),
        "precision": log.precision(),
        "hazard": log.hazard_rate(),
        "by_kind": log.by_kind(),
        "calibration": log.calibration(),
        "label_source": "resolved risks count as helped; dismissals count by their reason code; open risks are not evidence.",
    }


def learned_adjustments(risks: list[dict[str, Any]]) -> dict[str, float]:
    """Per-kind point adjustments for ``Context.learned``. Score only, never a gate."""
    log = build_outcome_log(risks)
    return {
        kind: float(row["adjustment"])
        for kind, row in log.by_kind().items()
        if isinstance(row.get("adjustment"), (int, float)) and row["adjustment"]
    }
