"""Small request models. The show pack itself is a versioned JSON document."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class SignCueRequest(BaseModel):
    actor: str = "Mara Voss"
    note: str = ""


class ApproveVersionRequest(BaseModel):
    actor: str = "Jonas Reed"
    note: str = ""


class RiskActionRequest(BaseModel):
    actor: str = "Mara Voss"
    owner: str | None = None
    reason: str | None = None
    note: str = ""


class AskRequest(BaseModel):
    question: str
    active_look_id: str | None = None
    rejected_looks: list[str] = Field(default_factory=list)
    # A workspace show pack. When present, the agent reads this show instead of
    # the seeded demo. Read-only, size-capped, never persisted.
    pack: dict | None = None


class RenderSettings(BaseModel):
    device: Literal["gpu", "cpu", "npu"] = "gpu"
    quality: Literal["draft", "high", "show"] = "high"


class ExportRequest(BaseModel):
    actor: str = "Mara Voss"


def now_iso() -> str:
    return datetime.now().astimezone().replace(microsecond=0).isoformat()
