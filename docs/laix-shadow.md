# LAIX shadow mode

CUE keeps its own decision layer (`server/laix_attention/`) and, when asked, also
asks the external [LAIX](https://github.com/michaelatamuk/laix) layer for the same
decision. The native result is the only one that is used. The LAIX result is
recorded so the two can be compared with real data before anyone moves traffic.

**Boundary.** CUE keeps detection, storage, notification copy and delivery. LAIX
returns a decision and nothing else: no send, no store, no model call, no network.

## The flag

| Variable | Values | Default |
|---|---|---|
| `CUE_LAIX_MODE` | `off` · `shadow` | `off` |

- Read **once at import** of `cue.proactive.scanner`. Changing it needs a process
  restart.
- `off` (or any unknown value): the code path is unchanged and `laix` is never
  imported. The native path has no LAIX dependency at all.
- `shadow`: native detection and native decisions run first and are final; then one
  LAIX `DecisionRequest` is built for the same signals and `Layer.decide()` is called
  to compare.

## Install

LAIX is **not** in CUE's base install. Choose one mode.

**Local development — editable.** Picks up source edits on the next Python process;
no reinstall after a change.

```powershell
py -m pip install -e C:\Workspace\laix\python\laix
```

**CI and stable use — pinned tag.** Never a branch, never `main`.

```powershell
py -m pip install -r server/requirements-laix.txt
```

`server/requirements-laix.txt` pins
`laix @ git+https://github.com/michaelatamuk/laix.git@v0.1.1#subdirectory=python/laix`.
Moving that tag is a separate, deliberate change: reinstall, then re-run the replay
so the recorded differences are updated on purpose.

## Enable

```powershell
$env:CUE_LAIX_MODE = "shadow"
$env:CUE_LAIX_LOG  = "C:\logs\laix-shadow.jsonl"   # optional file copy
# restart the API process, then run any scan
```

```powershell
# from server/
$env:PYTHONPATH="."; py -m uvicorn cue.api.app:app --host 127.0.0.1 --port 8100
# POST /api/proactive/scan
```

## Where the logs go

- The normal CUE logger, `cue.laix.shadow`, at INFO. Under uvicorn these appear on
  the server's stdout with its usual format.
- Optionally the same lines as JSONL in `CUE_LAIX_LOG`.

Two record types:

| `event` | When | Contents |
|---|---|---|
| `laix.shadow.scan` | one per scan | `scan_id`, `at`, `policy_versions`, `signals`, `raw_agreement`, `semantic_agreement`, ratios, `error` |
| `laix.shadow.signal` | one per signal | the same ids plus `native` (action, reason, deliver, record, score) and `laix` (verb, reason_code, deliver, record, requires_approval, score), plus `raw_agreement`, `semantic_agreement` |

A LAIX failure produces **one** scan line with `error` set and no signal lines. The
native scan continues normally. Log lines carry signal ids, actions and scores —
not show titles, venues or copy.

## Report tool

```powershell
py server/tools/laix_shadow_report.py C:\logs\laix-shadow.jsonl
py server/tools/laix_shadow_report.py C:\logs\laix-shadow.jsonl --json
```

Read-only. Prints scans, signals compared, raw and semantic agreement, disagreement
groups (`native->laix`) with an example id, errors, and the policy versions seen.

## Roll back

```powershell
Remove-Item Env:CUE_LAIX_MODE
# or
$env:CUE_LAIX_MODE = "off"
# restart the API process
```

Nothing to undo in data: shadow mode writes no CUE state, no notification and no
delivery. Uninstalling LAIX is also safe: the native path never imports it.

## Semantic mappings and expected differences

Two vocabularies describe the same policy.

| CUE native | LAIX | Note |
|---|---|---|
| `notify` | `guide` | the only difference in the current demo data |
| `ask` with `reason == ask_approval` | `act` with `requires_approval: true` | CUE asks; LAIX marks the act as needing approval |
| `wait`, `act`, `escalate` | same | |
| — | `observe`, `verify` | LAIX verbs CUE never emits |
| reason `notify` | reason `worth_surfacing` | recorded, not part of the agreement metrics |

`rawAgreement` compares the two words as emitted. `semanticAgreement` applies the
mappings above. Both are always reported; the raw number is not hidden behind the
normalised one.

Expressions of the same formula give the same score: severity points, due urgency,
confidence, interruption cost and the learned adjustment are identical, so scores
and `deliver` / `record` flags agree wherever the actions do.

### Observed on this machine

Demo pack, one scan, `risks` cleared so every candidate is new:

```
scans               1
signals compared    8
raw agreement       2/8 (25%)
semantic agreement  8/8 (100%)

disagreements (native -> laix)
  notify->guide                   6   e.g. D-1944A7E3
```

Golden replay, 22 fixture cases (`server/laix_attention/fixtures/replay.json`):

```
22 cases · raw 11/22 · semantic 22/22 · disagreements {"notify->guide": 11}
```

The replay is a recorded observation at LAIX v0.1.1
(`tests/test_laix_shadow_replay.py`). It is not a requirement, and it must not be
made to pass by editing either contract.

## Tests

```powershell
cd server
$env:PYTHONPATH="."; py -m pytest -q tests/test_laix_integration_mapper.py tests/test_laix_integration_compare.py tests/test_laix_integration_shadow.py tests/test_laix_shadow_flag.py tests/test_laix_shadow_replay.py
$env:PYTHONPATH="."; py -m pytest -q
cd ..
py -m ruff check server
```

The mapper, shadow and replay tests skip when LAIX is not installed
(`pytest.importorskip("laix")`); the comparison and flag tests always run, so the
native path stays covered on a machine with no LAIX.

## What this is not

- Not a replacement for `laix_attention`. That module stays authoritative.
- Not a network integration: LAIX runs in-process, and no HTTP wrapper is used.
- Not a migration plan. Moving traffic to LAIX would be a separate change with its
  own flag, its own tests and its own rollback.
