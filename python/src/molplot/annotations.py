"""Chart annotations — portable Vega-Lite layers (mirrors core/src/annotations.ts).

Kinds:
  * ``scaleBar`` — a ``|———|`` bar in data coordinates
  * ``arrow``    — directed arrow (rule + tip) with optional label

Use :func:`with_annotations` on any unit/layered VL dict, or put an
``annotations`` list on a fence / RawChart payload (stripped before render).
"""

from __future__ import annotations

import math
from typing import Any, Literal, Mapping, Sequence, TypedDict

__all__ = [
    "ScaleBarAnnotation",
    "ArrowAnnotation",
    "Annotation",
    "annotation_layers",
    "with_annotations",
    "take_annotations",
]


class ScaleBarAnnotation(TypedDict, total=False):
    kind: Literal["scaleBar"]
    x: float
    y: float
    length: float
    label: str
    color: str
    strokeWidth: float
    orientation: Literal["horizontal", "vertical"]
    tick: float


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


def _scale_bar_layers(a: Mapping[str, Any]) -> list[dict[str, Any]]:
    color = a.get("color") or "#14271d"
    sw = a.get("strokeWidth") or 1.6
    horizontal = (a.get("orientation") or "horizontal") == "horizontal"
    length = float(a["length"])
    tick = a.get("tick")
    if tick is None:
        tick = abs(length) * 0.08 if length else 0.05
    x, y = float(a["x"]), float(a["y"])
    layers: list[dict[str, Any]] = []

    if horizontal:
        x0, x1 = x, x + length
        mid = (x0 + x1) / 2
        layers.append(
            {
                "data": {"values": [{"x": x0, "x2": x1, "y": y}]},
                "mark": {"type": "rule", "strokeWidth": sw, "color": color, "strokeCap": "butt"},
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
                        {"x": x0, "y": y - tick, "y2": y + tick},
                        {"x": x1, "y": y - tick, "y2": y + tick},
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
                        "dy": 12,
                        "fontSize": 11,
                        "color": color,
                        "align": "center",
                        "baseline": "top",
                    },
                    "encoding": {
                        "x": {"field": "x", "type": "quantitative"},
                        "y": {"field": "y", "type": "quantitative"},
                        "text": {"field": "label", "type": "nominal"},
                    },
                }
            )
    else:
        y0, y1 = y, y + length
        mid = (y0 + y1) / 2
        layers.append(
            {
                "data": {"values": [{"x": x, "y": y0, "y2": y1}]},
                "mark": {"type": "rule", "strokeWidth": sw, "color": color, "strokeCap": "butt"},
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
                        {"x": x - tick, "x2": x + tick, "y": y0},
                        {"x": x - tick, "x2": x + tick, "y": y1},
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
                        "fontSize": 11,
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
    color = a.get("color") or "#14271d"
    sw = a.get("strokeWidth") or 1.6
    tip_size = a.get("tipSize") or 55
    x, y = float(a["x"]), float(a["y"])
    x2, y2 = float(a["x2"]), float(a["y2"])
    angle = math.degrees(math.atan2(y2 - y, x2 - x)) + 90
    layers: list[dict[str, Any]] = [
        {
            "data": {"values": [{"x": x, "y": y, "x2": x2, "y2": y2}]},
            "mark": {"type": "rule", "strokeWidth": sw, "color": color, "strokeCap": "round"},
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
                        {"x": (x + x2) / 2, "y": (y + y2) / 2, "label": a["label"]}
                    ]
                },
                "mark": {
                    "type": "text",
                    "dy": -8,
                    "fontSize": 11,
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


def take_annotations(spec: dict[str, Any]) -> tuple[dict[str, Any], list[Annotation]]:
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
