# Deployment

## Public demo

The public demo is a static build on GitHub Pages:

<https://jiuwendemos.github.io/cue/>

- `web` builds to `web/dist`.
- Vite `base: "./"`, so the same build works under `/cue/` and at the root.
- HashRouter, so no server rewrite is needed.
- The service worker caches the shell and hashed assets after the first load.
- No external fonts, CDN or analytics.

The Pages workflow is `.github/workflows/pages.yml`.

## Local web

```bash
cd web
npm install
npm run dev        # http://127.0.0.1:5174
npm run build
```

The dev proxy sends `/api` to `http://127.0.0.1:8000`.

## On-site API

```bash
cd web && npm run pack
cd ../server
python -m pip install -e ".[dev]"
uvicorn cue.api.app:app --host 127.0.0.1 --port 8000
```

Environment (see `.env.example`):

| Variable | Default | Purpose |
|---|---|---|
| `CUE_DB` | `./cue-data/cue.sqlite3` | tenant-scoped store |
| `CUE_PACK` | `server/cue/data/show.json` | the show pack |
| `CUE_WEB_DIST` | `web/dist` | the SPA served by FastAPI |
| `CUE_DEFAULT_TENANT` | `halcyon` | default tenant |
| `CUE_TENANTS` | `halcyon` | advertised tenants |
| `CUE_AGENT_BACKEND` | empty | configured DeepAgent backend; empty = deterministic local |
| `CUE_STRICT_INTEGRATIONS` | `0` | refuse ready without agent + live connector |
| `CUE_RENDER_DEVICE` | `gpu` | gpu, cpu or npu |
| `CUE_NPU_ENDPOINT` | empty | optional local NPU broker |

## Docker

```bash
docker compose up --build
# http://127.0.0.1:8000
```

The image builds the web app, installs the API, serves the SPA and keeps SQLite in the `cue-data`
volume. The healthcheck calls `/api/health`.

## systemd

`deploy/cue.service` runs uvicorn as an unprivileged user with a read-only filesystem except
`/var/lib/cue`. It denies outbound traffic by default; remove the two `IPAddress*` lines only for a
deliberate integration window. This is the show-week posture.

## Backup and restore

The store is a single SQLite file. The pilot path:

1. Stop the service.
2. Copy `cue-data/cue.sqlite3` to encrypted storage.
3. Restore by replacing the file and starting the service.
4. Verify `/api/health`, `/api/audits` and `/api/readiness`.

A production deployment should use PostgreSQL plus object storage and a tested restore drill. The
schema and the tenant scoping map directly.

## Offline

- The public build is cached by the service worker.
- The on-site service has no outbound dependency.
- The show pack is local; the only writes are the audit, signatures, approvals and risk states.
- Test with the network cable unplugged before every show week.

## Health

```bash
curl -s http://127.0.0.1:8000/api/health | jq
curl -s http://127.0.0.1:8000/api/agent/status | jq
curl -s http://127.0.0.1:8000/api/render/status | jq
```

`/api/ready` returns 503 when `CUE_STRICT_INTEGRATIONS=1` and the agent or a live connector is missing.
That is the intended failure: no silent ready.
