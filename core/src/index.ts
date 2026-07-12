// Chart classes (imperative, framework-agnostic) ---------------------------

export type {
  BarChartConfig,
  BarClickEvent,
  BarMode,
  BarPoint,
  BarSeriesConfig,
} from "./bar_chart";
export { BarChart } from "./bar_chart";
// Web Component — register `<molplot-chart>` in the browser. These are plain
// functions that touch the DOM only when called, so importing the library stays
// side-effect-free and SSR-safe (no top-level `class extends HTMLElement`). The
// self-registering browser bundle is the `./elements` subpath.
export { defineMolplotChart, parseSpec } from "./element";
export type {
  GanttChartConfig,
  GanttClickEvent,
  GanttTask,
} from "./gantt_chart";
export { GanttChart } from "./gantt_chart";
export { LineChart } from "./line_chart";
export {
  DEFAULT_PRESET,
  getPreset,
  PRESETS,
  type Preset,
  type PresetMode,
  type PresetName,
  presetNames,
} from "./preset";
export type { RawChartConfig } from "./raw_chart";
export { RawChart } from "./raw_chart";
export { ScatterChart } from "./scatter_chart";
// Vega-Lite spec builders — the portable intermediate language --------------
export {
  barSpec,
  ganttSpec,
  lineSpec,
  type SpecSize,
  scatterSpec,
  type VegaLiteSpec,
  VL_SCHEMA,
} from "./specs";
// Theme + unified preset ----------------------------------------------------
export {
  CHART_DEFAULT_COLOR,
  CHART_PALETTE,
  type ChartTheme,
  resolveTheme,
  vegaConfig,
} from "./theme";
// Shared config / event types ----------------------------------------------
export type {
  AxisConfig,
  LegendConfig,
  LineChartClickEvent,
  LineChartConfig,
  LineSeriesConfig,
  ScatterChartConfig,
  ScatterClickEvent,
  ScatterMarkerConfig,
  ScatterPoint,
  SeriesPoint,
  ThemeMode,
} from "./types";
