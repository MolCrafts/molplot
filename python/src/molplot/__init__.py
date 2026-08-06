"""MolPlot — unified scientific charting for the MolCrafts stack.

Two renderers, one preset, one intermediate language:

* **Web** — ``@molcrafts/molplot`` (TypeScript) renders Vega-Lite via vega-embed.
* **Paper** — this package wraps **scienceplots** and injects the same unified
  preset into matplotlib, then renders the *same Vega-Lite spec* to a figure.

The Vega-Lite JSON spec is the portable interchange format: build it here with
:func:`line_spec` / :func:`scatter_spec` / :func:`bar_spec` / :func:`gantt_spec`,
then either ship it to the browser or render it to matplotlib with
:func:`render` (or one-call :func:`line` / :func:`scatter` / :func:`bar` /
:func:`gantt`).

Quick start::

    import molplot
    molplot.use("molplot")                 # scienceplots + unified preset
    fig, ax = molplot.line([{ "id": "e", "x": xs, "y": ys }])
"""

from __future__ import annotations

from .charts import bar, gantt, line, scatter
from .convert import to_png, to_svg
from .palette import color, cycle, default_color, diverging, palette, sequential
from .preset import DEFAULT_PRESET, PRESET_NAMES, get_preset, rc_params, resolve
from .render import render
from .specs import VL_SCHEMA, bar_spec, gantt_spec, line_spec, scatter_spec
from .style import available, register, science_base, style, use
from .vega_config import vega_config

__version__ = "0.1.4"

# Register the generated *.mplstyle files so `plt.style.use("molplot")` works.
register()

__all__ = [
    "__version__",
    # style
    "use",
    "style",
    "available",
    "register",
    "science_base",
    # preset / tokens
    "get_preset",
    "resolve",
    "rc_params",
    "DEFAULT_PRESET",
    "PRESET_NAMES",
    # palette
    "palette",
    "cycle",
    "color",
    "default_color",
    "sequential",
    "diverging",
    # intermediate language (Vega-Lite spec builders)
    "line_spec",
    "scatter_spec",
    "bar_spec",
    "gantt_spec",
    "vega_config",
    "VL_SCHEMA",
    # render
    "render",
    "line",
    "scatter",
    "bar",
    "gantt",
    # exact web-parity export
    "to_png",
    "to_svg",
]
