"""Test isolation.

The suite must be deterministic and offline. The OpenJiuwen runtime is real, so
it is switched off for the default run; the live test re-enables it explicitly
and skips unless ``CUE_LIVE_AGENT=1``.
"""

from __future__ import annotations

import os

os.environ["CUE_OPENJIUWEN"] = "0"
