# laix_attention

A small, domain-free **decision layer for the right moment**. Given a candidate
intervention, the current context and the user's limits, should the product
**wait, notify, ask, act, verify or escalate**?

Extracted from CUE's readiness desk so LAIX can take it later. CUE is the first
consumer, not the owner. Where it sits in LAIX: [`POSITION.md`](POSITION.md).

```
pip install nothing. Standard library only.
```

## What it is not

- not a model, an agent framework or an orchestrator;
- not a scheduler — the app calls it;
- not a transport — the app owns email, Slack, inbox and SMS;
- not a store — the app persists decisions and outcomes;
- not an execution bridge — it carries an intent, it does not run it.

It is the policy between *"something happened"* and *"the product does something"*.

## The whole API

```python
from laix_attention import Context, Signal, decide

decisions = decide(
    [Signal(id="D-1", kind="power", severity="critical", confidence=0.9, due="2026-11-02T09:00:00+02:00")],
    Context(now=now, quiet_hours=("22:00", "06:00"), min_severity="high"),
)
# decisions[0].action == "notify"
# decisions[0].reason == "notify"
# decisions[0].trace_id == "tr-3f1c0a2b9d41"
# decisions[0].cost_of_waiting == 40.0
# decisions[0].undo_hint == "withdraw"
```

Every decision carries: `action`, `reason`, `score`, `confidence`, `deliver`,
`record`, `requires_approval`, `evidence_refs`, `trace_id`, `cost_of_waiting`,
`reversible`, `undo_hint`, and a `breakdown` that shows how the score was reached.

## The gates, in order

The first gate that fires decides. The order is part of the contract.

| # | Gate | Action | Reason | Kept on record |
|---|---|---|---|---|
| 1 | kill switch | `wait` | `kill_switch` | no |
| 2 | muted kind | `wait` | `muted` | no |
| 3 | feedback: snoozed / wrong / assigned / dismissed | `wait` | that state | no |
| 4 | below `min_confidence` | `wait` | `low_confidence` | no |
| 5 | below `min_severity` | `wait` | `below_floor` | no |
| 6 | already sent today | `wait` | `already_sent` | no |
| 7 | quiet hours, not critical | `wait` | `quiet_hours` | yes, not delivered |
| 8 | interruption budget spent | `wait` | `budget` | no |
| 9 | critical, overdue past the limit | `escalate` | `overdue_escalation` | yes, delivered |
| 10 | `allow_act` + intent + reversible | `act` | `act` | yes, delivered |
| 10a | …and approval required | `ask` | `ask_approval` | yes, delivered |
| 11 | otherwise | `notify` | `notify` | yes, delivered |

Critical signals pass quiet hours. That is deliberate: a stop-work item at 23:30 is
still a stop-work item.

`act` is opt-in twice: the app sets `allow_act`, and the signal must be reversible.
An irreversible intent is only notified, because an undo has to exist for an
autonomous action to be safe.

## The score

```
severity + due urgency + confidence − interruption cost + learned
```

Severity is 60/45/30/15/5 for critical/high/medium/low/info. Due urgency is 30
(overdue), 20 (≤24 h), 12 (≤72 h), 6 (≤168 h). Confidence and interruption cost
scale by 20. `learned` is a per-kind adjustment supplied by the app.

The score is advisory in v1: it explains and ranks, it does not gate. Gates are
explicit so the behaviour is reproducible.

## Cost of waiting and undo

```
cost_of_waiting = due_points × {critical 2.0, high 1.5, medium 1.0, low 0.5, info 0.25}
undo_hint       = "withdraw" | "cancel" | None
```

Both are outputs, not gates. They answer the two questions Max asks of LAIX: what
does silence cost, and can the action be taken back.

## Outcome learning

```python
from laix_attention import Outcome, OutcomeLog

log = OutcomeLog()
log.record(Outcome("D-1", "power", "notify", "helped", score=94))
log.record(Outcome("D-2", "power", "notify", "hurt", reason_code="false_alarm", score=71))

log.precision()          # confirmed / raised
log.hazard_rate()        # unfairly raised / raised
log.adjustment("power")  # a point adjustment for Context.learned
log.calibration()        # score bucket -> observed help rate
```

Six reason codes map to three labels: `false_alarm` and `data_error` are `hurt`;
`design_change`, `operational`, `duplicate` and `no_action` are `no_effect`;
anything else is `unknown`.

## Contract, schema, bench

| File | What it is |
|---|---|
| `contract/attention.v1.json` | 23 behavioural cases — normative |
| `contract/schema.json` | machine-readable shape for a second implementation |
| `contract/bench.v1.json` | 12 labelled cases to score a policy against two baselines |

```python
from laix_attention import benchmark, load_vectors, run_vectors, validate_document

doc = load_vectors("contract/attention.v1.json")
assert run_vectors(doc) == []
assert validate_document(doc) == []
print(benchmark(load_vectors("contract/bench.v1.json"))["rows"])
```

| Policy | Raised | Precision | Hazard | Recall |
|---|---|---|---|---|
| `policy` | 4 / 12 | 0.75 | 0.00 | 0.75 |
| `severity_only` | 10 / 12 | 0.40 | 0.40 | 1.00 |
| `always_notify` | 12 / 12 | 0.33 | 0.50 | 1.00 |

Twelve synthetic cases are not a study. They exist so a gate change shows up as a
number.

## Taking it into LAIX

The package has no imports from the app, no app nouns, no clock of its own and no
dependencies. Extraction is a move, not a rewrite:

1. copy `server/laix_attention/` to `packages/laix-attention-py/src/laix_attention/`;
2. add the ten-line `pyproject.toml` (name `laix-attention`, no dependencies);
3. move `contract/` next to it and let the TypeScript package consume the same files;
4. point CUE at the published version and delete the local copy.

What LAIX still supplies — by design — is the execution bridge (run, cancel,
approve, verify), the store, the capability levels and the live context.

## Tests

```bash
PYTHONPATH=. pytest -q tests/test_laix_attention.py tests/test_laix_attention_reuse.py
```

Contract vectors, gate boundaries, feedback states, the act/ask seam, cost and
undo, schema agreement, bench superiority, a second consumer in a different domain,
and a guard that fails if the package ever imports the app or reads the clock.
