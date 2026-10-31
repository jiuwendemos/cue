"""Shadow integration with the external LAIX decision layer.

This package is imported **only** when ``CUE_LAIX_MODE=shadow``. CUE's native
decision path lives in ``laix_attention`` and stays authoritative; nothing here
may change a notification, a delivery or an API response.

- ``mapper``  CUE candidate / settings -> LAIX ``Signal`` / ``Context``
- ``compare`` raw and normalised agreement between the two decisions
- ``shadow``  one LAIX request per scan, one report, one log line per comparison
"""
