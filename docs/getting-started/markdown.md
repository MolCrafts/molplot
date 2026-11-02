# Markdown

A methods note should show the figure it is talking about, not a screenshot
that goes stale. A fenced block on this site is a live chart: pan and zoom
work, and the look follows the [preset](preset.md).

````markdown
```molplot
mark: line
data:
  sequence: {start: 0, stop: 61, step: 1, as: t}
transform:
  - calculate: "1 - exp(0 - datum.t / 8)"
    as: conversion
encoding:
  x: {field: t, type: quantitative, title: x}
  y: {field: conversion, type: quantitative, title: y}
```
````

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

Header options: `preset`, `theme`, `width`, `aspect`. Interaction is on unless
you set `interactive="false"`.

In an app, register the element with `import "@molcrafts/molplot/elements"`.
