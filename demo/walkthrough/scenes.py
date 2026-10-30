"""The walkthrough scenes: a new tour built from nothing."""

SCENES = [
    {
        "key": "00_intro",
        "title": "CUE — a new tour, built from nothing",
        "shots": [],
        "voice": (
            "This is not a tour of a demo. It is a new tour, built from nothing in CUE: a blank workspace, a real venue "
            "list, imported files, a design decision, an agent that finds the problem, and a tour that ends checked, "
            "priced, signed and ready."
        ),
    },
    {
        "key": "01_blank",
        "title": "Six fields",
        "shots": ["blank", "new-form"],
        "voice": (
            "We start with six fields: artist, title, tour, the first room and the date. No sample data underneath. "
            "Harbour Lights, The Long Way Round, Kade 12 in Amsterdam, in November."
        ),
    },
    {
        "key": "02_new",
        "title": "A valid workspace",
        "shots": ["tour-new"],
        "voice": (
            "Create my tour gives a valid workspace — one venue, one look, one cue, no budget. The checklist is the "
            "path: venue, look, cue sheet, budget, date."
        ),
    },
    {
        "key": "03_configure",
        "title": "Make it the real tour",
        "shots": ["show-team", "venue-form", "date-form", "venues-dates"],
        "voice": (
            "Now make it the real tour. The team. A second room, The Foundry in Manchester: a twelve by eight stage, "
            "twenty-three kilowatts, a four-hundred-kilo rig rating. A second date. Two rooms with different limits — "
            "that is what a tour is."
        ),
    },
    {
        "key": "04_imports",
        "title": "Real files",
        "shots": ["imports", "cues-imported"],
        "voice": (
            "Instead of typing the rig, import the Vectorworks fixture schedule: twenty fixtures, twelve beams. Import "
            "the grandMA3 cue list: twelve cues. The files are parsed in the browser; nothing is uploaded. The blank "
            "placeholder cue is removed, so the sheet is the console's list."
        ),
    },
    {
        "key": "05_look",
        "title": "Build the look",
        "shots": ["look-form", "studio-full"],
        "voice": (
            "Build the look on the imported rig: all twenty fixtures, lime and cyan. The app computes twenty-seven "
            "point three kilowatts and four hundred and forty kilos on the front truss. This is the show the designer "
            "wants."
        ),
    },
    {
        "key": "06_checks",
        "title": "The room has a limit",
        "shots": ["checks-fail"],
        "voice": (
            "Now the app does the work a production office does. Kade 12 can take it. The Foundry has twenty-three "
            "kilowatts and a four-hundred-kilo rating: the checks name the room, the limit and the gap — before anyone "
            "plugs anything in."
        ),
    },
    {
        "key": "07_agent",
        "title": "The agent",
        "shots": ["agent"],
        "voice": (
            "Ask the agent. It reads this tour, calls the read-only tools and answers with the numbers: The Foundry, and "
            "a reduced look as the cheaper option. The tool trace is on the right. It proposes; it does not apply."
        ),
    },
    {
        "key": "08_fix",
        "title": "The designer decides",
        "shots": ["look-cut", "studio-fixed", "checks-pass"],
        "voice": (
            "So the designer makes the decision: a seven-beam cut, nineteen point one kilowatts and three hundred and "
            "twenty-six kilos. Select it. The checks pass in both rooms. This is the loop the product is for — propose, "
            "check, decide, and the numbers follow the decision."
        ),
    },
    {
        "key": "09_money",
        "title": "The money and the proof",
        "shots": ["budget-lines", "budget-over", "budget-under"],
        "voice": (
            "The money is not a separate spreadsheet. Add the real lines: rig and crew, five crew for two days, the van. "
            "The true total is twelve thousand seven hundred and forty-four. The first approval was twelve thousand — "
            "seven hundred and forty-four over. The producer approves thirteen thousand; the tour is two hundred and "
            "fifty-six under. Every look re-prices against that number."
        ),
    },
    {
        "key": "10_sign",
        "title": "Sign the sheet",
        "shots": ["cues-signed"],
        "voice": (
            "Sign the safety cues. The sheet the crew gets is the sheet the checks were reading. Export CSV, HTML or "
            "JSON."
        ),
    },
    {
        "key": "11_ready",
        "title": "Ready",
        "shots": ["ready", "home-final"],
        "voice": (
            "From six empty fields to a tour that is checked, priced, signed and ready. The band and the rooms are "
            "invented; the arithmetic, the imports, the agent and the decisions are real. CUE designs; the crew runs the "
            "show."
        ),
    },
]

END_CARD = {
    "key": "12_end",
    "title": "CUE",
    "shots": [],
    "voice": "",
}
