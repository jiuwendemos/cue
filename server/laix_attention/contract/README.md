# LAIX attention — contract files

**Frozen for handoff.** Do not edit these files in this repository. The canonical
LAIX contract is not final; this set is the CUE v1.1 snapshot that LAIX will adopt
or replace.

| File | Role |
|---|---|
| [`attention.v1.json`](attention.v1.json) | **Normative.** 23 behavioural vectors. An implementation that passes every case and reproduces the listed scores is a valid attention runtime at this version. |
| [`schema.json`](schema.json) | Machine-readable shape of `attention.v1.json`. Descriptive, not normative: if the two disagree, the vectors win and the schema is the bug. |
| [`bench.v1.json`](bench.v1.json) | **Evaluation data, not a contract.** 12 synthetic, labelled interventions used to score a policy against two baselines. A runtime is not required to reproduce it. |

## Provenance

- Contract name: `laix-attention`
- Version: **1.1.0** (do not bump in this repository)
- Extracted from: CUE, the live show design studio, at `cue@a4c6bef`
- First consumer: CUE's readiness desk (`cue/proactive/scanner.py`)
- Second consumer: a study-reminder app in `tests/test_laix_attention_reuse.py`
- Golden replay: [`../fixtures/replay.json`](../fixtures/replay.json), captured from
  the same commit; it records what the CUE deployment actually did, not what the
  contract permits.

## Rules for the handoff

1. `attention.v1.json` is the single source of truth. Any other document — this
   one, `CONTRACT.md`, `POSITION.md`, a slide — is commentary.
2. A change to a gate, an action name, a reason string or a score weight is a
   **major** version and needs a vector that fails on the old behaviour.
3. Adding a vector is allowed; editing or deleting one is not, unless the version
   changes and the reason is recorded.
4. `bench.v1.json` is allowed to grow. Adding labelled cases is how a bench gets
   useful; it never gains normative status.
5. The copy of these files that travels with the extracted package is the copy
   that matters. This repository keeps them for CUE's tests.

## Versions in this snapshot

| Thing | Version |
|---|---|
| Package (`laix_attention.__version__`) | 1.1.0 |
| `attention.v1.json` | 1.1.0 |
| `bench.v1.json` | 1.0.0 |
| `fixtures/replay.json` | 1 |
