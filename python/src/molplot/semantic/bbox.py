"""Parse a figure-fraction bbox from a Set command value."""

from __future__ import annotations

from typing import Any

from ._generated import BBox
from .hex import is_finite_number


def parse_bbox(value: Any) -> BBox | None:
    if not isinstance(value, dict):
        return None
    try:
        x = float(value["x"])
        y = float(value["y"])
        w = float(value["w"])
        h = float(value["h"])
    except (KeyError, TypeError, ValueError):
        return None
    if not all(is_finite_number(v) for v in (x, y, w, h)):
        return None
    if w <= 0 or h <= 0:
        return None
    return BBox(x=x, y=y, w=w, h=h)
