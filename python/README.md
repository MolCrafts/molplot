# molcrafts-molplot

Unified scientific charting for the MolCrafts stack — the **Python / matplotlib**
half of [MolPlot](https://github.com/MolCrafts/molplot).

It wraps [scienceplots](https://github.com/garrettj403/SciencePlots) and injects
MolPlot's **unified preset** (palette, type scale, grid, light/dark) so a figure
made here matches the same preset rendered in the browser by the TypeScript
package `@molcrafts/molplot`.

The bridge between the two renderers is the **Vega-Lite spec** — a portable JSON
intermediate language. Build a spec in Python and either ship it to the web or
render it to matplotlib for a publication figure.

## Install

```sh
pip install molcrafts-molplot
# optional exact web-parity export (real Vega engine → PNG/SVG):
pip install "molcrafts-molplot[convert]"
```

## Style — scienceplots + unified preset

```python
import matplotlib.pyplot as plt
import molplot

molplot.use("molplot")            # scienceplots base + MolPlot overlay
# or a publication variant (serif, high-DPI, scienceplots 'nature' base):
molplot.use("molplot-paper")

with molplot.style("molplot", mode="dark"):
    plt.plot(x, y)                # scoped; restores rcParams on exit

molplot.palette()[0]              # '#0c5da5' — same categorical colours as the web
```

`plt.style.use("molplot")` also works directly (the `.mplstyle` files are
registered on import) — but `molplot.use()` additionally layers the scienceplots
base styles named by the preset.

## Charts — one call, or via the portable spec

```python
# one call → (fig, ax)
fig, ax = molplot.line(
    [{"id": "E_total", "x": steps, "y": e_total},
     {"id": "E_kin",   "x": steps, "y": e_kin}],
    x_label="step", y_label="energy (kcal/mol)", show_legend=True,
)

# or build the Vega-Lite spec and choose a renderer:
spec = molplot.scatter_spec(pc1, pc2, color=cluster_id, colorscale="viridis")
fig, ax = molplot.render(spec)     # matplotlib (scienceplots)
molplot.to_png(spec, "fig.png")    # exact web parity via vl-convert (optional)
import json; json.dumps(spec)      # ship the same spec to the browser
```

`line_spec` / `scatter_spec` / `bar_spec` / `gantt_spec` emit the same Vega-Lite
shapes as the TypeScript `@molcrafts/molplot` builders.

## License

BSD-3-Clause
