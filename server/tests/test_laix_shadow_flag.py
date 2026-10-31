"""With the flag off, LAIX is not imported and the native scan is unchanged."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

SERVER = Path(__file__).resolve().parents[1]

SCRIPT = """
import json
import sys

from cue.proactive import scanner
from cue.store.db import Store

pack = json.load(open("cue/data/show.json", encoding="utf-8"))
settings = scanner.default_settings(pack)
settings.update(mode="live", quietHours="22:00-06:00")
result = scanner.run_scan(pack, Store(":memory:"), "flag-test", settings)
print(json.dumps({
    "raised": result["run"]["raised"],
    "checked": result["run"]["checked"],
    "status": result["run"]["status"],
    "notifications": sorted((n["severity"], n["title"], n["delivered"]) for n in result["notifications"]),
    "laix_imported": "laix" in sys.modules,
    "integration_imported": "laix_integration" in sys.modules,
}, sort_keys=True))
"""


def run_scan(flag: str | None) -> dict:
    environment = dict(os.environ)
    environment["PYTHONPATH"] = str(SERVER)
    environment.pop("CUE_LAIX_MODE", None)
    environment.pop("CUE_LAIX_LOG", None)
    if flag is not None:
        environment["CUE_LAIX_MODE"] = flag

    completed = subprocess.run(
        [sys.executable, "-c", SCRIPT],
        cwd=SERVER,
        env=environment,
        capture_output=True,
        text=True,
        timeout=180,
        check=False,
    )
    assert completed.returncode == 0, completed.stderr
    return json.loads(completed.stdout.strip().splitlines()[-1])


def test_the_default_flag_is_off_and_never_imports_laix() -> None:
    result = run_scan(None)
    assert result["laix_imported"] is False
    assert result["integration_imported"] is False
    assert result["status"] == "ok"
    assert result["notifications"]


def test_an_explicit_off_is_identical_to_unset() -> None:
    unset = run_scan(None)
    off = run_scan("off")
    assert unset == off


def test_an_unknown_value_is_treated_as_off() -> None:
    result = run_scan("on")
    assert result["laix_imported"] is False
    assert result["integration_imported"] is False
