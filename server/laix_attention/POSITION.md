# Where this sits in LAIX

A one-page answer to "is this a LAIX component, an app, or neither", written for a
reviewer who has read `agentic-desk/projects/middleware/laix/`.

## The six components

LAIX's brief names six: Live Context, Experience State, Decision Engine, Execution
bridge, Outcome Learning, Resource policy.

| Component | This package | Note |
|---|---|---|
| **Decision Engine** | **owns it** | gates in a fixed order, a score, a reason, a trace id |
| **Outcome Learning** | **the measurement half** | labels, precision, hazard, calibration, a per-kind adjustment for the score. It does not learn policy; the app or a bandit feeds `Context.learned` back |
| **Resource policy** | **a slice** | the interruption budget. Not model tiers, not edge/cloud routing |
| **Experience State** | **the feedback slice only** | per-signal user state: accepted, snoozed until, wrong, assigned, dismissed. Not goals, phases or beliefs with expiry |
| **Execution bridge** | **the seam, not the bridge** | it carries an `Intent` (capability + args), asks for approval, and says what can be undone. It executes nothing |
| **Live Context** | **out of scope** | no perception, no sensors, no sub-second loop |

So: one component owned, one half-owned, one slice, one seam. Not a framework.

## The ten decision classes

From `laix-case.md` §3.1–3.10 and the quadrant map:

| Class | Covered |
|---|---|
| Attention allocation over days ("attention portfolio", bottom-left of the map) | **yes — this is the module** |
| §3.5 causal outcome estimation | **the measurement input**: labelled interventions with scores, ready for attribution |
| §3.9 safety-constrained action | **partly**: approval and reversibility, no policy of its own |
| §3.1 real-time intervention (≤1 s) | no |
| §3.2 active perception | no |
| §3.3 stochastic replanning | no |
| §3.4 resource allocation under uncertainty | no (the budget is a cap, not an allocation) |
| §3.6 strategic negotiation | no |
| §3.7 multi-party coordination | no |
| §3.8 fair allocation | no |
| §3.10 preference elicitation | no |

Claiming more than the first three rows would be dishonest. CUE is a tour
production office: the decisions are "what deserves attention this week", not
"what should the camera look at next".

## North and south

| North (app → module) | South (module → platform) |
|---|---|
| candidate, context, feedback, intent, outcome | decision, reason, score, trace id, intent, approval request, undo hint |

The south side of LAIX proper — run a named skill, cancel, read/write session
state, stream events, ask for a capability level rather than a model name — is
**not implemented here**. The module produces the decision that an execution
bridge consumes; it does not consume it itself. That keeps the package
dependency-free and lets LAIX own the bridge.

## Sibling: `@laix/attention` (TypeScript, RECALL)

After v1.1 the two agree on the vocabulary: actions, severity, feedback states
(`accepted`, `dismissed`, `snoozed`, `wrong`, `assigned`), `interruptionCost`,
`reversible`, `requiresApproval`.

| Still different | Where |
|---|---|
| `Context.outcomes` (a list) vs `Context.learned` (a dict) | TS keeps raw outcomes; this package takes the adjustment. Both are defensible; the dict is what the score needs |
| digest batching and shadow mode | this package only |
| per-day dedupe keys | this package only |
| six reason codes, hazard rate, calibration | this package only |
| replay, a labelled bench and two baselines | this package only |
| `Intent`, `Escalation`, `cost_of_waiting`, `undo_hint` | this package only |

`contract/attention.v1.json` is the file that can close the gap: any runtime that
passes it is a valid implementation, in any language. The RECALL side can vendor
it without changing a line of the policy.

## Status, honestly

- **Version:** 1.1.0. 23 contract vectors, 12 bench cases, 2 consumers (CUE and a
  study-reminder app in `tests/test_laix_attention_reuse.py`).
- **Bench:** precision 0.75, hazard 0.00, recall 0.75 — against `severity_only`
  (0.40 / 0.40 / 1.00) and `always_notify` (0.33 / 0.50 / 1.00) on twelve
  synthetic, self-labelled cases.
- **Not proven:** calibration against real outcomes, cross-app learning, and
  anything at production scale. One real tour would be worth more than the bench.

## What would falsify it

- A second app cannot express its decision without a new gate. Two would mean the
  six gates are one app's habits, not a decision layer.
- Precision on real dismissals stays near the `severity_only` baseline. Then the
  score and the timing rules add nothing.
- A LAIX team needs a model call inside the decision. Then this is the wrong
  shape: it is a rules-and-score policy, not a model.
