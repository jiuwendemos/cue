"""Ask LAIX for the same decision, record both, change nothing.

The contract with CUE:

* one ``DecisionRequest`` per scan, one ``Layer.decide()`` call;
* no send, no delivery, no storage, no model call, no network;
* every LAIX failure is caught and reported, and the native path continues;
* the native decisions are returned untouched — this module never mutates them.

``emit`` writes one JSON line per scan and one per signal comparison to the
``cue.laix.shadow`` logger, and appends the same lines to ``CUE_LAIX_LOG`` when
that variable is set.
"""

from __future__ import annotations

import json
import logging
import os
import time
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from laix_attention import __version__ as NATIVE_VERSION

from .compare import Comparison, compare, summarise

LOGGER = logging.getLogger("cue.laix.shadow")


def policy_versions() -> dict[str, str]:
    """The three versions a reader needs to interpret a shadow line."""
    versions = {"native_laix_attention": NATIVE_VERSION}
    try:
        from importlib.metadata import version

        versions["laix"] = version("laix")
    except Exception:  # noqa: BLE001 - a missing install is a fact, not a crash
        versions["laix"] = "missing"
    try:
        import laix.attention as laix_attention_module

        versions["laix_attention"] = str(getattr(laix_attention_module, "__version__", "unknown"))
    except Exception:  # noqa: BLE001
        versions["laix_attention"] = "missing"
    return versions


@dataclass(frozen=True, slots=True)
class ShadowReport:
    scan_id: str
    at: str
    signals: int
    comparisons: tuple[Comparison, ...] = ()
    policy_versions: dict[str, str] = field(default_factory=dict)
    error: str | None = None

    @property
    def raw_agreement(self) -> int:
        return sum(1 for item in self.comparisons if item.raw_agreement)

    @property
    def semantic_agreement(self) -> int:
        return sum(1 for item in self.comparisons if item.semantic_agreement)

    @property
    def raw_ratio(self) -> float:
        return (self.raw_agreement / len(self.comparisons)) if self.comparisons else 0.0

    @property
    def semantic_ratio(self) -> float:
        return (self.semantic_agreement / len(self.comparisons)) if self.comparisons else 0.0

    def as_dict(self) -> dict[str, Any]:
        return {
            "scan_id": self.scan_id,
            "at": self.at,
            "signals": self.signals,
            "raw_agreement": self.raw_agreement,
            "semantic_agreement": self.semantic_agreement,
            "raw_ratio": round(self.raw_ratio, 4),
            "semantic_ratio": round(self.semantic_ratio, 4),
            "policy_versions": dict(self.policy_versions),
            "error": self.error,
            "disagreements": summarise(self.comparisons).disagreements,
        }


def run_shadow(
    native_decisions: list[Any] | tuple[Any, ...],
    signals: list[Any] | tuple[Any, ...],
    context: Any,
    *,
    scan_id: str | None = None,
    at: str | None = None,
    subject: str = "CUE readiness scan",
) -> ShadowReport:
    """Call LAIX once for this scan and compare, without touching the native list."""
    moment = at or datetime.now(UTC).isoformat()
    identifier = scan_id or f"laix-shadow-{int(time.time() * 1000)}"
    versions = policy_versions()

    try:
        from laix import DecisionRequest, Layer

        request = DecisionRequest(subject=subject, at=moment, signals=tuple(signals), context=context)
        decisions = Layer().decide(request)
    except Exception as exc:  # noqa: BLE001 - shadow must never break the scan
        return ShadowReport(
            scan_id=identifier,
            at=moment,
            signals=len(signals),
            policy_versions=versions,
            error=f"{type(exc).__name__}: {exc}",
        )

    if len(decisions) != len(native_decisions):
        return ShadowReport(
            scan_id=identifier,
            at=moment,
            signals=len(signals),
            policy_versions=versions,
            error=f"laix returned {len(decisions)} decisions for {len(native_decisions)} native decisions",
        )

    comparisons = tuple(
        compare(native, decision, getattr(signal, "id", None))
        for native, decision, signal in zip(native_decisions, decisions, signals)
    )
    return ShadowReport(
        scan_id=identifier,
        at=moment,
        signals=len(signals),
        comparisons=comparisons,
        policy_versions=versions,
    )


def _log_target(path: str | None) -> str | None:
    return path or os.environ.get("CUE_LAIX_LOG") or None


def emit(report: ShadowReport, *, path: str | None = None) -> list[str]:
    """Write the scan line and one line per comparison. Returns the lines written."""
    lines = [_scan_line(report)]
    lines.extend(_signal_line(report, item) for item in report.comparisons)

    target = _log_target(path)
    for line in lines:
        LOGGER.info(line)
        if target:
            try:
                with open(target, "a", encoding="utf-8") as handle:
                    handle.write(line + "\n")
            except OSError as exc:
                LOGGER.warning("laix shadow log write failed for %s: %s", target, exc)
                target = None
    return lines


def _scan_line(report: ShadowReport) -> str:
    return json.dumps(
        {
            "event": "laix.shadow.scan",
            "scan_id": report.scan_id,
            "at": report.at,
            "policy_versions": report.policy_versions,
            "signal_id": None,
            "signals": report.signals,
            "raw_agreement": report.raw_agreement,
            "semantic_agreement": report.semantic_agreement,
            "raw_ratio": round(report.raw_ratio, 4),
            "semantic_ratio": round(report.semantic_ratio, 4),
            "error": report.error,
        },
        sort_keys=True,
        default=str,
    )


def _signal_line(report: ShadowReport, item: Comparison) -> str:
    payload = item.as_dict()
    payload.update(
        {
            "event": "laix.shadow.signal",
            "scan_id": report.scan_id,
            "at": report.at,
            "policy_versions": report.policy_versions,
            "error": None,
        }
    )
    return json.dumps(payload, sort_keys=True, default=str)
