"""Configuration for the on-site CUE service.

The public GitHub Pages build is static. This service is the pilot path: it
serves the same SPA, keeps the append-only audit and the human decisions in
SQLite, and exposes the agent/render/readiness surfaces.
"""

from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PACK_PATH = Path(os.getenv("CUE_PACK", str(Path(__file__).parent / "data" / "show.json")))
DB_PATH = Path(os.getenv("CUE_DB", str(ROOT / "cue-data" / "cue.sqlite3")))
WEB_DIST = Path(os.getenv("CUE_WEB_DIST", str(ROOT / "web" / "dist")))
RUNTIME_DIR = Path(os.getenv("CUE_RUNTIME", str(ROOT / "cue-data" / "runtime")))
BACKUP_DIR = Path(os.getenv("CUE_BACKUP_DIR", str(ROOT / "cue-data" / "backups")))

MODEL_VERSION = os.getenv("CUE_MODEL_VERSION", "cue-looksmith-1.4.0")
DEFAULT_TENANT = os.getenv("CUE_DEFAULT_TENANT", "halcyon")
TENANTS = [t.strip().lower() for t in os.getenv("CUE_TENANTS", DEFAULT_TENANT).split(",") if t.strip()] or [DEFAULT_TENANT]
AGENT_BACKEND = os.getenv("CUE_AGENT_BACKEND", "")  # e.g. jiuwenswarm
AGENT_MODEL = os.getenv("CUE_AGENT_MODEL", MODEL_VERSION)
AGENT_ENDPOINT = os.getenv("CUE_AGENT_ENDPOINT", "").rstrip("/")
AGENT_API_KEY = os.getenv("CUE_AGENT_API_KEY", "")
STRICT_INTEGRATIONS = os.getenv("CUE_STRICT_INTEGRATIONS", "0") == "1"
RENDER_DEVICE = os.getenv("CUE_RENDER_DEVICE", "gpu")
NPU_ENDPOINT = os.getenv("CUE_NPU_ENDPOINT", "")

# Proactive readiness
SCHEDULER_ENABLED = os.getenv("CUE_SCHEDULER", "0") in {"1", "true", "yes"}
SCAN_INTERVAL_MINUTES = int(os.getenv("CUE_SCAN_INTERVAL_MINUTES", "1440"))
PUBLIC_URL = os.getenv("CUE_PUBLIC_URL", "http://127.0.0.1:8000")
SHARE_SECRET = os.getenv("CUE_SHARE_SECRET", "cue-demo-share-secret-change-me")
SHARE_TTL_HOURS = int(os.getenv("CUE_SHARE_TTL_HOURS", "72"))

# Delivery
SLACK_WEBHOOK = os.getenv("CUE_SLACK_WEBHOOK", "")
TEAMS_WEBHOOK = os.getenv("CUE_TEAMS_WEBHOOK", "")
WEBHOOK_URL = os.getenv("CUE_WEBHOOK_URL", "")
WEBHOOK_SECRET = os.getenv("CUE_WEBHOOK_SECRET", "")
SMTP_HOST = os.getenv("CUE_SMTP_HOST", "")
SMTP_PORT = int(os.getenv("CUE_SMTP_PORT", "587"))
SMTP_USER = os.getenv("CUE_SMTP_USER", "")
SMTP_PASSWORD = os.getenv("CUE_SMTP_PASSWORD", "")
EMAIL_FROM = os.getenv("CUE_EMAIL_FROM", "cue@example.invalid")
SMS_URL = os.getenv("CUE_SMS_URL", "")
SMS_TOKEN = os.getenv("CUE_SMS_TOKEN", "")


def cors_origins() -> list[str]:
    raw = os.getenv("CUE_CORS_ORIGINS", "http://127.0.0.1:5174,http://localhost:5174")
    return [o.strip() for o in raw.split(",") if o.strip()]
