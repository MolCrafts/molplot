# Python

You already have matplotlib. What is missing is a look that matches the web
pane, and a way to hand the same chart to the browser without redrawing it.

```sh
pip install molcrafts-molplot
```

`use()` puts the shared palette and type on matplotlib (and the scienceplots
base the preset names). Then one call draws a figure:

```python
import molplot

molplot.use("molplot")

fig, ax = molplot.line(
    [{"id": "A", "x": t, "y": conv}],
    x_label="x",
    y_label="y",
    show_legend=True,
)
```

`molplot-paper` is the journal variant. A `with molplot.style(...)` block
applies a look only inside the block.

Scatter, bar, and Gantt are the same shape of call. When you want a description
you can ship to the browser, build it first and then render:

```python
spec = molplot.scatter_spec(pc1, pc2, color=cluster, colorscale="viridis")
fig, ax = molplot.render(spec)
```

Exact web pixels (optional): `pip install "molcrafts-molplot[convert]"`, then
`molplot.to_png(spec, "fig.png")`.

To inspect an existing matplotlib script instead of rewriting it, open the
[workbench](workbench.md):

```sh
molplot serve script.py
```

Names and options: [API](../api/python.md).
