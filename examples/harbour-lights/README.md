# Worked example — Harbour Lights, *The Long Way Round*

A small club tour you can load, analyse and change. It is here so the workspace has a **real case**
next to the synthetic Nova Vale demo, and so you can see what to fill in and what to upload.

Everything is invented: the band, the company, the rooms and the money. The arithmetic, the checks
and the readiness model are the same code the app uses for your own data.

---

## The brief

| | |
|---|---|
| Artist | Harbour Lights (six-piece) |
| Tour | *The Long Way Round* — club tour 2026 |
| Company | Northline Production |
| Designer / producer / TM | Ines Duarte / Tom Becker / Sana Okafor |
| Dates | Amsterdam 11-14 · Rotterdam 11-18 · Manchester 11-27 · Glasgow 12-05 |
| Design | 12 × 8 m stage, 7 m trim, 12 beams + 4 washes + 2 spots + 2 bars |
| Budget | €15,000 approved (the UK leg was added after approval) |
| Cue sheet | 12 cues, 6 songs, 25 minutes of show |

The tour is already in trouble in four specific ways. That is the point: the example is built so the
readiness board, the budget and the checks have something true to say.

---

## Three ways to load it

**1. One click (easiest).** Open the app → **My tour** → **Load the worked example**. It becomes your
workspace; the synthetic demo stays in **Settings → Data source**.

**2. Import the show pack.** My tour → **Import a show pack** → `show-pack.json` from this folder.
The file is generated from `web/src/data/example.ts` by `npm run example`.

**3. Start blank and type it in.** My tour → fill the four fields, then add the rest by hand. The
values to use:

| Field | Value |
|---|---|
| Artist | `Harbour Lights` |
| Show title | `The Long Way Round` |
| Tour | `Club tour 2026` |
| Venue / city / capacity | `Kade 12` / `Amsterdam` / `450` |
| First date | `2026-11-14` |
| Stage (venue) | 12 × 8 m, 7 m trim |
| Power | 32 kW (Kade), 40 (Hangar), 23 (Foundry), 20 (Studio 4) |
| Rig rating | 600 / 700 / 450 / 400 kg |
| Approved budget | `15000` |

---

## The files in this folder

| File | What it is | Where it goes |
|---|---|---|
| `show-pack.json` | The whole tour: project, venues, rig, looks, cues, dates, budget, rights, risks | My tour → Import a show pack |
| `cues-grandma3.csv` | A real cue list export shape | My tour → Import cues (grandMA3 CSV) |
| `fixtures-vectorworks.csv` | A real fixture schedule shape | My tour → Import fixtures (Vectorworks CSV) |

The same three files are served from `web/public/examples/harbour-lights/`, so the app can offer them
as downloads without the repo.

### Cue CSV columns

```csv
Cue,Name,Trigger,Fade,Delay,Command,Page,Executor,Note
1,Doors / house,Time 0:00,2,0,House to half; stage warm,LX,1,Harbour Lights cue sheet v3
```

`Trigger` accepts `Time 3:45`, `3:45`, `1:02:03` or seconds. `Page` picks the cue kind when it is
`LX`, `VID`, `AUD`, `SFX`, `STG` or `CAM`. Imported cues arrive as `draft`, owned by `Imported`, and
never overwrite an existing id.

### Fixture CSV columns

```csv
id,label,kind,truss,x,y,z,watts,weight_kg,beam_angle,universe,address,rental
f-b01,Beam 1,beam,front,-5.4,1.6,6,800,38,8,1,1,180
```

`kind` is one of `beam`, `wash`, `spot`, `led_bar`, `strobe`, `follow`, `lamp`, `blinder`. A truss id
that does not exist yet is created. Importing a rig replaces the fixture list and drops fixture ids a
look no longer references, so the checks immediately use the new rig.

---

## What to analyse (and what you should find)

Open **Readiness** after loading, then **Budget**, **Cues** and the **Agent**.

| Question | Where | Expected |
|---|---|---|
| Which room cannot power the full look? | Readiness → power | **Glasgow**: 20 kW supply vs **27.3 kW** draw (136%). Manchester is 23 kW (119%). |
| Where is the rig over its rating? | Readiness → weight | Front truss is **440 kg**. Glasgow is rated **400 kg** (110%). Manchester is 450 kg (98%, warn). |
| Which rooms need a variant? | Readiness → venue | **The Foundry** 9 × 6 m / 6 m trim; **Studio 4** 8 × 6 m / 5.5 m. The design is 12 × 8 m / 7 m. |
| Which content is missing? | Cues / Readiness → asset | `tide_lines_v2.mp4`, used by cue **VID 2**. The fallback is **PAPER SKY**. |
| Which shows fall outside the licence? | Readiness → rights | Video licence ends **2026-11-15**; Manchester (11-27) and Glasgow (12-05) are outside. |
| Is the tour under budget? | Budget | Base show + contingency is **€15,714** against **€15,000** approved. With the optional four beams it is **€16,794** — **€1,794 over**. |
| What does the chorus cost? | Budget | The *Long way* look adds **€1,080** (four beams × €270). |

### Questions for the agent

With the on-site OpenJiuwen runtime connected, try:

- *Which room cannot power the full look, and what is the cheaper option?*
- *What is the rig load on the front truss in Glasgow?*
- *Which clip is missing, and what is the fallback?*
- *Which shows fall outside the video licence?*
- *What does the Long Way look cost against the approved budget?*
- *What should the producer fix first?*

The agent reads the same records the pages do, cites them, and cannot change a cue or sign safety.

---

## Change it

- **Edit the venue** in My tour and watch the power and weight checks move.
- **Import the fixture CSV** after editing a row (for example, drop four beams) and watch the front
  truss load fall in Readiness.
- **Set the approved budget** to €17,000 and the drift disappears.
- **Add a cue** at the drop, or change VID 2's look to the fallback, and print the cue sheet.
- **Export the tour as JSON** and import it on another machine.

---

## What is synthetic, and what is not

Synthetic: the band, the company, the four rooms, the crew, the songs and the money.

Real: the arithmetic in `web/src/lib/engine.ts` (power, truss load, glare, venue fit, budget with
contingency), the readiness lifecycle, the cue-sheet rules and the agent's read-only tool set. The
fixture and cue CSV shapes match the exports a crew already has.

No real artist, venue or production company is represented. The files are safe to upload.
