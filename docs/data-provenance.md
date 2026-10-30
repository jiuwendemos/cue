# Data provenance

**The public demo is synthetic.** This sheet is the source of truth for every asset, and the in-app
provenance page says the same thing.

## Show and people

- **Nova Vale**, **Night Signal**, **Halcyon Productions**, the crew, the venues, the tour dates and the
  pilot numbers are invented for this demo.
- The show is a fixed pack, seed `20261030`, generated `2026-10-30`.
- No customer, artist, venue or crew data is used.

## Music

- The track is **synthesised in the browser** with Web Audio from the show's energy curve (kick, bass,
  pad, hats, riser). There is no commercial recording and no sample pack.
- The cue sheet and the audio share one clock; the stage piece loops the synth, the studio follows the
  playhead.
- Licence: generated in-house for this demo. The rights register records it as worldwide and cleared.

## Stage, rig and set

- The stage, trusses, fixtures, set pieces, screen, audience and blocking are generated geometry.
- The fixture labels and rental rates are synthetic but plausible; they are not a vendor quote.
- The venue profiles are invented. No venue's real rig, power or sightline data is published.

## Video and moodboard

- The screen content is drawn in SVG and CSS; the moodboard cards are generated gradients with a noise
  overlay. No third-party photography or footage is used.
- The clips are named in the asset register but do not ship as media files. `SIGNAL BARS v4` is
  deliberately missing, to exercise asset drift.

## The model

- **CUE Looksmith 1.4.0** is a deterministic rule system: energy, impact, rig limits and sightlines.
- The public demo makes no cloud model call. The proposals are authored in the pack and ranked by the
  same reactive scoring the UI shows.
- The agent answers are deterministic lookups over the pack, with citations.
- AI proposals are labelled **Agent** and carry the model version. The designer owns the approved look.

## What is real

The engine is real code over synthetic data:

- power, weight, glare, budget and cue math;
- the human reject/re-rank and the audit;
- the readiness lifecycle, evidence and show-week brief;
- the cue sheet, version approvals and signatures;
- the offline build, the reset and the service worker;
- the TypeScript and Python tests.

## Reproducibility

```bash
cd web
npm run pack          # writes server/cue/data/show.json from the TS source
npm run build
```

CI runs `npm run pack` and `diff`s the result against the committed JSON. A seed change is a show
change and must be reviewed like one.

## Rights register (demo)

| Asset | Kind | Territory | Window | Status | Source |
|---|---|---|---|---|---|
| Static Bloom / Night Signal / Afterglow | music | Worldwide | 2026-01-01 → 2030-12-31 | cleared | Commissioned instrumental — in-house |
| MONOLITH / SIGNAL BARS / HORIZON | video | EU · UK · US | 2026-09-01 → 2026-11-10 | cleared, expiring | Content licence v2 |
| RAIN / AFTERGLOW DUST | video | Worldwide | 2026-01-01 → 2030-12-31 | cleared | Generated in-house |
| Nova Vale — name, image, likeness | likeness | Worldwide | 2026-08-01 → 2027-06-30 | cleared, broadcast excluded | Artist rider §4.2 (synthetic) |
| Venue rig, power and sightline profiles | venue | Internal | 2026-01-01 → 2027-12-31 | customer confidential | Pilot agreement §7 (synthetic) |
| CUE look suggestions — model 1.4.0 | software | Pilot | 2026-09-01 → 2027-09-01 | cleared | Model card v1.4.0 |

## AI disclosure

AI-assisted looks and video are disclosed in the UI, in the cue sheet metadata and on the provenance
page. The model version, inference path and source IDs are attached to the proposal. The approved show
is authored by the designer; a rejection is stored and the ranking is recomputed.

## What is not used

- No commercial recording.
- No artist, venue or crew personal data.
- No third-party imagery, stock footage or font CDN.
- No analytics or telemetry.
