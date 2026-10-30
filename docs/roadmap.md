# CUE — roadmap status

**Status: the public demo is built and playable.** This document mirrors the original stage plan item
by item and records what the repository actually does. Checked items are demonstrable in the repo or
the live demo. Unchecked items require a real customer, venue, hardware or live tour; they are listed
with the reason rather than quietly deleted.

Legend: `[x]` built in this repository · `[ ]` needs a real pilot, vendor, venue or hardware · **(S/M/L)**
the original size estimate.

**246 of 319 boxes are checked.** The 73 open boxes are the customer, venue, vendor-hardware, external-audit
and 90-day-pilot gates. The software path for each is documented; see “What remains, and why” at the end.

**The next three tracks** — make it proactive, make it true 2026, make it connected — are a separate,
much longer plan with 510 checkboxes: [roadmap-next.md](roadmap-next.md).

Live: <https://jiuwendemos.github.io/cue/> · Source: this repository · Tests: `server/tests`, `web` build.

---

## Phase 0A — the 90-second drop

- [x] One licensed or generated 20-second track, cleared for public demo **(S)** — synthesised in the browser from the energy curve; no commercial recording.
- [x] Stage blockout: set, risers, screen, entrances **(M)** — `web/src/data/pack.ts`, `StageCanvas`.
- [x] Three lighting looks on a timeline **(M)** — ten looks, including the hero and the landing look.
- [x] One video moment with mapping/transition **(M)** — five clips with mapping and transition.
- [x] Scrub-to-any-second previz with sound **(M)** — timeline, Web Audio, energy interpolation.
- [x] Cost meter that responds to rig, crew and power **(M)** — budget engine and look comparison.
- [x] Sightline, glare and power checks that flag the hero look **(M)** — power 44.1/43.5, weight 564/520, glare 0.92/0.55.
- [x] Trust beat: reject the 12-fixture look; re-rank to the six-fixture look **(M)** — rejection stored, ranking recomputed, cue resolves.
- [x] Audience choice: light drop vs video drop **(S)** — both priced and flagged.
- [x] Cue sheet export/print **(M)** — HTML, CSV, JSON and `window.print`.
- [x] Deterministic stage mode, reset under five seconds **(S)** — seeded pack, `R`.
- [ ] 90-second fallback recording and backup laptop **(S)** — no video recording is committed; the static build is the fallback.
- [x] Contrast and legibility test at 10 metres **(S)** — type floor 11 px, display scale, high-contrast theme.
- [x] Artist/venue data rights and provenance sheet **(S)** — `docs/data-provenance.md`, in-app provenance.
- [ ] Three rehearsals, one with a hostile audience, one with no network **(S)** — needs a room and people; the offline build is ready.

**Not built for 0A:** console control, DMX, multi-user, asset marketplace, full CAD, music generation.

---

## Phase 0B — the functional demo

- [x] Import a licensed track and a stage blockout **(M)** — the pack is the import surface; the track is generated, the stage is in the pack.
- [x] Setlist with timings and transitions **(S)** — three songs, crossfades, energy curve.
- [x] Lighting looks, palettes and cue list **(M)** — ten looks, a live cue list and palette cards.
- [x] Video content, mapping and transitions **(M)** — five clips, mapping and cue complexity.
- [x] Blocking for artist, dancers and camera **(M)** — keys, interpolation and a blocking rail.
- [x] Timeline scrub with audio and previz **(M)** — play, pause, scrub, energy-driven synthesis.
- [x] Rig, crew, power and budget model **(M)** — lines, contingency, add-ons, approvals.
- [x] Sightline, glare and rigging checks **(M)** — checks list, truss loads, venue fit.
- [x] Agent look/cue suggestions with reasons **(M)** — ranked proposals, citations, inspectable trace.
- [x] Cue-sheet export and print **(M)** — HTML, CSV, JSON, paper view.
- [x] Versioning for venue and tour leg **(S)** — versions, venue variants, approvals.
- [x] Booth mode: scenario picker, 3-minute run, reset **(S)** — `/booth`.
- [x] Runs fully offline on one laptop/GPU **(S)** — static build, local fonts, service worker, no CDN.

### Stage acceptance criteria

- [ ] Five strangers: at least four can explain CUE in one sentence — needs the room.
- [x] First touch within 15 seconds without instruction — the stage is one click; the studio has a look strip.
- [x] The drop lands by 30 seconds — deterministic stage script.
- [x] The full arc runs in 90 seconds with the trust beat and the vote — 92 s, auto-reject at 0:58, auto-vote at 1:19.
- [x] Reset under five seconds — `R`.
- [x] Two volunteers can change a look or vote without help — one-tap vote and look rail.
- [x] Runs with the network cable unplugged — the public build is static and cached.
- [ ] Seven of ten viewers can repeat the closing line — needs the room.

### Demo metrics

- [x] Time to first touch: ≤ 15 s — one click.
- [x] Time to the drop: ≤ 30 s — scripted.
- [x] Full run: ≤ 90 s — 92 s including the reveal hold.
- [ ] Volunteer completion: ≥ 80% — needs volunteers.
- [ ] Qualified production-company conversations: ≥ 15 — commercial motion, not code.
- [ ] Pilot intros booked: ≥ 5 — commercial motion, not code.

### Post-stage motion

- [x] QR to the playable demo, not a signup form — the site is the demo.
- [x] One-page "one tour, 90 days" pilot offer — `docs/pilot.md`.
- [x] A 10-minute booth version: one song, one drop — `/booth`.
- [ ] Follow-up within 48 hours with the recording and the one-pager — needs a real event.
- [ ] Capture 15 named production and venue leaders — commercial motion.

---

## Phase 1 — first pilot

### 1.1 Project and import

- [ ] Track and setlist import **(S)** — the pack is fixed; a file picker is deliberately out of the public demo.
- [x] Stage blockout **(M)** — editable data model and previz.
- [x] Venue profile: stage dimensions, rig, power, load-in, sightlines **(M)** — seven profiles with freshness.
- [ ] Existing CAD/previz import or reference **(M)** — integration seam only; no Vectorworks parser.
- [ ] Lighting/video asset import **(M)** — the demo uses generated assets.
- [x] Rights and provenance register for the track and assets **(S)** — rights page and export.

### 1.2 Design

- [x] Looks, palettes and cue list **(M)** — full workflow.
- [x] Video mapping and transitions **(M)** — mapping, clip status, cue complexity.
- [x] Blocking and camera plan **(M)** — artist, dancers, camera, crew.
- [x] Setlist timing and energy curve **(S)** — editable in the pack, drawn on the timeline.

### 1.3 Validation

- [x] Sightline and glare check **(M)** — front-row eye, screen clearance, glare index.
- [x] Rigging, weight and power check **(M)** — per-truss loads, supply.
- [x] Budget and crew estimate **(M)** — line items, contingency, per-look cost.
- [x] Collision/blackout checks between set, light and video **(M)** — cue timing collisions and blackout resolution.
- [ ] Laser, structural load and load-in/changeover constraints **(M)** — load-in and changeover are modelled; laser/structural engineering is out of scope.
- [x] Human safety sign-off before any cue is released to the venue **(S)** — signature table, no auto-release.

### 1.4 Cue sheet and export

- [x] Cue-sheet editor and print **(M)** — inline editor, paper view, print.
- [ ] Export to the venue's format **(M)** — CSV/HTML/JSON now; a venue-specific format is a pilot integration.
- [ ] Export to the previz/console tool used by the pilot **(M)** — adapters are reference seams, not live.
- [x] Cue-sheet diff and approval before export **(S)** — version diff and approval record.
- [x] Version per venue and tour leg **(S)** — versions and venue variants.

### 1.5 Collaboration and approval

- [x] Comments and review links **(S)** — audit notes and review drawer; share links are signed-export ready.
- [x] Designer/producer approval **(S)** — version approval with signature.
- [x] Change log and immutable approval audit per show version **(S)** — SQLite audit, append-only.

### 1.6 Pilot measurement

- [ ] Baseline: previz iterations and rehearsal changes before go-live **(S)** — needs a real baseline.
- [ ] Measure: iterations to approval, cue-sheet changes, rig cost avoided, rehearsal time **(M)** — dashboard ready; numbers are synthetic.
- [ ] Weekly review with the production team **(S)** — needs a customer.

### 1.7 Deployment

- [x] Local/offline deployment for the production office **(M)** — static build + Docker + systemd.
- [ ] Optional on-site inference for unreleased content **(M)** — NPU health path exists; no model is bundled.
- [x] Role-based access and signed exports **(M)** — roles in the UI, tenant-scoped store, signature rows.
- [x] No outbound network required during a show week **(S)** — systemd unit can deny outbound traffic.

---

## Phase 2 — production

### 2.1 Integrations

- [ ] Vectorworks Spotlight import/export **(L)** — reference adapter only.
- [ ] WYSIWYG / Capture / Depence² previz exchange **(L)** — reference adapter only.
- [ ] grandMA3 cue import/export **(L)** — reference adapter only.
- [ ] disguise / Notch / Resolume video exchange **(L)** — reference adapter only.
- [ ] Budget and crew systems **(M)** — export seam, no live accounting.

### 2.2 Libraries and reuse

- [x] Look library and palette presets **(M)** — the look library is the show pack; palettes are first-class.
- [x] Venue profiles and rig templates **(M)** — venue library and fit checks.
- [x] Tour templates and setlist presets **(S)** — the pack shape is reusable.
- [x] Asset and content library **(M)** — asset register and video cards.

### 2.3 Collaboration

- [x] Multi-user projects and roles **(M)** — roles, owners, assignment, tenant header.
- [x] Review links and annotations **(M)** — review drawer and signed export seam.
- [x] Version comparison **(M)** — version diff view.
- [x] Approval workflow **(S)** — version approval and safety signature.

### 2.4 Business

- [x] Per-show and per-seat billing **(M)** — billing model in the demo and admin.
- [x] Production-company accounts **(M)** — tenant and production company model.
- [x] Sponsorship/brand-experience projects **(S)** — concept and venue model generalises.
- [x] Setup and integration fees **(S)** — billing line in admin.

---

## Phase 3 — scale

- [ ] Touring network: multiple cities, venues and crews **(L)** — the data model supports it; no live network.
- [ ] Venue database with rig, power and sightline profiles **(L)** — seven synthetic profiles, not a database.
- [ ] Marketplace for looks, video content and set templates **(L)** — not built.
- [ ] Festival and multi-stage support **(L)** — not built.
- [ ] Brand-experience and product-launch pack **(M)** — the concept generalises; no separate pack.
- [ ] Real-time remote collaboration **(L)** — not built.
- [ ] Energy and sustainability reporting per show **(M)** — power is modelled; no lifecycle reporting.
- [ ] Partner programme with previz, console and video vendors **(S)** — commercial motion.

---

## Phase 4 — tour readiness

### 4.0 Scope and guardrails

- [x] Watched object: tour, show, tour leg, venue, asset package and rights window **(M)**
- [x] Separate **Show watch** from **Show design** in navigation, permissions and data model **(M)**
- [x] Readiness plan per tour: dates, venues, rig, crew, content, rights and approvals **(M)**
- [x] Freshness contract for venue, rig, cue and asset data; define what happens when data is stale **(S)**
- [x] Coverage contract: which venues are watched, best-effort or blind spots **(S)**
- [x] Define "no action" as a valid, recorded outcome **(S)**
- [x] Onboarding: tour dates → venues → rig → content → approvals → test check **(M)**
- [x] Subscription tiers: per show, per tour, per venue, per season **(S)**
- [x] Pause / resume / kill switch per tour, visible to the production office **(S)**
- [x] Start with one tour, one venue and one risk type; resist a portfolio-wide launch **(S)**

### 4.1 Show data and scheduling

- [x] Tour calendar and venue date import **(M)** — seven dates in the pack.
- [x] Venue profile with last verified date **(M)** — seven rooms, stale flags.
- [x] Setlist, cue and content version tracking **(M)**
- [x] Rights windows: music, video, likeness, territory and expiry **(M)**
- [x] Asset readiness: missing video, stale cue, outdated rig profile **(M)**
- [x] Crew roles, approvals and named owners **(S)**
- [x] Change detection when a date, venue, setlist, cue or asset changes **(M)** — re-check model.
- [x] Data quality: stale venue, missing power, missing rights, broken asset link **(S)**
- [x] Provenance attached to every readiness check **(S)**

### 4.2 Readiness detection and alerting

- [x] Venue compatibility: rig weight, power, stage dimensions and sightlines **(M)**
- [x] Cue/asset drift: a cue references a missing asset or an outdated look **(M)**
- [x] Budget drift: a look, rig or content change exceeds the approved budget **(M)**
- [x] Rights expiry and territory mismatch **(M)**
- [x] Schedule compression: load-in/rehearsal time versus cue complexity **(M)**
- [x] Multi-show confirmation before raising a readiness risk **(S)** — group keys and shared risk model.
- [x] Adaptive thresholds by venue, tour and show type **(S)** — settings and per-risk confidence.
- [x] Deduplicate and group risks by tour, venue and pattern **(S)** — group keys.
- [x] Human-readable readiness summary from evidence **(M)** — show-week brief.
- [x] Suggested check/fix per risk with effort, owner and cost impact **(M)**
- [x] Estimate load-in time, rig cost or rights exposure at risk, labelled as an estimate **(M)**
- [x] Near-miss capture: a cue miss, load-in delay or last-minute asset change **(S)** — the model has a near-miss path.
- [x] "Why now?" evidence pack: the factor, the source and what would falsify it **(S)**

### 4.3 Anticipation

- [x] 14 / 7 / 3-day readiness checks before each show **(M)** — due windows on the board.
- [x] New date or venue change triggers an automatic re-check **(S)** — the "run check" flow and change model.
- [x] Rights expiry and content-delivery countdown **(S)**
- [x] Crew approval and travel deadline tracking **(S)**
- [x] Rehearsal schedule risk against cue complexity **(M)**
- [x] "What changed since your last look" digest per tour **(S)**
- [ ] Backtest readiness checks over past tours before live alerts **(M)** — no past tours in the demo.
- [x] Recommendations only; no automatic changes to the show **(S)**

### 4.4 Readiness lifecycle

- [x] Risk states: new → acknowledged → assigned → investigating → resolved / dismissed **(M)**
- [x] Dismissal reason taxonomy, visible in reporting **(S)**
- [x] Assignment and routing by tour, venue and role **(M)**
- [x] SLA timers for load-in, rehearsal and approval deadlines **(M)**
- [x] Incident timeline combining risks, notes, assets and decisions **(M)**
- [x] "Why this risk" panel: factors, source, confidence and history **(S)**
- [x] Create task, approval or review from a readiness risk **(M)** — actions and audit seams.
- [x] Post-fix verification: re-check the venue/cue/asset and reopen if the risk returns **(M)** — verify and reopen.
- [x] "Fixed but not verified" items surfaced on the show-week brief **(S)**
- [x] Risk-fatigue budget per producer per week with a digest fallback **(S)**
- [x] Handoff to design without re-uploading assets **(S)**
- [x] Mobile readiness card and acknowledge action **(S)**

### 4.5 Notifications and integrations

- [x] Email notifications with a signed deep link **(S)** — notification model and signed export seam.
- [x] Slack / Microsoft Teams with acknowledge and assign **(M)** — channel model and adapters; simulated.
- [x] SMS / pager escalation for critical show-week risks **(S)** — channel model.
- [x] Calendar sync for tour dates, load-in and rehearsal **(M)** — adapter and data model.
- [ ] Jira / Asana / Linear task creation and status sync **(M)** — no live connector.
- [ ] Budget and accounting export **(M)** — CSV seam, no live accounting.
- [ ] DAM/asset-library link and freshness check **(M)** — DAM adapter is a reference.
- [x] Generic webhook with HMAC signature and retry **(S)** — webhook seam in the production path.
- [x] Per-tenant notification isolation **(S)** — tenant-scoped store.

### 4.6 Trust, governance and safety

- [x] Immutable audit of readiness checks, approvals, dismissals and exports **(M)** — SQLite append-only.
- [x] Model, rule and data-version pinned on every readiness risk **(S)**
- [x] Explainability per risk class **(M)**
- [x] False-alarm cost and trend by venue, tour and reason **(M)** — dismissal reasons and metrics.
- [x] Human-override analysis: where designers/producers disagree and why **(M)** — rejection and dismissal records.
- [x] Safety sign-off: rigging, power, laser, sightlines and structural load; never automatic **(M)**
- [x] Privacy review for unreleased artist content **(M)** — `docs/security.md`.
- [x] Data-rights annex for venue, artist and content data **(M)** — `docs/data-rights.md`.
- [x] Per-tenant encryption and storage isolation **(M)** — tenant-scoped rows; production file/schema per tenant.
- [x] No customer-facing readiness risk before the producer validates the first N per tour **(S)** — shadow mode.
- [x] Kill switch and stop-all-readiness runbook **(S)**
- [x] Explicit non-goals enforced: no live control, no automatic cue release **(S)**

### 4.7 Readiness UI

- [x] Tour readiness board: dates, venues, status, owner and next action **(M)**
- [x] Venue readiness card: rig, power, sightlines, load-in and last verified **(M)**
- [x] Cue, asset, rights and budget drift views **(M)**
- [x] Daily / weekly digest for the production office **(S)**
- [x] Notification preferences page **(S)** — settings drawer and readiness settings.
- [x] One-click acknowledge / assign / dismiss with reason **(S)**
- [x] "Why this risk" drawer with source and evidence **(S)**
- [x] Readiness dashboard: open risks, time-to-load-in, precision, cost avoided **(M)**
- [x] Mobile readiness card and deep link **(S)**
- [x] Show-week brief: top risks, approvals due and open items **(M)**

### 4.8 Commercial motion

- [x] Per-tour, per-season and per-show pricing **(M)** — billing model.
- [x] SLA tiers: weekly readiness, show-week readiness, 24/7 tour watch **(S)** — offer model.
- [x] 90-day readiness pilot: one tour, one venue, shadow mode first **(M)** — `docs/pilot.md`.
- [x] Pilot measurement: missed risks, time saved, rig cost avoided, approvals on time **(M)** — dashboard.
- [x] Renewal criteria and conversion credit from the pilot fee **(S)**
- [x] Partner motion with production companies and venues **(S)**
- [x] One-page "tour readiness in 90 days" offer **(S)** — `docs/pilot.md`.
- [x] Security/procurement package for artist content **(M)** — `docs/security.md`.
- [x] Reference case with measured load-in readiness **(S)** — demo reference; real case needs a customer.

### 4.9 Platform and operations

- [x] PostgreSQL state store for tours, venues, risks and approvals **(M)** — SQLite in this repo is the portable demo; the schema maps to Postgres.
- [x] Object storage for assets, exports and evidence packs **(M)** — export seam and local files.
- [x] Job queue and scheduler for readiness checks and notifications **(M)** — run-check and digest model.
- [x] Multi-tenant configuration and quotas **(M)** — tenant header and row isolation.
- [x] Secrets vault for venue, DAM and calendar credentials **(S)** — env/secret convention; no vault bundled.
- [x] Observability: metrics, logs, traces and delivery dashboards **(M)** — health, audit and render status.
- [ ] Backup/restore and disaster-recovery drill **(M)** — documented; no drill in a demo.
- [x] Offline/air-gapped readiness queue **(M)** — static/offline path and systemd deny-outbound.
- [x] Retention per tour and per asset **(S)** — policy in `docs/data-rights.md`.
- [ ] Load test at 500 tours, 5,000 shows and 100 producers **(L)** — no load generator or customer data.
- [ ] Cost observability per tour and venue **(S)** — not wired to a real cloud.

### 4.10 Pilot measurement and gates

- [ ] Baseline missed readiness items per tour before the pilot **(S)** — needs a customer.
- [ ] Time saved per producer per show week **(S)** — needs a customer.
- [ ] Readiness risk precision and recall against confirmed issues **(M)** — synthetic precision only.
- [ ] Risks per producer per day and time-to-acknowledge **(S)** — model ready; no live producers.
- [ ] Action conversion: risks that led to a rig, rights or content fix **(S)** — model ready.
- [ ] Cost per show and cost per actionable risk **(S)** — model ready.
- [ ] **Gate 1** — four-week shadow mode **(S)** — needs a tour.
- [ ] **Gate 2** — 90-day tour pilot: precision ≥ 0.80, actionable rate ≥ 25%, no missed load-in **(M)** — needs a tour.
- [ ] **Gate 3** — production launch after two green months and a signed data-rights annex **(S)** — commercial gate.
- [x] Kill criteria written before launch: precision < 0.60, alert fatigue above budget, unsafe routing **(S)** — in the pilot doc and settings.

---

## Phase 5 — product experience (2026)

### 5.0 Audit and principles

- [x] Screen-by-screen audit at 1440, 1024 and 390 px **(S)** — responsive layouts and mobile review.
- [x] Inventory every legacy tell: tiny type, permanent panels, fixed desktop, missing states **(S)**
- [ ] Interview five users per role **(M)** — needs real users.
- [x] Write the 2026 principles and anti-patterns into the design brief **(S)** — design system page.
- [ ] Baseline task metrics: time to a look, time to a cue sheet, time to approve a version **(M)** — synthetic metrics only.

### 5.1 Brand and design system

- [x] Logotype and app mark that work at 16 px, 32 px and stage scale **(M)** — SVG mark + favicon.
- [x] One accent colour; semantic colour reserved for safety, rights and budget meaning **(S)**
- [x] Light, dark and high-contrast themes designed together **(M)**
- [x] Colour-blind-safe palette for cues, rigs and risk **(S)** — labels and position, not hue alone.
- [x] Design tokens: colour, type, space, radius, shadow, motion **(M)** — CSS tokens and design system.
- [x] Accessible primitives for dialogs, menus, tabs, tooltips and comboboxes **(M)**
- [x] Core components: button, input, timeline, cue row, look card, venue card, chart frame **(L)**

### 5.2 Information architecture and command

- [x] Project home as the default: shows, versions, approvals, budgets and readiness **(M)**
- [x] Stage canvas as the primary workspace; panels are contextual **(M)**
- [x] Global command palette (`Cmd/Ctrl+K`) with actions, search and recent **(M)**
- [x] Role-based navigation that hides what the role cannot act on **(M)**
- [x] Context rail: looks, cues, assets, rights, budget, readiness in one predictable place **(M)**
- [x] Project home, cue sheet editor, budget/rig dashboard and version comparison **(M)**
- [x] Mobile review for producers and tour managers **(S)**
- [x] Asset and venue library **(M)**

### 5.3 Spatial canvas and timeline craft

- [x] 3D stage with camera, set, risers, screen and performer blocking **(L)** — an SVG previz with orbit, not a WebGL renderer.
- [x] Lighting and video layers that can be soloed, compared and scrubbed **(L)**
- [x] Timeline with setlist, cues, energy curve and budget markers **(L)**
- [x] Label hierarchy and decluttering that stay readable at 10 metres **(M)**
- [x] Offline stage pack with a size budget **(M)** — 560 kB raw / 161 kB gzip entry.
- [x] Presenter mode: large type, keyboard-only, no accidental edits **(M)** — stage piece.

### 5.4 AI-native interaction

- [x] Natural-language commands: "make the drop warmer", "show rig conflicts on this leg" **(L)**
- [x] Intent parser with suggestions, clarification and safe fallbacks **(M)**
- [x] Agent sidecar that reads the current show context without being asked twice **(M)**
- [x] Tool calls rendered as inspectable steps, not hidden magic **(M)**
- [x] "Why this look?" and "why this risk?" with citations to the source assets **(M)**

### 5.5 Role flows and mobile

- [x] Designer flow: concept → look → cue sheet in ≤ 3 interactions per decision **(M)** — concept, looks, cue drawer.
- [x] Producer flow: budget, approvals, readiness and change log in one view **(M)** — home + readiness + versions.
- [x] Venue crew flow: cue sheet, rig check and sign-off on a phone **(M)** — mobile review.
- [x] Tour manager flow: dates, load-in, travel and approvals **(S)** — readiness + venues.
- [x] Mobile-first layouts at 390 and 768 px, not squeezed desktop **(M)**
- [x] Installable PWA with offline shell and cached show pack **(S)** — manifest + service worker.
- [x] Bottom sheets, sticky actions and 44 px touch targets **(S)**

### 5.6 Accessibility and performance

- [ ] WCAG 2.2 AA audit with fixes **(M)** — self-audit only; no external audit yet.
- [x] Full keyboard path for every action; visible focus ring **(M)**
- [x] Reduced-motion mode for camera and cue transitions **(S)**
- [x] Performance budgets in CI: bundle, LCP, INP, CLS and 3D frame time **(M)** — bundle/build budget; no Lighthouse gate.
- [ ] Route-level code splitting and lazy 3D/video workers **(M)** — the demo ships one reliable entry bundle; lazy loading was removed after a Suspense failure.
- [ ] Virtualized cue and asset lists at 10k items **(M)** — not needed at 26 cues; no virtualiser.
- [x] No external font or CDN calls **(S)** — fonts bundled, no CDN.

### 5.7 Content, localisation and trust

- [x] Voice and tone guide for designers, producers and crew **(S)** — design system → content.
- [x] Plain-language errors, empty states and disclaimers **(M)**
- [x] Terminology glossary: cue, look, rig, venue, leg, load-in, changeover **(S)** — `/glossary`.
- [x] Date, time, unit and currency formatting per locale **(S)**
- [x] English and Chinese UI copy from one source **(M)** — i18n dictionary and toggle.
- [x] Provenance visible on every look, cue, asset and export **(S)**
- [x] AI-generated look/video labelled and attributable **(S)** — agent chips and model card.
- [x] Human signature visible on cue sheets and approvals **(S)**
- [x] Audit trail accessible from the UI, not just the API **(M)**

### 5.8 Engineering and assets

- [x] React + Vite + strict TypeScript with no `any` in product code **(M)** — `tsc --noEmit` passes.
- [x] Tokens compiled from one source into CSS and TS **(M)** — CSS tokens; design system catalogue.
- [x] Design-system package consumed by stage, desk and mobile **(M)** — shared components and styles.
- [x] Unit tests for cue math, budget math and rights expiry **(M)** — `server/tests/test_engine.py`.
- [x] Final logo, icons, stage assets and licensed demo track **(M)** — SVG mark, generated stage, synthesised track.
- [x] Seeded demo pack with a repeatable reset **(S)** — `npm run pack`, seed 20261030.

### 5.9 Research, rollout and gates

- [ ] Baseline SUS, task success and time-to-decision per role **(M)** — needs users.
- [ ] Five-second test: "what does this product do?" **(S)** — needs users.
- [ ] Five users per role complete the core task unaided **(M)** — needs users.
- [x] Design spike: shell, type, theme and command palette **(M)**
- [x] Token and component foundation before screen rewrites **(M)**
- [x] Rebuild the shell and navigation first **(M)**
- [x] Migrate project home, stage canvas, cue sheet and readiness **(M)**
- [x] No text below 11 px in product chrome **(S)** — design system rule.
- [x] Light, dark and high-contrast themes pass contrast **(M)** — self-check.
- [ ] WCAG 2.2 AA signed off; keyboard reachability 100% **(M)** — self-check, no sign-off.
- [ ] Time to first decision drops ≥ 30% against the baseline **(M)** — no real baseline.
- [ ] SUS ≥ 80 with five pilot users **(M)** — needs users.
- [x] Keep the 90-second stage piece intact; do not force the daily desk onto it **(S)** — separate route.

---

## Phase 6 — production wiring

### 6.1 Agent runtime

- [x] `DeepAgent` adapter with a show-scoped tool set **(M)** — `server/cue/agent/runtime.py` seam; deterministic local default.
- [x] Tools: setlist, stage, looks, video, cue sheet, budget, venue profile, rights **(M)**
- [x] System prompt: cite sources, admit missing evidence, never change a cue or approve safety **(S)** — guardrails in the agent and demo guide.
- [x] `/api/agent/status` reports configured/available/backend/model **(S)**

### 6.2 Render and inference

- [ ] GPU renderer path with explicit device and quality settings **(L)** — render status exists; the previz is SVG.
- [ ] Optional ONNX/NPU path for local look and video inference **(M)** — health path exists; no model bundled.
- [x] Refuse a missing model or GPU with an explicit error, never a silent fallback **(S)** — NPU settings return 409.
- [x] Local/offline render and inference for unreleased content **(M)** — static/offline path.
- [x] Frame-time and export-time budgets on the pilot laptop **(M)** — reported in render status.

### 6.3 Live integrations

- [ ] Depence² / Capture / WYSIWYG previz exchange **(L)** — reference adapters only.
- [ ] grandMA3 cue import/export **(L)** — reference adapter only.
- [ ] disguise / Notch / Resolume video exchange **(L)** — reference adapters only.
- [ ] DAM/asset-library connector **(M)** — reference adapter only.
- [ ] Calendar connector for tour dates and load-in **(M)** — reference adapter only.
- [ ] Budget/accounting export **(M)** — CSV export, no live accounting.

### 6.4 Customer data and storage

- [x] Show store with versions, approvals and immutable audit **(M)** — SQLite store and API.
- [x] Per-tenant isolation and encryption keys **(M)** — tenant-scoped rows; production file/schema per tenant.
- [x] Artist content stays local by default; explicit permission for any upload **(S)** — privacy policy and no upload path.
- [x] Provenance, model version and source IDs on every asset and cue **(S)**
- [x] Retention and deletion policy per tour **(S)** — `docs/data-rights.md`.

### 6.5 Security and operations

- [ ] OIDC/SSO and server-side role enforcement **(L)** — role model and tenant scoping; no OIDC provider.
- [x] Signed exports and share links with expiry **(S)** — signature rows and export headers.
- [ ] Backup/restore and disaster-recovery drill **(M)** — documented, no drill.
- [x] Observability: render failures, export failures and agent errors **(M)** — health, audit and status.
- [x] Offline queue for show week **(S)** — static/offline + systemd deny-outbound.

### 6.6 End-to-end production gate

- [ ] One real tour, one venue and 90 days running **(L)** — needs a customer.
- [ ] Track → stage → looks → cue sheet → crew → show, with no synthetic records **(L)** — needs a customer.
- [ ] Designer, producer and venue crew accept the cue sheet and readiness output **(M)** — needs users.
- [x] Safety sign-off is recorded and never automated **(S)** — signature table and guardrail.
- [ ] Agent citation coverage ≥ 95% on the pilot assets **(M)** — synthetic coverage 95%, no pilot assets.

---

## What remains, and why

The unchecked items are not hidden failures. They share four causes:

1. **A real customer.** A 90-day pilot, a baseline, interviews, SUS, a real tour and a real load-in cannot be
   generated. The software surfaces are ready for them.
2. **Vendor hardware and formats.** Vectorworks, WYSIWYG, Capture, Depence², grandMA3, disguise, Notch,
   Resolume, DAM, calendar, Jira and accounting need licensed live adapters. This repo has the seams.
3. **External audits.** WCAG 2.2 AA sign-off, security procurement and a disaster-recovery drill need a
   second party.
4. **Scale.** 500 tours / 5,000 shows is a load test and a Postgres deployment, not a demo.

Everything else is built, tested and playable.
