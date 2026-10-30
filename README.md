# CUE

**The show is designed before the lights go down.**

[**Play the 90-second show →**](https://jiuwendemos.github.io/cue/#/stage) · [**Open the studio →**](https://jiuwendemos.github.io/cue/#/show) · [**Tour readiness →**](https://jiuwendemos.github.io/cue/#/readiness)

[![CI](https://github.com/jiuwendemos/cue/actions/workflows/ci.yml/badge.svg)](https://github.com/jiuwendemos/cue/actions/workflows/ci.yml)
[![Deploy](https://github.com/jiuwendemos/cue/actions/workflows/pages.yml/badge.svg)](https://github.com/jiuwendemos/cue/actions/workflows/pages.yml)

![CUE — the show poster and previz](docs/assets/home.png)

> *It was spectacular. It was wrong. The show is not the rig.*

CUE is the **live show design studio**. It connects the concept, the stage, the looks, the video, the
blocking, the setlist, the cue sheet and the budget on one timeline — and exports into the tools the
crew already uses. The designer authors. CUE proposes and checks.

**This repository is a complete, deterministic public demo.** The show, artist, venues, crew and
audience are synthetic. Every number is calculated from a fixed pack. The track is synthesised in the
browser. Nothing is uploaded, and there is no cloud model call. Read the
[demo guide](https://jiuwendemos.github.io/cue/#/glossary) or the
[provenance sheet](docs/data-provenance.md).

---

## What is here

| Surface | What it is | Try it |
|---|---|---|
| **The 90-second show** | One lamp, one unsafe AI proposal, one human decision, one vote, one printed cue sheet. Deterministic, sound, reset with `R`. | [`/#/stage`](https://jiuwendemos.github.io/cue/#/stage) |
| **The studio** | Stage previz, looks, video, blocking, timeline, checks and the look rail. Drag a look onto the build. | [`/#/show`](https://jiuwendemos.github.io/cue/#/show) |
| **Concept board** | The mood, references, rules, palette and the setlist as a design board. | [`/#/show?tab=concept`](https://jiuwendemos.github.io/cue/#/show?tab=concept) |
| **Cue sheet** | 26 cues across LX/VID/STG/AUD/SFX/CAM, safety signatures, conflicts, missing assets, print and CSV/HTML/JSON. | [`/#/cues`](https://jiuwendemos.github.io/cue/#/cues) |
| **Rig and budget** | Cost per look, power, truss load, contingency and the over/under against the approved budget. | [`/#/budget`](https://jiuwendemos.github.io/cue/#/budget) |
| **Tour readiness** | Risk board, lifecycle, evidence, show-week brief, digests, coverage, precision and a kill switch. | [`/#/readiness`](https://jiuwendemos.github.io/cue/#/readiness) |
| **Design agent** | Ranked proposals with citations, an inspectable tool trace, guardrails and a human reject/re-rank. | [`/#/agent`](https://jiuwendemos.github.io/cue/#/agent) |
| **Venues** | Seven rooms with stage, rig, power, sightlines, freshness and a fit check against the design. | [`/#/venues`](https://jiuwendemos.github.io/cue/#/venues) |
| **Versions** | Version history, diffs, approvals, signatures and an immutable audit. | [`/#/versions`](https://jiuwendemos.github.io/cue/#/versions) |
| **Pilot** | A 90-day, one-tour pilot dashboard with baselines, gates, kill criteria and honest measurement. | [`/#/pilot`](https://jiuwendemos.github.io/cue/#/pilot) |
| **Mobile review** | The producer and crew phone surface: acknowledge, sign, approve, brief. 44 px targets. | [`/#/mobile`](https://jiuwendemos.github.io/cue/#/mobile) |
| **Studio settings** | Theme, role, language, density, reduced motion and **hide synthetic-demo notices**. | [`/#/settings`](https://jiuwendemos.github.io/cue/#/settings) |
| **Glossary** | How to read a cue sheet, a look, a risk and this demo. | [`/#/glossary`](https://jiuwendemos.github.io/cue/#/glossary) |
| **Provenance** | Rights register, model card, AI disclosure, privacy review and the data-rights annex. | [`/#/provenance`](https://jiuwendemos.github.io/cue/#/provenance) |

The public site is a **static, offline build** of the same product UI. The API and the pilot workflow
live in [`server/`](server/) and serve the same pack, with SQLite for the human decisions.

---

## The trust beat

The agent ranks **AERIAL 12** first: twelve beams, impact 97, spectacular in previz. It is also:

- **44 kg over the front truss rating** — 564 kg on a 520 kg truss;
- **1.6 kW over the house supply** — 44.1 kW against 43.5 kW;
- **blinding the front row** — glare 0.92 against a 0.55 limit, six beams below the 1.15 m eyeline.

The designer rejects it. The reason is stored. The ranking is recomputed. **SIX BEAM + MONOLITH** —
impact 89, 34.5 kW, 312 kg, no audience-aimed fixture, €1,373 under budget — is the show.

That is the product in one minute: creativity, evidence, a human decision, and a system that updates.

---

## How it works

```mermaid
flowchart LR
  A["1 · Setlist<br/>energy · transitions"] --> B["2 · Stage and rig<br/>set · screen · trusses"]
  B --> C["3 · Looks and video<br/>colour · focus · mapping"]
  C --> D["4 · Blocking<br/>artist · dancers · camera"]
  D --> E["5 · Cue sheet<br/>LX · VID · STG · AUD · SFX · CAM"]
  E --> F["6 · Checks<br/>power · weight · glare · rights · asset · budget"]
  F --> G["7 · Human sign-off<br/>designer · producer · venue crew"]
  G --> H["8 · Export<br/>print · CSV · HTML · venue format"]
  F -.->|"evidence"| C
  G -.->|"rejection"| C
```

The math is deliberately simple and auditable. Every check shows the metric, the limit and the
source record. No number is a black box.

---

## What is real, and what is simulated

| Real in this demo | Simulated |
|---|---|
| Power, weight, glare, budget, rights and cue math | The artist, songs, venues, rig, set, video and audience |
| The reactive ranking and the human reject/re-rank | The look suggestions and their confidence |
| The cue sheet, safety signatures, versions and audit | The pilot numbers and the production company |
| The readiness lifecycle, evidence and show-week brief | The GPU/NPU timings and live integrations |
| The static offline pack and the reset | The music: synthesised, not a commercial recording |

**You can hide the synthetic-show notices** in **Studio settings → Interface**. The data stays
synthetic; the notices go quiet. The provenance page always keeps the facts.

---

## Quick start

### Public demo (no install)

Open <https://jiuwendemos.github.io/cue/>. It runs fully offline after the first load. Press `R` on the
stage piece to reset.

### Web locally

```bash
cd web
npm install
npm run dev        # http://127.0.0.1:5174
npm run build      # typecheck + production build
```

### API locally

```bash
# generate the shared pack from the TypeScript source
cd web && npm run pack

# the on-site API
cd ../server
python -m pip install -e ".[dev]"
uvicorn cue.api.app:app --reload --port 8000
```

The dev server proxies `/api` to `127.0.0.1:8000`. The API also serves `web/dist` when it exists.

### Tests

```powershell
$PY = "C:\Workspace\openjiuwen\jiuwenswarm\.venv\Scripts\python.exe"
& $PY -m pip install -e "server[dev]"
& $PY -m pytest -q server
& $PY -m ruff check server
```

### One on-site service

```bash
docker compose up --build
# open http://127.0.0.1:8000
```

The SPA is served by FastAPI; the SQLite store lives in the `cue-data` volume. No outbound network is
required after setup. See [deployment](docs/deployment.md).

---

## Architecture

```mermaid
flowchart TB
  subgraph Browser["Browser / PWA"]
    UI["React + Vite + strict TypeScript<br/>stage · studio · concept · cues · budget · readiness"]
    Pack["show pack<br/>fixed seed, offline"]
    UI --- Pack
  end
  subgraph Site["Production network"]
    API["FastAPI<br/>server/cue/api"]
    Agent["Deterministic design agent<br/>citations + guardrails"]
    Engine["Show engine<br/>power · weight · glare · budget · rights · cues"]
    DB[("SQLite<br/>audit · signatures · approvals · risk states")]
    API --> Agent --> Engine
    Agent --> DB
    API --> DB
  end
  UI -.->|"live API when served on site"| API
```

**Repository layout**

```
cue/
  web/
    src/
      data/        the single demo pack + moodboard
      lib/         engine · store · agent answers · audio · i18n · UI context
      components/  stage canvas · timeline · shell · demo guide · settings · UI
      pages/       stage · studio · concept · cues · budget · readiness · agent · venues ·
                   versions · pilot · mobile · design system · admin · provenance · settings ·
                   glossary · about
      styles.css   tokens, themes, print, responsive, reduced motion
    public/        favicon, manifest, offline shell assets
    scripts/       export the single pack to JSON for the server
  server/cue/
    api/           FastAPI routes
    engine/        deterministic show math
    agent/         deterministic agent + DeepAgent seam
    store/         SQLite audit, signatures, approvals, risk lifecycle
    data/          generated show.json (shared with web)
    tests/         engine math and API flows
  docs/            roadmap · architecture · stage script · pilot · data rights · deployment · 2026
  deploy/          systemd unit and environment template
  scripts/         developer helpers
```

---

## Roadmap

The full, item-by-item status is in [docs/roadmap.md](docs/roadmap.md). The short version:

- **0A — the stage piece:** built. Deterministic 90 seconds, sound, trust beat, vote, cue-sheet reveal, reset under five seconds.
- **0B — the functional demo:** built. Editable show, looks, video, blocking, cue sheet, budget, checks, offline.
- **1 — the pilot surface:** built as software. One production company, three shows and 90 days still need a real customer.
- **4 — tour readiness:** built. Risk board, lifecycle, show-week brief, dedupe, coverage, precision, kill switch.
- **5 — interface 2026:** built. Three themes, tokens, command palette, role navigation, mobile review, EN/中文, provenance, accessibility.
- **6 — production wiring:** code paths for the agent, render/inference, integrations, store and security. The end-to-end gate needs a real tour.
- **2–3 — production and scale:** adapters and UI surfaces exist; live vendor integrations and a multi-city network are pilot work.

**The next three tracks** — [make it proactive, make it true 2026, make it connected](docs/roadmap-next.md) — are
a detailed plan with 472 checkboxes, gates and a 30/60/90-day sequence. They are the honest gap between this
demo and a production system.

---

## Non-goals

- **No live show control.** No DMX, no console, no automatic cue release.
- **No renderer replacement.** Depence², WYSIWYG, Capture and Vectorworks remain the previz and drafting tools.
- **No music generation.** The artist's track is the source of truth.
- **No CAD replacement.** CUE is the design layer above the drafting.
- **No autonomous design.** The designer authors; the AI proposes and checks.
- **No hardware.** No fixture, console or rig is required to use CUE.

---

## Data rights

- Public demo data is **synthetic**, generated in-house with a fixed seed. Licence: MIT.
- No commercial recording, artist likeness or venue data is used.
- The track is synthesised in the browser from the energy curve.
- Artist content stays local by default; any upload needs written permission and is recorded in the rights register.
- Venue and rig data are customer confidential. Cross-tenant sharing is off by default.
- AI proposals are labelled, attributable and designer-owned on approval.

Read the [provenance sheet](docs/data-provenance.md) and the [data-rights annex](docs/data-rights.md).

---

## Licence

MIT. See [LICENSE](LICENSE).

Built as a demonstration of evidence-first live-show design. The designer owns the decision; CUE never
runs the show.
