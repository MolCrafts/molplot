"""Typed Vega-Lite AST + normalization — the interpreter frontend.

Turns a raw Vega-Lite dict into an immutable list of :class:`Unit` (one per
layer), each carrying the encoding it should draw with (top-level channels
merged with the layer's own overrides), its inline data rows, its mark type and
properties, and any transforms. This is the *only* module that understands
Vega-Lite's structure — layering and channel inheritance; everything downstream
sees a flat, field-name-agnostic ``Unit``.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

# Sentinel: distinguishes "no value channel / no constant" from an explicit None.
_UNSET: Any = object()


@dataclass(frozen=True)
class Scale:
    """A resolved Vega-Lite ``scale`` object (positional, colour, or size)."""

    type: str | None = None
    domain: list | None = None
    range: list | None = None
    scheme: str | None = None
    zero: bool | None = None
    padding_inner: float | None = None

    @classmethod
    def parse(cls, raw: Any) -> "Scale | None":
        if not isinstance(raw, dict):
            return None
        dom = raw.get("domain")
        rng = raw.get("range")
        return cls(
            type=raw.get("type"),
            domain=list(dom) if isinstance(dom, (list, tuple)) else None,
            range=list(rng) if isinstance(rng, (list, tuple)) else None,
            scheme=raw.get("scheme"),
            zero=raw.get("zero"),
            padding_inner=raw.get("paddingInner"),
        )


@dataclass(frozen=True)
class Channel:
    """A resolved encoding channel (``x``, ``color``, ``opacity``, …)."""

    name: str
    field: str | None = None
    type: str | None = None
    scale: Scale | None = None
    axis_title: str | None = None
    legend: Any = None
    sort: tuple | None = None
    stack: bool | None = None
    value: Any = _UNSET

    @property
    def wants_legend(self) -> bool:
        """Vega shows a legend/colourbar only when ``legend`` is non-null."""
        return self.legend is not None

    @property
    def is_value(self) -> bool:
        """True for a constant channel like ``{"value": 0.65}``."""
        return self.value is not _UNSET

    @classmethod
    def parse(cls, name: str, raw: Any) -> "Channel":
        if not isinstance(raw, dict):
            return cls(name=name)
        axis = raw.get("axis")
        sort = raw.get("sort")
        return cls(
            name=name,
            field=raw.get("field"),
            type=raw.get("type"),
            scale=Scale.parse(raw.get("scale")),
            axis_title=axis.get("title") if isinstance(axis, dict) else None,
            legend=raw.get("legend"),
            sort=tuple(sort) if isinstance(sort, (list, tuple)) else None,
            stack=raw.get("stack"),
            value=raw.get("value", _UNSET),
        )


@dataclass(frozen=True)
class Unit:
    """One drawable view: a mark plus the channels and rows that feed it."""

    mark: str | None
    mark_props: dict
    encoding: dict  # channel name -> Channel
    rows: tuple  # inline data rows (dicts)
    transforms: tuple  # raw Vega-Lite transform dicts


def _mark_of(node: dict) -> tuple[str | None, dict]:
    mark = node.get("mark")
    if isinstance(mark, dict):
        return mark.get("type"), dict(mark)
    return mark, {}


def _rows_of(node: dict, inherited: tuple) -> tuple:
    data = node.get("data")
    if isinstance(data, dict) and isinstance(data.get("values"), list):
        return tuple(data["values"])
    return inherited


def _encoding_of(raw: dict | None) -> dict:
    return {name: Channel.parse(name, ch) for name, ch in (raw or {}).items()}


def normalize(spec: dict) -> list[Unit]:
    """Flatten a Vega-Lite spec into drawable units.

    A ``layer`` spec yields one unit per layer, each inheriting the spec's
    top-level ``encoding`` and ``data`` (its own channels win). A single-view
    spec yields one unit. Handles both shapes MolPlot emits: layered line specs
    and top-level scatter / bar / gantt specs.
    """
    top_rows = _rows_of(spec, ())
    top_enc_raw = spec.get("encoding") or {}
    layers = spec.get("layer")
    if isinstance(layers, list):
        units: list[Unit] = []
        for layer in layers:
            merged = {**top_enc_raw, **(layer.get("encoding") or {})}
            mark, props = _mark_of(layer)
            units.append(
                Unit(
                    mark=mark,
                    mark_props=props,
                    encoding=_encoding_of(merged),
                    rows=_rows_of(layer, top_rows),
                    transforms=tuple(layer.get("transform") or ()),
                )
            )
        return units
    mark, props = _mark_of(spec)
    return [
        Unit(
            mark=mark,
            mark_props=props,
            encoding=_encoding_of(top_enc_raw),
            rows=top_rows,
            transforms=tuple(spec.get("transform") or ()),
        )
    ]
