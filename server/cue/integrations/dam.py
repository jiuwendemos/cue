"""A local DAM/asset-library connector.

The pilot can point this at a folder (or a mounted DAM export) and get a real
freshness/checksum report without a cloud call. A vendor DAM adapter replaces
the folder scan with the vendor API; the shape stays the same.
"""

from __future__ import annotations

import hashlib
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


def checksum(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()[:16]


def scan(directory: str | None, expected: list[str]) -> dict[str, Any]:
    if not directory:
        return {
            "status": "simulated",
            "directory": None,
            "expected": expected,
            "found": [],
            "missing": expected,
            "detail": "CUE_ASSET_DIR is not configured. The scan is a simulated readiness check.",
        }
    root = Path(directory)
    if not root.exists():
        return {
            "status": "error",
            "directory": str(root),
            "expected": expected,
            "found": [],
            "missing": expected,
            "detail": "The configured asset directory does not exist.",
        }
    files = [path for path in root.rglob("*") if path.is_file()]
    by_name = {path.name: path for path in files}
    found = []
    missing = []
    for name in expected:
        path = by_name.get(name)
        if not path:
            missing.append(name)
            continue
        stat = path.stat()
        found.append(
            {
                "name": name,
                "bytes": stat.st_size,
                "modified": datetime.fromtimestamp(stat.st_mtime, tz=UTC).isoformat(),
                "checksum": checksum(path),
            }
        )
    return {
        "status": "ok" if not missing else "missing",
        "directory": str(root),
        "expected": expected,
        "found": found,
        "missing": missing,
        "detail": f"{len(found)} found · {len(missing)} missing · {len(files)} files scanned.",
    }
