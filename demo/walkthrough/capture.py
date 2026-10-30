"""Capture the build-a-new-tour walkthrough from the live app.

Fresh browser → My tour → six fields → venues, dates, imports, looks, cues,
readiness, the agent, the fix, the budget, the signature.

    uv run --with playwright python demo/walkthrough/capture.py
"""

from __future__ import annotations

import json
import time
from pathlib import Path

from playwright.sync_api import Page, sync_playwright

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent.parent
FRAMES = ROOT / "frames"
BASE = "http://127.0.0.1:8100"


def main() -> None:
    FRAMES.mkdir(parents=True, exist_ok=True)
    for old in FRAMES.glob("*.png"):
        old.unlink()
    shots: list[dict] = []

    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True)
        context = browser.new_context(
            viewport={"width": 1600, "height": 900},
            device_scale_factor=1,
            locale="en-GB",
            color_scheme="dark",
        )
        page = context.new_page()
        page.add_init_script(
            """
            document.addEventListener('DOMContentLoaded', () => {
              const style = document.createElement('style');
              style.textContent = '*{scrollbar-width:none} ::-webkit-scrollbar{display:none} .toast{display:none!important}';
              document.head.appendChild(style);
            });
            """
        )

        def shot(name: str, wait: int = 500, scroll: int | None = None) -> None:
            if scroll is not None:
                page.evaluate(f"window.scrollTo(0, {scroll})")
            page.wait_for_timeout(wait)
            path = FRAMES / f"{len(shots):02d}-{name}.png"
            page.screenshot(path=str(path))
            shots.append({"name": name, "file": path.name})
            print(f"shot {path.name}")

        def panel(text: str):
            return page.locator(".panel").filter(has_text=text).first

        def fill(root, label: str, value: str) -> None:
            root.get_by_label(label, exact=False).first.fill(value)

        def click(root, name: str) -> None:
            root.get_by_role("button", name=name, exact=False).first.click()

        def look_id(name: str) -> str:
            looks = page.evaluate("() => JSON.parse(localStorage.getItem('cue.demo.v1')).workspace.looks")
            return next(item["id"] for item in looks if item["name"] == name)

        page.goto(f"{BASE}/#/tour", wait_until="domcontentloaded")
        page.evaluate("localStorage.removeItem('cue.demo.v1')")
        page.reload(wait_until="domcontentloaded")
        page.wait_for_selector("text=Start with your show", timeout=30000)
        # The first-run synthetic-show guide is a modal; close it once.
        try:
            page.get_by_role("button", name="Close", exact=True).first.click(timeout=2500)
            page.wait_for_timeout(400)
        except Exception:
            pass
        shot("blank")

        # Six fields. Everything else is built in the app.
        fill(page, "Artist", "Harbour Lights")
        fill(page, "Show title", "The Long Way Round")
        fill(page, "Tour name", "Club tour 2026")
        fill(page, "Venue", "Kade 12")
        fill(page, "City", "Amsterdam")
        fill(page, "Capacity", "450")
        fill(page, "First show date", "2026-11-14")
        shot("new-form")
        click(page, "Create my tour")
        page.wait_for_selector("text=Save show", timeout=30000)
        shot("tour-new")

        # The team
        fill(panel("The show"), "Company", "Northline Production")
        fill(panel("The show"), "Designer", "Ines Duarte")
        fill(panel("The show"), "Producer", "Tom Becker")
        fill(panel("The show"), "Tour manager", "Sana Okafor")
        click(panel("The show"), "Save show")
        page.wait_for_timeout(600)
        shot("show-team")

        # The second room: 23 kW, 450 kg, a 12 x 8 stage
        venues = panel("Venues")
        click(venues, "New venue")
        page.wait_for_timeout(400)
        fill(venues, "Name", "The Foundry")
        fill(venues, "City", "Manchester")
        fill(venues, "Capacity", "380")
        fill(venues, "Stage width (m)", "12")
        fill(venues, "Stage depth (m)", "8")
        fill(venues, "Trim (m)", "7")
        fill(venues, "Power (kW)", "23")
        fill(venues, "Rig rating (kg)", "400")
        fill(venues, "Load-in (h)", "4")
        fill(venues, "Curfew", "23:00")
        shot("venue-form")
        click(venues, "Save venue")
        page.wait_for_timeout(700)

        # The second date
        dates = panel("Dates")
        click(dates, "New date")
        page.wait_for_timeout(400)
        fill(dates, "City", "Manchester")
        fill(dates, "Date", "2026-11-27")
        dates.locator("select").first.select_option(label="The Foundry")
        shot("date-form")
        click(dates, "Add date")
        page.wait_for_timeout(700)
        shot("venues-dates")

        # Real files in: the rig and the cue list
        data = panel("Your data")
        data.locator('input[type=file][accept=".csv,text/csv"]').nth(1).set_input_files(
            str(REPO / "examples" / "harbour-lights" / "fixtures-vectorworks.csv")
        )
        page.wait_for_timeout(1200)

        # Remove the placeholder cue before importing, so cue ids stay clean.
        page.locator("tr").filter(has_text="Blackout").first.get_by_role("button", name="Edit").click()
        page.wait_for_timeout(400)
        page.get_by_role("button", name="Remove", exact=True).click()
        page.wait_for_timeout(500)

        data.locator('input[type=file][accept=".csv,text/csv"]').nth(0).set_input_files(
            str(REPO / "examples" / "harbour-lights" / "cues-grandma3.csv")
        )
        page.wait_for_timeout(1400)
        shot("imports")
        shot("cues-imported", scroll=100000)

        # The look: all twenty fixtures
        looks = panel("Looks")
        click(looks, "New look")
        page.wait_for_timeout(400)
        fill(looks, "Name", "Long way")
        shot("look-form")
        click(looks, "Save look")
        page.wait_for_timeout(700)

        # The studio on that look
        first = look_id("Long way")
        page.goto(f"{BASE}/#/show?look={first}", wait_until="domcontentloaded")
        page.wait_for_selector("text=The Long Way Round", timeout=30000)
        page.wait_for_timeout(900)
        shot("studio-full")

        # What the checks say, before load-in
        page.goto(f"{BASE}/#/readiness", wait_until="domcontentloaded")
        page.wait_for_selector("text=Checks on this tour", timeout=30000)
        page.wait_for_timeout(700)
        shot("checks-fail")

        # The agent, on this tour
        page.goto(
            f"{BASE}/#/agent?q=Which%20room%20cannot%20power%20the%20full%20look%2C%20and%20what%20is%20the%20cheaper%20option%3F",
            wait_until="domcontentloaded",
        )
        page.wait_for_function(
            "() => { const el = document.querySelector('.answer-body'); return el && el.innerText.trim().length > 80; }",
            timeout=240000,
        )
        page.wait_for_timeout(700)
        shot("agent")

        # The designer builds the reduced look and applies it
        page.goto(f"{BASE}/#/tour", wait_until="domcontentloaded")
        page.wait_for_selector("text=Save show", timeout=30000)
        looks = panel("Looks")
        click(looks, "New look")
        page.wait_for_timeout(400)
        fill(looks, "Name", "Foundry cut")
        click(looks, "None")
        for index in range(7):
            looks.locator(".look-fixture").nth(index).click()
        page.wait_for_timeout(300)
        shot("look-cut")
        click(looks, "Save look")
        page.wait_for_timeout(700)

        second = look_id("Foundry cut")
        page.goto(f"{BASE}/#/show?look={second}", wait_until="domcontentloaded")
        page.wait_for_selector("text=The Long Way Round", timeout=30000)
        page.wait_for_timeout(800)
        shot("studio-fixed")

        page.goto(f"{BASE}/#/readiness", wait_until="domcontentloaded")
        page.wait_for_selector("text=Checks on this tour", timeout=30000)
        page.wait_for_timeout(700)
        shot("checks-pass")

        # The real budget: three lines, then the approval
        page.goto(f"{BASE}/#/tour", wait_until="domcontentloaded")
        page.wait_for_selector("text=Save show", timeout=30000)
        budget = panel("Budget")
        for name, qty, cost in [("Rig and crew", "1", "4800"), ("Crew x5 x2 days", "10", "520"), ("Van and trailer", "1", "1800")]:
            fill(budget, "Line name", name)
            fill(budget, "Qty", qty)
            fill(budget, "Unit cost", cost)
            click(budget, "Add line")
            page.wait_for_timeout(400)
        fill(budget, "Approved total (EUR)", "12000")
        click(budget, "Set approved")
        page.wait_for_timeout(600)
        shot("budget-lines")

        page.goto(f"{BASE}/#/budget", wait_until="domcontentloaded")
        page.wait_for_selector("text=Rig and budget", timeout=30000)
        page.wait_for_timeout(700)
        shot("budget-over")
        page.locator("#budget-approved").fill("13000")
        page.get_by_role("button", name="Set", exact=True).click()
        page.wait_for_timeout(700)
        shot("budget-under")

        # Sign the safety cues
        page.goto(f"{BASE}/#/cues", wait_until="domcontentloaded")
        page.wait_for_selector("text=Cue sheet", timeout=30000)
        page.get_by_role("button", name="Sign the safety cues").first.click()
        page.wait_for_timeout(700)
        shot("cues-signed")

        # Ready
        page.goto(f"{BASE}/#/readiness", wait_until="domcontentloaded")
        page.wait_for_selector("text=Checks on this tour", timeout=30000)
        page.wait_for_timeout(700)
        shot("ready")

        page.goto(f"{BASE}/#/", wait_until="domcontentloaded")
        page.wait_for_selector("text=MY TOUR", timeout=30000)
        page.wait_for_timeout(700)
        shot("home-final")

        context.close()
        browser.close()

    (ROOT / "shots.json").write_text(json.dumps(shots, indent=2), encoding="utf-8")
    print(f"{len(shots)} frames in {FRAMES}")


if __name__ == "__main__":
    started = time.time()
    main()
    print(f"done in {time.time() - started:.1f}s")
