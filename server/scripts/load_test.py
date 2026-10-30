"""Synthetic load harness: 500 tours, 5,000 shows, 100 producers.

This is not a cloud load test. It exercises the pure show engine at the scale the
pilot brief names, so a regression in the check path is visible in CI or on a
laptop before a real deployment.
"""

from __future__ import annotations

import json
import random
import time
from pathlib import Path

from cue.engine.show import checks_for

PACK = json.loads((Path(__file__).resolve().parents[1] / "cue" / "data" / "show.json").read_text(encoding="utf-8"))


def main() -> None:
    random.seed(20261030)
    base_dates = PACK["dates"]
    dates = []
    for tour in range(500):
        for show in range(10):
            source = base_dates[(tour + show) % len(base_dates)]
            dates.append(
                {
                    **source,
                    "id": f"tour-{tour:03d}-show-{show:02d}",
                    "city": f"{source['city']} {tour}-{show}",
                    "date": f"2027-{(show % 12) + 1:02d}-{(show + 1):02d}",
                }
            )
    # 100 named producers; the engine does not personify them, the pilot does.
    producers = [f"producer-{index:03d}" for index in range(100)]
    pack = {**PACK, "dates": dates}
    started = time.perf_counter()
    checked = 0
    for date in dates:
        checks_for(pack, "look-aerial-12", date["venueId"], date["id"])
        checked += 1
    elapsed = time.perf_counter() - started
    print(f"tours=500 shows={checked} producers={len(producers)} seconds={elapsed:.2f} checks_per_second={checked / elapsed:.0f}")
    assert elapsed < 60, "the pure engine should not take a minute for 5,000 shows"


if __name__ == "__main__":
    main()
