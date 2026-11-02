"""Color / number gates used by the Set command checker."""

from __future__ import annotations

import re
from typing import Any

_HEX6 = re.compile(r"^#[0-9a-f]{6}$")
_HEX3 = re.compile(r"^#[0-9a-f]{3}$")


def normalize_hex(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    raw = value.strip().lower()
    if _HEX6.match(raw):
        return raw
    if _HEX3.match(raw):
        r, g, b = raw[1], raw[2], raw[3]
        return f"#{r}{r}{g}{g}{b}{b}"
    return None


def is_finite_number(value: Any) -> bool:
    return (
        isinstance(value, (int, float))
        and value == value
        and abs(value) != float("inf")
    )
