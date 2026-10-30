from __future__ import annotations

import copy
import json
import os
from pathlib import Path

import pytest

from cue import config
from cue.agent import openjiuwen_backend as oj
from cue.agent.runtime import AgentRuntime, AgentUnavailable
from cue.store.db import Store

PACK = json.loads((Path(__file__).resolve().parents[1] / "cue" / "data" / "show.json").read_text(encoding="utf-8"))


def test_toolbox_reads_real_records_and_never_writes() -> None:
    store = Store(":memory:")
    capture = oj._Capture()
    tools = oj.tool_functions(PACK, store, "halcyon", capture, "look-aerial-12")
    before = copy.deepcopy(PACK)

    summary = json.loads(tools["show_summary"]())
    assert summary["data"]["cues"] == len(PACK["cues"])
    assert summary["data"]["dates"]

    checks = json.loads(tools["look_checks"]("look-aerial-12"))
    assert checks["data"]
    assert any(citation["id"] == "cit-rig" for citation in checks["citations"])

    budget = json.loads(tools["look_budget"]("look-aerial-12"))
    assert budget["data"]["total_eur"] > 0
    assert budget["data"]["approved_eur"] == PACK["budget"]["approved"]

    risks = json.loads(tools["open_risks"]())
    assert risks["data"]["count"] >= 4
    assert risks["citations"]
    assert any(risk["fix"] and risk["open_checks"] for risk in risks["data"]["risks"])

    cues = json.loads(tools["cue_sheet"]())
    assert cues["data"]["missing_assets"]
    assert cues["data"]["clips"]
    # The recorded fallback must be visible to the agent, not hidden in the pack.
    asset_risks = cues["data"]["asset_risks"]
    assert asset_risks
    assert "MONOLITH" in json.dumps(asset_risks)
    assert asset_risks[0]["fix"]["label"]

    venue = json.loads(tools["find_venue"]("Apolo"))
    assert venue["data"]["found"] is True
    assert venue["data"]["venue"]["name"] == "Sala Apolo"

    rights = json.loads(tools["rights_windows"]())
    assert rights["data"]["rights"]
    assert any(right["dates_outside_window"] for right in rights["data"]["rights"])

    upcoming = json.loads(tools["next_show"]())
    assert upcoming["data"]["date"]["id"] == PACK["dates"][0]["id"]

    assert len(capture.steps) == 8
    assert all(step["ok"] for step in capture.steps)
    assert capture.citations
    # The tools are read-only: the show pack is byte-identical afterwards.
    assert PACK == before


def test_env_file_maps_a_coachme_style_file(tmp_path, monkeypatch) -> None:
    env = tmp_path / "coachme.env"
    env.write_text(
        "MODEL_PROVIDER=OpenAI\n"
        "API_BASE=https://example.invalid/v1\n"
        "API_KEY=test-key\n"
        "MODEL_NAME=test-model\n"
        "LLM_TIMEOUT=42\n",
        encoding="utf-8",
    )
    for key in ("CUE_LLM_API_BASE", "CUE_LLM_API_KEY", "CUE_LLM_MODEL", "CUE_LLM_PROVIDER", "CUE_LLM_TIMEOUT"):
        monkeypatch.delenv(key, raising=False)
    loaded = config.load_env_file(str(env))
    assert loaded["API_BASE"] == "https://example.invalid/v1"
    assert loaded["MODEL_NAME"] == "test-model"
    assert os.environ["CUE_LLM_MODEL"] == "test-model"
    assert os.environ["CUE_LLM_TIMEOUT"] == "42"


def test_env_file_does_not_override_the_process(tmp_path, monkeypatch) -> None:
    env = tmp_path / "cue.env"
    env.write_text("CUE_LLM_MODEL=from-file\n", encoding="utf-8")
    monkeypatch.setenv("CUE_LLM_MODEL", "from-process")
    config.load_env_file(str(env))
    assert os.environ["CUE_LLM_MODEL"] == "from-process"


def test_status_reports_openjiuwen_when_configured(monkeypatch) -> None:
    monkeypatch.setattr(config, "OPENJIUWEN_MODE", "1")
    monkeypatch.setattr(config, "LLM_API_BASE", "https://example.invalid/v1")
    monkeypatch.setattr(config, "LLM_API_KEY", "test-key")
    monkeypatch.setattr(config, "LLM_MODEL", "test-model")
    status = AgentRuntime(PACK).status()
    assert status.backend == "openjiuwen"
    assert status.model == "test-model"
    assert status.provider == "OpenAI"
    assert status.endpoint == "example.invalid"
    assert status.configured is True


def test_warm_is_a_noop_when_the_runtime_is_off(monkeypatch) -> None:
    monkeypatch.setattr(config, "OPENJIUWEN_MODE", "0")
    result = AgentRuntime(PACK).warm()
    assert result["ok"] is False
    assert "not enabled" in result["reason"]


def test_status_stays_local_without_credentials(monkeypatch) -> None:
    monkeypatch.setattr(config, "OPENJIUWEN_MODE", "auto")
    monkeypatch.setattr(config, "LLM_API_BASE", "")
    monkeypatch.setattr(config, "LLM_API_KEY", "")
    monkeypatch.setattr(config, "LLM_MODEL", "")
    status = AgentRuntime(PACK).status()
    assert status.backend == "deterministic-local"
    assert status.configured is False


def test_unreachable_runtime_is_explicit_by_default(monkeypatch) -> None:
    monkeypatch.setattr(config, "OPENJIUWEN_MODE", "1")
    monkeypatch.setattr(config, "LLM_API_BASE", "http://127.0.0.1:1/v1")
    monkeypatch.setattr(config, "LLM_API_KEY", "test-key")
    monkeypatch.setattr(config, "LLM_MODEL", "test-model")
    monkeypatch.setattr(config, "LLM_TIMEOUT", 5.0)
    monkeypatch.setattr(config, "AGENT_FALLBACK", False)
    with pytest.raises(AgentUnavailable):
        AgentRuntime(PACK).ask("Why is the front truss over?")


def test_fallback_is_labelled_when_opted_in(monkeypatch) -> None:
    monkeypatch.setattr(config, "OPENJIUWEN_MODE", "1")
    monkeypatch.setattr(config, "LLM_API_BASE", "http://127.0.0.1:1/v1")
    monkeypatch.setattr(config, "LLM_API_KEY", "test-key")
    monkeypatch.setattr(config, "LLM_MODEL", "test-model")
    monkeypatch.setattr(config, "LLM_TIMEOUT", 5.0)
    monkeypatch.setattr(config, "AGENT_FALLBACK", True)
    answer = AgentRuntime(PACK).ask("Why is the front truss over?")
    assert answer["degraded"] is True
    assert answer["backend"] == "deterministic-local"
    assert "did not answer" in answer["notice"]


@pytest.mark.live
def test_live_openjiuwen_answer_is_cited(monkeypatch) -> None:
    if os.getenv("CUE_LIVE_AGENT") != "1":
        pytest.skip("set CUE_LIVE_AGENT=1 and CUE_ENV_FILE=<path to a dotenv file> to run the live agent test")
    env_file = os.getenv("CUE_ENV_FILE", "")
    if env_file:
        config.load_env_file(env_file)
    monkeypatch.setattr(config, "OPENJIUWEN_MODE", "auto")
    monkeypatch.setattr(config, "LLM_API_BASE", os.environ.get("CUE_LLM_API_BASE", ""))
    monkeypatch.setattr(config, "LLM_API_KEY", os.environ.get("CUE_LLM_API_KEY", ""))
    monkeypatch.setattr(config, "LLM_MODEL", os.environ.get("CUE_LLM_MODEL", ""))
    monkeypatch.setattr(config, "LLM_TIMEOUT", 180.0)
    if not oj.runtime_installed():
        pytest.skip("openjiuwen is not installed in this interpreter")
    if not oj.connection_configured():
        pytest.skip("no model connection configured")
    answer = AgentRuntime(PACK, Store(":memory:")).ask("Why is the front truss over?", "look-aerial-12")
    assert answer["backend"] == "openjiuwen"
    assert answer["citations"]
    assert answer["steps"]
    assert "front truss" in answer["body"].lower()
