# Contributing

## Shape

- `web/` — React + Vite + strict TypeScript. No `any` in product code.
- `server/` — FastAPI + Python 3.11. The show engine is pure functions over the pack.
- `docs/` — the stage plan, architecture, data rights and the roadmap status.
- `web/src/data/pack.ts` — the single source of the show. Do not edit the generated
  `server/cue/data/show.json` by hand.

## Before a PR

```bash
cd web
npm run build          # typecheck + build
npm run pack           # regenerate the shared JSON
cd ../server
python -m pytest -q
python -m ruff check .
```

The `pack-drift` CI job regenerates the JSON and fails if it differs. If you change the show, change
the TypeScript and commit the regenerated JSON in the same PR.

## Design

- Read the design system page and `docs/interface-2026.md`.
- One accent; semantic colour reserved for safety, rights and budget.
- No text below 11 px in product chrome.
- A number needs a source, a limit and a plain-language sentence.
- An AI proposal needs a label, a model version and a citation.
- Safety is a human signature. Never add an automatic release.

## Data

The public demo is synthetic. Do not add a commercial recording, artist likeness, venue data or
customer content. Any new asset needs a row in `docs/data-provenance.md` and the rights register.

## Commits

Small, descriptive, present tense. The roadmap checkbox is not done until the code, the test and the
provenance note agree.
