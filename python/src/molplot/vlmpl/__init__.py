"""Vega-Lite → matplotlib interpreter.

A small tree-walking interpreter whose *source language* is Vega-Lite and whose
*target machine* is matplotlib. Four passes, each a classic compiler stage:

1. :mod:`.model` — normalize the raw spec into a typed, immutable AST (frontend).
2. :mod:`.scales` — bind scales: colour maps, numeric maps, positional axes.
3. :mod:`.marks` — dispatch each mark to an encoder that emits artists (codegen).
4. :mod:`.axes` — finalize titles, scales, and legend (link).

The public entry is :func:`molplot.render`.
"""

from __future__ import annotations

from .interp import render

__all__ = ["render"]
