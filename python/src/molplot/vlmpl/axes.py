"""Finalize an Axes after all marks are drawn: axis titles, positional scales
(log / explicit domain — the step the old prototype dropped), and the legend.
Runs once per render so cross-layer axis state is resolved in one place.
"""

from __future__ import annotations

from typing import Any

from .model import Unit
from .scales import apply_positional


def apply_axes(ax: Any, units: list[Unit], labelled: bool) -> None:
    enc = _merged_encoding(units)
    x, y = enc.get("x"), enc.get("y")
    if x is not None and x.axis_title:
        ax.set_xlabel(x.axis_title)
    if y is not None and y.axis_title:
        ax.set_ylabel(y.axis_title)
    apply_positional(ax, "x", x)
    apply_positional(ax, "y", y)
    _apply_legend(ax, units, labelled)


def _merged_encoding(units: list[Unit]) -> dict:
    """First-seen channel across layers (shared x/y live at the spec root and
    appear identically in every unit after normalization)."""
    merged: dict = {}
    for unit in units:
        for name, channel in unit.encoding.items():
            merged.setdefault(name, channel)
    return merged


def _apply_legend(ax: Any, units: list[Unit], labelled: bool) -> None:
    """Show a categorical legend only when a colour channel asked for one and
    labelled artists exist. Quantitative colour uses a colourbar, added when the
    point mark is drawn, so it is skipped here."""
    color = next(
        (u.encoding["color"] for u in units if u.encoding.get("color") and u.encoding["color"].wants_legend),
        None,
    )
    if color is None or color.type == "quantitative":
        return
    if labelled:
        ax.legend()
