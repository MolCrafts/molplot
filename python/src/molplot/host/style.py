"""Workbench style catalog and matplotlib rc overlay.

Host-only: not Core Scene, not an Engine command. The workbench lists MolPlot
presets, optional scienceplots / seaborn styles, and a curated matplotlib rc
subset as Custom. Missing packages stay listed but ``available: false`` with
an install hint — the user installs them in this Python environment.
"""

from __future__ import annotations

import importlib
import shutil
import subprocess
from typing import Any

from matplotlib.colors import to_hex
from matplotlib.font_manager import font_scalings

from molplot.preset import PRESET_NAMES, PRESETS

SCRIPT_SOURCE = "script"
CUSTOM_SOURCE = "custom"

INSTALL_HINTS = {
    "scienceplots": "Install scienceplots in this Python environment (`pip install scienceplots`).",
    "seaborn": "Install seaborn in this Python environment (`pip install seaborn`).",
}

LATEX_HINT = (
    "Matplotlib TeX needs type1cm.sty, which TeX Live basic does not ship. "
    "Install with `tlmgr install type1cm`, or leave TeX off. "
    "scienceplots styles then use no-latex."
)

SCIENCEPLOTS_STYLES = (
    "science",
    "no-latex",
    "ieee",
    "nature",
    "elsevier",
    "aip",
    "aps",
    "rsc",
    "notebook",
    "grid",
    "scatter",
    "high-vis",
    "bright",
    "vibrant",
    "muted",
    "retro",
    "high-contrast",
    "light",
    "sans",
    "latex-sans",
)

SEABORN_STYLES = ("darkgrid", "whitegrid", "dark", "white", "ticks")

_LINESTYLE_FROM_RC = {
    "-": "solid",
    "--": "dashed",
    "-.": "dashdot",
    ":": "dotted",
    "solid": "solid",
    "dashed": "dashed",
    "dashdot": "dashdot",
    "dotted": "dotted",
}
_LINESTYLE_TO_RC = {
    "solid": "-",
    "dashed": "--",
    "dashdot": "-.",
    "dotted": ":",
}

_RC_KEYS = frozenset(
    {
        "figureWidth",
        "figureHeight",
        "dpi",
        "figureFace",
        "axesFace",
        "axesEdge",
        "axesLineWidth",
        "grid",
        "titleSize",
        "labelSize",
        "labelColor",
        "fontFamily",
        "fontSize",
        "fontWeight",
        "fontStyle",
        "textColor",
        "usetex",
        "lineWidth",
        "lineStyle",
        "markerSize",
        "tickSize",
        "tickDirection",
        "tickColor",
        "gridColor",
        "gridStyle",
        "gridWidth",
        "gridAlpha",
        "legendSize",
        "legendFrame",
        "cmap",
        "savefigBbox",
        "palette",
    }
)


class StyleError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def module_available(name: str) -> bool:
    try:
        importlib.import_module(name)
    except ImportError:
        return False
    return True


def latex_usable() -> bool:
    """True when matplotlib usetex can run (latex + type1cm.sty)."""
    if not shutil.which("latex"):
        return False
    kpsewhich = shutil.which("kpsewhich")
    if kpsewhich is None:
        return False
    try:
        found = subprocess.run(
            [kpsewhich, "type1cm.sty"],
            check=False,
            capture_output=True,
            text=True,
            timeout=5,
        )
    except (OSError, subprocess.TimeoutExpired):
        return False
    return bool(found.stdout.strip())


def is_latex_error(exc: BaseException) -> bool:
    message = str(exc).lower()
    return "latex" in message or "type1cm" in message or "usetex" in message


def disable_usetex() -> None:
    """Turn off matplotlib TeX, preferring scienceplots' no-latex overlay."""
    import matplotlib as mpl
    import matplotlib.pyplot as plt

    if "no-latex" in plt.style.library:
        plt.style.use("no-latex")
    mpl.rcParams["text.usetex"] = False


def _style_items(ids: tuple[str, ...] | list[str]) -> list[dict[str, str]]:
    return [{"id": item, "label": item} for item in ids]


def _molplot_styles() -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    for name in PRESET_NAMES:
        preset = PRESETS.get(name) or {}
        out.append({"id": name, "label": str(preset.get("label") or name)})
    return out


def _scienceplots_style_ids() -> list[str]:
    if not module_available("scienceplots"):
        return list(SCIENCEPLOTS_STYLES)
    import matplotlib.style as mstyle

    library = set(mstyle.library)
    return [name for name in SCIENCEPLOTS_STYLES if name in library]


def catalog() -> dict[str, Any]:
    """JSON-friendly source list for GET /api/result extras."""
    science_ok = module_available("scienceplots")
    seaborn_ok = module_available("seaborn")
    tex_ok = latex_usable()
    science_hint = None
    if not science_ok:
        science_hint = INSTALL_HINTS["scienceplots"]
    elif not tex_ok:
        science_hint = LATEX_HINT
    return {
        "latex": {
            "available": tex_ok,
            "hint": None if tex_ok else LATEX_HINT,
        },
        "sources": [
            {
                "id": SCRIPT_SOURCE,
                "label": "Figure script",
                "available": True,
                "hint": None,
                "styles": [{"id": SCRIPT_SOURCE, "label": "As written"}],
            },
            {
                "id": "molplot",
                "label": "MolPlot",
                "available": True,
                "hint": None,
                "styles": _molplot_styles(),
            },
            {
                "id": "scienceplots",
                "label": "scienceplots",
                "available": science_ok,
                "hint": science_hint,
                "styles": _style_items(_scienceplots_style_ids()),
            },
            {
                "id": "seaborn",
                "label": "seaborn",
                "available": seaborn_ok,
                "hint": None if seaborn_ok else INSTALL_HINTS["seaborn"],
                "styles": _style_items(list(SEABORN_STYLES)),
            },
            {
                "id": CUSTOM_SOURCE,
                "label": "Custom",
                "available": True,
                "hint": None,
                "styles": [{"id": CUSTOM_SOURCE, "label": "matplotlib rc"}],
            },
        ],
        "rc": read_rc(),
    }


def _hex(color: Any, fallback: str = "#000000") -> str:
    if color in (None, "auto", "none", "inherit"):
        return fallback
    try:
        return to_hex(color, keep_alpha=False).lower()
    except (ValueError, TypeError):
        return fallback


def _pt(value: Any) -> float:
    import matplotlib as mpl

    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value)
    scale = font_scalings.get(str(value))
    if scale is not None:
        return float(mpl.rcParams["font.size"]) * float(scale)
    try:
        return float(value)
    except (TypeError, ValueError):
        return float(mpl.rcParams["font.size"])


def _linestyle(value: Any) -> str:
    if isinstance(value, str):
        return _LINESTYLE_FROM_RC.get(value, "solid")
    return "solid"


def _font_family() -> str:
    import matplotlib as mpl

    fam = mpl.rcParams["font.family"]
    if isinstance(fam, (list, tuple)):
        fam = fam[0] if fam else "sans-serif"
    return str(fam)


def _palette() -> list[str]:
    import matplotlib as mpl

    cycle = mpl.rcParams["axes.prop_cycle"]
    colors = cycle.by_key().get("color", [])
    return [_hex(item) for item in colors]


def _dpi() -> float:
    import matplotlib as mpl

    value = mpl.rcParams["savefig.dpi"]
    if value == "figure" or value is None:
        return float(mpl.rcParams["figure.dpi"])
    return float(value)


def read_rc() -> dict[str, Any]:
    """Curated matplotlib rc snapshot (JSON-friendly camelCase)."""
    import matplotlib as mpl

    size = mpl.rcParams["figure.figsize"]
    bbox = mpl.rcParams["savefig.bbox"]
    return {
        "figureWidth": float(size[0]),
        "figureHeight": float(size[1]),
        "dpi": _dpi(),
        "figureFace": _hex(mpl.rcParams["figure.facecolor"], "#ffffff"),
        "axesFace": _hex(mpl.rcParams["axes.facecolor"], "#ffffff"),
        "axesEdge": _hex(mpl.rcParams["axes.edgecolor"]),
        "axesLineWidth": float(mpl.rcParams["axes.linewidth"]),
        "grid": bool(mpl.rcParams["axes.grid"]),
        "titleSize": _pt(mpl.rcParams["axes.titlesize"]),
        "labelSize": _pt(mpl.rcParams["axes.labelsize"]),
        "labelColor": _hex(mpl.rcParams["axes.labelcolor"]),
        "fontFamily": _font_family(),
        "fontSize": float(mpl.rcParams["font.size"]),
        "fontWeight": str(mpl.rcParams["font.weight"]),
        "fontStyle": str(mpl.rcParams["font.style"]),
        "textColor": _hex(mpl.rcParams["text.color"]),
        "usetex": bool(mpl.rcParams["text.usetex"]),
        "lineWidth": float(mpl.rcParams["lines.linewidth"]),
        "lineStyle": _linestyle(mpl.rcParams["lines.linestyle"]),
        "markerSize": float(mpl.rcParams["lines.markersize"]),
        "tickSize": _pt(mpl.rcParams["xtick.labelsize"]),
        "tickDirection": str(mpl.rcParams["xtick.direction"]),
        "tickColor": _hex(mpl.rcParams["xtick.color"]),
        "gridColor": _hex(mpl.rcParams["grid.color"], "#b0b0b0"),
        "gridStyle": _linestyle(mpl.rcParams["grid.linestyle"]),
        "gridWidth": float(mpl.rcParams["grid.linewidth"]),
        "gridAlpha": float(mpl.rcParams["grid.alpha"]),
        "legendSize": _pt(mpl.rcParams["legend.fontsize"]),
        "legendFrame": bool(mpl.rcParams["legend.frameon"]),
        "cmap": str(mpl.rcParams["image.cmap"]),
        "savefigBbox": "tight" if bbox == "tight" else "standard",
        "palette": _palette(),
    }


def _looks_serif(family: str) -> bool:
    primary = family.split(",")[0].strip().lower()
    if "sans" in primary:
        return False
    return any(
        token in primary
        for token in ("serif", "times", "roman", "georgia", "garamond", "nimbus")
    )


def _set_font_family(name: str) -> None:
    import matplotlib as mpl

    primary = name.split(",")[0].strip() or "sans-serif"
    generic = primary.lower()
    if generic in {"sans-serif", "serif", "monospace", "cursive", "fantasy"}:
        mpl.rcParams["font.family"] = generic
        return
    serif = _looks_serif(primary)
    mpl.rcParams["font.family"] = "serif" if serif else "sans-serif"
    key = "font.serif" if serif else "font.sans-serif"
    mpl.rcParams[key] = [primary]


def apply_custom(rc: dict[str, Any] | None) -> None:
    """Apply the curated rc overlay on top of the current matplotlibrc."""
    import matplotlib as mpl
    from cycler import cycler

    data = read_rc()
    if rc:
        for key, value in rc.items():
            if key in _RC_KEYS:
                data[key] = value
    mpl.rcParams["figure.figsize"] = (
        float(data["figureWidth"]),
        float(data["figureHeight"]),
    )
    dpi = float(data["dpi"])
    mpl.rcParams["figure.dpi"] = dpi
    mpl.rcParams["savefig.dpi"] = dpi
    mpl.rcParams["figure.facecolor"] = str(data["figureFace"])
    mpl.rcParams["savefig.facecolor"] = str(data["figureFace"])
    mpl.rcParams["axes.facecolor"] = str(data["axesFace"])
    mpl.rcParams["axes.edgecolor"] = str(data["axesEdge"])
    mpl.rcParams["axes.linewidth"] = float(data["axesLineWidth"])
    mpl.rcParams["axes.grid"] = bool(data["grid"])
    mpl.rcParams["axes.titlesize"] = float(data["titleSize"])
    mpl.rcParams["axes.labelsize"] = float(data["labelSize"])
    mpl.rcParams["axes.labelcolor"] = str(data["labelColor"])
    _set_font_family(str(data["fontFamily"]))
    mpl.rcParams["font.size"] = float(data["fontSize"])
    mpl.rcParams["font.weight"] = str(data["fontWeight"])
    mpl.rcParams["font.style"] = str(data["fontStyle"])
    mpl.rcParams["text.color"] = str(data["textColor"])
    want_tex = bool(data["usetex"])
    if want_tex and not latex_usable():
        raise StyleError("not_editable", LATEX_HINT)
    mpl.rcParams["text.usetex"] = want_tex
    mpl.rcParams["lines.linewidth"] = float(data["lineWidth"])
    mpl.rcParams["lines.linestyle"] = _LINESTYLE_TO_RC.get(str(data["lineStyle"]), "-")
    mpl.rcParams["lines.markersize"] = float(data["markerSize"])
    tick_size = float(data["tickSize"])
    mpl.rcParams["xtick.labelsize"] = tick_size
    mpl.rcParams["ytick.labelsize"] = tick_size
    direction = str(data["tickDirection"])
    mpl.rcParams["xtick.direction"] = direction
    mpl.rcParams["ytick.direction"] = direction
    tick_color = str(data["tickColor"])
    mpl.rcParams["xtick.color"] = tick_color
    mpl.rcParams["ytick.color"] = tick_color
    mpl.rcParams["grid.color"] = str(data["gridColor"])
    mpl.rcParams["grid.linestyle"] = _LINESTYLE_TO_RC.get(str(data["gridStyle"]), "-")
    mpl.rcParams["grid.linewidth"] = float(data["gridWidth"])
    mpl.rcParams["grid.alpha"] = float(data["gridAlpha"])
    mpl.rcParams["legend.fontsize"] = float(data["legendSize"])
    mpl.rcParams["legend.frameon"] = bool(data["legendFrame"])
    mpl.rcParams["image.cmap"] = str(data["cmap"])
    mpl.rcParams["savefig.bbox"] = "tight" if data["savefigBbox"] == "tight" else None
    palette = data.get("palette") or []
    colors = [str(item) for item in palette if item]
    if colors:
        mpl.rcParams["axes.prop_cycle"] = cycler(color=colors)


def reset_rc() -> None:
    import matplotlib as mpl

    mpl.rc_file_defaults()


def apply_source(source: str, name: str, rc: dict[str, Any] | None = None) -> None:
    """Reset matplotlibrc, then apply a named workbench style."""
    import matplotlib.pyplot as plt

    sources = {item["id"]: item for item in catalog()["sources"]}
    spec = sources.get(source)
    if spec is None:
        raise StyleError("invalid_value", f"Unknown style source {source!r}.")
    if not spec["available"]:
        raise StyleError("not_editable", spec["hint"] or f"{source} is not installed.")
    allowed = {item["id"] for item in spec["styles"]}
    if source != CUSTOM_SOURCE and name not in allowed:
        raise StyleError("invalid_value", f"Unknown {source} style {name!r}.")

    reset_rc()
    if source == SCRIPT_SOURCE:
        return
    if source == "molplot":
        import molplot

        molplot.use(name)
        return
    if source == "scienceplots":
        import matplotlib as mpl
        import scienceplots  # noqa: F401

        plt.style.use(name)
        if mpl.rcParams["text.usetex"] and not latex_usable():
            disable_usetex()
        return
    if source == "seaborn":
        import seaborn as sns

        if hasattr(sns, "set_theme"):
            sns.set_theme(style=name)
        else:  # pragma: no cover
            sns.set_style(name)
        return
    if source == CUSTOM_SOURCE:
        apply_custom(rc)
        return
    raise StyleError("invalid_value", f"Unknown style source {source!r}.")


def payload(current_source: str, current_name: str) -> dict[str, Any]:
    data = catalog()
    data["current"] = {"source": current_source, "name": current_name}
    return data
