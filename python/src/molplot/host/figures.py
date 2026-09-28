"""Load figure objects from a user script. The script must not export files."""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any


def kinetics_figure() -> Any:
    import numpy as np
    from matplotlib import pyplot as plt

    t = np.linspace(0, 60, 200)
    fast = 1 - np.exp(-t / 8)
    slow = 1 - np.exp(-t / 24)
    fig, ax = plt.subplots(figsize=(3.4, 2.5))
    ax.plot(t, fast, lw=1.4, label="Catalyst A")
    ax.plot(t, slow, lw=1.4, ls="--", label="Blank")
    ax.set_xlabel("Reaction time (min)")
    ax.set_ylabel("Conversion")
    ax.set_title("Reaction kinetics", fontsize=9)
    ax.set_xlim(0, 60)
    ax.set_ylim(0, 1.05)
    ax.legend(loc="lower right")
    fig.tight_layout()
    return fig


@contextmanager
def _ignore_savefig() -> Iterator[None]:
    from matplotlib import pyplot as plt
    from matplotlib.figure import Figure

    orig_fig = Figure.savefig
    orig_plt = plt.savefig

    def _noop(*_args: Any, **_kwargs: Any) -> None:
        return None

    Figure.savefig = _noop  # type: ignore[method-assign]
    plt.savefig = _noop
    try:
        yield
    finally:
        Figure.savefig = orig_fig
        plt.savefig = orig_plt


def collect_figures(
    ns: dict[str, Any], *, fignums: list[int] | None = None
) -> list[Any]:
    from matplotlib import pyplot as plt
    from matplotlib.figure import Figure

    out: list[Any] = []
    seen: set[int] = set()

    def add(fig: Any) -> None:
        if fig is None or not isinstance(fig, Figure):
            return
        key = id(fig)
        if key in seen:
            return
        seen.add(key)
        out.append(fig)

    figs = ns.get("figs")
    if isinstance(figs, (list, tuple)):
        for item in figs:
            add(item)
    add(ns.get("fig"))
    add(ns.get("figure"))
    nums = fignums if fignums is not None else list(plt.get_fignums())
    for num in nums:
        add(plt.figure(num))
    return out


def load_script(path: str) -> list[Any]:
    from pathlib import Path

    from matplotlib import pyplot as plt

    source = Path(path).read_text(encoding="utf-8")
    ns: dict[str, Any] = {"__name__": "__main__", "__file__": str(Path(path).resolve())}
    before = set(plt.get_fignums())
    with _ignore_savefig():
        exec(compile(source, str(path), "exec"), ns)
    created = [num for num in plt.get_fignums() if num not in before]
    figs = collect_figures(ns, fignums=created)
    if not figs:
        raise RuntimeError(
            f"{path} must provide a matplotlib Figure via fig, figure, figs, "
            "or plt.subplots(). Do not savefig; the workbench exports from the frontend."
        )
    return figs
