# TypeScript

```sh
npm install @molcrafts/molplot
```

| Import | |
|--------|--|
| `@molcrafts/molplot` | classes, builders, theme, `defineMolplotChart` |
| `@molcrafts/molplot/elements` | registers `<molplot-chart>` |

## Classes

`(container, config)`. Shared: `ready()`, `resize()`, `dispose()`.

| | Config | Click |
|--|--------|-------|
| `LineChart` | `LineChartConfig` | `onPointClick` |
| `ScatterChart` | `ScatterChartConfig` | `onPointClick` |
| `BarChart` | `BarChartConfig` | `onBarClick` |
| `GanttChart` | `GanttChartConfig` | `onTaskClick` |
| `RawChart` | `{ spec }` | — |

`LineChart`: `setSeries`, `appendPoint(s)`, `clear`, `setWindow`, `setAxisRange`. `ScatterChart.setHighlight`. Bar `mode`: `group` / `stack` / `overlay`. Gantt field: `statusGroup`.

## Builders and theme

`lineSpec(config, theme, size?)`, `scatterSpec`, `barSpec`, `ganttSpec`. `VL_SCHEMA`. `getPreset`, `presetNames`, `PRESETS`, `DEFAULT_PRESET`, `resolveTheme`, `vegaConfig`, `CHART_PALETTE`.

## Element

`defineMolplotChart()`. `parseSpec` / `readSpec`. Attributes: `preset`, `theme`, `interactive`, `width`, `aspect`, `spec`. Events: `molplot:ready`, `molplot:error`.
