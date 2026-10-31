# LAIX integration

CUE is an app. LAIX is the decision layer it calls.

```
CUE detection → CUE adapter → LAIX Layer → CUE delivery
```

LAIX decides **whether, when and how** a detected problem should reach the
production office. CUE still decides **what the problem is**, and does everything
after the decision.

## Boundary

| CUE owns | LAIX owns |
|---|---|
| detection: venue fit, power, weight, glare, rights, assets, budget | the gate order: kill switch, mute, feedback, floor, dedupe, quiet hours, budget, escalation |
| the show store, dynamic risks, history labels | the score, cost of waiting, undo hint |
| notification copy, inbox, email/Slack/Teams/SMS/webhook | the decision record: action, reason, confidence, evidence refs, trace id |
| readiness page, watch page, API responses | outcome measurement primitives (`OutcomeLog`, precision, calibration) |
| approval and signing | — |

There is **one decision path**. The local engine was removed when LAIX became a
normal dependency; there is no fallback and no shadow switch.

## The adapter

`server/laix_integration/` is the only place that knows both vocabularies.

| Function | Direction |
|---|---|
| `mapper.to_signal(candidate, now)` | CUE scan candidate → `laix.Signal` |
| `mapper.to_context(settings, now)` | CUE scan settings → `laix.Context` |
| `mapper.to_cue_decision(decision, signal_id)` | `laix.Decision` → the `CueDecision` the scanner uses |

`CueDecision` carries exactly the fields the scanner had before the switch:
`signal_id`, `action`, `reason`, `score`, `confidence`, `deliver`, `record`,
`requires_approval`, `evidence_refs`, `breakdown`, `trace_id`, `intent`,
`escalation`, `cost_of_waiting`, `reversible`, `undo_hint`.

Only two words differ, and the adapter translates them both ways:

| LAIX | CUE |
|---|---|
| `guide` | `notify` |
| `worth_surfacing` | `notify` (reason) |

Everything else maps one to one: `wait`, `ask`, `act`, `escalate`, the five
severity levels, the score formula and the `deliver` / `record` flags.

## Dependency

LAIX is a normal pinned dependency, not an extra:

```toml
"laix @ git+https://github.com/michaelatamuk/laix.git@v0.2.0#subdirectory=python/laix"
```

Install:

```powershell
cd server
py -m pip install -e ".[dev]"
```

For local co-development against a checkout (edits are picked up by the next
Python process, no reinstall):

```powershell
py -m pip install -e C:\Workspace\laix\python\laix
```

There is no `main` URL in this repository. The tag is the contract.

v0.2.0 adds policy plugins (`Layer(policy=...)`, `register_policy`, `use_policy`,
`Layer.explain`). CUE uses the built-in attention policy and registers nothing, so
the upgrade changed no behaviour; the parity fixture still passes unchanged.

## Upgrading LAIX

1. Read the LAIX changelog and the contract it ships.
2. Move the tag in `server/pyproject.toml` — one line, in its own commit.
3. Reinstall (`py -m pip install -e "server[dev]"` or the editable checkout).
4. Run `server/tests/test_laix_integration_scanner.py`, which compares the new
   decisions against the parity baseline, and the rest of the suite.
5. If the decisions changed, that is a behaviour change: review it like one, with
   evidence, before merging.

## Rollback

There is no second path to fall back to. Roll back by reverting the commit that
introduced the replacement (`git revert <sha>`), which restores the previous
engine. That is deliberate: a permanent parallel path is what this change removed.

## Parity evidence

`server/tests/fixtures/laix_parity.json` was captured on the last commit that used
the local engine, before it was deleted. The tests replay it through LAIX and
assert:

- the same actions, reasons, `deliver`, `record`, scores, approval flags and
  evidence refs for every detected candidate (8 cases);
- the same scan counters and notification fields for a real scan of the demo pack.

Only the vocabulary is translated; nothing else was allowed to move.

## Tests

```powershell
cd server
$env:PYTHONPATH="."; py -m pytest -q
cd ..
py -m ruff check server
```

The adapter tests are:

| File | What it pins |
|---|---|
| `tests/test_laix_integration_mapper.py` | candidate → signal, settings → context, decision → CueDecision |
| `tests/test_laix_integration_scanner.py` | decision and notification parity, no local engine, no fallback |
| `tests/test_proactive_characterization.py` | the scan's observable behaviour |

## What CUE does not gain

LAIX does not detect anything, does not store anything and does not send anything.
It is a library call inside the scan. If it is unavailable, the scan fails loudly;
silently deciding with a second engine would hide a broken dependency.
