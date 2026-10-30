"""Signed links for exports and notification deep links."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from typing import Any

from .. import config


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _unb64(data: str) -> bytes:
    return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4))


def sign_payload(payload: dict[str, Any], ttl_hours: int | None = None, secret: str | None = None) -> str:
    body = dict(payload)
    body.setdefault("exp", int(time.time()) + int((ttl_hours or config.SHARE_TTL_HOURS) * 3600))
    raw = json.dumps(body, separators=(",", ":"), sort_keys=True).encode("utf-8")
    key = (secret or config.SHARE_SECRET).encode("utf-8")
    sig = hmac.new(key, raw, hashlib.sha256).digest()
    return f"{_b64(raw)}.{_b64(sig)}"


def verify_payload(token: str, secret: str | None = None) -> dict[str, Any] | None:
    try:
        raw_b64, sig_b64 = token.split(".", 1)
        raw = _unb64(raw_b64)
        expected = hmac.new((secret or config.SHARE_SECRET).encode("utf-8"), raw, hashlib.sha256).digest()
        if not hmac.compare_digest(expected, _unb64(sig_b64)):
            return None
        payload = json.loads(raw)
        if int(payload.get("exp", 0)) < int(time.time()):
            return None
        return payload
    except Exception:  # noqa: BLE001 - a malformed token is simply invalid
        return None


def signed_link(path: str, *, actor: str = "Mara Voss", risk_id: str | None = None, ttl_hours: int | None = None) -> dict[str, Any]:
    token = sign_payload({"path": path, "actor": actor, "risk_id": risk_id}, ttl_hours=ttl_hours)
    return {
        "url": f"{config.PUBLIC_URL.rstrip('/')}{path}?token={token}",
        "token": token,
        "expires_in_hours": ttl_hours or config.SHARE_TTL_HOURS,
        "actor": actor,
    }
