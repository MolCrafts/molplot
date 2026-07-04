"""Data-space helpers: apply a unit's transforms to its rows and coerce
temporal values to matplotlib date numbers. Kept separate so mark encoders
receive plain, already-filtered row dicts and never re-implement filtering.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any


def apply_transforms(rows: tuple, transforms: tuple) -> list[dict]:
    """Return the rows that survive a unit's ``transform`` list.

    Only ``filter`` transforms are meaningful for a static figure; this is what
    gates the line spec's marker layer (``oneOf: []`` → draw nothing), so a
    plain line chart shows no stray marker points.
    """
    out = list(rows)
    for t in transforms:
        f = t.get("filter") if isinstance(t, dict) else None
        if isinstance(f, dict):
            out = _apply_filter(out, f)
    return out


def _apply_filter(rows: list[dict], f: dict) -> list[dict]:
    field = f.get("field")
    if field is None:
        return rows
    if "oneOf" in f:
        allowed = set(f["oneOf"])
        return [r for r in rows if r.get(field) in allowed]
    if "equal" in f:
        target = f["equal"]
        return [r for r in rows if r.get(field) == target]
    return rows


def is_temporal(v: Any) -> bool:
    """A value that is not already numeric is treated as a timestamp."""
    return not isinstance(v, (int, float))


def as_number(v: Any) -> float:
    """Coerce a value that may be an ISO-8601 timestamp to a plottable number;
    pass ints/floats through unchanged."""
    if isinstance(v, (int, float)):
        return float(v)
    import matplotlib.dates as mdates

    return float(mdates.date2num(datetime.fromisoformat(str(v).replace("Z", "+00:00"))))
