"""Quiet hours and windows. Pure functions, no clock of their own."""

from __future__ import annotations

from datetime import datetime


def parse_range(raw: object) -> tuple[str, str] | None:
    """Accept ``("22:00", "06:00")`` or ``"22:00-06:00"``; return a pair or None."""
    if raw is None:
        return None
    if isinstance(raw, (tuple, list)) and len(raw) == 2:
        return str(raw[0]), str(raw[1])
    text = str(raw).strip()
    if "-" not in text:
        return None
    start, _, end = text.partition("-")
    start, end = start.strip(), end.strip()
    if not start or not end:
        return None
    return start, end


def _minutes(value: str) -> int:
    hour, minute = value.split(":")
    return int(hour) * 60 + int(minute)


def is_quiet(now: datetime, quiet_hours: object) -> bool:
    """True inside the window, inclusive on both ends. Bad input is never quiet."""
    window = parse_range(quiet_hours)
    if window is None:
        return False
    try:
        start, end = _minutes(window[0]), _minutes(window[1])
    except (ValueError, IndexError):
        return False
    minutes = now.hour * 60 + now.minute
    if start <= end:
        return start <= minutes <= end
    return minutes >= start or minutes <= end


def hours_until(now: datetime, when_iso: str | None) -> float | None:
    """Hours from ``now`` to ``when_iso``. Negative means overdue. None when unparsable."""
    if not when_iso:
        return None
    try:
        when = datetime.fromisoformat(when_iso)
    except (TypeError, ValueError):
        return None
    if when.tzinfo is None and now.tzinfo is not None:
        when = when.replace(tzinfo=now.tzinfo)
    if when.tzinfo is not None and now.tzinfo is None:
        now = now.replace(tzinfo=when.tzinfo)
    return (when - now).total_seconds() / 3600.0
