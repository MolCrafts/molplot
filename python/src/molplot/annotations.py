"""Chart annotations — one call draws a complete artist (mirrors TS).

Design follows matplotlib:

* ``scale_bar(...)`` ≈ ``FancyArrowPatch(..., arrowstyle='|-|')`` plus a
  label — **one** object owns the spine, both end-caps, and the text.
  Callers never draw caps by hand.
* ``arrow(...)`` ≈ ``ax.annotate(..., arrowprops=dict(arrowstyle='->'))``.

Expand with :func:`with_annotations` / a top-level ``annotations`` list on a
Vega-Lite fence or :class:`RawChart` payload. The expansion always emits
bar + caps + label as a single unit.
"""

from __future__ import annotations

import math
from typing import Any, Literal, Mapping, Sequence, TypedDict

__all__ = [
    "ScaleBarAnnotation",
    "ArrowAnnotation",
    "Annotation",
    "scale_bar",
    "arrow",
    "annotation_layers",
    "with_annotations",
    "take_annotations",
]


class ScaleBarAnnotation(TypedDict, total=False):
    """One complete ``|———|`` (spine + ⊥ caps + optional label)."""

    kind: Literal["scaleBar"]
    x: float
    y: float
    length: float
    x2: float
    y2: float
    label: str
    color: str
    strokeWidth: float
    orientation: Literal["horizontal", "vertical", "along"]
    tick: float
    tickRatio: float
    capLog: float
    offsetLog: float


class ArrowAnnotation(TypedDict, total=False):
    kind: Literal["arrow"]
    x: float
    y: float
    x2: float
    y2: float
    label: str
    color: str
    strokeWidth: float
    tipSize: float


Annotation = ScaleBarAnnotation | ArrowAnnotation

_SERIF = "Times New Roman, Times, STIX Two Text, STIXGeneral, serif"


def scale_bar(
    x: float,
    y: float,
    *,
    x2: float | None = None,
    y2: float | None = None,
    length: float | None = None,
    label: str | None = None,
    orientation: Literal["horizontal", "vertical", "along"] | None = None,
    offset: float = 0.42,
    capsize: float = 0.16,
    color: str = "#18432b",
    linewidth: float = 1.8,
    tick: float | None = None,
    tick_ratio: float | None = None,
) -> ScaleBarAnnotation:
    """Build one complete ``|———|`` annotation (matplotlib ``arrowstyle='|-|'``).

    Parameters
    ----------
    x, y
        Start in data coordinates. For ``orientation='along'`` this is a point
        **on the curve** (reference chord start).
    x2, y2
        End of the chord (required for ``along``; optional for axis-aligned
        when ``length`` is given).
    length
        Axis-aligned length when ``x2``/``y2`` are omitted.
    label
        Text drawn with the bar (Times roman). Owned by this artist — do not
        add a separate text layer.
    orientation
        ``'along'`` — chord parallel to ``(x,y)→(x2,y2)``, offset off the
        path by ``offset`` in log–log space, end-caps ⊥ bar (default when
        both ends are given).
        ``'horizontal'`` / ``'vertical'`` — axis-aligned size bar.
    offset
        Log-space normal offset from the reference chord (``along`` only).
        Default ``0.42`` so the bar does not sit on the curve. ``0`` = on chord.
    capsize
        Log-space half-length of each end-cap (``along``). Default ``0.16``.
    color, linewidth
        Stroke style for spine and caps together.

    Returns
    -------
    ScaleBarAnnotation
        Pass inside ``annotations=[...]`` or to :func:`with_annotations`.
        Expansion yields spine + both caps + label — never hand-draw caps.
    """
    if orientation is None:
        orientation = (
            "along"
            if x2 is not None and y2 is not None
            else "horizontal"
        )
    out: ScaleBarAnnotation = {
        "kind": "scaleBar",
        "x": float(x),
        "y": float(y),
        "color": color,
        "strokeWidth": float(linewidth),
        "orientation": orientation,
    }
    if x2 is not None:
        out["x2"] = float(x2)
    if y2 is not None:
        out["y2"] = float(y2)
    if length is not None:
        out["length"] = float(length)
    if label is not None:
        out["label"] = label
    if orientation == "along":
        out["offsetLog"] = float(offset)
        out["capLog"] = float(capsize)
    if tick is not None:
        out["tick"] = float(tick)
    if tick_ratio is not None:
        out["tickRatio"] = float(tick_ratio)
    return out


def arrow(
    x: float,
    y: float,
    x2: float,
    y2: float,
    *,
    label: str | None = None,
    color: str = "#18432b",
    linewidth: float = 1.6,
    tip_size: float = 55,
) -> ArrowAnnotation:
    """Build one complete arrow (matplotlib ``arrowstyle='->'``)."""
    out: ArrowAnnotation = {
        "kind": "arrow",
        "x": float(x),
        "y": float(y),
        "x2": float(x2),
        "y2": float(y2),
        "color": color,
        "strokeWidth": float(linewidth),
        "tipSize": float(tip_size),
    }
    if label is not None:
        out["label"] = label
    return out


def _log_perp_cap(
    x: float, y: float, x0: float, y0: float, x1: float, y1: float, s: float
) -> dict[str, float]:
    dx = math.log(x1 / x0)
    dy = math.log(y1 / y0)
    n = math.hypot(dx, dy) or 1.0
    px, py = (-dy / n) * s, (dx / n) * s
    return {
        "x": math.exp(math.log(x) + px),
        "y": math.exp(math.log(y) + py),
        "x2": math.exp(math.log(x) - px),
        "y2": math.exp(math.log(y) - py),
    }


def _scale_bar_layers(a: Mapping[str, Any]) -> list[dict[str, Any]]:
    """Expand **one** scaleBar into spine + caps + label (internal)."""
    color = a.get("color") or "#18432b"
    sw = a.get("strokeWidth") or 1.8
    orient = a.get("orientation") or "horizontal"
    x2, y2 = a.get("x2"), a.get("y2")
    along = orient == "along" or (
        x2 is not None and y2 is not None and orient not in ("horizontal", "vertical")
    )
    length = float(a["length"]) if a.get("length") is not None else 0.0
    tick = a.get("tick")
    if tick is None:
        tick = abs(length) * 0.08 if length else 0.05
    tick_ratio = a.get("tickRatio")
    x, y = float(a["x"]), float(a["y"])
    layers: list[dict[str, Any]] = []

    if along and x2 is not None and y2 is not None:
        rx0, ry0, rx1, ry1 = x, y, float(x2), float(y2)
        dx = math.log(rx1 / rx0)
        dy = math.log(ry1 / ry0)
        n = math.hypot(dx, dy) or 1.0
        ux, uy = dx / n, dy / n
        side = 1
        if math.exp(0.5 * (math.log(ry0) + math.log(ry1)) - ux * 0.1) > math.exp(
            0.5 * (math.log(ry0) + math.log(ry1)) + ux * 0.1
        ):
            side = -1
        s_off = float(a["offsetLog"]) if a.get("offsetLog") is not None else 0.42
        ox, oy = -uy * s_off * side, ux * s_off * side
        x0 = math.exp(math.log(rx0) + ox)
        y0 = math.exp(math.log(ry0) + oy)
        x1 = math.exp(math.log(rx1) + ox)
        y1 = math.exp(math.log(ry1) + oy)
        s_cap = float(a["capLog"]) if a.get("capLog") is not None else 0.16
        # spine
        layers.append(
            {
                "data": {"values": [{"x": x0, "y": y0, "x2": x1, "y2": y1}]},
                "mark": {
                    "type": "rule",
                    "strokeWidth": sw,
                    "color": color,
                    "strokeCap": "butt",
                },
                "encoding": {
                    "x": {"field": "x", "type": "quantitative"},
                    "y": {"field": "y", "type": "quantitative"},
                    "x2": {"field": "x2"},
                    "y2": {"field": "y2"},
                },
            }
        )
        # both end-caps (owned by this scale_bar — not a separate API call)
        layers.append(
            {
                "data": {
                    "values": [
                        _log_perp_cap(x0, y0, x0, y0, x1, y1, s_cap),
                        _log_perp_cap(x1, y1, x0, y0, x1, y1, s_cap),
                    ]
                },
                "mark": {"type": "rule", "strokeWidth": sw, "color": color},
                "encoding": {
                    "x": {"field": "x", "type": "quantitative"},
                    "y": {"field": "y", "type": "quantitative"},
                    "x2": {"field": "x2"},
                    "y2": {"field": "y2"},
                },
            }
        )
        if a.get("label"):
            s_lab = s_off + 0.32
            lx = math.exp(
                0.5 * (math.log(rx0) + math.log(rx1)) + -uy * s_lab * side
            )
            ly = math.exp(
                0.5 * (math.log(ry0) + math.log(ry1)) + ux * s_lab * side
            )
            layers.append(
                {
                    "data": {"values": [{"x": lx, "y": ly, "label": a["label"]}]},
                    "mark": {
                        "type": "text",
                        "font": _SERIF,
                        "fontStyle": "normal",
                        "color": color,
                        "align": "center",
                        "baseline": "middle",
                    },
                    "encoding": {
                        "x": {"field": "x", "type": "quantitative"},
                        "y": {"field": "y", "type": "quantitative"},
                        "text": {"field": "label", "type": "nominal"},
                    },
                }
            )
        return layers

    horizontal = orient == "horizontal"
    if horizontal:
        x0 = x
        x1 = float(x2) if x2 is not None else x + length
        mid = (x0 + x1) / 2
        if tick_ratio is not None:
            y_lo, y_hi = y / float(tick_ratio), y * float(tick_ratio)
        else:
            y_lo, y_hi = y - tick, y + tick
        layers.append(
            {
                "data": {"values": [{"x": x0, "x2": x1, "y": y}]},
                "mark": {
                    "type": "rule",
                    "strokeWidth": sw,
                    "color": color,
                    "strokeCap": "butt",
                },
                "encoding": {
                    "x": {"field": "x", "type": "quantitative"},
                    "x2": {"field": "x2"},
                    "y": {"field": "y", "type": "quantitative"},
                },
            }
        )
        layers.append(
            {
                "data": {
                    "values": [
                        {"x": x0, "y": y_lo, "y2": y_hi},
                        {"x": x1, "y": y_lo, "y2": y_hi},
                    ]
                },
                "mark": {"type": "rule", "strokeWidth": sw, "color": color},
                "encoding": {
                    "x": {"field": "x", "type": "quantitative"},
                    "y": {"field": "y", "type": "quantitative"},
                    "y2": {"field": "y2"},
                },
            }
        )
        if a.get("label"):
            layers.append(
                {
                    "data": {"values": [{"x": mid, "y": y, "label": a["label"]}]},
                    "mark": {
                        "type": "text",
                        "dy": -10,
                        "font": _SERIF,
                        "fontStyle": "normal",
                        "color": color,
                        "align": "center",
                        "baseline": "bottom",
                    },
                    "encoding": {
                        "x": {"field": "x", "type": "quantitative"},
                        "y": {"field": "y", "type": "quantitative"},
                        "text": {"field": "label", "type": "nominal"},
                    },
                }
            )
        return layers

    # vertical
    y0 = y
    y1 = float(y2) if y2 is not None else y + length
    mid = (y0 + y1) / 2
    if tick_ratio is not None:
        x_lo, x_hi = x / float(tick_ratio), x * float(tick_ratio)
    else:
        x_lo, x_hi = x - tick, x + tick
    layers.append(
        {
            "data": {"values": [{"x": x, "y": y0, "y2": y1}]},
            "mark": {
                "type": "rule",
                "strokeWidth": sw,
                "color": color,
                "strokeCap": "butt",
            },
            "encoding": {
                "x": {"field": "x", "type": "quantitative"},
                "y": {"field": "y", "type": "quantitative"},
                "y2": {"field": "y2"},
            },
        }
    )
    layers.append(
        {
            "data": {
                "values": [
                    {"x": x_lo, "x2": x_hi, "y": y0},
                    {"x": x_lo, "x2": x_hi, "y": y1},
                ]
            },
            "mark": {"type": "rule", "strokeWidth": sw, "color": color},
            "encoding": {
                "x": {"field": "x", "type": "quantitative"},
                "x2": {"field": "x2"},
                "y": {"field": "y", "type": "quantitative"},
            },
        }
    )
    if a.get("label"):
        layers.append(
            {
                "data": {"values": [{"x": x, "y": mid, "label": a["label"]}]},
                "mark": {
                    "type": "text",
                    "dx": 10,
                    "font": _SERIF,
                    "fontStyle": "normal",
                    "color": color,
                    "align": "left",
                    "baseline": "middle",
                },
                "encoding": {
                    "x": {"field": "x", "type": "quantitative"},
                    "y": {"field": "y", "type": "quantitative"},
                    "text": {"field": "label", "type": "nominal"},
                },
            }
        )
    return layers


def _arrow_layers(a: Mapping[str, Any]) -> list[dict[str, Any]]:
    color = a.get("color") or "#18432b"
    sw = a.get("strokeWidth") or 1.6
    tip_size = a.get("tipSize") or 55
    x, y = float(a["x"]), float(a["y"])
    x2, y2 = float(a["x2"]), float(a["y2"])
    angle = math.degrees(math.atan2(y2 - y, x2 - x)) + 90
    layers: list[dict[str, Any]] = [
        {
            "data": {"values": [{"x": x, "y": y, "x2": x2, "y2": y2}]},
            "mark": {
                "type": "rule",
                "strokeWidth": sw,
                "color": color,
                "strokeCap": "round",
            },
            "encoding": {
                "x": {"field": "x", "type": "quantitative"},
                "y": {"field": "y", "type": "quantitative"},
                "x2": {"field": "x2"},
                "y2": {"field": "y2"},
            },
        },
        {
            "data": {"values": [{"x": x2, "y": y2, "angle": angle}]},
            "mark": {
                "type": "point",
                "shape": "triangle",
                "filled": True,
                "size": tip_size,
                "color": color,
            },
            "encoding": {
                "x": {"field": "x", "type": "quantitative"},
                "y": {"field": "y", "type": "quantitative"},
                "angle": {"field": "angle", "type": "quantitative"},
            },
        },
    ]
    if a.get("label"):
        layers.append(
            {
                "data": {
                    "values": [
                        {
                            "x": (x + x2) / 2,
                            "y": (y + y2) / 2,
                            "label": a["label"],
                        }
                    ]
                },
                "mark": {
                    "type": "text",
                    "dy": -8,
                    "font": _SERIF,
                    "fontStyle": "normal",
                    "color": color,
                    "align": "center",
                    "baseline": "bottom",
                },
                "encoding": {
                    "x": {"field": "x", "type": "quantitative"},
                    "y": {"field": "y", "type": "quantitative"},
                    "text": {"field": "label", "type": "nominal"},
                },
            }
        )
    return layers


def annotation_layers(annotations: Sequence[Mapping[str, Any]]) -> list[dict[str, Any]]:
    """Expand each annotation into its full set of VL layers."""
    out: list[dict[str, Any]] = []
    for a in annotations:
        kind = a.get("kind")
        if kind == "scaleBar":
            out.extend(_scale_bar_layers(a))
        elif kind == "arrow":
            out.extend(_arrow_layers(a))
    return out


def with_annotations(
    spec: dict[str, Any],
    annotations: Sequence[Mapping[str, Any]] | None,
) -> dict[str, Any]:
    """Merge annotation layers into a unit or layered Vega-Lite spec."""
    if not annotations:
        return spec
    extra = annotation_layers(annotations)
    if not extra:
        return spec
    if isinstance(spec.get("layer"), list):
        return {**spec, "layer": [*spec["layer"], *extra]}
    if "mark" in spec or "encoding" in spec:
        base = {
            k: spec[k]
            for k in ("data", "mark", "encoding", "transform", "params")
            if k in spec
        }
        rest = {k: v for k, v in spec.items() if k not in base}
        return {**rest, "layer": [base, *extra]}
    return {**spec, "layer": extra}


def take_annotations(
    spec: dict[str, Any],
) -> tuple[dict[str, Any], list[Annotation]]:
    """Pull top-level ``annotations`` off a payload; return ``(spec, list)``."""
    raw = spec.get("annotations")
    if not isinstance(raw, list) or not raw:
        cleaned = {k: v for k, v in spec.items() if k != "annotations"}
        return cleaned, []
    annotations: list[Annotation] = [
        a  # type: ignore[misc]
        for a in raw
        if isinstance(a, dict) and a.get("kind") in ("scaleBar", "arrow")
    ]
    cleaned = {k: v for k, v in spec.items() if k != "annotations"}
    return cleaned, annotations
