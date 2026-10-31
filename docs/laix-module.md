# The LAIX attention module

**Status:** extracted and working. One consumer (CUE). No behaviour change.
**Code:** [`server/laix_attention/`](../server/laix_attention/) · **Contract:** [`CONTRACT.md`](../server/laix_attention/CONTRACT.md)

## Why this exists

CUE's readiness desk already decided **when a production office should be
interrupted**: which risks are worth a notification, what waits for the quiet-hours
digest, what is already known, what the kill switch silences, and whether an alert
turned out to be right.

That is a decision layer, not a feature. It was hand-coded inside one app, which is
exactly the waste LAIX names as its fifth problem: *"timers, thresholds, session
state and feedback logic are hand-coded per app, so nothing is learned across apps."*

So the policy was moved into a package that does not know what the app is about.

## What moved, and what did not

| Moved into `laix_attention` | Stayed in CUE |
|---|---|
| severity floor, quiet hours, digest hold | detecting risks (venue fit, power, weight, rights, assets, budget) |
| per-day dedupe and interruption budget | reading and writing the show store |
| kill switch and shadow/live mode | delivery channels and credentials |
| the score and its breakdown | notification copy and the readiness UI |
| outcome labels, precision, hazard rate, calibration | approval and sign-off |
| digest selection order | the digest's wording |
| trace ids | signed links |

Roughly 120 lines left the app and ~700 lines of detection stayed. The seam is
`Signal` in, `Decision` out.

## How CUE uses it

`cue/proactive/scanner.py` keeps `detect_candidates()` — the domain knowledge —
and then does three things:

1. translate each candidate into a `Signal`;
2. call `decide(signals, context)` with the show's settings;
3. turn each `Decision` back into a notification: `record` decides whether it is
   stored, `deliver` whether it is sent, `reason` whether it waits for the digest.

Nothing else changed. `tests/test_proactive_characterization.py` was written
against the old code first; the same tests pass after the move, and a captured
scan output from both versions is byte-identical apart from a created-at timestamp.

The loop is closed in the other direction too. `cue/proactive/history.py` turns
closed risks into outcomes — a resolved risk is `helped`, a dismissed risk is
labelled from its reason sentence — and reports precision, hazard rate and
calibration at `GET /api/proactive → outcomes`. The same labels feed
`Context.learned`, so a kind that is dismissed repeatedly loses score. Score does
not gate in v1, so notification behaviour is unchanged; the measurement is live.

## Why it is shaped this way

LAIX's own interface note (in `agentic-desk`, `projects/middleware/laix/interfaces.md`)
asks for six things from the south side and four from the north. This package
satisfies the parts it owns:

| LAIX requirement | Where it is |
|---|---|
| a decision the app can explain | `Decision.reason`, `.score`, `.breakdown` |
| what · why · evidence · confidence · undo | `Decision` + `evidence_refs`; undo is the app's, because execution is the app's |
| trace ids on every event | `Decision.trace_id` |
| a capability level, not a model name | no model is named; a scorer is a future seam |
| approval for destructive actions | `requires_approval` passes through; `act` is never autonomous |
| no execution, no storage | guarantees 1, 2 and 5 in `CONTRACT.md` |

And it deliberately does **not** claim what it cannot do: there is no perception,
no sub-second path and no multi-party negotiation. Those are other decision
classes. This module covers one: **attention allocation over days** — deciding
what deserves the office's attention this week — plus the outcome measurement that
class needs.

## What LAIX still has to add

- **Execution bridge** — run, cancel, approve, verify. CUE does this in its own API today.
- **Store** — decisions and outcomes outlive a process; today the app owns it.
- **A scorer** — the gates are explicit rules. A contextual bandit replaces gate
  ordering at threshold time, not the contract.
- **Cross-app learning** — one app's outcomes do not yet move another app's policy.
  That is the point of the layer, and it needs a second consumer in production.

## The reuse evidence

`tests/test_laix_attention_reuse.py` is a second consumer in a different domain
(study reminders) written against the public API only. It needed no change to the
module. Together with CUE that is **two consumers, one contract** — the first
honest data point toward LAIX's "≥60% reuse across three apps" target.

The TypeScript package `@laix/attention` in the RECALL repository is a sibling
implementation of the same idea. It has `wait/notify/ask/act/verify/escalate`, a
score with an interruption cost, quiet hours, an interruption budget and an
outcome log. It does **not** have digest batching, shadow mode, per-day dedupe,
reason-code outcomes, calibration or replay. Those are this package's addition.

`contract/attention.v1.json` is the file that can make the two converge: it is
plain JSON, and any runtime that passes it is a valid implementation.

## Extraction checklist

When LAIX takes it:

1. `git mv server/laix_attention packages/laix-attention-py/src/laix_attention`
2. add a `pyproject.toml` with name `laix-attention` and **no dependencies**
3. move `contract/` next to it; give it to the TypeScript package too
4. publish, then point CUE's `server/pyproject.toml` at the published version
5. delete the local copy; the guard test (`test_the_package_does_not_know_the_app`)
   can move with it

Nothing in the package names CUE, so steps 1–4 are mechanical.

## Honest limits

- The numbers are small: 12 contract vectors and 14 demo risks. It is a real
  mechanism, not a benchmark.
- `precision` here means "confirmed ÷ raised" from dismissals — self-reported
  labels, not a controlled study.
- The score is not calibrated against outcomes yet; `calibration()` is the place
  where that evidence would accumulate.
- No real production tour has run on it.
