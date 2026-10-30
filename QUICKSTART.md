# Quick start

## The demo

Open <https://jiuwendemos.github.io/cue/>.

- `/#/stage` — the 90-second show. Sound on. `R` resets, `Esc` exits.
- `/#/show` — the studio. Scrub the track, drag a look onto the build.
- `/#/readiness` — the production office's morning.
- `/#/settings` — theme, role, language, and the synthetic-demo notices.

## Web

```bash
cd web
npm install
npm run dev
# http://127.0.0.1:5174
```

## API

```bash
cd web && npm run pack
cd ../server
python -m pip install -e ".[dev]"
uvicorn cue.api.app:app --reload --port 8000
```

## Tests

```bash
cd server
python -m pytest -q
python -m ruff check .
cd ../web
npm run build
```

## Docker

```bash
docker compose up --build
# http://127.0.0.1:8000
```
