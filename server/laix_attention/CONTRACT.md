# LAIX attention — contract v1.1

**Status:** draft, extracted from a working app, two consumers.
**Authority:** `contract/attention.v1.json` is normative. `contract/bench.v1.json` scores
policies. `contract/schema.json` is the machine-readable shape. This document explains them.

## 1. Boundary

An app supplies signals, context and outcomes. The module returns decisions and
measurements. It never calls a model, never sends, never stores, never reads the
clock, never executes.

| The app provides | The module provides |
|---|---|
| a candidate: what happened, severity, confidence, due, evidence refs | one `Decision` per candidate |
| context: now, quiet hours, floor, budget, mutes, dedupe set, feedback | the action, the reason, the score, the trace id |
| what it would do (`Intent`), whether that is reversible, who to escalate to | the intent carried back, an approval request, an undo hint |
| feedback and recorded outcomes | precision, hazard rate, calibration, a learned adjustment |
| whether `act` is allowed at all | `requires_approval`, passed through unchanged |

## 2. Types

| Type | Fields |
|---|---|
| `Signal` | `id`, `kind`, `title`, `detail`, `severity`, `confidence`, `due`, `evidence_refs`, `group_key`, `interruption_cost`, `requires_approval`, `intent`, `reversible`, `escalation` |
| `Intent` | `capability`, `args` |
| `Escalation` | `target`, `reason` |
| `Feedback` | `state` (`accepted`, `dismissed`, `snoozed`, `wrong`, `assigned`), `at`, `until`, `note` |
| `Context` | `now`, `quiet_hours`, `mode`, `stopped`, `min_severity`, `min_confidence`, `muted_kinds`, `interruption_budget`, `sent`, `feedback`, `escalate_after_hours`, `learned`, `allow_act` |
| `Decision` | `signal_id`, `action`, `score`, `reason`, `confidence`, `deliver`, `record`, `requires_approval`, `evidence_refs`, `breakdown`, `trace_id`, `intent`, `escalation`, `cost_of_waiting`, `reversible`, `undo_hint` |
| `Outcome` | `signal_id`, `kind`, `action`, `result`, `reason_code`, `score`, `at` |

`action` is one of `wait`, `notify`, `ask`, `act`, `verify`, `escalate`.
`verify` is reserved: the policy never emits it, because verification belongs to the
execution bridge after an action has run.

`record` and `deliver` are execution hints for the app:

- `record=true, deliver=true` — keep it and interrupt now;
- `record=true, deliver=false` — keep it, do not interrupt (a digest item);
- `record=false, deliver=false` — it never happened, as far as the user is concerned.

## 3. Gate order (normative)

The first gate that fires decides. The order is part of the contract.

| # | Condition | Action | Reason | record | deliver |
|---|---|---|---|---|---|
| 1 | `Context.stopped` | `wait` | `kill_switch` | false | false |
| 2 | `Signal.kind in muted_kinds` | `wait` | `muted` | false | false |
| 3 | feedback blocks it (see §4) | `wait` | `snoozed` / `wrong` / `assigned` / `dismissed` | false | false |
| 4 | `confidence < min_confidence` | `wait` | `low_confidence` | false | false |
| 5 | severity rank > rank of `min_severity` | `wait` | `below_floor` | false | false |
| 6 | `dedupe_key(signal, now) in sent` | `wait` | `already_sent` | false | false |
| 7 | inside quiet hours and severity ≠ critical | `wait` | `quiet_hours` | true | false |
| 8 | budget spent (`interruption_budget` reached) | `wait` | `budget` | false | false |
| 9 | critical and overdue by more than `escalate_after_hours` | `escalate` | `overdue_escalation` | true | true |
| 10 | `allow_act`, an intent, and `reversible` | `act` | `act` | true | true |
| 10a | …and `requires_approval` | `ask` | `ask_approval` | true | true |
| 11 | otherwise | `notify` | `notify` | true | true |

- Severity rank: `critical 0 < high 1 < medium 2 < low 3 < info 4`. A signal passes
  the floor when its rank is less than or equal to the floor's rank.
- Quiet hours are inclusive at both ends. A window that wraps midnight
  (`22:00-06:00`) is handled. An unparsable window is never quiet.
- `dedupe_key` is `"{signal.id}:{YYYY-MM-DD}"` in the signal's local date.
- The budget counts delivered decisions within one `decide()` call.
- `act` is opt-in twice: the app sets `allow_act`, and the signal must be reversible.
  An irreversible intent is only notified.
- A blocked signal never reaches `act`: gates 1–8 run first.

## 4. Feedback (normative)

| State | Effect |
|---|---|
| `accepted` | none; the signal may notify again |
| `snoozed` with `until` in the future | `wait` / `snoozed` |
| `snoozed` with `until` in the past | none; the signal proceeds |
| `snoozed` with no `until`, or an unreadable one | `wait` / `snoozed` (conservative) |
| `wrong` | `wait` / `wrong` |
| `assigned` | `wait` / `assigned` |
| `dismissed` | `wait` / `dismissed` |

`dedupe_key` handles "not again today". Feedback handles "not again at all, or not
until Tuesday". They are different questions and both are kept.

## 5. Score (normative in v1)

```
severity + due + confidence − interruption + learned
```

| Term | Rule |
|---|---|
| severity | critical 60, high 45, medium 30, low 15, info 5 |
| due | overdue 30 · ≤24 h 20 · ≤72 h 12 · ≤168 h 6 · else 0 · unparsable 0 |
| confidence | `clamp(confidence, 0, 1) × 20` |
| interruption | `−clamp(interruption_cost, 0, 1) × 20` |
| learned | `Context.learned.get(kind, 0)` |

`Decision.score` is the total, rounded to 2 decimals in `as_dict()`.

## 6. Cost of waiting and undo

```
cost_of_waiting = due_points × factor(severity)
factor: critical 2.0 · high 1.5 · medium 1.0 · low 0.5 · info 0.25
```

Zero when there is no deadline. It is an output, not a gate: it tells the app what
silence costs, per the Max note's requirement.

`undo_hint` is `withdraw` for `notify`/`ask`, `cancel` for a reversible `act`, and
`None` otherwise. The app decides which control to draw; the module says what is
possible.

## 7. Trace ids

`"tr-" + sha1(f"{signal_id}|{YYYY-MM-DD}|{action}")[:12]`.

Stable for the same signal, day and action; different across actions. The app
carries it into delivery records and logs. LAIX's south contract asks for trace ids
on every event; this is the north half of it.

## 8. Outcome learning

```
result = helped      when feedback is accepted / confirmed / signed
       = hurt        when reason_code in {false_alarm, data_error}
       = no_effect   when reason_code in {design_change, operational, duplicate, no_action}
       = unknown     otherwise
```

| Measure | Definition |
|---|---|
| `precision(kind)` | `helped / all` — `None` when there is no evidence |
| `hazard_rate(kind)` | `hurt / all` — the number a floor should be tuned against |
| `adjustment(kind)` | `(helped − hurt) / all × weight`, default weight 12 |
| `calibration()` | four score buckets → sample size and observed help rate |

The log is bounded (`limit`, default 500) and serialisable via `Outcome.as_dict()`.

## 9. Benchmark

`contract/bench.v1.json` holds twelve labelled interventions. `benchmark()` scores
three policies on them: `policy`, `severity_only` (floor only, no timing, no
feedback) and `always_notify`.

Current numbers, from `laix_attention.benchmark()`:

| Policy | Raised | Precision | Hazard | Recall |
|---|---|---|---|---|
| `policy` | 4 / 12 | 0.75 | 0.00 | 0.75 |
| `severity_only` | 10 / 12 | 0.40 | 0.40 | 1.00 |
| `always_notify` | 12 / 12 | 0.33 | 0.50 | 1.00 |

Twelve synthetic cases are not a study. They exist so a change to a gate can be
seen as a number, and so a second implementation has something to beat.

## 10. Guarantees

1. **No I/O.** No network, no filesystem, no database, no environment.
2. **No clock.** `now` is always an argument. (`ports.SystemClock` is the app's
   adapter and the only place `datetime.now()` appears.)
3. **No app vocabulary.** The package never names a domain object.
4. **Deterministic.** Same signals + same context ⇒ same decisions, scores and
   trace ids.
5. **No execution.** `act` is a proposal with a payload. The app or platform
   executes, approves, cancels and verifies.
6. **Additive by default.** A new optional field, or a new gate that can only fire
   when that field is supplied, keeps the major version. Reordering an existing
   gate, changing a weight, or renaming an action or reason is a major version.
   `no_new_context_behaves_exactly_as_before` is the vector that enforces it.

## 11. Versioning

| Change | Version |
|---|---|
| a new optional `Context`/`Signal` field, a new gate behind it, a new helper | 1.x |
| an existing gate reordered, a weight changed, an action or reason renamed | 2.0 |

Every change ships with a vector that fails on the old behaviour and passes on the
new one.
