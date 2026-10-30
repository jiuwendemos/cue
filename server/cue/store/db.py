"""SQLite show store.

Append-only audit, cue signatures, version approvals and readiness lifecycle.
Every row is scoped to a tenant. The public demo is a static pack; this store is
the on-site pilot path. No cue is released automatically: a signature is a
human row.
"""

from __future__ import annotations

import json
import sqlite3
import threading
from datetime import datetime
from pathlib import Path
from typing import Any

from ..config import MODEL_VERSION


def now_iso() -> str:
    return datetime.now().astimezone().replace(microsecond=0).isoformat()


SCHEMA = """
CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant TEXT NOT NULL,
  at TEXT NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  object TEXT NOT NULL,
  detail TEXT NOT NULL,
  model_version TEXT NOT NULL,
  sources TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit(tenant, id DESC);
CREATE TABLE IF NOT EXISTS cue_signatures (
  tenant TEXT NOT NULL,
  cue_id TEXT NOT NULL,
  actor TEXT NOT NULL,
  at TEXT NOT NULL,
  signature TEXT NOT NULL,
  PRIMARY KEY (tenant, cue_id)
);
CREATE TABLE IF NOT EXISTS version_approvals (
  tenant TEXT NOT NULL,
  version_id TEXT NOT NULL,
  actor TEXT NOT NULL,
  at TEXT NOT NULL,
  note TEXT NOT NULL,
  signature TEXT NOT NULL,
  PRIMARY KEY (tenant, version_id)
);
CREATE TABLE IF NOT EXISTS risk_states (
  tenant TEXT NOT NULL,
  risk_id TEXT NOT NULL,
  state TEXT NOT NULL,
  owner TEXT,
  dismissed_reason TEXT,
  updated_at TEXT NOT NULL,
  verified_at TEXT,
  PRIMARY KEY (tenant, risk_id)
);
CREATE TABLE IF NOT EXISTS risk_checks (
  tenant TEXT NOT NULL,
  risk_id TEXT NOT NULL,
  check_id TEXT NOT NULL,
  at TEXT NOT NULL,
  PRIMARY KEY (tenant, risk_id, check_id)
);
"""


class Store:
    def __init__(self, path: str | Path = ":memory:") -> None:
        self.path = str(path)
        if self.path != ":memory:":
            Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(self.path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        with self._lock:
            self._conn.executescript(SCHEMA)
            self._conn.commit()

    def close(self) -> None:
        with self._lock:
            self._conn.close()

    def audit(
        self,
        tenant: str,
        actor: str,
        action: str,
        obj: str,
        detail: str,
        sources: list[str] | None = None,
        model_version: str = MODEL_VERSION,
    ) -> dict[str, Any]:
        at = now_iso()
        with self._lock:
            cur = self._conn.execute(
                "INSERT INTO audit(tenant, at, actor, action, object, detail, model_version, sources) VALUES (?,?,?,?,?,?,?,?)",
                (tenant, at, actor, action, obj, detail, model_version, json.dumps(sources or [])),
            )
            self._conn.commit()
            return {
                "id": f"a-{cur.lastrowid}",
                "at": at,
                "actor": actor,
                "action": action,
                "object": obj,
                "detail": detail,
                "modelVersion": model_version,
                "sources": sources or [],
            }

    def audits(self, tenant: str, limit: int = 100, object_id: str | None = None) -> list[dict[str, Any]]:
        query = "SELECT * FROM audit WHERE tenant = ?"
        args: list[Any] = [tenant]
        if object_id:
            query += " AND object = ?"
            args.append(object_id)
        query += " ORDER BY id DESC LIMIT ?"
        args.append(limit)
        with self._lock:
            rows = self._conn.execute(query, args).fetchall()
        return [
            {
                "id": f"a-{r['id']}",
                "at": r["at"],
                "actor": r["actor"],
                "action": r["action"],
                "object": r["object"],
                "detail": r["detail"],
                "modelVersion": r["model_version"],
                "sources": json.loads(r["sources"]),
            }
            for r in rows
        ]

    def sign_cue(self, tenant: str, cue_id: str, actor: str, signature: str) -> dict[str, Any]:
        at = now_iso()
        with self._lock:
            self._conn.execute(
                "INSERT OR REPLACE INTO cue_signatures(tenant, cue_id, actor, at, signature) VALUES (?,?,?,?,?)",
                (tenant, cue_id, actor, at, signature),
            )
            self._conn.commit()
        self.audit(tenant, actor, "cue.signed", cue_id, f"Safety sign-off recorded for {cue_id}.", ["human"])
        return {"cue_id": cue_id, "actor": actor, "at": at, "signature": signature}

    def cue_signatures(self, tenant: str) -> dict[str, dict[str, Any]]:
        with self._lock:
            rows = self._conn.execute("SELECT * FROM cue_signatures WHERE tenant = ?", (tenant,)).fetchall()
        return {r["cue_id"]: {"actor": r["actor"], "at": r["at"], "signature": r["signature"]} for r in rows}

    def approve_version(self, tenant: str, version_id: str, actor: str, note: str, signature: str) -> dict[str, Any]:
        at = now_iso()
        with self._lock:
            self._conn.execute(
                "INSERT OR REPLACE INTO version_approvals(tenant, version_id, actor, at, note, signature) VALUES (?,?,?,?,?,?)",
                (tenant, version_id, actor, at, note, signature),
            )
            self._conn.commit()
        self.audit(tenant, actor, "version.approved", version_id, f"Approved. {note}".strip(), ["show"])
        return {"version_id": version_id, "actor": actor, "at": at, "note": note, "signature": signature}

    def version_approvals(self, tenant: str) -> dict[str, dict[str, Any]]:
        with self._lock:
            rows = self._conn.execute("SELECT * FROM version_approvals WHERE tenant = ?", (tenant,)).fetchall()
        return {
            r["version_id"]: {"actor": r["actor"], "at": r["at"], "note": r["note"], "signature": r["signature"]}
            for r in rows
        }

    def set_risk_state(
        self,
        tenant: str,
        risk_id: str,
        state: str,
        owner: str | None = None,
        reason: str | None = None,
        verified: bool = False,
    ) -> dict[str, Any]:
        at = now_iso()
        with self._lock:
            existing = self._conn.execute(
                "SELECT * FROM risk_states WHERE tenant = ? AND risk_id = ?", (tenant, risk_id)
            ).fetchone()
            self._conn.execute(
                "INSERT OR REPLACE INTO risk_states(tenant, risk_id, state, owner, dismissed_reason, updated_at, verified_at) VALUES (?,?,?,?,?,?,?)",
                (
                    tenant,
                    risk_id,
                    state,
                    owner if owner is not None else (existing["owner"] if existing else None),
                    reason if reason is not None else (existing["dismissed_reason"] if existing else None),
                    at,
                    at if verified else (existing["verified_at"] if existing else None),
                ),
            )
            self._conn.commit()
        return {
            "risk_id": risk_id,
            "state": state,
            "owner": owner,
            "dismissed_reason": reason,
            "updated_at": at,
            "verified_at": at if verified else None,
        }

    def risk_states(self, tenant: str) -> dict[str, dict[str, Any]]:
        with self._lock:
            rows = self._conn.execute("SELECT * FROM risk_states WHERE tenant = ?", (tenant,)).fetchall()
        return {
            r["risk_id"]: {
                "state": r["state"],
                "owner": r["owner"],
                "dismissed_reason": r["dismissed_reason"],
                "updated_at": r["updated_at"],
                "verified_at": r["verified_at"],
            }
            for r in rows
        }

    def complete_check(self, tenant: str, risk_id: str, check_id: str) -> dict[str, Any]:
        at = now_iso()
        with self._lock:
            self._conn.execute(
                "INSERT OR REPLACE INTO risk_checks(tenant, risk_id, check_id, at) VALUES (?,?,?,?)",
                (tenant, risk_id, check_id, at),
            )
            self._conn.commit()
        self.audit(tenant, "Mara Voss", "risk.check", risk_id, f"Completed check {check_id}.", ["human"])
        return {"risk_id": risk_id, "check_id": check_id, "at": at}

    def risk_checks(self, tenant: str) -> dict[str, list[str]]:
        with self._lock:
            rows = self._conn.execute("SELECT risk_id, check_id FROM risk_checks WHERE tenant = ?", (tenant,)).fetchall()
        out: dict[str, list[str]] = {}
        for r in rows:
            out.setdefault(r["risk_id"], []).append(r["check_id"])
        return out

    def reset(self, tenant: str) -> None:
        with self._lock:
            for table in ("audit", "cue_signatures", "version_approvals", "risk_states", "risk_checks"):
                self._conn.execute(f"DELETE FROM {table} WHERE tenant = ?", (tenant,))
            self._conn.commit()

    def counts(self, tenant: str) -> dict[str, int]:
        with self._lock:
            audits = self._conn.execute("SELECT COUNT(*) FROM audit WHERE tenant = ?", (tenant,)).fetchone()[0]
            signs = self._conn.execute("SELECT COUNT(*) FROM cue_signatures WHERE tenant = ?", (tenant,)).fetchone()[0]
            approvals = self._conn.execute("SELECT COUNT(*) FROM version_approvals WHERE tenant = ?", (tenant,)).fetchone()[0]
            risks = self._conn.execute("SELECT COUNT(*) FROM risk_states WHERE tenant = ?", (tenant,)).fetchone()[0]
        return {"audit": audits, "signatures": signs, "approvals": approvals, "risk_states": risks}
