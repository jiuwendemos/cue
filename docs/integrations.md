# Integrations — status, why, and what CUE does with them

Two runtimes exist:

- **The public demo** (GitHub Pages) is static. It makes **no external calls**. Every integration below is
  either a real file export or a labelled simulation there.
- **The on-site service** (`server/`) is where calls are made. Status below describes that service.

Status values:

| Status | Means |
|---|---|
| **Verified** | A real call was made from this repo and checked. |
| **Built, not configured** | The code path exists; no credential is attached in this repo. Missing credentials are recorded as `simulated`, never as a silent success. |
| **File exchange** | Real files are produced/parsed; the vendor has not certified the round-trip. |
| **Not built** | No adapter. The UI may show a placeholder or a button that only explains the gap. |

## The table

| Service | Why CUE needs it | What CUE does with it | Status | Configure |
|---|---|---|---|---|
| **OpenJiuwen + model endpoint** | The design agent needs a reasoning model | `Model` + `create_deep_agent` + `Runner`; 8 read-only show tools; cited answers; warm-up at boot; 502 if configured and unreachable | **Verified** (`openjiuwen 0.1.19`, `deepseek-v4-pro`, ~8 s first answer) | `CUE_LLM_API_BASE`, `CUE_LLM_API_KEY`, `CUE_LLM_MODEL` (or `CUE_ENV_FILE` pointing at a CoachMe-style `.env`) |
| **JiuwenSwarm / remote agent HTTP** | Run the agent outside this process | POST adapter (CUE answer or chat shape), Bearer key, explicit failure | Built, not configured | `CUE_AGENT_ENDPOINT`, `CUE_AGENT_API_KEY` |
| **MCP clients (inbound)** | Let other design tools or agents read the show | JSON-RPC at `/mcp`: `show_summary`, `checks`, `budget`, `readiness`, `cue_sheet`, `ask` (read-only) | Built; no external client attached | Point a client at `POST /mcp` |
| **Email (SMTP)** | Risk and digest notifications to the production office | Sends alerts + signed deep links; retries; records `delivered` / `error` / `simulated` | Built, not configured | `CUE_SMTP_HOST`, `CUE_SMTP_PORT`, `CUE_SMTP_USER`, `CUE_SMTP_PASSWORD`, `CUE_EMAIL_FROM` |
| **Slack** | Same, to the show channel | Webhook post; same delivery record | Built, not configured | `CUE_SLACK_WEBHOOK` |
| **Microsoft Teams** | Same, where the office lives in Teams | Webhook post | Built, not configured | `CUE_TEAMS_WEBHOOK` |
| **SMS / pager** | Critical, show-week only | POST to a gateway; short message | Built, not configured | `CUE_SMS_URL`, `CUE_SMS_TOKEN` |
| **Generic signed webhook** | Connect any other system (ticketing, ops, BI) | HMAC-SHA256 `X-CUE-Signature`, retry/backoff | Built, not configured | `CUE_WEBHOOK_URL`, `CUE_WEBHOOK_SECRET` |
| **DAM / asset library** | Content freshness: is the clip actually there? | Scans a local/mounted folder, SHA-256 per file, reports found/missing | **Partial**: local folder only | `CUE_ASSET_DIR` |
| **Vectorworks Spotlight** | The rig schedule the crew already has | Fixture CSV **import** (browser + server preview) and **export** | File exchange, not certified | Upload in My tour, or `POST /api/import/vectorworks` |
| **grandMA3** | The cue list the console operator runs | Cue CSV/XML **export**, cue CSV **import** | File exchange, not certified | `/api/export/grandma3.csv`, My tour import |
| **Resolume** | The video operator's clip list | Clip/layer CSV export | File exchange, not certified | `/api/export/resolume.csv` |
| **MVR (previz handoff)** | One scene package for another tool | Minimal MVR ZIP: scene XML + cue CSV + fixture CSV | File exchange, not certified | `/api/export/mvr.zip` |
| **Depence², Capture, WYSIWYG, disguise, Notch** | Professional previz/media-server round-trip | Nothing vendor-specific; only the MVR/CSV files above | **Not built** | — |
| **Google Calendar / Outlook** | Put dates, load-ins and crew calls where people look | iCalendar (.ics) export of the tour | **Export only**; no sync | `/api/export/ics` |
| **Xero / accounting** | Budget and purchase orders | Budget CSV export; the “Create invoice” button is a demo explanation | **Export only**; no API | `/api/export/bundle` |
| **OIDC / SSO** | Real identity and server-enforced roles | None. The role switch is client-side; the server trusts the `X-CUE-Tenant` header | **Not built** | — |
| **Postgres / object storage** | Multi-user content, scale, DR | SQLite + local disk, per-tenant rows, backup endpoint | **Not built** | `CUE_DB`, `CUE_BACKUP_DIR` (SQLite/file) |
| **GPU render / NPU** | High-quality previz rendering | Render status seam; optional NPU broker health check; timings are modelled | **Simulated / optional** | `CUE_RENDER_DEVICE`, `CUE_NPU_ENDPOINT` |
| **Venue, weather, travel APIs** | Fill venue and travel data automatically | None; venue profiles are part of the show pack | **Not built** | — |

## What is verified in this repo

- **OpenJiuwen agent**: live answer with real tool calls and citations, plus a `pytest -m live` check.
- **Delivery adapters**: unit-tested for the `simulated` path; a real webhook/SMTP/SMS call happens only
  when its env var is set.
- **Exports**: iCalendar, grandMA3 CSV/XML, Resolume CSV, Vectorworks CSV, MVR ZIP — files verified in
  tests.
- **Imports**: cue and fixture CSV parsing, both in the browser and in the server preview.
- **DAM**: local folder scan with checksums, unit-tested.
- **Signed links**: HMAC with expiry, unit-tested.
- **Backup / metrics**: SQLite backup + restore drill, Prometheus-style `/api/metrics`.

## What is not there yet

Real vendor certification, cloud DAM, calendar sync, accounting APIs, OIDC, Postgres/object storage,
a render farm, and real venue/weather feeds. Each has a row above and a reason; none is faked as
“connected”.

The Admin page shows the integration registry. In the demo its statuses are the honest reference
statuses above; on site, the **delivery records** (`/api/proactive` → deliveries) and the configured
env are the authority, not the registry label.

## What to connect first

1. **Slack + email** — the show-watch loop is already built; one webhook and one SMTP host make it real.
2. **OIDC** — roles stop being a client-side switch.
3. **Postgres + object storage** — multi-user authoring and a real backup/DR story.
4. **One console and one previz vendor** — a certified round-trip beats ten file formats.

## Secrets

Credentials live in the environment or a git-ignored `.env` (`CUE_ENV_FILE`). The repo contains none.
The API reports the endpoint **host** and never the key; the public demo makes no external call at all.
