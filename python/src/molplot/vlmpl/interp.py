"""The interpreter driver.

Walks a Vega-Lite spec end to end: normalize into typed units, apply the unified
preset style, dispatch each unit's mark onto the axes, then finalize the axes
(titles, scales, legend). This is the implementation behind ``molplot.render``.
"""

from __future__ import annotations

from contextlib import nullcontext
from typing import Any

from ..preset import DEFAULT_PRESET, Mode
from ..style import style as _style
from .axes import apply_axes
from .marks import encode
from .model import normalize


def _ensure_ax(ax: Any) -> tuple[Any, Any]:
    import matplotlib.pyplot as plt

    if ax is not None:
        return ax.figure, ax
    return plt.subplots()


def render(
    spec: dict[str, Any],
    *,
    preset: str = DEFAULT_PRESET,
    mode: Mode = "light",
    ax: Any = None,
    apply_style: bool = True,
):
    """Render a Vega-Lite spec to matplotlib. Returns ``(figure, axes)``.

    >>> spec = molplot.line_spec([{"id": "a", "x": [0, 1, 2], "y": [1, 3, 2]}])
    >>> fig, ax = molplot.render(spec)
    """
    units = normalize(spec)
    ctx = _style(preset, mode) if apply_style else nullcontext()
    with ctx:
        fig, ax = _ensure_ax(ax)
        labelled = False
        for unit in units:
            labelled = encode(ax, unit) or labelled
        apply_axes(ax, units, labelled)
    return fig, ax
