"""Scale binding — the interpreter's semantic pass.

Turns typed channels into the things matplotlib needs: colour lookups, numeric
maps for per-series stroke width / opacity, and positional-axis configuration
(log scaling and explicit domain limits). Applying positional scales is exactly
the step the ad-hoc renderer skipped, so log axes and fixed domains were lost.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .model import Channel


@dataclass(frozen=True)
class ColorMap:
    """Resolved colour encoding.

    ``kind`` is one of ``nominal`` (``mapping`` is a value→hex dict),
    ``quantitative`` (``mapping`` is a colour-scheme name for a cmap),
    ``literal`` (the field value *is* the colour), or ``none``.
    """

    kind: str
    mapping: Any = None


def color_map(channel: Channel | None) -> ColorMap:
    if channel is None:
        return ColorMap("none")
    if channel.type == "quantitative":
        return ColorMap("quantitative", channel.scale.scheme if channel.scale else None)
    scale = channel.scale
    if scale and scale.domain is not None and scale.range is not None:
        return ColorMap("nominal", dict(zip(scale.domain, scale.range)))
    return ColorMap("literal")


def numeric_map(channel: Channel | None) -> dict | None:
    """A value→number map for a per-field ``strokeWidth`` / ``opacity`` channel
    (domain/range scale). Returns None when the channel carries no such scale.
    """
    if channel is None or channel.scale is None:
        return None
    scale = channel.scale
    if scale.domain is not None and scale.range is not None:
        return dict(zip(scale.domain, scale.range))
    return None


def apply_positional(ax: Any, axis: str, channel: Channel | None) -> None:
    """Apply a positional channel's scale to ``ax``: ``log`` scaling and an
    explicit numeric ``domain`` → axis limits. ``axis`` is ``"x"`` or ``"y"``.
    Categorical (nominal/ordinal) and temporal channels carry no numeric domain
    and are left to the mark encoder / autoscaling.
    """
    if channel is None or channel.scale is None:
        return
    scale = channel.scale
    set_scale = ax.set_xscale if axis == "x" else ax.set_yscale
    set_lim = ax.set_xlim if axis == "x" else ax.set_ylim
    if scale.type == "log":
        set_scale("log")
    if scale.domain is not None and channel.type in (None, "quantitative"):
        set_lim(scale.domain[0], scale.domain[-1])
