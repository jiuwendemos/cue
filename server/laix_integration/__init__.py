"""The CUE adapter for the LAIX decision layer.

CUE detects; LAIX decides; CUE delivers. This package is the only place that
knows both vocabularies:

- ``mapper.to_signal`` / ``mapper.to_context``   CUE -> LAIX
- ``mapper.to_cue_decision``                     LAIX -> CUE

There is no second decision path. The local engine was removed when LAIX became
a normal dependency.
"""
