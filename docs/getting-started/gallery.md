# Gallery

<div class="molplot-gallery" markdown>

Examples of every chart MolPlot draws. Pan and zoom each figure. How to make
one: [Getting Started](index.md).

## Lines

<figure id="gal-line" class="molcrafts-figure" markdown>
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
    legend: {title: null, orient: top-left, symbolType: stroke}
layer:
  - transform: [{filter: {field: series, equal: "A"}}]
    mark: {type: line, strokeWidth: 1.5, clip: true}
  - transform: [{filter: {field: series, equal: "B"}}]
    mark: {type: line, strokeWidth: 1.5, strokeDash: [5, 3], clip: true}
```

</div>

**Two series, one dashed**

</figure>

<figure id="gal-points" class="molcrafts-figure" markdown>
<div class="molcrafts-figure__body molcrafts-figure__body--chart" markdown>

```molplot preset="molplot-paper" theme="auto" width="100%" aspect="16:10"
data:
  sequence: {start: 0, stop: 21, step: 1, as: step}
transform:
  - calculate: "exp(0 - datum.step / 7)"
    as: energy
mark: {type: line, point: true, strokeWidth: 1.4, clip: true}
encoding:
  x: {field: step, type: quantitative, title: x}
  y: {field: energy, type: quantitative, title: y}
```

</div>

**Line with markers**

</figure>

<figure id="gal-area" class="molcrafts-figure" markdown>
<div class="molcrafts-figure__body molcrafts-figure__body--chart" markdown>

```molplot preset="molplot-paper" theme="auto" width="100%" aspect="16:10"
data:
  sequence: {start: 0, stop: 61, step: 1, as: t}
transform:
  - calculate: "1 - exp(0 - datum.t / 12)"
    as: conversion
mark: {type: area, line: true, opacity: 0.35, clip: true, color: "#0c5da5"}
encoding:
  x: {field: t, type: quantitative, title: x, scale: {domain: [0, 60], nice: false}}
  y: {field: conversion, type: quantitative, title: y, scale: {domain: [0, 1.05], nice: false}}
```

</div>

**Filled area**

</figure>

<figure id="gal-log" class="molcrafts-figure" markdown>
<div class="molcrafts-figure__body molcrafts-figure__body--chart" markdown>

```molplot preset="molplot-paper" theme="auto" width="100%" aspect="16:10"
data:
  sequence: {start: 1, stop: 101, step: 1, as: t}
transform:
  - calculate: "0.4 * pow(datum.t, 0.5)"
    as: msd
mark: {type: line, strokeWidth: 1.5, clip: true, color: "#0c5da5"}
encoding:
  x:
    field: t
    type: quantitative
    title: x
    scale: {type: log, domain: [1, 100], nice: false}
  y:
    field: msd
    type: quantitative
    title: y
    scale: {type: log, domain: [0.3, 5], nice: false}
```

</div>

**Log–log**

</figure>

## Scatter

<figure id="gal-pca" class="molcrafts-figure" markdown>
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
mark: {type: point, filled: true, opacity: 0.88, stroke: white, strokeWidth: 0.6}
encoding:
  x: {field: pc1, type: quantitative, title: x, scale: {zero: false}}
  y: {field: pc2, type: quantitative, title: y, scale: {zero: false}}
  color: {field: energy, type: quantitative, title: color, scale: {scheme: viridis, reverse: true}}
  size: {field: population, type: quantitative, title: size, scale: {range: [30, 220]}}
  shape: {field: cluster, type: nominal, title: group}
```

</div>

**Colour, size, and shape**

</figure>

<figure id="gal-scatter" class="molcrafts-figure" markdown>
<div class="molcrafts-figure__body molcrafts-figure__body--chart" markdown>

```molplot preset="molplot-paper" theme="auto" width="100%" aspect="16:10"
data:
  sequence: {start: 0, stop: 80, step: 1, as: i}
transform:
  - calculate: "sin(datum.i * 0.41) + 0.15 * cos(datum.i * 2.3)"
    as: x
  - calculate: "0.6 * datum.x + 0.35 * sin(datum.i * 1.1)"
    as: y
  - calculate: "datum.x * datum.x + datum.y * datum.y"
    as: r2
mark: {type: point, filled: true, opacity: 0.85, size: 50, strokeWidth: 0}
encoding:
  x: {field: x, type: quantitative, title: x, scale: {zero: false}}
  y: {field: y, type: quantitative, title: y, scale: {zero: false}}
  color: {field: r2, type: quantitative, title: color, scale: {scheme: viridis}}
```

</div>

**Colour by value**

</figure>

## Bars

<figure id="gal-group" class="molcrafts-figure" markdown>
<div class="molcrafts-figure__body molcrafts-figure__body--chart" markdown>

```molplot preset="molplot-paper" theme="auto" width="100%" aspect="16:10"
data:
  values:
    - {q: "A", s: "P", v: 8}
    - {q: "B", s: "P", v: 9}
    - {q: "C", s: "P", v: 7}
    - {q: "D", s: "P", v: 10}
    - {q: "A", s: "Q", v: 2}
    - {q: "B", s: "Q", v: 1}
    - {q: "C", s: "Q", v: 3}
    - {q: "D", s: "Q", v: 1}
mark: {type: bar, clip: true}
encoding:
  x: {field: q, type: nominal, title: null, axis: {labelAngle: 0}, scale: {paddingInner: 0.2}}
  y: {field: v, type: quantitative, title: y}
  xOffset: {field: s}
  color:
    field: s
    type: nominal
    scale: {domain: ["P", "Q"], range: ["#0c5da5", "#ff2c00"]}
    legend: {title: null, orient: top-right}
```

</div>

**Grouped**

</figure>

<figure id="gal-stack" class="molcrafts-figure" markdown>
<div class="molcrafts-figure__body molcrafts-figure__body--chart" markdown>

```molplot preset="molplot-paper" theme="auto" width="100%" aspect="16:10"
data:
  values:
    - {q: "A", s: "P", v: 8}
    - {q: "B", s: "P", v: 9}
    - {q: "C", s: "P", v: 7}
    - {q: "D", s: "P", v: 10}
    - {q: "A", s: "Q", v: 2}
    - {q: "B", s: "Q", v: 1}
    - {q: "C", s: "Q", v: 3}
    - {q: "D", s: "Q", v: 1}
mark: {type: bar, clip: true}
encoding:
  x: {field: q, type: nominal, title: null, axis: {labelAngle: 0}, scale: {paddingInner: 0.2}}
  y: {field: v, type: quantitative, title: y, stack: true}
  color:
    field: s
    type: nominal
    scale: {domain: ["P", "Q"], range: ["#0c5da5", "#ff2c00"]}
    legend: {title: null, orient: top-right}
```

</div>

**Stacked**

</figure>

<figure id="gal-barh" class="molcrafts-figure" markdown>
<div class="molcrafts-figure__body molcrafts-figure__body--chart" markdown>

```molplot preset="molplot-paper" theme="auto" width="100%" aspect="16:10"
data:
  values:
    - {cat: "A", v: 4.2}
    - {cat: "B", v: 6.8}
    - {cat: "C", v: 3.1}
    - {cat: "D", v: 5.5}
mark: {type: bar, clip: true, color: "#0c5da5"}
encoding:
  y: {field: cat, type: nominal, title: null}
  x: {field: v, type: quantitative, title: x}
```

</div>

**Horizontal**

</figure>

<figure id="gal-hist" class="molcrafts-figure" markdown>
<div class="molcrafts-figure__body molcrafts-figure__body--chart" markdown>

```molplot preset="molplot-paper" theme="auto" width="100%" aspect="16:10"
data:
  sequence: {start: 0, stop: 300, step: 1, as: i}
transform:
  - calculate: "sin(datum.i * 0.37) + 0.45 * sin(datum.i * 1.9)"
    as: x
mark: {type: bar, clip: true, color: "#0c5da5"}
encoding:
  x: {field: x, type: quantitative, bin: {maxbins: 18}, title: x}
  y: {aggregate: count, type: quantitative, title: y}
```

</div>

**Histogram**

</figure>

## Statistics

<figure id="gal-band" class="molcrafts-figure" markdown>
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
  x: {field: x, type: quantitative, title: x, scale: {domain: [0, 60], nice: false, zero: true}}
  y: {field: y, type: quantitative, title: y, scale: {domain: [0, 1.15], nice: false, zero: true}}
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

**Curve with a confidence band**

</figure>

<figure id="gal-gantt" class="molcrafts-figure" markdown>
<div class="molcrafts-figure__body molcrafts-figure__body--chart" markdown>

```molplot preset="molplot-paper" theme="auto" width="100%" aspect="16:10"
data:
  values:
    - {label: A, start: "2026-01-01", end: "2026-01-04", status: X}
    - {label: B, start: "2026-01-03", end: "2026-01-08", status: X}
    - {label: C, start: "2026-01-08", end: "2026-01-18", status: Y}
    - {label: D, start: "2026-01-16", end: "2026-01-22", status: Z}
mark: {type: bar, cornerRadius: 2}
encoding:
  y: {field: label, type: nominal, title: null, sort: {field: start, op: min}}
  x: {field: start, type: temporal, title: null}
  x2: {field: end}
  color:
    field: status
    type: nominal
    scale: {domain: [X, Y, Z], range: ["#0c5da5", "#00b945", "#9e9e9e"]}
    legend: {title: null, orient: bottom}
```

</div>

**Gantt**

</figure>

## Images and fields

<figure id="gal-heat" class="molcrafts-figure" markdown>
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
  x: {field: x, type: quantitative, title: x, scale: {zero: false, nice: false}, axis: {tickCount: 5}}
  y: {field: y, type: quantitative, title: y, scale: {zero: false, nice: false}, axis: {tickCount: 5}}
  color: {field: lz, type: quantitative, title: z, scale: {scheme: viridis}}
  size: {value: 42}
```

</div>

**Heatmap**

</figure>

<figure id="gal-rb3d" class="molcrafts-figure" markdown>
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
  - mark: {type: square, size: 28, opacity: 0.92, strokeWidth: 0, clip: true}
    encoding:
      x: {field: u, type: quantitative, title: null, axis: {title: null, labels: false, ticks: false, domain: false, grid: true}}
      y: {field: v, type: quantitative, title: null, axis: {title: null, labels: false, ticks: false, domain: false, grid: true}}
      color: {field: lz, type: quantitative, title: z, scale: {scheme: viridis}}
  - mark: {type: line, strokeWidth: 0.3, opacity: 0.22, clip: true}
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

</div>
