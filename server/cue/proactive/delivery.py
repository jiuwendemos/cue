"""Notification delivery.

Every channel is optional. A missing credential records a ``simulated`` delivery,
not a silent success and not a crash. Real HTTP/SMTP calls are made only when the
environment is configured; the scan never fails because a channel is down.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import smtplib
import time
from collections.abc import Mapping
from email.message import EmailMessage
from typing import Any
from urllib import request

from .. import config
from ..store.db import Store
from .signing import signed_link


def _post_json(url: str, payload: dict[str, Any], headers: dict[str, str] | None = None, timeout: int = 8, attempts: int = 3) -> tuple[str, int]:
    body = json.dumps(payload).encode("utf-8")
    last: Exception | None = None
    for attempt in range(attempts):
        req = request.Request(url, data=body, method="POST", headers={"Content-Type": "application/json", **(headers or {})})
        try:
            with request.urlopen(req, timeout=timeout) as response:
                return response.read().decode("utf-8", "replace"), int(response.status)
        except Exception as exc:  # noqa: BLE001 - retry only; the caller records the error
            last = exc
            if attempt < attempts - 1:
                time.sleep(0.15 * (attempt + 1))
    raise last or RuntimeError("delivery failed")


def deliver(store: Store, tenant: str, notification: dict[str, Any], settings: dict[str, Any]) -> list[dict[str, Any]]:
    channels = settings.get("channels") or ["in_app"]
    risk_id = notification.get("risk_id")
    link = signed_link(f"/#/readiness?risk={risk_id}" if risk_id else "/#/readiness", risk_id=risk_id)
    text = f"{notification['title']}\n\n{notification['detail']}\n\n{link['url']}"
    results: list[dict[str, Any]] = []

    def record(channel: str, status: str, detail: str = "") -> None:
        results.append(store.record_delivery(tenant, notification["id"], channel, status, detail))

    if "in_app" in channels:
        record("in_app", "delivered", "Stored in the tenant inbox.")

    if "slack" in channels:
        if config.SLACK_WEBHOOK:
            try:
                _post_json(config.SLACK_WEBHOOK, {"text": text})
                record("slack", "delivered", "Slack webhook accepted.")
            except Exception as exc:  # noqa: BLE001 - report, do not crash the scan
                record("slack", "error", str(exc)[:300])
        else:
            record("slack", "simulated", "CUE_SLACK_WEBHOOK is not configured.")

    if "teams" in channels:
        if config.TEAMS_WEBHOOK:
            try:
                _post_json(config.TEAMS_WEBHOOK, {"text": text})
                record("teams", "delivered", "Teams webhook accepted.")
            except Exception as exc:  # noqa: BLE001
                record("teams", "error", str(exc)[:300])
        else:
            record("teams", "simulated", "CUE_TEAMS_WEBHOOK is not configured.")

    if "email" in channels:
        if config.SMTP_HOST:
            try:
                msg = EmailMessage()
                msg["Subject"] = f"[CUE] {notification['title']}"
                msg["From"] = config.EMAIL_FROM
                msg["To"] = settings.get("email_to", "production@example.invalid")
                msg.set_content(text)
                with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=8) as smtp:
                    if config.SMTP_USER:
                        smtp.starttls()
                        smtp.login(config.SMTP_USER, config.SMTP_PASSWORD)
                    smtp.send_message(msg)
                record("email", "delivered", "SMTP accepted.")
            except Exception as exc:  # noqa: BLE001
                record("email", "error", str(exc)[:300])
        else:
            record("email", "simulated", "CUE_SMTP_HOST is not configured.")

    if "sms" in channels:
        if config.SMS_URL:
            try:
                _post_json(
                    config.SMS_URL,
                    {"to": settings.get("sms_to", "+10000000000"), "message": text[:320]},
                    {"Authorization": f"Bearer {config.SMS_TOKEN}"},
                )
                record("sms", "delivered", "SMS gateway accepted.")
            except Exception as exc:  # noqa: BLE001
                record("sms", "error", str(exc)[:300])
        else:
            record("sms", "simulated", "CUE_SMS_URL is not configured.")

    if "webhook" in channels:
        if config.WEBHOOK_URL:
            try:
                raw = json.dumps(notification, separators=(",", ":")).encode("utf-8")
                digest = hmac.new(config.WEBHOOK_SECRET.encode("utf-8"), raw, hashlib.sha256).hexdigest()
                req = request.Request(
                    config.WEBHOOK_URL,
                    data=raw,
                    method="POST",
                    headers={"Content-Type": "application/json", "X-CUE-Signature": f"sha256={digest}"},
                )
                with request.urlopen(req, timeout=8) as response:
                    response.read()
                record("webhook", "delivered", "Signed webhook accepted.")
            except Exception as exc:  # noqa: BLE001
                record("webhook", "error", str(exc)[:300])
        else:
            record("webhook", "simulated", "CUE_WEBHOOK_URL is not configured.")

    return results


class CueSink:
    """The app side of ``laix_attention.ports.Sink``.

    The decision layer decides; this class owns the channels, the credentials and
    the delivery log. A different app implements the same two-line interface.
    """

    def __init__(self, store: Store, tenant: str, settings: dict[str, Any]) -> None:
        self.store = store
        self.tenant = tenant
        self.settings = settings

    def emit(self, notification: Mapping[str, Any]) -> list[dict[str, Any]]:
        return deliver(self.store, self.tenant, dict(notification), self.settings)
