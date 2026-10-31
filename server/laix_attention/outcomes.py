"""Outcome learning: did the interruption help?

This is the smallest honest version. It stores labelled outcomes, maps a reason
code to a result, and reports precision and calibration. A LAIX bandit can
replace ``adjustment`` later; the recording contract stays the same.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass, field

from .model import Outcome

HELPED = "helped"
NO_EFFECT = "no_effect"
HURT = "hurt"
UNKNOWN = "unknown"

_HURT_CODES = {"false_alarm", "data_error"}
_NEUTRAL_CODES = {"design_change", "operational", "duplicate", "no_action"}


def result_for_reason(reason_code: str | None) -> str:
    """Map an app's dismissal reason to a learning label."""
    if not reason_code:
        return UNKNOWN
    code = reason_code.strip().lower()
    if code in _HURT_CODES:
        return HURT
    if code in _NEUTRAL_CODES:
        return NO_EFFECT
    return UNKNOWN


def label_for_feedback(state: str, reason_code: str | None = None) -> str:
    """A UI feedback state (accepted, dismissed, snoozed, wrong) to a result."""
    state = (state or "").strip().lower()
    if state in {"accepted", "confirmed", "signed"}:
        return HELPED
    if state in {"wrong", "false_alarm"}:
        return HURT
    if state in {"dismissed", "snoozed", "assigned"}:
        return result_for_reason(reason_code)
    return UNKNOWN


@dataclass
class OutcomeLog:
    """A bounded, serialisable log. No database, no clock, no app types."""

    limit: int = 500
    records: list[Outcome] = field(default_factory=list)

    def record(self, outcome: Outcome) -> None:
        self.records.append(outcome)
        if len(self.records) > self.limit:
            del self.records[: len(self.records) - self.limit]

    def extend(self, outcomes: Iterable[Outcome]) -> None:
        for outcome in outcomes:
            self.record(outcome)

    def _counts(self, kind: str | None = None) -> dict[str, int]:
        counts = {HELPED: 0, NO_EFFECT: 0, HURT: 0, UNKNOWN: 0}
        for item in self.records:
            if kind is not None and item.kind != kind:
                continue
            counts[item.result] = counts.get(item.result, 0) + 1
        return counts

    def total(self, kind: str | None = None) -> int:
        return sum(self._counts(kind).values())

    def precision(self, kind: str | None = None) -> float | None:
        """Confirmed / raised. None when there is no evidence yet."""
        counts = self._counts(kind)
        total = sum(counts.values())
        if not total:
            return None
        return counts[HELPED] / total

    def hazard_rate(self, kind: str | None = None) -> float | None:
        """Raised actions that turned out wrong. The number the gate cares about."""
        counts = self._counts(kind)
        total = sum(counts.values())
        if not total:
            return None
        return counts[HURT] / total

    def adjustment(self, kind: str, weight: float = 12.0) -> float:
        """A small per-kind point adjustment for ``Context.learned``."""
        counts = self._counts(kind)
        total = sum(counts.values())
        if not total:
            return 0.0
        net = (counts[HELPED] - counts[HURT]) / total
        return round(net * weight, 2)

    def calibration(self) -> list[dict[str, float | int]]:
        """Observed help rate per score bucket. Score is the confidence we claimed."""
        buckets = [(0, 25), (25, 50), (50, 75), (75, 101)]
        rows: list[dict[str, float | int]] = []
        for low, high in buckets:
            sample = [r for r in self.records if r.score is not None and low <= r.score < high]
            helped = sum(1 for r in sample if r.result == HELPED)
            rows.append(
                {
                    "low": low,
                    "high": high,
                    "n": len(sample),
                    "helped": helped,
                    "rate": round(helped / len(sample), 3) if sample else 0.0,
                }
            )
        return rows

    def by_kind(self) -> dict[str, dict[str, float | int | None]]:
        kinds = {item.kind for item in self.records}
        return {
            kind: {
                **self._counts(kind),
                "precision": self.precision(kind),
                "hazard": self.hazard_rate(kind),
                "adjustment": self.adjustment(kind),
            }
            for kind in sorted(kinds)
        }
