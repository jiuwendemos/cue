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

## Production gate

- [x] Agent status and ask endpoint.
- [x] Deterministic engine with tests.
- [x] Tenant-scoped store and audit.
- [x] Signed cue sheet and version approval.
- [x] Explicit missing-NPU error.
- [x] Offline/air-gapped posture.
- [ ] One live previz adapter.
- [ ] One live console export.
- [ ] OIDC/SSO.
- [ ] Backup/restore drill.
- [ ] One real tour, one venue, 90 days.
- [ ] Designer, producer and crew acceptance.

The last six are customer and vendor work. The code is ready to be pointed at them.
