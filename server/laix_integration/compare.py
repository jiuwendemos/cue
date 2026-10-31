"""Compare CUE's native decision with LAIX's decision for the same signal.

Two numbers, always reported together:

* **raw** — CUE's action against LAIX's verb, as emitted.
* **semantic** — after the known vocabulary mappings.

Reporting only the normalised number would hide the fact that the two layers
speak differently today. Reporting only the raw number would call a pure rename
a behavioural disagreement.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

#: CUE action -> LAIX verb, where the difference is vocabulary rather than intent.
ACTION_ALIASES: dict[str, str] = {
    "notify": "guide",
}


def normalise_native(action: str, reason: str) -> tuple[str, bool | None]:
    """Return the LAIX verb CUE's action means, plus an approval requirement.

    ``None`` means "no approval condition applies". CUE's ``ask`` exists only to
    request approval for a reversible action, which LAIX expresses as ``act``
    with ``requires_approval=True``.
    """
    verb = (action or "").strip().lower()
    if verb == "ask" and (reason or "").strip() == "ask_approval":
        return "act", True
    return ACTION_ALIASES.get(verb, verb), None


@dataclass(frozen=True, slots=True)
class Comparison:
    signal_id: str
    native_action: str
    native_reason: str
    native_deliver: bool
    native_record: bool
    native_score: float | None
    laix_verb: str
    laix_reason: str
    laix_deliver: bool
    laix_record: bool
    laix_requires_approval: bool
    laix_score: float | None
    mapped_verb: str
    mapped_requires_approval: bool | None
    raw_agreement: bool
    semantic_agreement: bool

    @property
    def raw_pair(self) -> str:
        return f"{self.native_action}->{self.laix_verb}"

    @property
    def semantic_pair(self) -> str:
        return f"{self.mapped_verb}->{self.laix_verb}"

    def as_dict(self) -> dict[str, Any]:
        return {
            "signal_id": self.signal_id,
            "native": {
                "action": self.native_action,
                "reason": self.native_reason,
                "deliver": self.native_deliver,
                "record": self.native_record,
                "score": round(self.native_score, 2) if self.native_score is not None else None,
            },
            "laix": {
                "verb": self.laix_verb,
                "reason_code": self.laix_reason,
                "deliver": self.laix_deliver,
                "record": self.laix_record,
                "requires_approval": self.laix_requires_approval,
                "score": round(self.laix_score, 2) if self.laix_score is not None else None,
            },
            "raw_agreement": self.raw_agreement,
            "semantic_agreement": self.semantic_agreement,
            "raw_pair": self.raw_pair,
            "semantic_pair": self.semantic_pair,
        }


def compare(native: Any, laix_decision: Any, signal_id: str | None = None) -> Comparison:
    """Build one comparison from a CUE decision and a LAIX decision."""
    native_action = str(getattr(native, "action", "") or "")
    native_reason = str(getattr(native, "reason", "") or "")
    laix_verb = str(getattr(laix_decision, "verb", "") or "")

    mapped_verb, mapped_requires_approval = normalise_native(native_action, native_reason)
    semantic = mapped_verb == laix_verb
    if semantic and mapped_requires_approval is not None:
        semantic = bool(getattr(laix_decision, "requires_approval", False)) is mapped_requires_approval

    return Comparison(
        signal_id=str(signal_id if signal_id is not None else getattr(native, "signal_id", "")),
        native_action=native_action,
        native_reason=native_reason,
        native_deliver=bool(getattr(native, "deliver", False)),
        native_record=bool(getattr(native, "record", False)),
        native_score=getattr(native, "score", None),
        laix_verb=laix_verb,
        laix_reason=str(getattr(laix_decision, "reason_code", "") or ""),
        laix_deliver=bool(getattr(laix_decision, "deliver", False)),
        laix_record=bool(getattr(laix_decision, "record", False)),
        laix_requires_approval=bool(getattr(laix_decision, "requires_approval", False)),
        laix_score=getattr(laix_decision, "score", None),
        mapped_verb=mapped_verb,
        mapped_requires_approval=mapped_requires_approval,
        raw_agreement=native_action == laix_verb,
        semantic_agreement=semantic,
    )


@dataclass(frozen=True, slots=True)
class Summary:
    signals: int
    raw_agreement: int
    semantic_agreement: int
    raw_ratio: float
    semantic_ratio: float
    disagreements: dict[str, int]

    def as_dict(self) -> dict[str, Any]:
        return {
            "signals": self.signals,
            "raw_agreement": self.raw_agreement,
            "semantic_agreement": self.semantic_agreement,
            "raw_ratio": round(self.raw_ratio, 4),
            "semantic_ratio": round(self.semantic_ratio, 4),
            "disagreements": dict(self.disagreements),
        }


def summarise(comparisons: tuple[Comparison, ...] | list[Comparison]) -> Summary:
    total = len(comparisons)
    raw = sum(1 for item in comparisons if item.raw_agreement)
    semantic = sum(1 for item in comparisons if item.semantic_agreement)
    groups: dict[str, int] = {}
    for item in comparisons:
        if item.raw_agreement:
            continue
        groups[item.raw_pair] = groups.get(item.raw_pair, 0) + 1
    return Summary(
        signals=total,
        raw_agreement=raw,
        semantic_agreement=semantic,
        raw_ratio=(raw / total) if total else 0.0,
        semantic_ratio=(semantic / total) if total else 0.0,
        disagreements=dict(sorted(groups.items(), key=lambda pair: (-pair[1], pair[0]))),
    )
