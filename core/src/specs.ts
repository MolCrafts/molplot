import type { BarChartConfig, BarSeriesConfig } from "./bar_chart";
import type { GanttChartConfig } from "./gantt_chart";
import { type ChartTheme, vegaConfig } from "./theme";
import type { AxisConfig, LineChartConfig, ScatterChartConfig } from "./types";

/**
 * A Vega-Lite top-level spec. Loosely typed on purpose — the object *is* the
 * portable intermediate language, produced identically here (TypeScript) and
 * by the Python package, then rendered either by vega-embed (web) or by the
 * matplotlib translator (paper). Keep these builders pure and free of DOM /
 * engine references so they stay node-testable and reusable on both sides.
 */
export type VegaLiteSpec = Record<string, unknown>;

export const VL_SCHEMA = "https://vega.github.io/schema/vega-lite/v5.json";

export interface SpecSize {
  width?: number | "container";
  height?: number;
}

const FALLBACK_STATUS_COLOR = "#a3a3a3";

/** Continuous channels that can carry a scale binding. */
export type ZoomChannel = "x" | "y";

/** One scale-bound interval selection per zoomable axis. */
export const ZOOM_PARAM = { x: "zoomX", y: "zoomY" } as const;

/**
 * Flags `VegaChart` stamps on a wheel event to say which axis gutter the
 * pointer is over.
 *
 * A Vega event filter is compiled without the signal scope object, so it can
 * call the geometry functions (`x()`, `y()`) but throws `ReferenceError: _ is
 * not defined` the moment it reads a signal. That rules out the expression the
 * region test wants — `y() > height` — because `height` is a signal. Hence the
 * test happens where the geometry is knowable and arrives here as a boolean.
 */
export const ZOOM_EVENT_FLAG = {
  x: "molplotZoomX",
  y: "molplotZoomY",
} as const;

/** A scale-bound interval selection, one per zoomable axis. */
export interface ZoomParam {
  name: string;
  bind: "scales";
  select: { type: "interval"; encodings: ZoomChannel[]; zoom: string };
}

/**
 * The zoom params a builder attached, wherever it legally placed them: top
 * level for a unit spec, `layer[0]` for a layered one. Empty for a spec that
 * never went through a builder (`RawChart`).
 */
export function zoomParamsOf(spec: VegaLiteSpec): ZoomParam[] {
  const layers = spec.layer as { params?: ZoomParam[] }[] | undefined;
  return (spec.params as ZoomParam[]) ?? layers?.[0]?.params ?? [];
}

/**
 * Pan/zoom, one param per continuous axis: drag pans, wheel over an axis
 * gutter zooms that axis alone, Shift+wheel zooms every bound axis, double
 * click resets.
 *
 * The `view:` source matters. Vega-Lite's default for a scale binding is
 * `scope` — the plot group — but axes render with `pointer-events: none`, so a
 * wheel over an axis falls through to the SVG root and never enters that
 * group. `view:` listens on the chart's own element instead, which both catches
 * the axis wheel and keeps sibling charts on the page from reacting to it.
 *
 * `|| event.shiftKey` keeps the spec self-sufficient: Shift+wheel zooms even
 * when nobody is stamping the event (a raw `vegaEmbed` of this spec, the docs).
 *
 * `bind: "scales"` attaches a `domainRaw` signal that outranks the computed
 * domain, so `zero` / `nice` / an explicit `domain` still choose the *initial*
 * view and the interaction owns the view from then on.
 *
 * Pass only continuous channels; binding a band scale warns "Scale bindings are
 * currently only supported for scales with unbinned, continuous domains."
 *
 * Inert outside the browser: the matplotlib translator and vl-convert both
 * ignore `params` and render the initial view.
 */
function interactionParams(channels: ZoomChannel[]): ZoomParam[] {
  return channels.map((channel) => ({
    name: ZOOM_PARAM[channel],
    select: {
      type: "interval",
      encodings: [channel],
      zoom: `view:wheel![event.${ZOOM_EVENT_FLAG[channel]} || event.shiftKey]`,
    },
    bind: "scales",
  }));
}

/** Strip undefined so specs compare cleanly in tests and serialize small. */
function clean<T extends Record<string, unknown>>(obj: T): T {
  for (const k of Object.keys(obj)) {
    if (obj[k] === undefined) delete obj[k];
  }
  return obj;
}

function axisDef(cfg: AxisConfig | undefined): Record<string, unknown> {
  return clean({
    title: cfg?.label ?? null,
    format: cfg?.tickformat,
    tickCount: cfg?.nticks,
    grid: true,
  });
}

function scaleDef(cfg: AxisConfig | undefined): Record<string, unknown> {
  const zero = cfg?.rangemode === "tozero" || cfg?.rangemode === "nonnegative";
  return clean({
    type: cfg?.type === "log" ? "log" : "linear",
    domain: cfg?.range,
    zero,
    nice: !cfg?.range,
  });
}

function size(spec: SpecSize | undefined): {
  width: number | "container";
  height: number;
} {
  return { width: spec?.width ?? "container", height: spec?.height ?? 300 };
}

/** LINE — one path per series, per-series width/opacity via nominal scales. */
export function lineSpec(
  config: LineChartConfig,
  theme: ChartTheme,
  spec?: SpecSize,
): VegaLiteSpec {
  const keys: string[] = [];
  const colors: string[] = [];
  const widths: number[] = [];
  const opacities: number[] = [];
  const markerKeys: string[] = [];
  config.series.forEach((s, i) => {
    const key = s.label ?? s.id;
    if (keys.includes(key)) return;
    keys.push(key);
    colors.push(s.color ?? theme.palette[i % theme.palette.length]);
    widths.push(s.width ?? theme.geometry.lineWidth);
    opacities.push(s.opacity ?? 1);
    if ((s.mode ?? "lines") === "lines+markers") markerKeys.push(key);
  });

  const { width, height } = size(spec);
  const colorEnc = {
    field: "key",
    type: "nominal",
    scale: { domain: keys, range: colors },
    legend: config.showLegend ? { title: null } : null,
  };
  // Every layer reuses the *same* colour encoding: Vega-Lite merges same-field
  // colour legends into one, so the legend setting must be identical across
  // layers (differing `disable` flags would conflict).
  const xy = {
    x: {
      field: "x",
      type: "quantitative",
      axis: axisDef(config.xAxis),
      scale: scaleDef(config.xAxis),
    },
    y: {
      field: "y",
      type: "quantitative",
      axis: axisDef(config.yAxis),
      scale: scaleDef(config.yAxis),
    },
  };

  // Encode stroke width / opacity per series only when they actually differ;
  // otherwise set them as constant mark props. Encoding a size/opacity channel
  // on the same field as `color` makes Vega-Lite merge legends and warn.
  const uniformWidth = widths.every((w) => w === widths[0]);
  const uniformOpacity = opacities.every((o) => o === opacities[0]);
  const lineMark: Record<string, unknown> = {
    type: "line",
    interpolate: "linear",
    clip: true,
  };
  if (uniformWidth)
    lineMark.strokeWidth = widths[0] ?? theme.geometry.lineWidth;
  if (uniformOpacity) lineMark.opacity = opacities[0] ?? 1;
  const lineEncoding: Record<string, unknown> = {
    color: colorEnc,
    detail: { field: "s", type: "nominal" },
  };
  if (!uniformWidth) {
    lineEncoding.strokeWidth = {
      field: "key",
      type: "nominal",
      scale: { domain: keys, range: widths },
      legend: null,
    };
  }
  if (!uniformOpacity) {
    lineEncoding.opacity = {
      field: "key",
      type: "nominal",
      scale: { domain: keys, range: opacities },
      legend: null,
    };
  }

  return clean({
    $schema: VL_SCHEMA,
    config: vegaConfig(theme),
    width,
    height,
    autosize: { type: "fit", contains: "padding" },
    data: { name: "table" },
    encoding: xy,
    layer: [
      {
        // Params belong to exactly one unit layer. At the top level of a
        // layered spec Vega-Lite copies them into every layer and Vega then
        // throws "Duplicate signal name" while compiling stays silent.
        params: interactionParams(["x", "y"]),
        mark: lineMark,
        encoding: lineEncoding,
      },
      {
        transform: [{ filter: { field: "key", oneOf: markerKeys } }],
        mark: {
          type: "point",
          filled: true,
          size: theme.geometry.markerSize ** 2,
          clip: true,
        },
        encoding: { color: colorEnc },
      },
      {
        // Invisible wide hit target → precise hover tooltip + click datum.
        mark: { type: "point", opacity: 0, size: 160, clip: true },
        encoding: {
          color: colorEnc,
          tooltip: [
            { field: "key", type: "nominal", title: "series" },
            { field: "x", type: "quantitative", format: ".4g" },
            { field: "y", type: "quantitative", format: ".4g" },
          ],
        },
      },
    ],
  });
}

/** SCATTER — points + optional highlight ring + optional colour channel. */
export function scatterSpec(
  config: ScatterChartConfig,
  theme: ChartTheme,
  spec?: SpecSize,
): VegaLiteSpec {
  const marker = config.marker ?? {};
  const colorArr = Array.isArray(marker.color) ? marker.color : null;
  const numeric = colorArr !== null && typeof colorArr[0] === "number";
  const { width, height } = size(spec);

  let colorEnc: Record<string, unknown> | undefined;
  if (numeric) {
    colorEnc = {
      field: "c",
      type: "quantitative",
      scale: { scheme: marker.colorscale ?? theme.scheme.sequential },
      legend: marker.showscale ? {} : null,
    };
  } else if (colorArr) {
    colorEnc = { field: "c", type: "nominal", scale: null, legend: null };
  }
  const markSize = (marker.size ?? theme.geometry.markerSize) ** 2;

  const layers: Record<string, unknown>[] = [
    {
      params: interactionParams(["x", "y"]),
      data: { name: "table" },
      mark: clean({
        type: "point",
        filled: true,
        size: markSize,
        clip: true,
        color: colorEnc
          ? undefined
          : ((marker.color as string) ?? theme.palette[0]),
      }),
      encoding: clean({
        x: {
          field: "x",
          type: "quantitative",
          axis: axisDef(config.xAxis),
          scale: scaleDef(config.xAxis),
        },
        y: {
          field: "y",
          type: "quantitative",
          axis: axisDef(config.yAxis),
          scale: scaleDef(config.yAxis),
        },
        color: colorEnc,
        tooltip: [
          { field: "x", type: "quantitative", format: ".4g" },
          { field: "y", type: "quantitative", format: ".4g" },
        ],
      }),
    },
    {
      data: { name: "highlight" },
      mark: {
        type: "point",
        filled: false,
        size: markSize * 4,
        stroke: theme.highlightRing,
        strokeWidth: 2,
        clip: true,
      },
      encoding: {
        x: { field: "x", type: "quantitative" },
        y: { field: "y", type: "quantitative" },
      },
    },
  ];

  return clean({
    $schema: VL_SCHEMA,
    config: vegaConfig(theme),
    width,
    height,
    autosize: { type: "fit", contains: "padding" },
    layer: layers,
  });
}

/** BAR — stack / group / overlay, vertical or horizontal, line-over-bars. */
export function barSpec(
  config: BarChartConfig,
  theme: ChartTheme,
  spec?: SpecSize,
): VegaLiteSpec {
  const mode = config.mode ?? "group";
  const horizontal = (config.orientation ?? "v") === "h";
  const { width, height } = size(spec);

  const keys: string[] = [];
  const colors: string[] = [];
  config.series.forEach((s: BarSeriesConfig, i) => {
    const key = s.label ?? s.id;
    if (keys.includes(key)) return;
    keys.push(key);
    colors.push(s.color ?? theme.palette[i % theme.palette.length]);
  });
  const colorEnc = {
    field: "key",
    type: "nominal",
    scale: { domain: keys, range: colors },
    legend: config.showLegend ? { title: null } : null,
  };

  const catAxis = horizontal ? config.yAxis : config.xAxis;
  const valAxis = horizontal ? config.xAxis : config.yAxis;
  const catChannel = horizontal ? "y" : "x";
  const valChannel = horizontal ? "x" : "y";
  const offsetChannel = horizontal ? "yOffset" : "xOffset";

  const catEnc = {
    field: "cat",
    type: "nominal",
    axis: axisDef(catAxis),
    scale: { paddingInner: config.bargap ?? theme.geometry.barGap },
  };
  const valEnc: Record<string, unknown> = {
    field: "val",
    type: "quantitative",
    axis: axisDef(valAxis),
    stack: mode === "stack" ? true : null,
  };

  const barEncoding: Record<string, unknown> = clean({
    [catChannel]: catEnc,
    [valChannel]: valEnc,
    color: colorEnc,
    [offsetChannel]: mode === "group" ? { field: "key" } : undefined,
    opacity: mode === "overlay" ? { value: 0.65 } : undefined,
    tooltip: [
      { field: "cat", type: "nominal" },
      { field: "val", type: "quantitative", format: ".4g" },
      { field: "key", type: "nominal", title: "series" },
    ],
  });

  const layers: Record<string, unknown>[] = [
    {
      // Only the value axis is continuous; the category axis is a band scale
      // and cannot take a scale binding.
      params: interactionParams([valChannel]),
      data: { name: "table" },
      mark: { type: "bar", clip: true },
      encoding: barEncoding,
    },
  ];

  // Optional line-over-bars overlay (fed via the "line" dataset).
  const hasLine = config.series.some((s) => s.type === "line");
  if (hasLine) {
    layers.push({
      data: { name: "line" },
      mark: { type: "line", point: true, strokeWidth: 2, clip: true },
      encoding: {
        [catChannel]: { field: "cat", type: "nominal" },
        [valChannel]: { field: "val", type: "quantitative" },
        color: colorEnc,
        detail: { field: "key", type: "nominal" },
      },
    });
  }

  return clean({
    $schema: VL_SCHEMA,
    config: vegaConfig(theme),
    width,
    height,
    autosize: { type: "fit", contains: "padding" },
    layer: layers,
  });
}

/** GANTT — one time-spanning bar per task, coloured by status group. */
export function ganttSpec(
  config: GanttChartConfig,
  theme: ChartTheme,
  spec?: SpecSize,
): VegaLiteSpec {
  const present = [...new Set(config.tasks.map((t) => t.statusGroup))];
  const order = config.statusOrder ?? [];
  const groups = [
    ...order.filter((g) => present.includes(g)),
    ...present.filter((g) => !order.includes(g)),
  ];
  const groupLabels = groups.map((g) => config.statusLabels?.[g] ?? g);
  const colors = groups.map(
    (g) => config.statusColors[g] ?? FALLBACK_STATUS_COLOR,
  );
  const opacities = groups.map((g) => config.statusOpacity?.[g] ?? 1);
  const labelOrder = [...new Set(config.tasks.map((t) => t.label))];

  const barWidth = config.barWidth ?? 18;
  const rowHeight = config.rowHeight ?? 28;
  const padding = Math.max(0.05, Math.min(0.7, 1 - barWidth / rowHeight));
  const { width } = size(spec);
  const height =
    spec?.height ?? Math.max(160, rowHeight * labelOrder.length + 40);

  return clean({
    $schema: VL_SCHEMA,
    config: vegaConfig(theme),
    width,
    height,
    autosize: { type: "fit", contains: "padding" },
    data: { name: "table" },
    // A unit spec, so the params sit at the top level. Only the temporal axis
    // is continuous; the task-label axis is a band scale.
    params: interactionParams(["x"]),
    mark: { type: "bar", cornerRadius: 2, clip: true },
    encoding: {
      x: {
        field: "start",
        type: "temporal",
        axis: axisDef(config.xAxis),
        title: null,
      },
      x2: { field: "end" },
      y: {
        field: "label",
        type: "nominal",
        sort: labelOrder,
        scale: { paddingInner: padding },
        axis: { title: null },
      },
      color: {
        field: "groupLabel",
        type: "nominal",
        scale: { domain: groupLabels, range: colors },
        legend:
          (config.showLegend ?? true)
            ? { title: null, orient: "bottom" }
            : null,
      },
      opacity: {
        field: "group",
        type: "nominal",
        scale: { domain: groups, range: opacities },
        legend: null,
      },
      tooltip: [
        { field: "label", type: "nominal" },
        { field: "start", type: "temporal" },
        { field: "end", type: "temporal" },
        { field: "groupLabel", type: "nominal", title: "status" },
      ],
    },
  });
}
