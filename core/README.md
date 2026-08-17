# @molcrafts/molplot

Vega-Lite scientific charting primitives — line, scatter, bar, gantt, and a raw
spec passthrough — with a shared, matplotlib-portable preset and a lazily-loaded
Vega runtime.

Part of [MolPlot](https://github.com/MolCrafts/molplot): every chart builds a
**Vega-Lite spec** (the portable intermediate language) and renders it with
`vega-embed` using its Canvas renderer. The web package does not emit SVG. The
same spec can be rendered to a matplotlib figure by the Python package
`molcrafts-molplot`, so web and paper figures share one description and one
preset.

## Install

```sh
npm install @molcrafts/molplot vega vega-lite vega-embed
```

The Vega runtime is loaded lazily and externalized from the build, so a consumer
that never renders a chart never pays for the bundle.

## Usage

```ts
import { LineChart, ScatterChart, CHART_PALETTE } from "@molcrafts/molplot";

const chart = new LineChart(container, {
  preset: "molplot",       // unified preset; "molplot-paper" also ships
  theme: "auto",           // tracks <html class="dark">
  series: [{ id: "e", label: "Energy", initialPoints: pts }],
});
await chart.ready();
chart.appendPoint("e", { x, y });     // cheap streaming update (view.data)
chart.onPointClick((e) => console.log(e.seriesId, e.index));
```

## API

Chart classes (imperative, framework-agnostic): `LineChart`, `ScatterChart`,
`BarChart`, `GanttChart`, `RawChart`. Each takes `(container, config)` and
exposes `ready()`, `resize()`, `dispose()`, and typed `on*Click` handlers;
`LineChart` adds `setSeries` / `appendPoint` / `appendPoints` / `clear` /
`setWindow` / `setAxisRange`.

Spec builders (the intermediate language, no DOM): `lineSpec`, `scatterSpec`,
`barSpec`, `ganttSpec`. Theme / preset: `resolveTheme`, `vegaConfig`,
`getPreset`, `CHART_PALETTE`, `CHART_DEFAULT_COLOR`.

> **Migration from the plotly build:** the chart classes and config/event types
> are unchanged. `RawChart` now takes a Vega-Lite spec (`{ spec }`) instead of a
> plotly `{ data, layout, config }` payload.

## License

BSD-3-Clause
