"""Configuration for the on-site CUE service.

The public GitHub Pages build is static. This service is the pilot path: it
serves the same SPA, keeps the append-only audit and the human decisions in
SQLite, and exposes the agent/render/readiness surfaces.
"""

from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def load_env_file(raw: str | None = None) -> dict[str, str]:
    """Load a .env file without adding a dependency.

    ``CUE_ENV_FILE`` points at any dotenv file, for example another checkout's
    ``.env``. Existing process variables always win, so a deployment can
    override a single value without editing the file. Returns the keys that
    were read, never the values.
    """
    raw = (raw if raw is not None else os.getenv("CUE_ENV_FILE", "")).strip()
    if not raw:
        return {}
    path = Path(raw).expanduser()
    if not path.is_absolute():
        path = (ROOT / path).resolve()
    if not path.is_file():
        return {}
    try:
        lines = path.read_text(encoding="utf-8-sig").splitlines()
    except OSError:
        return {}
    loaded: dict[str, str] = {}
    for line in lines:
        text = line.strip()
        if not text or text.startswith("#") or "=" not in text:
            continue
        text = text.removeprefix("export ")
        key, _, value = text.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if not key or not key.replace("_", "").isalnum():
            continue
        loaded[key] = value
        if key not in os.environ:
            os.environ[key] = value
    # A CoachMe-style file names the model connection API_BASE/API_KEY/MODEL_NAME.
    # Map them onto CUE's names once, so one file can drive both apps.
    for cue_key, alias in (
        ("CUE_LLM_API_BASE", "API_BASE"),
        ("CUE_LLM_API_KEY", "API_KEY"),
        ("CUE_LLM_MODEL", "MODEL_NAME"),
        ("CUE_LLM_PROVIDER", "MODEL_PROVIDER"),
        ("CUE_LLM_TIMEOUT", "LLM_TIMEOUT"),
        ("CUE_LLM_SSL_VERIFY", "LLM_SSL_VERIFY"),
    ):
        if not os.getenv(cue_key) and loaded.get(alias):
            os.environ[cue_key] = loaded[alias]
    return loaded


# A git-ignored `.env` at the repo root is the local development path. It may
# itself point at another checkout with CUE_ENV_FILE.
load_env_file(str(ROOT / ".env"))
ENV_FILE_LOADED = load_env_file()
PACK_PATH = Path(os.getenv("CUE_PACK", str(Path(__file__).parent / "data" / "show.json")))
DB_PATH = Path(os.getenv("CUE_DB", str(ROOT / "cue-data" / "cue.sqlite3")))
WEB_DIST = Path(os.getenv("CUE_WEB_DIST", str(ROOT / "web" / "dist")))
RUNTIME_DIR = Path(os.getenv("CUE_RUNTIME", str(ROOT / "cue-data" / "runtime")))
BACKUP_DIR = Path(os.getenv("CUE_BACKUP_DIR", str(ROOT / "cue-data" / "backups")))
ASSET_DIR = os.getenv("CUE_ASSET_DIR", "")

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

# OpenJiuwen runtime. "auto" uses it when the package and the model connection
# are both present; "0" forces the deterministic local agent; "1" requires it.
OPENJIUWEN_MODE = os.getenv("CUE_OPENJIUWEN", "auto").strip().lower()
LLM_PROVIDER = os.getenv("CUE_LLM_PROVIDER", "OpenAI")
LLM_API_BASE = os.getenv("CUE_LLM_API_BASE", "").rstrip("/")
LLM_API_KEY = os.getenv("CUE_LLM_API_KEY", "")
LLM_MODEL = os.getenv("CUE_LLM_MODEL", "")
LLM_TIMEOUT = float(os.getenv("CUE_LLM_TIMEOUT", "120"))
LLM_SSL_VERIFY = os.getenv("CUE_LLM_SSL_VERIFY", "false").strip().lower() in {"1", "true", "yes", "on"}
LLM_TEMPERATURE = float(os.getenv("CUE_LLM_TEMPERATURE", "0.15"))
AGENT_FALLBACK = os.getenv("CUE_AGENT_FALLBACK", "0") == "1"
# Start the agent runtime in the background at boot. The first deep-agent build
# imports openjiuwen and starts the global Runner; doing it on a click makes the
# first ask look broken.
OPENJIUWEN_WARMUP = os.getenv("CUE_OPENJIUWEN_WARMUP", "1") == "1"

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
