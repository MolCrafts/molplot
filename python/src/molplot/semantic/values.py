"""Set-command value parsers. No backend imports."""

from __future__ import annotations

from typing import Any

from .hex import is_finite_number


def parse_opacity(value: Any) -> float | None:
    if not is_finite_number(value):
        return None
    number = float(value)
    if number < 0 or number > 1:
        return None
    return number


def parse_size(value: Any) -> float | None:
    if not is_finite_number(value):
        return None
    number = float(value)
    if number <= 0:
        return None
    return number


def parse_dash(value: Any) -> list[float] | None:
    if not isinstance(value, (list, tuple)):
        return None
    out: list[float] = []
    for item in value:
        if not is_finite_number(item) or float(item) < 0:
            return None
        out.append(float(item))
    return out


def parse_name(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    name = value.strip()
    return name or None


def parse_bool(value: Any) -> bool | None:
    if isinstance(value, bool):
        return value
    return None


def parse_ticks(value: Any) -> list[float] | None:
    if not isinstance(value, (list, tuple)):
        return None
    out: list[float] = []
    for item in value:
        if not is_finite_number(item):
            return None
        out.append(float(item))
    return out


def parse_tick_labels(value: Any) -> list[str] | None:
    if not isinstance(value, (list, tuple)):
        return None
    out: list[str] = []
    for item in value:
        if not isinstance(item, str):
            return None
        out.append(item)
    return out
