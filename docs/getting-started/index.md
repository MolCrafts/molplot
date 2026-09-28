# Getting Started

A chart in a dashboard and the same chart in a paper should be the same
drawing. In practice they are not: the web stack picks one palette and type,
matplotlib another, and you restyle by hand before submission.

MolPlot is one description of a chart that both surfaces honor. The browser
draws it live; Python draws it for print. Colour, type, and grid come from the
same [preset](preset.md).

```sh
pip install molcrafts-molplot
npm install @molcrafts/molplot
```

Start in Python — that is the shortest path to a figure:

```python
import molplot

fig, ax = molplot.line(
    [{"id": "A", "x": t, "y": conv_a}, {"id": "B", "x": t, "y": conv_b}],
    x_label="x",
    y_label="y",
    show_legend=True,
)
```

The line below is that chart. Drag to pan; wheel an axis to zoom that
axis; Shift+wheel zooms both; double-click resets.

<figure id="fig-kinetics" class="molcrafts-figure" markdown>
<div class="molcrafts-figure__body molcrafts-figure__body--chart" markdown>

```molplot preset="molplot-paper" theme="auto" width="100%" aspect="16:10"
data:
  sequence: {start: 0, stop: 61, step: 1, as: t}
transform:
  - calculate: "1 - exp(0 - datum.t / 8)"
    as: catA
  - calculate: "1 - exp(0 - datum.t / 24)"
    as: blank
  - fold: [catA, blank]
    as: [key, conversion]
  - calculate: "datum.key === 'catA' ? 'A' : 'B'"
    as: series
encoding:
  x:
    field: t
    type: quantitative
    title: x
    scale: {domain: [0, 60], nice: false, zero: true}
    axis: {values: [0, 10, 20, 30, 40, 50, 60]}
  y:
    field: conversion
    type: quantitative
    title: y
    scale: {domain: [0, 1.05], nice: false, zero: true}
  color:
    field: series
    type: nominal
    scale:
      domain: ["A", "B"]
      range: ["#0c5da5", "#00b945"]
    legend: {title: null, orient: top-left, offset: 4, symbolType: stroke}
layer:
  - transform: [{filter: {field: series, equal: "A"}}]
    mark: {type: line, strokeWidth: 1.5, clip: true}
  - transform: [{filter: {field: series, equal: "B"}}]
    mark: {type: line, strokeWidth: 1.5, strokeDash: [5, 3], clip: true}
```

</div>

**Line**

</figure>

From here:

- [Gallery](gallery.md) — every chart type, grouped like matplotlib's examples
- [Python](python.md) — style, scatter / bar / Gantt, export
- [Web](web.md) — a pane that can stream points
- [Markdown](markdown.md) — a live chart inside a document
- [Workbench](workbench.md) — open a matplotlib script and export PDF / SVG / PNG
- [Preset](preset.md) — why screen and paper share a look
