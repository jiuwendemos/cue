"""Ports: the three things the module needs from the app, and nothing else.

An app supplies a clock, a sink and a recorder. The policy never sends, never
stores and never reads the environment.
"""

from __future__ import annotations

from collections.abc import Mapping
from datetime import datetime
from typing import Any, Protocol, runtime_checkable


@runtime_checkable
class Clock(Protocol):
    def now(self) -> datetime: ...


@runtime_checkable
class Sink(Protocol):
    """Deliver one accepted notification. Returns one record per channel."""

    def emit(self, notification: Mapping[str, Any]) -> list[Mapping[str, Any]]: ...


@runtime_checkable
class Recorder(Protocol):
    """Persist one labelled outcome."""

    def record(self, outcome: Mapping[str, Any]) -> None: ...


class SystemClock:
    def now(self) -> datetime:
        return datetime.now().astimezone()


class NullSink:
    """A sink that records the decision and delivers nothing. Useful in tests."""

    def __init__(self) -> None:
        self.seen: list[Mapping[str, Any]] = []

    def emit(self, notification: Mapping[str, Any]) -> list[Mapping[str, Any]]:
        self.seen.append(notification)
        return [{"channel": "none", "status": "dropped"}]
