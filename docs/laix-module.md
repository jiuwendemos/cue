# The LAIX decision layer

**Status:** the local copy is gone. LAIX is the decision layer, installed as a
pinned dependency.

This page used to describe the engine package that lived inside CUE. That module was handed off, then removed: its code is now the generic
attention policy inside [LAIX](https://github.com/michaelatamuk/laix), and CUE
calls it through a small adapter.

| Question | Answer |
|---|---|
| Where is the decision engine? | `laix` v0.2.0, pinned in `server/pyproject.toml` |
| Where is the adapter? | [`server/laix_integration/`](../server/laix_integration/) |
| Where does CUE call it? | `cue/proactive/scanner.py`, one `Layer.decide()` per scan |
| Is there a local fallback? | No. There is one decision path |
| How is the upgrade done? | Move the tag, reinstall, run the parity test |

The full contract — boundary, adapter shape, vocabulary mapping, parity evidence,
upgrade and rollback — is in [the integration note](laix-integration.md).

## What stayed in CUE

Detection is still CUE's: venue fit, power, weight, glare, rights, missing assets,
schedule pressure and budget all live in `cue/engine/` and
`cue/proactive/scanner.py`. So is everything after the decision: the show store,
notification copy, delivery channels, the readiness and watch pages, signing, and
the outcome labels in `cue/proactive/history.py`.

LAIX answers one question per detected candidate: *should this reach the user now,
later, or never?* CUE does the rest.

## Why the copy was removed

Two implementations of the same policy is the problem, not the solution. While
both existed, every gate change had to be made twice and the two could drift. The
shadow period measured the difference first (22/22 cases agreed once the
`notify` → `guide` vocabulary was normalised); the replacement then deleted the
copy and pinned the dependency.
