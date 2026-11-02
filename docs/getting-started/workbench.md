# Workbench

Most analysis scripts already end in `plt.savefig`. The workbench is for the
case where you want to inspect the live figure — move a legend, check a limit —
and export from the window instead of from the script.

```sh
molplot serve examples/figures/kinetics.py
```

The file should assign `fig` (or `figure` / `figs`, or just call `subplots`).
Do not `savefig`; PDF, SVG, and PNG are chosen in the UI. It opens at
`http://127.0.0.1:8765`.

```python
import numpy as np
import matplotlib.pyplot as plt

t = np.linspace(0, 60, 200)
fig, ax = plt.subplots(figsize=(3.4, 2.5))
ax.plot(t, 1 - np.exp(-t / 8), label="A")
ax.plot(t, 1 - np.exp(-t / 24), ls="--", label="B")
ax.set_xlabel("x")
ax.set_ylabel("y")
ax.legend(loc="lower right")
```

The left **Preset** tab restyles the live figure. MolPlot presets are always
available. scienceplots and seaborn are optional — install them in the same
Python environment as the host, or the source stays disabled with an install
hint. scienceplots' `science` style turns on matplotlib TeX; TeX Live basic is
missing `type1cm.sty`, so the workbench applies `no-latex` unless you
`tlmgr install type1cm`. Custom TeX is disabled with the same hint. Custom
also exposes the main matplotlib rc groups (figure, font, axes, lines, ticks,
grid, legend, colormap, save). The script is re-run after a style change, so
explicit kwargs in the file still win over rc defaults.

In this repo: `npm run example:kinetics`.
