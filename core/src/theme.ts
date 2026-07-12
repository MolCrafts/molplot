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
 * Build the Vega-Lite `config` object for a theme. This is the *single*
 * place the unified preset is injected into a spec — the exact counterpart of
 * the matplotlib rcParams the Python package applies, so a spec rendered in
 * the browser and the same spec rendered by scienceplots share palette, type
 * scale, and grid styling.
 */
export function vegaConfig(theme: ChartTheme): Record<string, unknown> {
  return {
    background: "transparent",
    font: theme.font.family,
    padding: 4,
    axis: {
      labelColor: theme.font.color,
      titleColor: theme.font.color,
      tickColor: theme.axis.tickColor,
      domainColor: theme.axis.tickColor,
      gridColor: theme.axis.gridColor,
      gridWidth: 0.5,
      labelFontSize: theme.fontSize.tick,
      titleFontSize: theme.fontSize.label,
      labelFont: theme.font.family,
      titleFont: theme.font.family,
      grid: true,
      tickSize: 4,
    },
    legend: {
      labelColor: theme.font.color,
      titleColor: theme.font.color,
      labelFontSize: theme.fontSize.legend,
      titleFontSize: theme.fontSize.legend,
      labelFont: theme.font.family,
      titleFont: theme.font.family,
      symbolType: "circle",
    },
    title: {
      color: theme.font.color,
      fontSize: theme.fontSize.title,
      font: theme.font.family,
      fontWeight: 600,
    },
    view: { stroke: null, continuousWidth: 320, continuousHeight: 200 },
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
