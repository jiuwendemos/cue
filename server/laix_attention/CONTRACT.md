# LAIX attention — contract v1.0

**Status:** draft, extracted from a working app, one consumer proven.
**Authority:** `contract/attention.v1.json` is normative. This document explains it.

## 1. Boundary

An app supplies signals, context and outcomes. The module returns decisions and
measurements. It never calls a model, never sends, never stores, never reads the
clock.

| The app provides | The module provides |
|---|---|
| a candidate: what happened, severity, confidence, due, evidence refs | one `Decision` per candidate |
| context: now, quiet hours, floor, budget, mutes, dedupe set | the action, the reason, the score, the trace id |
| feedback and recorded outcomes | precision, hazard rate, calibration, a learned adjustment |
| whether an action needs approval | `requires_approval`, passed through unchanged |

## 2. Types

| Type | Fields |
|---|---|
| `Signal` | `id`, `kind`, `title`, `detail`, `severity`, `confidence`, `due`, `evidence_refs`, `group_key`, `interruption_cost`, `requires_approval` |
| `Context` | `now`, `quiet_hours`, `mode`, `stopped`, `min_severity`, `min_confidence`, `muted_kinds`, `interruption_budget`, `sent`, `escalate_after_hours`, `learned` |
| `Decision` | `signal_id`, `action`, `score`, `reason`, `confidence`, `deliver`, `record`, `requires_approval`, `evidence_refs`, `breakdown`, `trace_id` |
| `Outcome` | `signal_id`, `kind`, `action`, `result`, `reason_code`, `score`, `at` |

`action` is one of `wait`, `notify`, `ask`, `act`, `verify`, `escalate`.
`result` is one of `helped`, `no_effect`, `hurt`, `unknown`.

`record` and `deliver` are execution hints for the app:

- `record=true, deliver=true` — keep it and interrupt now;
- `record=true, deliver=false` — keep it, do not interrupt (a digest item);
- `record=false, deliver=false` — it never happened, as far as the user is concerned.

## 3. Gate order (normative)

| # | Condition | Action | Reason | record | deliver |
|---|---|---|---|---|---|
| 1 | `Context.stopped` | `wait` | `kill_switch` | false | false |
| 2 | `Signal.kind in muted_kinds` | `wait` | `muted` | false | false |
| 3 | `confidence < min_confidence` | `wait` | `low_confidence` | false | false |
| 4 | severity rank > rank of `min_severity` | `wait` | `below_floor` | false | false |
| 5 | `dedupe_key(signal, now) in sent` | `wait` | `already_sent` | false | false |
| 6 | inside quiet hours and severity ≠ critical | `wait` | `quiet_hours` | true | false |
| 7 | budget spent (`interruption_budget` reached) | `wait` | `budget` | false | false |
| 8 | severity critical and overdue by more than `escalate_after_hours` | `escalate` | `overdue_escalation` | true | true |
| 9 | otherwise | `notify` | `notify` | true | true |

- Severity rank: `critical 0 < high 1 < medium 2 < low 3 < info 4`. A signal passes
  the floor when its rank is less than or equal to the floor's rank.
- Quiet hours are inclusive at both ends. A window that wraps midnight
  (`22:00-06:00`) is handled. An unparsable window is never quiet.
- `dedupe_key` is `"{signal.id}:{YYYY-MM-DD}"` in the signal's local date.
- The budget counts delivered decisions within one `decide()` call.

## 4. Score (normative in v1.0)

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

## 5. Trace ids

`"tr-" + sha1(f"{signal_id}|{YYYY-MM-DD}|{action}")[:12]`.

Stable for the same signal, day and action; different across actions. The app
carries it into delivery records and logs. LAIX's south contract asks for trace
ids on every event; this is the north half of it.

## 6. Outcome learning

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

## 7. Guarantees

1. **No I/O.** No network, no filesystem, no database, no environment.
2. **No clock.** `now` is always an argument. (`ports.SystemClock` is the app's
   adapter and the only place `datetime.now()` appears.)
3. **No app vocabulary.** The package never names a domain object.
4. **Deterministic.** Same signals + same context ⇒ same decisions, scores and
   trace ids.
5. **No execution.** `act` is a proposal. The app or platform executes, approves,
   cancels and verifies.
6. **Additive surface.** New fields may be added in a minor version; gates,
   reasons and score weights are frozen within a major version.

## 8. Versioning

| Change | Version |
|---|---|
| a new optional `Context`/`Signal` field, a new outcome helper | 1.x |
| a gate added, reordered, or a weight changed | 2.0 |
| an action or reason renamed | 2.0 |

Every change ships with a vector that fails on the old behaviour and passes on
the new one.
