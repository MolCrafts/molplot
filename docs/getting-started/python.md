# Python (scienceplots)

```sh
pip install molcrafts-molplot
pip install "molcrafts-molplot[convert]"   # optional exact web-parity export
```

## Style

`use()` / `style()` apply the scienceplots base styles named by the preset and
overlay the MolPlot tokens, so a scienceplots figure gets the unified palette,
type scale, and grid.

```python
import matplotlib.pyplot as plt
import molplot

molplot.use("molplot")                 # persistent
molplot.use("molplot-paper")           # serif, high-DPI, 'nature' base
with molplot.style("molplot", mode="dark"):
    plt.plot(x, y)                     # scoped; restores on exit

molplot.palette()[0]                   # '#0c5da5' — same colours as the web
```

`plt.style.use("molplot")` also works directly (the `.mplstyle` files register
on import), without the scienceplots base.

## Charts and the portable spec

```python
# one call → (fig, ax)
fig, ax = molplot.bar(
    ["Q1", "Q2"], [{"id": "ok", "values": [8, 9]}, {"id": "fail", "values": [1, 2]}],
    mode_="stack", show_legend=True,
)

# or build the Vega-Lite spec, then choose a renderer
spec = molplot.scatter_spec(pc1, pc2, color=cluster, colorscale="viridis")
fig, ax = molplot.render(spec)         # matplotlib (scienceplots)
molplot.to_png(spec, "fig.png")        # exact web parity via vl-convert (optional)
```

`line_spec` / `scatter_spec` / `bar_spec` / `gantt_spec` emit the same Vega-Lite
shapes as the TypeScript builders — the spec is the interchange format.
