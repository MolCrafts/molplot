"""scienceplots wrapper + unified-preset injection.

``molplot.use()`` / ``molplot.style()`` apply the scienceplots base styles named
by the preset (``science``, ``nature``, …) and then overlay the MolPlot tokens
(:func:`molplot.preset.rc_params`). The overlay is what makes a scienceplots
figure share its palette, type scale, and grid with the Vega-Lite web renderer.

The generated ``*.mplstyle`` files are also registered with matplotlib's style
library, so ``plt.style.use("molplot")`` works directly (without the
scienceplots base) for users who want just the tokens.
"""

from __future__ import annotations

import contextlib
from pathlib import Path
from typing import Any, Iterator

from .preset import DEFAULT_PRESET, Mode, get_preset, rc_params

__all__ = ["use", "style", "available", "register", "science_base"]

_PRESETS_DIR = Path(__file__).parent / "presets"
_registered = False


def _ensure_scienceplots() -> bool:
    """Import scienceplots so its styles register. Returns False if absent."""
    try:
        import scienceplots  # noqa: F401

        return True
    except ImportError:
        return False


def register() -> None:
    """Register the generated ``*.mplstyle`` files with matplotlib (idempotent)."""
    global _registered
    if _registered:
        return
    # Read each generated style file into an ``RcParams`` via the stable public
    # ``matplotlib.rc_params_from_file`` (``use_default_template=False`` keeps only
    # the file's own keys). This mirrors what matplotlib's own — private and
    # version-unstable — ``style.core.read_style_directory`` does, without
    # importing it (it was removed in newer matplotlib).
    import matplotlib as mpl
    import matplotlib.style as mstyle

    styles = {
        path.stem: mpl.rc_params_from_file(path, use_default_template=False)
        for path in sorted(_PRESETS_DIR.glob("*.mplstyle"))
    }
    mstyle.library.update(styles)
    mstyle.available[:] = sorted(mstyle.library.keys())
    _registered = True


def science_base(name: str = DEFAULT_PRESET) -> list[str]:
    """The scienceplots base style names layered under a preset's overlay."""
    base = list(get_preset(name)["sciencePlotsBase"])
    return base if _ensure_scienceplots() else []


def _style_stack(name: str, mode: Mode) -> list[Any]:
    """[*scienceplots base names, molplot rc overlay dict] for plt.style APIs."""
    register()
    return [*science_base(name), rc_params(name, mode)]


def use(name: str = DEFAULT_PRESET, mode: Mode = "light") -> None:
    """Apply a preset persistently (scienceplots base + MolPlot overlay).

    >>> import molplot
    >>> molplot.use("molplot")          # default
    >>> molplot.use("molplot-paper")    # serif, high-DPI, nature base
    >>> molplot.use("molplot", mode="dark")
    """
    import matplotlib.pyplot as plt

    plt.style.use(_style_stack(name, mode))


@contextlib.contextmanager
def style(name: str = DEFAULT_PRESET, mode: Mode = "light") -> Iterator[None]:
    """Scoped preset — restores the previous rcParams on exit.

    >>> with molplot.style("molplot-paper"):
    ...     ax.plot(x, y)
    """
    import matplotlib.pyplot as plt

    with plt.style.context(_style_stack(name, mode)):
        yield


def available() -> list[str]:
    """Preset names usable with :func:`use` / :func:`style`."""
    from .preset import PRESET_NAMES

    return list(PRESET_NAMES)
