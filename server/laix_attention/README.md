# laix_attention

A small, domain-free **decision layer for the right moment**. Given a candidate
intervention, the current context and the user's limits, should the product
**wait, notify, ask, act, verify or escalate**?

It was extracted from CUE's readiness desk so LAIX can take it later. CUE is the
first consumer, not the owner.

```
pip install nothing. Standard library only.
```

## What it is not

- not a model, an agent framework or an orchestrator;
- not a scheduler — the app calls it;
- not a transport — the app owns email, Slack, inbox and SMS;
- not a store — the app persists decisions and outcomes;
- not a product surface — the user never sees it.

It is the policy between *"something happened"* and *"the product does something"*.

## The whole API

```python
from laix_attention import Context, Signal, Outcome, OutcomeLog, decide

decisions = decide(
    [Signal(id="D-1", kind="power", severity="critical", confidence=0.9, due="2026-11-02T09:00:00+02:00")],
    Context(now=now, quiet_hours=("22:00", "06:00"), min_severity="high"),
)
# decisions[0].action == "notify"
# decisions[0].reason == "notify"
# decisions[0].trace_id == "tr-3f1c0a2b9d41"
```

Every decision carries: `action`, `reason`, `score`, `confidence`,
`deliver`, `record`, `requires_approval`, `evidence_refs`, `trace_id` and a
`breakdown` that shows how the score was reached.

## The gates, in order

The first gate that fires decides. The order is part of the contract.

| # | Gate | Action | Reason | Kept on record |
|---|---|---|---|---|
| 1 | kill switch | `wait` | `kill_switch` | no |
| 2 | muted kind | `wait` | `muted` | no |
| 3 | below `min_confidence` | `wait` | `low_confidence` | no |
| 4 | below `min_severity` | `wait` | `below_floor` | no |
| 5 | already sent today | `wait` | `already_sent` | no |
| 6 | quiet hours, not critical | `wait` | `quiet_hours` | yes, not delivered |
| 7 | interruption budget spent | `wait` | `budget` | no |
| 8 | critical, overdue past the limit | `escalate` | `overdue_escalation` | yes, delivered |
| 9 | otherwise | `notify` | `notify` | yes, delivered |

Critical signals pass quiet hours. That is deliberate: a stop-work item at
23:30 is still a stop-work item.

## The score

```
severity + due urgency + confidence − interruption cost + learned
```

Severity is 60/45/30/15/5 for critical/high/medium/low/info. Due urgency is
30 (overdue), 20 (≤24 h), 12 (≤72 h), 6 (≤168 h). Confidence and interruption
cost scale by 20. `learned` is a per-kind adjustment supplied by the app.

The score is advisory in v1: it explains and ranks, it does not gate. Gates are
explicit so the behaviour is reproducible. A learned scorer can replace the gate
later without changing the contract — that is a version bump.

## Outcome learning

```python
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

## The contract file

`contract/attention.v1.json` holds the behavioural cases. Any implementation
that passes every case — in any language — is a valid LAIX attention runtime.

```bash
python -c "import laix_attention, pathlib, json; \
  d=json.loads((pathlib.Path(laix_attention.__file__).parent/'contract/attention.v1.json').read_text()); \
  print(laix_attention.run_vectors(d))"
# []
```

Scores are in the contract in v1.0. Changing a weight is a version bump.

## Taking it into LAIX

The package has no imports from the app, no app nouns, no clock of its own and
no dependencies. Extraction is a move, not a rewrite:

1. copy `server/laix_attention/` to `packages/laix-attention-py/src/laix_attention/`;
2. add the ten-line `pyproject.toml` (name `laix-attention`, no dependencies);
3. move `contract/` next to it and let the TypeScript package consume the same file;
4. point CUE at the published version and delete the local copy.

What LAIX still has to supply — by design, not by omission — is the execution
bridge (cancel, approval, verify), the model capability level, and the store for
decisions and outcomes. This package decides; it does not execute.

## Tests

```bash
PYTHONPATH=. pytest -q tests/test_laix_attention.py tests/test_laix_attention_reuse.py
```

Thirteen contract vectors, gate boundaries, score arithmetic, reason-code
mapping, a second consumer in a different domain (study reminders), and a guard
that fails if the package ever imports the app or reads the clock.
