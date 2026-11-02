---
title: MolPlot
description: Scientific charts that look the same on the web and on paper.
hide:
  - navigation
  - toc
hero:
  kicker: MolPlot Manual
  title: MolPlot
  description: The same figure in a dashboard and in a journal.
  install:
    label: Install
    methods:
      - { label: npm, command: "npm install @molcrafts/molplot" }
      - { label: pip, command: "pip install molcrafts-molplot" }
  badges:
    - img: https://img.shields.io/npm/v/@molcrafts/molplot?color=4f46e5&label=npm
      href: https://www.npmjs.com/package/@molcrafts/molplot
      alt: npm version
    - img: https://img.shields.io/pypi/v/molcrafts-molplot?color=4f46e5&label=pypi
      href: https://pypi.org/project/molcrafts-molplot/
      alt: PyPI version
    - img: https://img.shields.io/badge/license-BSD--3--Clause-blue.svg
      href: https://github.com/MolCrafts/molplot/blob/master/LICENSE
      alt: License BSD-3-Clause
  actions:
    - label: Get started
      href: getting-started/
      style: primary
    - label: Gallery
      href: getting-started/gallery/
    - label: API
      href: api/
---

<h1 class="molcrafts-sr-only">MolPlot</h1>

<div class="molcrafts-manual-home" markdown>

<section class="molcrafts-manual-section molcrafts-manual-section--stack" markdown>

<div class="molcrafts-figure-grid" markdown>

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

<figure id="fig-rdf" class="molcrafts-figure" markdown>
<div class="molcrafts-figure__body molcrafts-figure__body--chart" markdown>

```molplot preset="molplot-paper" theme="auto" width="100%" aspect="16:10"
data:
  sequence: {start: 0, stop: 61, step: 1, as: x}
transform:
  - calculate: "0.55 + 0.28 * sin(datum.x / 7)"
    as: y
  - calculate: "datum.y - 0.2"
    as: lo
  - calculate: "datum.y + 0.2"
    as: hi
encoding:
  x:
    field: x
    type: quantitative
    title: x
    scale: {domain: [0, 60], nice: false, zero: true}
  y:
    field: y
    type: quantitative
    title: y
    scale: {domain: [0, 1.15], nice: false, zero: true}
layer:
  - mark: {type: area, opacity: 0.45, color: "#0c5da5", clip: true}
    encoding:
      y: {field: lo, type: quantitative}
      y2: {field: hi}
  - mark: {type: line, strokeWidth: 2, color: "#0c5da5", interpolate: monotone, clip: true}
    encoding:
      y: {field: y, type: quantitative}
```

</div>

**Confidence band**

</figure>

<figure id="fig-pca" class="molcrafts-figure" markdown>
<div class="molcrafts-figure__body molcrafts-figure__body--chart" markdown>

```molplot preset="molplot-paper" theme="auto" width="100%" aspect="16:10"
data:
  sequence: {start: 0, stop: 72, step: 1, as: i}
transform:
  - calculate: "datum.i < 28 ? 'A' : datum.i < 50 ? 'B' : 'C'"
    as: cluster
  - calculate: "datum.cluster === 'A' ? -2.15 : datum.cluster === 'B' ? 0.05 : 2.05"
    as: mx
  - calculate: "datum.cluster === 'A' ? 1.35 : datum.cluster === 'B' ? -0.55 : 1.15"
    as: my
  - calculate: "datum.mx + 0.42 * sin(datum.i * 1.73) + 0.22 * cos(datum.i * 2.91)"
    as: pc1
  - calculate: "datum.my + 0.34 * cos(datum.i * 1.19) + 0.18 * sin(datum.i * 3.31)"
    as: pc2
  - calculate: "(datum.cluster === 'A' ? 1.1 : datum.cluster === 'B' ? 2.8 : 4.4) + 0.35 * pow(datum.pc1 - datum.mx, 2)"
    as: energy
  - calculate: "max(4, 18 + 12 * sin(datum.i * 0.7))"
    as: population
encoding:
  x:
    field: pc1
    type: quantitative
    title: x
    scale: {zero: false}
  y:
    field: pc2
    type: quantitative
    title: y
    scale: {zero: false}
  color:
    field: energy
    type: quantitative
    title: color
    scale: {scheme: viridis, reverse: true}
  size:
    field: population
    type: quantitative
    title: size
    scale: {range: [30, 280]}
  shape:
    field: cluster
    type: nominal
    title: group
mark:
  type: point
  filled: true
  opacity: 0.88
  stroke: white
  strokeWidth: 0.6
```

</div>

**Scatter**

</figure>

<figure id="fig-rb-heat" class="molcrafts-figure" markdown>
<div class="molcrafts-figure__body molcrafts-figure__body--chart" markdown>

```molplot preset="molplot-paper" theme="auto" width="100%" aspect="1:1"
data:
  sequence: {start: 0, stop: 2704, step: 1, as: i}
transform:
  - calculate: "datum.i % 52"
    as: ix
  - calculate: "floor(datum.i / 52)"
    as: iy
  - calculate: "-2 + 4 * datum.ix / 51"
    as: x
  - calculate: "-1 + 4 * datum.iy / 51"
    as: y
  - calculate: "pow(1 - datum.x, 2) + 100 * pow(datum.y - datum.x * datum.x, 2)"
    as: z
  - calculate: "log(1 + datum.z)"
    as: lz
mark: {type: square, opacity: 0.95, strokeWidth: 0}
encoding:
  x:
    field: x
    type: quantitative
    title: x
    scale: {zero: false, nice: false}
    axis: {tickCount: 5}
  y:
    field: y
    type: quantitative
    title: y
    scale: {zero: false, nice: false}
    axis: {tickCount: 5}
  color:
    field: lz
    type: quantitative
    title: z
    scale: {scheme: viridis}
  size: {value: 42}
```

</div>

**Heatmap**

</figure>

</div>

<figure id="fig-rb-3d" class="molcrafts-figure" markdown>
<div class="molcrafts-figure__body molcrafts-figure__body--chart" markdown>

```molplot preset="molplot-paper" theme="auto" width="100%" aspect="16:9"
data:
  sequence: {start: 0, stop: 2304, step: 1, as: i}
transform:
  - calculate: "datum.i % 48"
    as: ix
  - calculate: "floor(datum.i / 48)"
    as: iy
  - calculate: "-2 + 4 * datum.ix / 47"
    as: x
  - calculate: "-1 + 4 * datum.iy / 47"
    as: y
  - calculate: "pow(1 - datum.x, 2) + 100 * pow(datum.y - datum.x * datum.x, 2)"
    as: z
  - calculate: "log(1 + datum.z)"
    as: lz
  - calculate: "datum.x + 0.55 * datum.y"
    as: u
  - calculate: "0.42 * datum.y + 0.55 * datum.lz"
    as: v
layer:
  - mark: {type: square, size: 36, opacity: 0.92, strokeWidth: 0, clip: true}
    encoding:
      x: {field: u, type: quantitative, title: null, axis: {title: null, labels: false, ticks: false, domain: false, grid: true}}
      y: {field: v, type: quantitative, title: null, axis: {title: null, labels: false, ticks: false, domain: false, grid: true}}
      color: {field: lz, type: quantitative, title: z, scale: {scheme: viridis}}
  - mark: {type: line, strokeWidth: 0.35, opacity: 0.22, clip: true}
    encoding:
      x: {field: u, type: quantitative}
      y: {field: v, type: quantitative}
      detail: {field: iy, type: nominal}
      order: {field: ix, type: quantitative}
      color: {value: "#14271d"}
```

</div>

**3D surface**

</figure>

</section>

</div>
