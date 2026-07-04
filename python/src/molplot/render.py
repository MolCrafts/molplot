"""Vega-Lite → matplotlib rendering — public entry point.

The implementation is the tree-walking interpreter in :mod:`molplot.vlmpl`
(normalize → bind scales → dispatch marks → finalize axes). This module keeps
the historical ``molplot.render`` import path stable.

Build one Vega-Lite spec with :mod:`molplot.specs` and render it in the browser
(vega-embed / RawChart) *or* here to a publication figure — the equivalence is
the whole point of routing through the Vega-Lite intermediate language. For
pixel-exact web parity of an arbitrary spec, use ``vl-convert`` via
:func:`molplot.to_png`.
"""

from __future__ import annotations

from .vlmpl import render

__all__ = ["render"]
