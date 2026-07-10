---
title: MolPlot
description: Unified scientific charting — Vega-Lite on the web, scienceplots on paper, one preset.
hide:
  - navigation
  - toc
hero:
  kicker: MolPlot Manual
  title: MolPlot
  description: One preset, one intermediate language, two renderers. Describe a chart once as a Vega-Lite spec; render it in the browser with vega-embed and to a matplotlib figure over scienceplots — sharing palette, type scale, and grid between a dashboard and a manuscript.
  install:
    label: Install
    command: pip install molcrafts-molplot
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
    - label: Unified Preset
      href: getting-started/preset/
    - label: API Reference
      href: api/
---

<h1 class="molcrafts-sr-only">MolPlot</h1>

<div class="molcrafts-manual-home" markdown>

<section class="molcrafts-manual-section molcrafts-manual-section--compact" markdown>

<div class="molcrafts-manual-section__header" markdown>

<span class="molcrafts-manual-eyebrow">At a glance</span>

## The same chart, in the browser and on paper

</div>

A chart is described once as a [Vega-Lite](https://vega.github.io/vega-lite/)
spec — the portable intermediate language. The **web** package renders it live;
the **Python** package renders the *same* spec to a matplotlib figure over
[scienceplots](https://github.com/garrettj403/SciencePlots). Both read one
preset, so a dashboard and a manuscript figure share palette, type scale, and
grid.

```
                      presets/*.json   ← single source of truth
                     /              \
        vegaConfig() (TS)      rc_params() (Python)
             |                        |
   Vega-Lite spec  ───────────────►  Vega-Lite spec
       |                                  |
  vega-embed (web)              render() → matplotlib (paper)
```

</section>

<section class="molcrafts-manual-section" markdown>

<div class="molcrafts-manual-section__header" markdown>

<span class="molcrafts-manual-eyebrow">Two renderers</span>

## Pick your surface

</div>

<dl class="molcrafts-feature-matrix" markdown>
<dt>Web — <code>@molcrafts/molplot</code></dt>
<dd markdown>Imperative TypeScript chart classes (`LineChart`, `ScatterChart`, `BarChart`, `GanttChart`, `RawChart`) that build a Vega-Lite spec and render it via `vega-embed`. The Vega runtime is lazy and externalized — consumers that never draw a chart never bundle it. `npm install @molcrafts/molplot`.</dd>
<dt>Paper — <code>molcrafts-molplot</code></dt>
<dd markdown>A scienceplots wrapper that injects the same preset into matplotlib `rcParams` and renders the *same* Vega-Lite spec to a figure. One-call `line` / `scatter` / `bar` / `gantt`, plus a `use()` / `style()` context manager. `pip install molcrafts-molplot`.</dd>
<dt>One preset</dt>
<dd markdown>`presets/*.json` is the single source of truth, compiled to a typed TS const, a Python dict, and `.mplstyle` files. Edit the JSON once; both renderers pick up the change.</dd>
</dl>

</section>

<section class="molcrafts-manual-section molcrafts-manual-section--compact" markdown>

<div class="molcrafts-manual-section__header" markdown>

<span class="molcrafts-manual-eyebrow">Find your page</span>

## The manual in four chapters

</div>

<nav class="molcrafts-manual-index" aria-label="Manual chapters">
  <a href="getting-started/">
    <span>01</span>
    <strong>Getting Started</strong>
    <em>Install both packages and draw your first chart on the web and in matplotlib.</em>
  </a>
  <a href="getting-started/preset/">
    <span>02</span>
    <strong>Unified Preset</strong>
    <em>The single source of truth: how one JSON preset compiles to a Vega-Lite config and matplotlib rcParams.</em>
  </a>
  <a href="getting-started/web/">
    <span>03</span>
    <strong>Web (Vega-Lite)</strong>
    <em>The imperative chart classes, streaming updates, and click handling in the browser.</em>
  </a>
  <a href="getting-started/python/">
    <span>04</span>
    <strong>Python (scienceplots)</strong>
    <em>Styling matplotlib with the preset and rendering the same spec to a publication figure.</em>
  </a>
</nav>

</section>

</div>
