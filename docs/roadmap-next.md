# CUE — the next three tracks

**Status: plan, not shipped.** This is the honest gap between the current demo and the product:

1. **Proactive** — the desk should act before the load-in, not wait for a click.
2. **True 2026** — the studio should be a place creative people love, not a styled dashboard.
3. **Connected** — the seams should become real services, real identity and real data.

Legend: `[x]` exists in the demo today · `[ ]` to build · **P0** prove in the next pilot · **P1** next
90 days · **P2** after the first paid tour.

**477 checkboxes: 114 already in the demo, 363 to build.** The count is the point: this is the work,
not a slogan.

The current demo status is in [roadmap.md](roadmap.md). The public app is
<https://jiuwendemos.github.io/cue/>.

---

# Track A — Proactive

**Goal:** CUE watches the tour, the venue, the cue, the rights, the assets and the budget, and raises
the right risk before the crew hits the loading dock.

**Contract:** recommendations only. No live control, no automatic cue changes, no automatic release.
Safety stays human.

## A1 · The clock and the runtime

- [ ] **P0** Durable scheduler (cron or queue) per tenant, not an in-process loop
- [ ] **P0** Job queue with retries, backoff and a dead-letter view
- [ ] **P0** Idempotent scan jobs keyed by `tour + window + rule version`
- [ ] **P0** Scan watermark per tour, so a re-run does not double-alert
- [ ] **P0** Timezone- and DST-safe windows for every city on the tour
- [ ] **P0** 14 / 7 / 3-day readiness checks before each show
- [ ] **P0** Daily show-week scan at a fixed local time
- [x] **P0** Manual **Scan now** that writes the same audit as the scheduler
- [x] **P0** Pause / resume / kill switch per tour, visible to the production office
- [x] **P0** Scan history with lag, duration, count and outcome
- [ ] **P0** Offline / air-gapped queue for a show week with no network
- [ ] **P0** Scheduler heartbeat and a “last scan” badge in the UI
- [ ] **P1** Per-venue scan cadence, not only per-tour
- [ ] **P1** Priority queue: critical show-week checks run before library refreshes
- [ ] **P1** Backfill / replay a window after an outage
- [ ] **P1** Job ownership and a runbook for a stuck queue
- [ ] **P2** Multi-region scheduler with tenant failover

## A2 · Change detection

- [ ] **P0** Date added, moved or cancelled
- [ ] **P0** Venue changed on a date
- [ ] **P0** Setlist or song timing changed
- [ ] **P0** Cue edited, re-pointed or deleted
- [ ] **P0** Look replaced, rejected or re-approved
- [ ] **P0** Video asset delivered, replaced or missing
- [ ] **P0** Rights window or territory changed
- [ ] **P0** Budget line, rate or approval changed
- [ ] **P0** Crew role, owner or travel deadline changed
- [ ] **P0** Venue rig, power or sightline profile re-verified
- [ ] **P0** Load-in or changeover hours changed
- [ ] **P0** A risk dismissed, resolved or reopened
- [ ] **P0** Every change carries `who / when / source / before / after`
- [ ] **P1** Change feed per tour, visible to the producer
- [ ] **P1** “What changed since your last look” digest
- [ ] **P1** Cascading change: a venue change re-checks screen, rig and load-in
- [ ] **P1** Conflict detection between overlapping edits
- [ ] **P2** Change subscriptions per role and per venue

## A3 · Watchers

- [ ] **P0** Tour watcher: dates, gaps, travel, curfew
- [ ] **P0** Show watcher: cue sheet, setlist, versions
- [x] **P0** Venue watcher: stage, rig, power, sightlines, freshness
- [x] **P0** Rig watcher: truss load, supply, distro, fixture count
- [x] **P0** Rights watcher: music, video, likeness, territory, expiry
- [x] **P0** Asset watcher: missing, stale, broken link, wrong version
- [x] **P0** Budget watcher: approved vs current, add-ons, contingency
- [ ] **P0** Crew watcher: owner, confirmation, travel, call time
- [x] **P0** Schedule watcher: cue complexity vs load-in and rehearsal
- [ ] **P0** Safety watcher: glare, strobe, structure, rigging, laser
- [x] **P0** Data watcher: stale venue profile, missing power survey
- [x] **P0** Coverage watcher: which venues are watched and which are blind
- [ ] **P0** Every watcher has a version, an owner and a false-alarm budget
- [x] **P0** Shadow mode: no customer-facing alert until the producer validates
- [ ] **P1** Adaptive thresholds per venue, tour leg and show type
- [ ] **P1** Multi-show confirmation before raising a cross-tour pattern
- [ ] **P1** Watcher dry-run with a fixture set
- [ ] **P2** Customer-defined watchers and rules

## A4 · Evidence and the human decision

- [ ] **P0** “Why now?” pack: the factor, the source, the delta, the window
- [ ] **P0** Source diff: the actual before/after record, not just a sentence
- [ ] **P0** Confidence calibrated against confirmed issues
- [x] **P0** Suggested check/fix with effort, owner and cost impact
- [x] **P0** Owner routing by tour, venue and role
- [x] **P0** SLA timer for load-in, rehearsal and approval deadlines
- [ ] **P0** Escalation path for a critical show-week risk
- [ ] **P0** “No action” as a recorded, valid outcome
- [x] **P0** Dismissal taxonomy, visible in reporting
- [x] **P0** Reopen on recurrence, with the previous decision attached
- [ ] **P0** “Fixed but not verified” on the show-week brief
- [x] **P0** Human override log: who disagreed, with what evidence, why
- [x] **P1** Risk grouping and dedupe by group key
- [ ] **P1** “What would falsify this?” attached to every risk
- [ ] **P1** Producer sign-off on the first N risks per tour
- [ ] **P2** Learned thresholds per production company

## A5 · Delivery

- [x] **P0** In-app inbox with read/acknowledge
- [x] **P0** Email with a signed deep link and expiry
- [x] **P0** Slack / Teams with acknowledge and assign
- [x] **P0** SMS / pager for critical show-week only
- [x] **P0** Quiet hours with a digest fallback
- [x] **P0** Daily / weekly digest for the production office
- [x] **P0** Per-tenant notification isolation
- [x] **P0** Generic webhook with HMAC and retry
- [x] **P0** Delivery dashboard: sent, opened, acknowledged, failed
- [ ] **P0** Notification preferences per role, venue and severity
- [ ] **P1** Calendar sync for dates, load-in and rehearsal
- [ ] **P1** Mobile push / PWA notification
- [ ] **P1** Digest “top 3, not 30”
- [ ] **P1** Escalation when an ack is overdue
- [ ] **P2** Broadcast to a festival’s multi-stage production office

## A6 · Anticipation

- [x] **P0** Rights expiry countdown per date and territory
- [x] **P0** Content delivery countdown with a fallback plan
- [ ] **P0** Crew confirmation and travel deadline tracker
- [ ] **P0** Rehearsal hours vs cue complexity
- [ ] **P0** Load-in hours vs rig and set complexity
- [ ] **P0** “What changed since your last look” per tour
- [x] **P0** Show-week brief: top risks, approvals due, open items
- [ ] **P0** Three-day final check with a stop-work list
- [x] **P1** Backtest readiness checks over past tours
- [ ] **P1** False-alarm trend by venue, tour and reason
- [x] **P1** Risk-fatigue budget per producer per week
- [ ] **P1** “If nothing changes, what happens next?” forecast
- [ ] **P2** Seasonal and festival readiness templates
- [ ] **P2** Cross-tour pattern library with a human owner

## A7 · Measurement and gates

- [ ] **P0** Risk precision and recall against confirmed issues
- [ ] **P0** Actionable rate: risks that led to a fix
- [ ] **P0** Time saved per producer per show week
- [ ] **P0** Cost avoided per risk and per tour
- [ ] **P0** Missed load-ins and near-misses
- [ ] **P0** Alerts per producer per day and time-to-acknowledge
- [ ] **P0** **Gate 1** four-week shadow with no customer-facing risk
- [ ] **P0** **Gate 2** 90-day tour: precision ≥ 0.80, actionable ≥ 25%
- [ ] **P0** **Gate 3** production after two green months and a signed annex
- [x] **P0** Kill criteria written before launch
- [ ] **P0** Kill-switch drill with the production office
- [ ] **P0** Weekly review ritual and a named owner
- [ ] **P1** Precision/recall by watcher and venue
- [ ] **P1** Cost per actionable risk
- [ ] **P2** Public benchmark with consenting production companies

## A8 · Proactive agent

- [ ] **P0** Agent sidecar reads the current show, venue and open risks
- [ ] **P0** Agent proposes a check, not just an answer
- [ ] **P0** “Why I spoke” with citations and a confidence
- [ ] **P0** Tool plan shown before a read-only tool runs
- [x] **P0** No autonomous cue, approval, signature or release
- [x] **P0** Missing evidence is stated, not guessed
- [ ] **P0** Memory of the last decision and the reason
- [ ] **P0** Opt-out per user and per tour
- [ ] **P1** Proactive “what changed” summary when the designer opens the show
- [ ] **P1** Proactive “this look will fail the rig” during a drag
- [ ] **P1** Multilingual proactive summaries
- [ ] **P2** Voice brief in the production office
- [ ] **P2** Agent-to-agent handoff with the venue crew

## A9 · Proactive definition of done

- [ ] **P0** A new date or venue triggers a scan without a click
- [x] **P0** A stale venue profile raises a risk with the last-verified date
- [x] **P0** A rights expiry creates a countdown and a fallback
- [x] **P0** A missing clip blocks the cue and names the asset
- [x] **P0** A budget drift shows the delta and the owner
- [x] **P0** A producer can acknowledge, assign and dismiss in one minute
- [x] **P0** A dismissal records a reason and does not silence the pattern
- [x] **P0** The show-week brief is generated, not hand-written
- [x] **P0** The system stays quiet when nothing changed
- [x] **P0** The kill switch stops readiness without hiding the show

---

# Track B — True 2026

**Goal:** a studio with taste, theatre and speed — not a SaaS dashboard with a dark theme.

The current build already has the poster home, concept board, custom type, command palette, themes,
mobile review and a PWA shell. This is what closes the gap to a product people love.

## B1 · Research with real people

- [ ] **P0** Five designer interviews
- [ ] **P0** Five producer interviews
- [ ] **P0** Five venue-crew interviews
- [ ] **P0** Five tour-manager interviews
- [ ] **P0** Contextual inquiry in a real venue at load-in
- [ ] **P0** Diary study across one show week
- [ ] **P0** Baseline: time to a look, time to a cue sheet, time to approve
- [ ] **P0** Five-second test: “what does this do?”
- [ ] **P0** Task success per role, unaided
- [ ] **P0** SUS baseline and target ≥ 80
- [ ] **P0** Failure taxonomy, not only success metrics
- [ ] **P0** Accessibility users in the sample
- [ ] **P0** Non-native English users
- [ ] **P0** Mobile-only producers and crew
- [ ] **P1** Longitudinal study over a tour

## B2 · Brand and identity

- [ ] **P0** Final logotype, not a placeholder mark
- [ ] **P0** App icon at 16, 32, 64 and stage scale
- [ ] **P0** Motion identity: cue light, beam sweep, blackout
- [ ] **P0** Sound identity: one cue chime, one blackout, mute by default
- [ ] **P0** Poster templates per show and per tour
- [ ] **P0** Cue-sheet template with a human signature line
- [ ] **P0** Ticket / venue-card template
- [ ] **P0** Photography and illustration rules
- [ ] **P0** AI-generated asset label and attribution
- [ ] **P0** Partner co-brand rules
- [ ] **P0** Brand guidelines with anti-patterns
- [ ] **P1** Show-poster generator from the setlist and palette
- [ ] **P2** Artist-specific skins with designer control

## B3 · Design system, for real

- [x] **P0** Tokens compiled from one source into CSS and TS
- [x] **P0** Light, dark and high-contrast themes designed together
- [x] **P0** Colour-blind-safe cue, rig and risk palette
- [x] **P0** Type scale with an 11 px floor in product chrome
- [ ] **P0** Space, radius, elevation and motion tokens
- [x] **P0** Focus ring, skip link and reduced motion
- [ ] **P0** Accessible dialog, menu, tabs, tooltip and combobox
- [x] **P0** Button, input, select, textarea, switch, slider
- [x] **P0** Command palette and search
- [x] **P0** Toast, drawer, bottom sheet and confirmation
- [x] **P0** Timeline, cue row, look card, venue card, chart frame
- [x] **P0** Empty, loading, error and offline states
- [ ] **P0** Data table with sort, filter, sticky header and virtual rows
- [ ] **P0** Chart data table fallback
- [x] **P0** Component catalogue with live props
- [ ] **P1** Design-system package consumed by stage, desk and mobile
- [ ] **P2** Public design tokens for partner tools

## B4 · Canvas and timeline craft

- [x] **P0** Real 3D previz path (WebGL/WebGPU), not only SVG
- [ ] **P0** Fixture models and a fixture library
- [ ] **P0** Volumetric beams with a quality setting
- [ ] **P0** Camera paths and shot presets
- [x] **P0** Screen mapping preview with content
- [ ] **P0** Performer blocking and paths
- [ ] **P0** Video scrub with audio
- [ ] **P0** Solo, compare and A/B two looks
- [ ] **P0** Cue transitions on the timeline
- [ ] **P0** 16 ms frame budget at the demo resolution
- [ ] **P0** Reduced-motion and low-quality fallback
- [ ] **P0** Export a still and a short sequence
- [ ] **P0** Legibility at 10 metres
- [x] **P0** Presenter mode: large type, keyboard-only
- [ ] **P1** Camera-move authoring
- [ ] **P1** Video mapping on non-planar screens
- [ ] **P2** Real-time remote previz session

## B5 · AI-native interaction

- [x] **P0** Natural-language commands: “make the drop warmer”
- [ ] **P0** “Show rig conflicts on this leg”
- [x] **P0** Intent parser with clarification and safe fallback
- [x] **P0** Tool calls as inspectable steps, not magic
- [x] **P0** Citations to the source asset, cue or risk
- [x] **P0** Confidence and missing-evidence language
- [ ] **P0** “Why this look?” and “why this risk?” drawers
- [x] **P0** Propose vs apply, with an explicit confirm
- [ ] **P0** Undo for any applied suggestion
- [x] **P0** Human approval for every change
- [ ] **P0** Multilingual answers, not only chrome
- [ ] **P1** Voice input in the production office
- [ ] **P1** Agent memory of the show's decisions
- [ ] **P2** Local model for unreleased content

## B6 · Mobile and PWA

- [x] **P0** Real 390 and 768 layouts, not a squeezed desktop
- [x] **P0** 44 px touch targets
- [ ] **P0** Bottom sheets and sticky actions
- [x] **P0** Offline shell and cached show pack
- [x] **P0** Installable PWA with an update path
- [ ] **P0** Safe areas and one-handed use
- [x] **P0** Crew cue card and sign-off
- [x] **P0** Producer approve / acknowledge / brief
- [x] **P0** Tour manager dates and travel
- [ ] **P0** Camera / QR handoff from the desk
- [ ] **P1** Push notifications
- [ ] **P1** Offline queue with a visible sync state
- [ ] **P2** Tablet mode for the stage manager

## B7 · Accessibility

- [ ] **P0** WCAG 2.2 AA audit by an external party
- [ ] **P0** 100% keyboard reachability
- [ ] **P0** Screen-reader pass on every core flow
- [ ] **P0** Logical focus order and focus return
- [ ] **P0** Contrast in all three themes
- [x] **P0** Reduced motion for camera and cue transitions
- [ ] **P0** Captions / transcripts for any recorded demo
- [x] **P0** 44 px touch targets
- [ ] **P0** Error identification and recovery
- [ ] **P0** Never colour alone
- [ ] **P0** 200% zoom without loss
- [ ] **P0** Language of parts
- [ ] **P0** Signed-off accessibility statement
- [ ] **P1** Cognitive-load test with a real cue sheet
- [ ] **P2** Accessible 3D alternative (plan view + list)

## B8 · Performance

- [ ] **P0** Route-level code splitting that works in this environment
- [x] **P0** On-demand WebGL chunk: the 3D previz is not in the first load
- [ ] **P0** Bundle budget in CI
- [ ] **P0** LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1
- [ ] **P0** 3D frame time ≤ 16 ms
- [ ] **P0** Virtualized cue and asset lists at 10k items
- [x] **P0** Local fonts, no CDN, no external call
- [x] **P0** Offline cold start
- [ ] **P1** Lighthouse CI and a performance regression gate
- [ ] **P1** Load test 500 tours / 5,000 shows / 100 producers
- [ ] **P2** Per-tenant cost and render budgets

## B9 · Content, voice and i18n

- [x] **P0** Voice and tone guide for designer, producer, crew
- [x] **P0** Plain-language errors, empty states and disclaimers
- [x] **P0** Terminology glossary, in-product
- [ ] **P0** English and Chinese from one source, full content
- [ ] **P0** Date, time, unit and currency per locale
- [x] **P0** Provenance on every look, cue, asset and export
- [x] **P0** AI-generated output labelled and attributable
- [x] **P0** Human signature on cue sheets and approvals
- [x] **P0** Audit trail in the UI
- [ ] **P0** Onboarding for a first-time designer
- [ ] **P0** Demo guide with “what is real”
- [ ] **P1** A second language beyond Chinese
- [ ] **P1** Terminology review with working designers

## B10 · Delight and creative craft

- [x] **P0** One sound cue at the drop, mute by default
- [x] **P0** A stage-piece intro that earns the first 10 seconds
- [x] **P0** Micro-interactions on look selection and cue commit
- [ ] **P0** Share card for a finished cue sheet
- [ ] **P0** Export a show poster / zine page
- [ ] **P0** Designer’s notes on every look
- [ ] **P0** A moodboard the designer can add to
- [x] **P0** A moodboard is part of the concept board
- [ ] **P0** Palette extraction from a reference
- [ ] **P0** A “scratch” look that is not in the cue sheet
- [ ] **P0** A show reset that feels like a blackout
- [ ] **P1** A stage-piece easter egg for the room
- [ ] **P1** Artist mode with only the creative surfaces
- [ ] **P2** A public show gallery with consent

## B11 · 2026 definition of done

- [ ] **P0** Five designers say “I would use this” unaided
- [ ] **P0** Five producers complete the core task unaided
- [ ] **P0** Time to first decision drops ≥ 30%
- [ ] **P0** SUS ≥ 80 with five pilot users
- [ ] **P0** WCAG 2.2 AA signed off
- [x] **P0** No text below 11 px in chrome
- [x] **P0** All three themes pass contrast
- [x] **P0** The 90-second stage piece stays intact
- [ ] **P0** No “dashboard” home in any theme
- [ ] **P0** A creative person opens it and smiles before they read a table

---

# Track C — Connected

**Goal:** real identity, real data, real tools. One previz adapter and one console export first, then
the rest. Never live control.

## C1 · OpenJiuwen / DeepAgent

- [x] **P0** HTTP adapter for a DeepAgent/OpenAI-compatible endpoint, with an explicit 502 on failure
- [ ] **P0** Real DeepAgent/JiuwenSwarm client, not a status-only seam
- [ ] **P0** Model configuration per tenant
- [ ] **P0** Auth and secret handling
- [x] **P0** Typed tool schemas and a tool registry
- [ ] **P0** Streaming answers and tool steps
- [ ] **P0** Citation coverage on every claim
- [ ] **P0** Eval set of 50 show questions
- [x] **P0** Offline deterministic fallback
- [ ] **P0** Timeout, retry and a clear error surface
- [ ] **P0** Rate limits and cost caps
- [x] **P0** Audit of every ask and answer
- [ ] **P0** Model version and prompt version pinned
- [x] **P0** No autonomous change, approval or signature
- [x] **P0** MCP server exposing the show tools
- [ ] **P0** MCP client for an external design tool
- [ ] **P1** Local model path for unreleased content
- [ ] **P1** Agent evaluation dashboard
- [ ] **P2** Multi-agent design review with a human chair

## C2 · Identity and tenancy

- [ ] **P0** OIDC / SSO
- [ ] **P0** SCIM provisioning
- [ ] **P0** Server-side role enforcement
- [ ] **P0** Per-tenant isolation and keys
- [ ] **P0** Session expiry and refresh
- [ ] **P0** Audit of role changes
- [ ] **P0** Invite and offboard flow
- [ ] **P0** Seat and show billing
- [ ] **P0** Admin console
- [ ] **P0** Tenant kill switch
- [ ] **P1** Data residency options
- [ ] **P1** SSO group mapping
- [ ] **P2** Partner and guest accounts

## C3 · Storage and operations

- [ ] **P0** PostgreSQL production store
- [ ] **P0** Migrations with rollback
- [ ] **P0** Object storage for assets, exports and evidence
- [ ] **P0** Job queue and scheduler
- [ ] **P0** Backup and restore drill
- [ ] **P0** Disaster-recovery runbook
- [ ] **P0** Metrics, logs and traces
- [ ] **P0** Alerting on render, export and agent errors
- [ ] **P0** Retention and deletion jobs
- [ ] **P0** Cost observability per tenant
- [ ] **P0** Load test 500 tours / 5,000 shows / 100 producers
- [ ] **P1** Read replica and failover
- [ ] **P1** Point-in-time recovery drill
- [ ] **P2** Multi-region active/passive

## C4 · Previz and CAD

- [x] **P0** Vectorworks fixture schedule CSV export
- [ ] **P0** Vectorworks Spotlight import
- [ ] **P0** Vectorworks Spotlight export
- [ ] **P0** WYSIWYG exchange
- [ ] **P0** Capture exchange
- [ ] **P0** Depence² exchange
- [x] **P0** MVR exchange package export (minimal, not vendor-certified)
- [ ] **P0** MVR import
- [ ] **P0** glTF / USD handoff
- [ ] **P0** Fixture library and patch
- [ ] **P0** Stage geometry round-trip
- [ ] **P0** Round-trip fixture test (import → edit → export)
- [ ] **P1** Layer and palette mapping
- [ ] **P2** Live link to a previz session

## C5 · Console and video

- [ ] **P0** grandMA3 cue import
- [x] **P0** grandMA3 cue export
- [x] **P0** Resolume clip/layer export
- [ ] **P0** disguise mapping export
- [ ] **P0** Notch block export
- [ ] **P0** Media-server clip list
- [ ] **P0** Cue sync and numbering
- [ ] **P0** Signed export with a version
- [ ] **P0** Round-trip cue test
- [x] **P0** No live control, no DMX, no automatic release
- [ ] **P1** Console patch import
- [ ] **P2** Vendor certification

## C6 · Content and DAM

- [ ] **P0** Dropbox
- [ ] **P0** Google Drive
- [ ] **P0** Frame.io
- [ ] **P0** Box
- [ ] **P0** S3-compatible storage
- [ ] **P0** Asset freshness and checksum
- [ ] **P0** Missing asset detection
- [ ] **P0** Rights metadata on each asset
- [ ] **P0** Preview proxy without leaking the master
- [ ] **P0** Deletion and retention
- [ ] **P1** Version diff on a clip
- [ ] **P2** Asset marketplace with licensing

## C7 · Calendar and crew

- [ ] **P0** Google Calendar
- [ ] **P0** Microsoft Outlook
- [x] **P0** ICS fallback
- [ ] **P0** Load-in, show, curfew and rehearsal events
- [ ] **P0** Travel and accommodation
- [ ] **P0** Crew assignment and confirmation
- [ ] **P0** Call sheet export
- [ ] **P0** Timezone-safe sync
- [ ] **P1** Two-way sync with conflict handling
- [ ] **P2** Crew marketplace / local vendor search

## C8 · Chat, tasks and alerts

- [x] **P0** Slack
- [ ] **P0** Microsoft Teams
- [x] **P0** Email
- [x] **P0** SMS / pager
- [ ] **P0** Jira
- [ ] **P0** Asana
- [ ] **P0** Linear
- [x] **P0** HMAC webhook and retry
- [ ] **P0** Acknowledge and assign from chat
- [ ] **P0** Signed deep links
- [ ] **P1** Task status sync back to a risk
- [ ] **P2** Production-office chat assistant

## C9 · Finance and rights

- [ ] **P0** Xero export
- [ ] **P0** QuickBooks export
- [ ] **P0** Budget and PO export
- [ ] **P0** Invoice status
- [ ] **P0** Rights register sync
- [ ] **P0** Territory and expiry rules
- [ ] **P0** Licence document links
- [ ] **P0** Audit of rights changes
- [ ] **P1** Cost of a look from the accounting system
- [ ] **P2** Insurance and permit tracking

## C10 · Venue and touring network

- [ ] **P0** Venue database with rig and power
- [ ] **P0** Sightline profiles
- [ ] **P0** Load-in and changeover history
- [ ] **P0** Local crew and vendors
- [ ] **P0** Travel and route planning
- [ ] **P0** Venue API / import
- [ ] **P1** Venue verification workflow
- [ ] **P2** Public venue graph with consent

## C11 · Media and inference

- [ ] **P0** GPU broker with explicit device/quality
- [ ] **P0** ONNX local inference
- [ ] **P0** Ascend/NPU optional path
- [ ] **P0** Model registry and versioning
- [ ] **P0** Frame-time budget
- [ ] **P0** Export-time budget
- [x] **P0** Explicit failure when the model or GPU is missing
- [x] **P0** Local-only path for unreleased content
- [x] **P0** Privacy review and telemetry off
- [ ] **P1** Beat/stem analysis on site
- [ ] **P1** Pose/blocking from rehearsal footage
- [ ] **P2** Look/video suggestions on the edge box

## C12 · Security and compliance

- [ ] **P0** Threat model review
- [ ] **P0** Penetration test
- [ ] **P0** Least-privilege service accounts
- [ ] **P0** Key rotation
- [x] **P0** Signed links with expiry
- [ ] **P0** DPA and sub-processor list
- [ ] **P0** Data-rights annex signed
- [ ] **P0** Incident response and notification
- [ ] **P0** DR drill with the production office
- [ ] **P0** Audit export for the customer
- [ ] **P1** SOC 2 readiness (if the market needs it)
- [ ] **P2** ISO 27001 readiness

## C13 · End-to-end

- [ ] **P0** One real tour
- [ ] **P0** One real venue
- [ ] **P0** 90 days running
- [ ] **P0** Track → stage → looks → cue sheet → crew → show, no synthetic records
- [ ] **P0** Designer accepts the cue sheet
- [ ] **P0** Producer accepts the readiness output
- [ ] **P0** Venue crew accepts the rig and power sign-off
- [ ] **P0** Safety sign-off recorded, never automated
- [ ] **P0** Agent citation coverage ≥ 95% on pilot assets
- [ ] **P0** Cost avoided measured
- [ ] **P0** Renewal decision
- [ ] **P1** Reference case with measured load-in readiness
- [ ] **P2** Second production company

## C14 · Connected definition of done

- [ ] **P0** One previz adapter is live, not a reference
- [ ] **P0** One console export is live, not a reference
- [ ] **P0** One real DeepAgent call returns a cited answer
- [ ] **P0** One real user signs in with SSO
- [ ] **P0** One real asset arrives from a DAM
- [ ] **P0** One real risk reaches Slack and is acknowledged
- [ ] **P0** One real calendar change triggers a re-check
- [ ] **P0** One real export is signed and accepted by a venue
- [x] **P0** The public demo still runs offline with no account
- [x] **P0** No live control, no DMX, no automatic release

---

# The sequencing

## Next 30 days — make it proactive

- [ ] Durable scheduler + change detection (A1, A2)
- [ ] 14/7/3 checks + show-week brief (A1, A6)
- [ ] Email + Slack + signed deep link (A5)
- [ ] Dismissal taxonomy and re-check loop (A4)
- [ ] Shadow mode with a real production office (A7)
- [ ] One real previz adapter (C4)

## Next 60 days — make it 2026

- [ ] User research with five designers and five producers (B1)
- [ ] Design-system package and component catalogue (B3)
- [ ] True 3D/WebGL previz path (B4)
- [ ] WCAG 2.2 AA audit (B7)
- [ ] Route splitting, Lighthouse CI and 10k virtualization (B8)
- [ ] Real DeepAgent client and evals (C1)

## Next 90 days — make it connected

- [ ] OIDC/SSO and server-side roles (C2)
- [ ] PostgreSQL, object storage, queue and backups (C3)
- [ ] One console export and one DAM (C5, C6)
- [ ] Calendar and Slack/Teams (C7, C8)
- [ ] One real tour, one venue, 90 days (C13)
- [ ] The three gates: proactive, 2026, connected

---

## The one rule for all three tracks

**CUE recommends; the designer authors; the crew runs the show; the human signs safety.**

Every checkbox must preserve that sentence.
