# Your own data

CUE has two data sources, and one switch between them.

| | Synthetic demo | Your tour |
|---|---|---|
| What it is | Nova Vale — Night Signal, a fixed pack | A workspace you create and edit |
| Where it lives | `web/src/data/pack.ts` (and `server/cue/data/show.json`) | This browser (`localStorage`), exportable as JSON |
| Who edits it | Nobody; it is the demo | You: show, dates, venues, looks, cues, budget |
| Switch | Settings → Data source → **Synthetic demo** | Settings → Data source → **My tour** |

Switching never deletes the other. It **does** clear the open decisions on the show you leave
(signatures, risk states, votes), because a signature belongs to a show. The show data stays.

## Start

Open **My tour**:

- **Create my tour** — the four fields that matter (artist, title, tour, venue, city, date). You get one
  venue, one look, one cue and a 12 × 8 m stage to build on.
- **Load the worked example** — Harbour Lights, a four-room club tour with four open risks. See
  [`examples/harbour-lights/`](../examples/harbour-lights/README.md).
- **Import a show pack** — a JSON file exported from another browser or machine.

A deep link can load the example once: `#/?example=1` (works on any route).

## Author

| Object | What you can edit |
|---|---|
| Show | artist, title, tour, company, designer, producer, tour manager |
| Dates | city, date, venue; add and remove |
| Venues | name, city, capacity, stage width/depth/trim, power kW, rig rating, load-in, curfew |
| Looks | name, palette, audience-aimed fixtures, energy; add and remove |
| Cues | number, id, time, title, detail, fade, kind, look, status, safety flag; add and remove |
| Budget | approved total, line items (name, category, qty, unit cost); add and remove |

The checks, previz, budget, cue sheet and readiness all read this pack. There is no separate
"workspace mode" in the engine: the same code that analyses the demo analyses your tour.

## Imports

| File | What it does |
|---|---|
| Show pack `.json` | Replaces the workspace with the imported pack |
| grandMA3 cue `.csv` | Appends cues; columns `Cue, Name, Trigger, Fade, Command, Page, Note`. Imported cues arrive as `draft`, owned by `Imported` |
| Vectorworks fixture `.csv` | Replaces the rig fixtures; columns `id, label, kind, truss, x, y, z, watts, weight_kg, beam_angle, universe, address, rental`. Unknown truss ids are created |

CSV parsing happens **in the browser**. The files never leave the machine. The on-site API also has
preview endpoints (`/api/import/vectorworks`, `/api/import/grandma3`) for a server-side review flow.

## Export and reset

- **Export my tour (JSON)** — the whole pack, safe to commit or hand to another machine.
- **Reset** (Settings) clears decisions, not your data.
- **Delete my tour** removes the workspace and returns to the demo.

## Limits, honestly

- **One editor per browser.** There is no server-side content API yet, so two people cannot edit the
  same tour. The on-site service stores *decisions* (signatures, approvals, readiness) in SQLite; the
  show content is still one pack.
- **No asset upload.** Video clips, posters and drawings are referenced by name; the DAM folder scan
  checks them on the server.
- **No version history of your own edits yet.** Versions are the approval record, not a diff of the
  tour.
- **The 90-second film is the demo.** It does not play your tour.
- **The proof table is the demo's pilot data** until a real pilot replaces it.

## What would make it multi-user

`POST /api/shows` + `PATCH /api/venues|looks|cues|dates|budget` against Postgres, a tenant-scoped
revision, and the same optimistic UI. The client already keeps the whole pack in one object, so the
API is the missing half, not a rewrite.
