from __future__ import annotations

import json
from pathlib import Path

from cue.engine.show import (
    budget_base,
    budget_for_look,
    checks_for,
    cue_conflicts,
    cue_rows,
    effective_look,
    look_stats,
    missing_asset_cues,
    risk_stats,
)

PACK = json.loads((Path(__file__).resolve().parents[1] / "cue" / "data" / "show.json").read_text(encoding="utf-8"))


def test_aerial_12_is_over_power_weight_and_glare() -> None:
    stats = look_stats(PACK, "look-aerial-12")
    assert round(stats["power_kw"], 1) == 44.1
    assert stats["front_kg"] == 564
    assert stats["front_capacity_kg"] == 520
    assert stats["supply_pct"] > 1
    assert stats["weight_pct"] > 1
    assert stats["glare"] > 0.9


def test_landing_look_inside_the_rig_and_budget() -> None:
    stats = look_stats(PACK, "look-six-beam")
    assert round(stats["power_kw"], 1) == 34.5
    assert stats["front_kg"] == 312
    assert stats["supply_pct"] < 1
    assert stats["weight_pct"] < 1
    assert stats["glare"] < 0.55
    assert stats["budget_total"] == 27627


def test_budget_math() -> None:
    assert budget_base(PACK) == 25677
    assert budget_for_look(PACK, "look-aerial-12") == 29577
    assert budget_for_look(PACK, "look-six-beam") == 27627
    assert PACK["budget"]["approved"] == 29000


def test_checks_flag_the_hero_look() -> None:
    checks = checks_for(PACK, "look-aerial-12", "v-halcyon", "d-home")
    by_id = {c["id"]: c for c in checks}
    assert by_id["power"]["status"] == "fail"
    assert by_id["weight"]["status"] == "fail"
    assert by_id["glare"]["status"] == "fail"
    assert by_id["asset"]["status"] == "fail"
    assert by_id["cue-timing"]["status"] == "warn"
    assert by_id["budget"]["status"] == "warn"
    # five days of rights cover is inside the 7-day warning window
    assert by_id["rights"]["status"] == "warn"


def test_rights_expire_before_paris() -> None:
    checks = checks_for(PACK, "look-six-beam", "v-trabendo", "d-par")
    rights = next(c for c in checks if c["id"] == "rights")
    assert rights["status"] == "fail"


def test_cue_sheet_conflict_and_missing_asset() -> None:
    conflicts = cue_conflicts(PACK)
    assert len(conflicts) == 1
    assert conflicts[0]["gap"] < 0.5
    assert [c["id"] for c in missing_asset_cues(PACK)] == ["VID 4"]


def test_rejected_look_resolves_to_the_landing_look() -> None:
    resolved = effective_look(PACK, "look-aerial-12", ["look-aerial-12"], None)
    assert resolved is not None
    assert resolved["id"] == "look-six-beam"
    rows = cue_rows(PACK, ["look-aerial-12"], None)
    drop = next(r for r in rows if r["id"] == "LX 7")
    assert drop["look_name"] == "SIX BEAM + MONOLITH"


def test_risk_stats() -> None:
    stats = risk_stats(PACK["risks"])
    assert stats["open"] == 11
    assert stats["critical"] == 3
    assert stats["resolved"] == 2
    assert stats["dismissed"] == 1
