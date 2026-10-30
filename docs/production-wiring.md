# Production wiring

What is actually wired, what is a seam, and what still needs a real tour.

## Agent

- **Default:** `server/cue/agent/runtime.py` answers deterministically from the show pack. It is the
  same behaviour as the public demo: citations, explicit missing evidence, no mutation.
- **DeepAgent seam:** set `CUE_AGENT_BACKEND=jiuwenswarm` (and the model config) to report a configured
  backend. The HTTP shape is stable: `/api/agent/status`, `/api/agent/tools`, `/api/agent/ask`.
- **Tools:** show.read, stage.read, rig.check, sightline.check, look.generate, safety.check, cue.draft,
  human.review.
- **Guardrails:** cite, admit missing evidence, never change a cue, never approve a version, never sign
  safety, never release.
- **Not claimed:** the public demo does not call a cloud model and does not require one.

```bash
curl -s http://127.0.0.1:8000/api/agent/status | jq
curl -s -X POST http://127.0.0.1:8000/api/agent/ask \
  -H 'content-type: application/json' \
  -d '{"question":"why is the front truss over?","active_look_id":"look-aerial-12"}' | jq
```

## Render and inference

- The public previz is SVG: orbit, beams, blockers, screen, glare. It is a design instrument, not a
  renderer replacement.
- `/api/render/status` reports device, quality, frame time, export time and the NPU state.
- `POST /api/render/settings` refuses `npu` without `CUE_NPU_ENDPOINT` (409). It never silently falls
  back to CPU while claiming NPU.
- A production GPU path can sit behind the same status shape. The pack and the checks do not change.

## Integrations

| Integration | Direction | State |
|---|---|---|
| Depence² | previz exchange | reference adapter |
| Capture | previz export | reference adapter |
| WYSIWYG | rig/patch import | reference adapter |
| Vectorworks Spotlight | drafting reference | reference adapter |
| grandMA3 | cue/patch export | reference adapter |
| disguise | screen mapping | reference adapter |
| Resolume | clip/layer export | reference adapter |
| Notch | block export | reference adapter |
| DAM / Dropbox | asset freshness | connected in the demo |
| Google Calendar | tour dates | connected in the demo |
| Xero | budget export | reference adapter |
| Slack / Teams | risk digest | connected in the demo |

Everything marked reference is a seam: a typed adapter, a status, a UI, and no live vendor credential.
A pilot connects one previz tool and one console export before anything else.

## Store

- SQLite in the demo; PostgreSQL in production.
- Tables: audit, cue signatures, version approvals, risk states, risk checks. All tenant-scoped.
- Append-only audit; signatures are rows; a reset deletes only the tenant's rows.
- The cron/scheduler is a run-check endpoint and a digest model; production uses a job queue.
- Signed exports, 72-hour links, retention per tour.

## Security

- OIDC/SSO is a production seam; the role model, tenant scoping and audit are in the code.
- No outbound network during a show week; systemd denies it by default.
- Backup/restore is documented; a real drill is a pilot task.
- Observability: `/api/health`, `/api/render/status`, `/api/audits`, `/api/readiness`.

## Readiness script

```bash
# the board
curl -s http://127.0.0.1:8000/api/readiness | jq '.stats, .brief.title'

# a human decision
curl -s -X POST http://127.0.0.1:8000/api/readiness/R-001/ack \
  -H 'content-type: application/json' -d '{"actor":"Mara Voss"}' | jq '.state'

# a dismissal needs a reason
curl -s -X POST http://127.0.0.1:8000/api/readiness/R-001/dismiss \
  -H 'content-type: application/json' -d '{"actor":"Mara Voss"}'   # 400
```

## Proactive runtime

- `CUE_SCHEDULER=1` starts an in-process asyncio scanner loop. It is intentionally small; a production
  deployment replaces it with a durable queue and a worker process.
- The scanner watches venue fit, rig/power, rights, assets, budget, schedule and data freshness. It
  groups risks, deduplicates by `groupKey` and does not re-raise an open risk in the same room.
- Scan history, notifications, deliveries, dynamic risks and settings are tenant-scoped in SQLite.
- Delivery: in-app, email, Slack, Teams, SMS and HMAC-signed webhook. Missing credentials are recorded
  as `simulated`; a failed call is recorded as `error` and never crashes the scan.
- `POST /api/proactive/scan` is the manual path; `POST /api/proactive/stop` is the kill switch.

## Exports and MCP

- Real files: `iCalendar`, grandMA3 CSV/XML, Resolume CSV, Vectorworks fixture CSV and a minimal MVR
  exchange ZIP. These are not vendor-certified; a pilot replaces a reference adapter with the vendor's
  schema and a round-trip test.
- `POST /mcp` is an MCP-compatible JSON-RPC surface: `initialize`, `tools/list`, `tools/call`, `ping`.
  Tools: `show_summary`, `checks`, `budget`, `readiness`, `cue_sheet`, `ask`. Every tool is read-only.
- Signed share links use HMAC-SHA256 and expire; `/api/share/cue-sheet` verifies the token before it
  prints.

## OpenJiuwen runtime

The real path is `server/cue/agent/openjiuwen_backend.py`. It uses the same primitives as CoachMe:

```python
ModelClientConfig(client_provider=..., api_key=..., api_base=..., timeout=..., verify_ssl=...)
ModelRequestConfig(model=..., temperature=..., top_p=...)
create_deep_agent(model=..., system_prompt=..., tools=[...], workspace=..., max_iterations=8)
Runner.start(); Runner.run_agent(agent, {"query": ...}, session="cue-<uuid>")
```

- **Credentials**: `CUE_LLM_PROVIDER`, `CUE_LLM_API_BASE`, `CUE_LLM_API_KEY`, `CUE_LLM_MODEL`.
  `CUE_ENV_FILE` can point at another checkout's dotenv file; `API_BASE` / `API_KEY` / `MODEL_NAME`
  are mapped onto the `CUE_LLM_*` names. Process variables always win.
- **Tools**: eight typed, read-only callables (`show_summary`, `look_checks`, `look_budget`,
  `open_risks`, `cue_sheet`, `find_venue`, `rights_windows`, `next_show`). openjiuwen extracts the
  schema from the signature and docstring.
- **Citations**: each tool returns `{data, citations}`. The adapter collects citations only from the
  tools the model actually called and returns them with the answer, plus the tool steps and timings.
- **Isolation**: every run gets a fresh `session` id, so answers do not leak into each other. The
  workspace is `<CUE_RUNTIME>/agent`, never the repo.
- **Warm-up**: `CUE_OPENJIUWEN_WARMUP=1` imports the runtime and starts `Runner` in a background task
  at boot. The first question then costs one model round, not the import.
- **Failure**: configured but unreachable → **502**. `CUE_AGENT_FALLBACK=1` returns the deterministic
  local answer with `degraded: true` and a visible notice instead.
- **Read-only**: no tool writes. The agent cannot change a cue, approve a version, sign safety or
  release a show.
- **Probe**: `POST /api/agent/probe` makes a real, tiny model call and returns the latency.

### Remote HTTP adapter

If the agent lives behind a service rather than in this process, set `CUE_AGENT_ENDPOINT` and
`CUE_AGENT_API_KEY`. The adapter sends the show, the active look, rejected looks and the tool list,
and accepts either a CUE answer shape or an OpenAI chat completion.

### Verified

Against `openjiuwen 0.1.19` and a live `deepseek-v4-pro` endpoint: one cited answer in ~8 s after
warm-up, 1-3 tool reads, 10-12 citations. `pytest -m live` runs the same check when
`CUE_LIVE_AGENT=1` and `CUE_ENV_FILE` are set.

## Production gate

- [x] Agent status and ask endpoint.
- [x] Deterministic engine with tests.
- [x] Tenant-scoped store and audit.
- [x] Signed cue sheet and version approval.
- [x] Explicit missing-NPU error.
- [x] Offline/air-gapped posture.
- [x] Proactive scheduler, watchers, scan history and kill switch.
- [x] Delivery adapters with simulated/real status.
- [x] MCP-compatible read-only tools.
- [x] Real iCalendar, console, video, fixture and MVR exchange exports.
- [x] Remote agent adapter with explicit failure.
- [x] Real OpenJiuwen DeepAgent with eight typed, read-only show tools.
- [x] Live cited answer verified against a real endpoint, with a `live` test.
- [ ] Durable queue/worker (the current loop is in-process).
- [ ] One live previz adapter.
- [ ] One live console export.
- [ ] OIDC/SSO.
- [ ] Backup/restore drill.
- [ ] One real tour, one venue, 90 days.
- [ ] Designer, producer and crew acceptance.

The remaining items are customer, hardware and deployment work. The code paths are ready to be pointed
at them.
