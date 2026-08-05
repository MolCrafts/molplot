import { getPreset } from "./preset";
import type { ThemeMode } from "./types";

/**
 * Categorical palette — scienceplots' standard seven-colour "science" cycle.
 * Re-exported for API compatibility with the former plotly build; the
 * authoritative copy now lives in `presets/molplot.json` and flows through
 * {@link getPreset}.
 */
export const CHART_PALETTE: readonly string[] = getPreset().palette.categorical;

export const CHART_DEFAULT_COLOR = getPreset().palette.defaultColor;

export interface ChartTheme {
  background: "transparent";
  font: { size: number; color: string; family: string };
  axis: { gridColor: string; tickColor: string };
  palette: readonly string[];
  /** Colour scheme names shared with matplotlib. */
  scheme: { sequential: string; diverging: string };
  /** Ring colour used to highlight a selected point. */
  highlightRing: string;
  /** Line stroke width / marker size from the preset geometry. */
  geometry: { lineWidth: number; markerSize: number; barGap: number };
  /** Type scale from the preset. */
  fontSize: {
    base: number;
    title: number;
    label: number;
    tick: number;
    legend: number;
  };
  /** The preset name this theme was resolved from. */
  presetName: string;
  mode: "light" | "dark";
}

function documentPrefersDark(): boolean {
  return (
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark")
  );
}

/**
 * Resolve a theme mode (and optional named preset) to a concrete ChartTheme.
 * `auto` observes `<html class="dark">` once at call time — for live tracking,
 * the chart classes set up a MutationObserver and call this on change.
 */
export function resolveTheme(mode: ThemeMode, presetName?: string): ChartTheme {
  const preset = getPreset(presetName);
  const dark = mode === "dark" || (mode === "auto" && documentPrefersDark());
  const m = dark ? preset.modes.dark : preset.modes.light;
  return {
    background: "transparent",
    font: {
      size: preset.typography.size.base,
      color: m.foreground,
      family: preset.typography.family,
    },
    axis: { gridColor: m.gridColorSolid, tickColor: m.tickColor },
    palette: preset.palette.categorical,
    scheme: {
      sequential: preset.palette.sequential,
      diverging: preset.palette.diverging,
    },
    highlightRing: m.highlightRing,
    geometry: {
      lineWidth: preset.geometry.lineWidth,
      markerSize: preset.geometry.markerSize,
      barGap: preset.geometry.barGap,
    },
    fontSize: { ...preset.typography.size },
    presetName: preset.name,
    mode: dark ? "dark" : "light",
  };
}

/**
 * Paper design width (matches `view.continuousWidth`). At this width the
 * preset type scale (≈9–12 px) is correct for a 3.5″ figure; wider web hosts
 * need a scale factor so axis labels stay readable.
 */
export const MOLPLOT_DESIGN_WIDTH = 320;

/**
 * Scale factor for screen / docs hosts.
 *
 * Paper preset is ~9–12 px at {@link MOLPLOT_DESIGN_WIDTH}. Docs use a **2×**
 * floor (200% of paper) and track host width so labels/ticks grow on large
 * pages (cap 3×). Fixed px in a fence `config` freeze type size — prefer
 * leaving sizes to this scale.
 */
export function fontScaleForWidth(width: number): number {
  if (!Number.isFinite(width) || width <= 0) return 2;
  const tracked = width / MOLPLOT_DESIGN_WIDTH;
  // 2× paper at design width; scales with page width up to 3×.
  return Math.min(3, Math.max(2, 2 * tracked));
}

/**
 * Build the Vega-Lite `config` object for a theme. This is the *single*
 * place the unified preset is injected into a spec — the exact counterpart of
 * the matplotlib rcParams the Python package applies, so a spec rendered in
 * the browser and the same spec rendered by scienceplots share palette, type
 * scale, and grid styling.
 *
 * @param fontScale - multiplies every type size (1 = paper preset). Web
 *   hosts should pass {@link fontScaleForWidth} so labels track the chart size.
 */
export function vegaConfig(
  theme: ChartTheme,
  fontScale = 1,
): Record<string, unknown> {
  const scale = Number.isFinite(fontScale) && fontScale > 0 ? fontScale : 1;
  const px = (n: number) => Math.round(n * scale * 10) / 10;
  // Modest outer pad — large pads + multi-legend + fixed box crushes the plot.
  const pad = Math.max(6, Math.round(6 * scale));
  return {
    background: "transparent",
    font: theme.font.family,
    padding: { left: pad, right: pad, top: pad, bottom: pad },
    axis: {
      labelColor: theme.font.color,
      titleColor: theme.font.color,
      tickColor: theme.axis.tickColor,
      domainColor: theme.axis.tickColor,
      gridColor: theme.axis.gridColor,
      gridWidth: 0.5,
      labelFontSize: px(theme.fontSize.tick),
      titleFontSize: px(theme.fontSize.label),
      labelFont: theme.font.family,
      titleFont: theme.font.family,
      titleFontStyle: "normal",
      labelFontStyle: "normal",
      titlePadding: Math.round(8 * scale),
      labelPadding: Math.round(4 * scale),
      grid: true,
      tickSize: Math.max(5, Math.round(4 * scale)),
      labelLimit: Math.round(220 * scale),
      titleLimit: Math.round(280 * scale),
      labelOverlap: true,
      labelFlush: true,
    },
    legend: {
      labelColor: theme.font.color,
      titleColor: theme.font.color,
      labelFontSize: px(theme.fontSize.legend),
      titleFontSize: px(theme.fontSize.legend),
      labelFont: theme.font.family,
      titleFont: theme.font.family,
      symbolType: "circle",
      titleLimit: Math.round(160 * scale),
      labelLimit: Math.round(120 * scale),
      padding: Math.round(4 * scale),
      offset: Math.round(6 * scale),
      rowPadding: Math.round(2 * scale),
      columnPadding: Math.round(4 * scale),
      symbolSize: Math.round(48 * scale),
    },
    title: {
      color: theme.font.color,
      fontSize: px(theme.fontSize.title),
      font: theme.font.family,
      fontWeight: 600,
      fontStyle: "normal",
    },
    text: {
      font: theme.font.family,
      fontSize: px(theme.fontSize.label),
      color: theme.font.color,
      fontStyle: "normal",
    },
    view: {
      stroke: null,
      continuousWidth: MOLPLOT_DESIGN_WIDTH,
      continuousHeight: 200,
    },
    line: { strokeWidth: theme.geometry.lineWidth },
    point: { size: theme.geometry.markerSize * theme.geometry.markerSize },
    bar: { discreteBandSize: undefined },
    range: {
      category: theme.palette as string[],
      ramp: { scheme: theme.scheme.sequential },
      diverging: { scheme: theme.scheme.diverging },
    },
  };
}
