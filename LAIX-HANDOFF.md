# LAIX handoff — CUE's attention module

**Branch:** `laix/handoff-v1` · **Tag:** `laix-handoff-v1`
**Handoff commit (module, fixtures, tests):** `32a950b` · **Base before the pass:** `a4c6bef`
**Contract version:** 1.1.0 — frozen, not bumped.
**Scope:** behaviour-preserving handoff. No change to `decide()`, gate order,
thresholds, reasons or action strings; no new dependency; no registry publication;
CUE is unchanged.

---

## 1. Module paths and size

| Path | Lines |
|---|---|
| `server/laix_attention/__init__.py` | 102 |
| `server/laix_attention/model.py` | 204 |
| `server/laix_attention/policy.py` | 203 |
| `server/laix_attention/outcomes.py` | 128 |
| `server/laix_attention/replay.py` | 241 |
| `server/laix_attention/timing.py` | 56 |
| `server/laix_attention/ports.py` | 46 |
| **Python total** | **980** |
| `contract/attention.v1.json` | 693 |
| `contract/bench.v1.json` | 83 |
| `contract/schema.json` | 132 |
| `contract/README.md` | 44 |
| `fixtures/replay.json` | 641 |
| `CONTRACT.md` | 183 |
| `POSITION.md` | 92 |
| `README.md` | 159 |

Supporting files outside the package:

| Path | Role |
|---|---|
| `server/tests/test_laix_attention.py` | contract, gates, feedback, act/ask, cost, undo, schema, bench, guard |
| `server/tests/test_laix_attention_reuse.py` | second consumer, different domain |
| `server/tests/test_laix_replay.py` | golden replay |
| `server/tools/capture_laix_replay.py` | regenerates `fixtures/replay.json` from CUE (imports the app on purpose; outside the package) |

`decide()` and `policy.py` are byte-identical to the base commit. The only edit to
existing module code in this pass is one comment in `model.py` (§6).

---

## 2. Public API

```python
from laix_attention import (
    # decisions
    Signal, Context, Decision, Feedback, Intent, Escalation,
    decide, score, cost_of_waiting, undo_hint, dedupe_key, trace_id, rollup,
    GATES, REASONS, ACTIONS, SEVERITY_RANK, FEEDBACK_STATES,
    # learning
    Outcome, OutcomeLog, result_for_reason, label_for_feedback,
    # replay and validation
    benchmark, compare, run_case, run_vectors, load_vectors, validate_document,
    context_from, signal_from, precision_recall, POLICIES,
    # ports
    Clock, Sink, Recorder, SystemClock, NullSink,
)
```

| Entry point | Contract |
|---|---|
| `decide(signals, context) -> list[Decision]` | one decision per signal, input order, deterministic |
| `OutcomeLog.record(outcome)` / `.precision()` / `.hazard_rate()` / `.adjustment(kind)` / `.calibration()` | bounded log, no I/O |
| `run_vectors(document)` / `compare(case)` | contract replay, returns human-readable mismatches |
| `validate_document(document)` | vocabulary check, no dependencies |
| `benchmark(document)` | policy vs `severity_only` vs `always_notify` |
| `context_from` / `signal_from` | JSON ↔ types, used by the replay fixture |

Emitted actions today: `wait`, `notify`, `escalate`; plus `ask` and `act` only when
the app sets `allow_act` on a reversible intent. `verify` is reserved and never
emitted. With CUE's settings (`allow_act=False`) only `wait`, `notify` and
`escalate` can occur.

---

## 3. Dependencies

**None.** The package imports only the standard library:

`dataclasses`, `datetime`, `typing`, `hashlib`, `json`, `pathlib`,
`collections.abc`.

Verified in a clean virtual environment: `non-stdlib modules loaded: []` (§4).
There is no `pyproject.toml` inside the package; the extraction step adds one.

---

## 4. Tests and the clean-room proof

### In-repo

```powershell
cd server
$env:PYTHONPATH="."; python -m pytest -q tests/test_laix_attention.py tests/test_laix_attention_reuse.py tests/test_laix_replay.py
# 57 passed

$env:PYTHONPATH="."; python -m pytest -q
# 130 passed, 1 skipped (the live-model test, skipped without CUE_LIVE_AGENT=1)

cd ..
python -m ruff check server
# All checks passed!
```

### Standalone, outside the repository, without CUE

```powershell
$clean = "$env:TEMP\opencode\laix-clean"
Remove-Item -Recurse -Force $clean -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $clean | Out-Null
Copy-Item -Recurse server\laix_attention $clean\laix_attention
python -m venv $clean\venv

cd $clean
$env:PYTHONPATH=$clean
& $clean\venv\Scripts\python.exe -c "import cue"
# ModuleNotFoundError: No module named 'cue'

& $clean\venv\Scripts\python.exe verify.py
```

Output:

```
module: C:\Users\...\laix-clean\laix_attention\__init__.py
version: 1.1.0
vectors: 23 problems: []
validation: []
bench cases: 12
bench rows: {'policy': {... 'precision': 0.75, 'hazard': 0.0, 'recall': 0.75},
             'severity_only': {... 'precision': 0.4, 'hazard': 0.4, 'recall': 1.0},
             'always_notify': {... 'precision': 0.333, 'hazard': 0.5, 'recall': 1.0}}
replay cases: 22 diffs: 0
non-stdlib modules loaded: []
cue importable: False
```

The clean venv is Python 3.11.14. The copy was made before the `LAIX-HANDOFF.md`
commit and contains the final package. No import was changed to make this pass.

---

## 5. Golden replay

`server/laix_attention/fixtures/replay.json`

- **22 cases** — 12 from `contract/bench.v1.json`, 10 from CUE's live scan and risk
  data (`detect_candidates` on the demo pack plus two pack risks).
- Each case: `id`, `signals`, `context`, `expected` with `action`, `reason`,
  `deliver`, `record`, `score`, `cost_of_waiting`, `undo_hint`.
- **22 / 22 replay with zero diff.** Run twice per case; deterministic.
- `capturedFrom: cue@a4c6bef`.
- Wall-clock stripped: `due` removed from CUE signals (candidates default it to
  `now_iso()`), all CUE cases share the frozen `now = 2026-11-01T10:00:00+02:00`,
  and no `at` / `createdAt` fields are kept. Scores were recomputed against the
  frozen clock, so they are stable.
- Regenerate with `cd server; PYTHONPATH=. python tools/capture_laix_replay.py`.

The fixture is evaluation provenance, not a second contract: it records what CUE's
deployment did, so a future policy change appears as a diff even where no vector
covers it.

---

## 6. Guard test

`server/tests/test_laix_attention.py`

| Check | Result |
|---|---|
| `test_the_package_does_not_know_the_app` | **pass**, zero violations |
| Fails on `from cue import …` | proven by `test_the_guard_catches_an_app_import` (temp module) |
| Fails on `datetime.now(` outside `ports.py` | proven by `test_the_guard_catches_a_direct_clock_read` |
| Fails on an app noun in executable code | proven by `test_the_guard_catches_an_app_noun_in_code` |
| Docstring/comment allowlist is explicit | `test_docstring_exceptions_are_explicit` |

The guard now parses the AST, so **comments and docstrings are excluded from the
executable check** and are checked separately against an explicit allowlist.
App nouns: `cue`, `show`, `venue`, `tour`, `risk` (plus the older
`rig`, `look_id`, `show_pack`, `cue_sheet`).

**Docstring/comment exceptions: none.** `DOCSTRING_ALLOWLIST` is empty. During the
pass one comment did trip the check:

- `model.py:103` — the example dedupe key `"risk-1:2026-11-14"`. Reworded to
  `"signal-1:2026-11-14"`. Comment-only change; no behaviour, no contract.

---

## 7. Generic versus app-specific

| Belongs to the module (generic) | Belongs to the app (CUE) |
|---|---|
| gate order, score, cost of waiting, undo hint | detecting problems: venue fit, power, weight, glare, rights, assets, budget |
| quiet hours, digest hold, interruption budget | reading and writing the show store |
| per-day dedupe and per-signal feedback | notification copy, inbox, email/Slack/Teams/SMS/webhook |
| intent and escalation pass-through | executing an intent, signing, approving |
| outcome labels, precision, hazard, calibration | collecting dismissal reasons from the UI |
| replay, validation, bench | the demo pack and its risks |

The seam is `Signal` in, `Decision` out. `cue/proactive/scanner.py` translates;
`cue/proactive/history.py` labels closed risks.

---

## 8. Vocabulary mapping for LAIX

LAIX's interface note uses *wait, ask, guide, act, verify, escalate*
(`agentic-desk/projects/middleware/laix/interfaces.md`, line 12).

| Concept | This module | LAIX | Action at adoption |
|---|---|---|---|
| surface the interruption | `notify` | `guide` | **rename on adoption**; a LAIX adapter may map `notify → guide` instead |
| hold | `wait` | `wait` | same |
| ask the user / for approval | `ask` | `ask` | same; `reason = ask_approval` |
| execute a reversible action | `act` | `act` | same; payload is `Intent {capability, args}` |
| check the result | — | `verify` | reserved here; belongs to the execution bridge |
| hand to a human | `escalate` | `escalate` | same; `Escalation {target, reason}` |

| Dimension | This module | Notes for LAIX |
|---|---|---|
| Severity | `critical`, `high`, `medium`, `low`, `info` | rank 0–4; score points 60/45/30/15/5. LAIX does not define a scale — this is CUE's and is a proposal |
| Score | 0–~110, `breakdown` exposed | advisory only: **no score thresholds**. The `@laix/attention` README cites 48/72/92 defaults — do **not** import them into this module without a version bump |
| Decision fields | `signal_id`, `action`, `reason`, `score`, `confidence`, `deliver`, `record`, `requires_approval`, `evidence_refs`, `trace_id`, `intent`, `escalation`, `cost_of_waiting`, `reversible`, `undo_hint`, `breakdown` | maps onto the decision record Max asked for: what · why · evidence · confidence · cost of waiting · undo · score |
| Trace id | `tr-<sha1[0:12]>` | north half of LAIX's "stream events with trace ids"; the stream itself is not implemented |
| Evidence | `evidence_refs: tuple[str, ...]` | ids only; the module never copies records |

**Known mismatches, not resolved here** (contract is not final; no renaming allowed):

1. `notify` vs `guide` — vocabulary only.
2. `@laix/attention` (TypeScript, RECALL) thresholds on the score; this module does
   not. Same idea, different mechanism.
3. `@laix/attention` carries `Context.outcomes`; this module takes
   `Context.learned`. Compatible, not identical.
4. LAIX has no defined severity scale or reason enum.

---

## 9. What LAIX still has to add

| Missing | Why it is not here |
|---|---|
| **Execution bridge** | run a named skill with typed arguments, cancel, verify. The module carries `Intent`; it must not execute |
| **Store** | decisions, outcomes and feedback outliving a process. CUE's SQLite is app-side |
| **Learned scorer** | gates are explicit rules; `Context.learned` is the seam for a bandit |
| **Cross-app learning** | one app's outcomes do not move another app's policy; needs a shared store and at least two production consumers |
| **Live Context** | perception, sensors, sub-second timing — a different decision class |
| **Capability levels** | "a model capability level, not a model name" is respected by naming no model at all |

---

## 10. Known limits

- **Contract size:** 23 vectors. Enough to pin behaviour, not a specification.
- **Bench:** 12 synthetic cases, authored here. `precision 0.75 / hazard 0.00 /
  recall 0.75` is a sanity result, not evidence of field performance.
- **Precision is self-reported:** resolved risks count as `helped`, dismissals are
  labelled by their reason. No control group, no held-out set.
- **No calibration evidence:** `OutcomeLog.calibration()` is implemented and empty.
- **Two consumers, one of them a test fixture.** `@laix/attention` is a sibling
  implementation, not a conformance run against this contract.
- **No production tour** has run on it.
- The package has never been packaged as a wheel; the extraction step below is the
  first time it leaves the repo.

---

## 11. Extraction steps

1. `git mv server/laix_attention packages/laix-attention-py/src/laix_attention`
   (or copy the directory; nothing else moves).
2. Add a `pyproject.toml` — name `laix-attention`, no runtime dependencies, and
   `[tool.setuptools.package-data] laix_attention = ["contract/*.json", "fixtures/*.json"]`.
3. Keep `contract/` and `fixtures/` next to the package. Give `attention.v1.json`
   to the TypeScript package; it is the conformance file.
4. Publish nothing until the contract owner accepts it. When a package exists, point
   `server/pyproject.toml` at it and delete the local copy **in a separate commit**,
   keeping `tests/test_laix_replay.py` against the installed package.
5. Move `test_the_package_does_not_know_the_app` with the package. It fails if the
   package imports an app, reads the clock, or names a domain object.

The extraction is mechanical because the package has no CUE imports, no app nouns
in code, no clock of its own and no dependencies — all four are enforced by tests,
not by promise.

---

## 12. Confirmation

- `decide()` output, gate order, thresholds, reasons and action strings: unchanged
  (`policy.py` has a zero-byte diff against `a4c6bef`).
- Contract vectors, schema and bench: unchanged (zero-byte diff).
- Version: still 1.1.0.
- CUE: tests green, no UI, copy, notification or storage change.
- Local package: present, untouched in behaviour.
- Dependencies added: none. Published: nothing.
