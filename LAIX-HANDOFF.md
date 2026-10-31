# LAIX handoff — completed

The local decision engine that this document used to describe has left CUE. LAIX
is now the decision layer, and CUE is an app that calls it.

| | Before | Now |
|---|---|---|
| Decision engine | a package in this repository (now deleted) | `laix` v0.2.1 (pinned dependency) |
| Call site | `decide()` imported from the local package | `Layer().decide(DecisionRequest(...))` in `cue/proactive/scanner.py` |
| Adapter | none | `server/laix_integration/` |
| Second path | shadow comparison behind a flag | none — one path |
| Contract ownership | this repository | the LAIX repository |

**Date of the replacement:** see the commit that removed
the local engine package and added the pinned dependency to
`server/pyproject.toml`.

## What CUE kept

Detection, the show store, the cue sheet, notification copy, delivery channels,
signing, API responses, and outcome labels (`cue/proactive/history.py`). The
replacement changed one function: where the decision comes from.

## Dependency

```toml
"laix @ git+https://github.com/michaelatamuk/laix.git@v0.2.1#subdirectory=python/laix"
```

```powershell
cd server
py -m pip install -e ".[dev]"          # installs LAIX from the pinned tag
py -m pip install -e C:\Workspace\laix\python\laix   # local co-development instead
```

## Parity

`server/tests/fixtures/laix_parity.json` was captured on the last commit that used
the local engine. `server/tests/test_laix_integration_scanner.py` replays it through
LAIX and asserts the same actions, reasons, scores, approval flags, evidence refs,
scan counters and notification fields. The only translated difference is the
vocabulary: LAIX `guide` = CUE `notify`, and `worth_surfacing` = `notify`.

## Verification

```powershell
cd server
$env:PYTHONPATH="."; py -m pytest -q
cd ..
py -m ruff check server
```

## Rollback

Revert the replacement commit (`git revert <sha>`). There is deliberately no
second engine and no shadow flag left in the tree to switch back to.

## Where to read next

- [`docs/laix-integration.md`](docs/laix-integration.md) — boundary, adapter, upgrade, rollback
- [`docs/laix-module.md`](docs/laix-module.md) — what moved and why
- [`server/laix_integration/`](server/laix_integration/) — the adapter
