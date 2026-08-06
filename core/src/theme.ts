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

/** CSS values read from the host page so docs type/color match the article. */
export interface HostStyle {
  /** Computed body font-size in px (e.g. `.md-typeset` ≈ 12.8). */
  fontSizePx: number;
  fontFamily: string | null;
  color: string | null;
}

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
  /** Host body size used for {@link fontScaleForHost}. */
  hostFontPx: number;
}

function documentPrefersDark(): boolean {
  return (
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark")
  );
}

/**
 * Read type / ink from the surrounding page so docs charts match body copy
 * instead of a frozen paper × 3× scale.
 *
 * Prefer `.md-typeset` (Material / Zensical article) when present.
 */
export function readHostStyle(el: HTMLElement | null | undefined): HostStyle {
  if (!el || typeof getComputedStyle === "undefined") {
    return { fontSizePx: 13, fontFamily: null, color: null };
  }
  const host =
    (el.closest(".md-typeset") as HTMLElement | null) ??
    (el.closest("article") as HTMLElement | null) ??
    el;
  const cs = getComputedStyle(host);
  const fontSizePx = parseFloat(cs.fontSize);
  return {
    fontSizePx: Number.isFinite(fontSizePx) && fontSizePx > 0 ? fontSizePx : 13,
    fontFamily: cs.fontFamily?.trim() || null,
    color: cs.color?.trim() || null,
  };
}

/**
 * Axis / label type stack: Times New Roman + math fonts (STIX / Latin Modern)
 * so τ, Å², subscripts match paper figures. Body prose may stay Inter; chart
 * labels stay scientific serif.
 */
export const CHART_SERIF_STACK =
  "Times New Roman, Times, STIX Two Text, STIXGeneral, " +
  "Latin Modern Roman, 'Cambria Math', serif";

/**
 * Resolve a theme mode (and optional named preset) to a concrete ChartTheme.
 * `auto` observes `<html class="dark">` once at call time — for live tracking,
 * the chart classes set up a MutationObserver and call this on change.
 *
 * Host supplies **ink colour** and **body size** (for fontScale). Chart type
 * family stays Times + math fonts — not the page sans — so axis titles read
 * like paper figures next to Inter body copy.
 */
export function resolveTheme(
  mode: ThemeMode,
  presetName?: string,
  host?: HTMLElement | null,
): ChartTheme {
  const preset = getPreset(presetName);
  const dark = mode === "dark" || (mode === "auto" && documentPrefersDark());
  const m = dark ? preset.modes.dark : preset.modes.light;
  const hostStyle = readHostStyle(host ?? null);
  // Scientific axis type: Times + math fonts (not the page sans).
  const family = CHART_SERIF_STACK;
  return {
    background: "transparent",
    font: {
      size: preset.typography.size.base,
      color: hostStyle.color ?? m.foreground,
      family,
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
    hostFontPx: hostStyle.fontSizePx,
  };
}

/**
 * Paper design width (matches `view.continuousWidth`). At this width the
 * preset type scale (≈9–12 px) is correct for a 3.5″ figure.
 */
export const MOLPLOT_DESIGN_WIDTH = 320;

/**
 * Scale factor so chart type matches the **host page body**, not a paper
 * billboard.
 *
 * Paper tick is ≈9 px. Docs body (`.md-typeset`) is typically 0.8rem ≈ 12–13 px.
 * We target tick ≈ 0.95 × body, title ≈ 1.05 × body — readable next to prose
 * without crushing legends or eating the plot.
 *
 * Width only nudges ±10% (narrow sidebars vs full column).
 */
export function fontScaleForHost(width: number, bodyPx = 13): number {
  const paperTick = 9;
  const body = Number.isFinite(bodyPx) && bodyPx > 0 ? bodyPx : 13;
  const targetTick = body * 0.95;
  let scale = targetTick / paperTick;
  if (Number.isFinite(width) && width > 0) {
    const wf = Math.min(1.1, Math.max(0.9, width / 560));
    scale *= wf;
  }
  // Keep a readable floor / modest ceiling (never the old 3–4.5× paper blow-up).
  return Math.round(Math.min(1.85, Math.max(1.15, scale)) * 100) / 100;
}

/**
 * Width-only scale with a neutral body size. Prefer
 * {@link fontScaleForHost} when the host element is known.
 */
export function fontScaleForWidth(width: number): number {
  return fontScaleForHost(width, 13);
}

/**
 * Build the Vega-Lite `config` object for a theme. This is the *single*
 * place the unified preset is injected into a spec — the exact counterpart of
 * the matplotlib rcParams the Python package applies, so a spec rendered in
 * the browser and the same spec rendered by scienceplots share palette, type
 * scale, and grid styling.
 *
 * @param fontScale - multiplies every type size (1 = paper preset). Web
 *   hosts should pass {@link fontScaleForHost} so labels track page body type.
 */
export function vegaConfig(
  theme: ChartTheme,
  fontScale = 1,
): Record<string, unknown> {
  const scale = Number.isFinite(fontScale) && fontScale > 0 ? fontScale : 1;
  const px = (n: number) => Math.round(n * scale * 10) / 10;
  // Equal outer pad on all four sides (CSS host margin is separate).
  const pad = Math.max(6, Math.round(4 * scale + 3));
  const serif = theme.font.family;
  return {
    background: "transparent",
    font: serif,
    padding: {
      left: pad,
      right: pad,
      top: pad,
      bottom: pad,
    },
    axis: {
      labelColor: theme.font.color,
      titleColor: theme.font.color,
      tickColor: theme.axis.tickColor,
      domainColor: theme.axis.tickColor,
      gridColor: theme.axis.gridColor,
      gridWidth: 0.5,
      labelFontSize: px(theme.fontSize.tick),
      titleFontSize: px(theme.fontSize.label),
      labelFont: serif,
      titleFont: serif,
      titleFontStyle: "normal",
      labelFontStyle: "normal",
      titlePadding: Math.round(5 * scale + 2),
      labelPadding: Math.round(3 * scale + 1),
      grid: true,
      tickSize: Math.max(4, Math.round(3 * scale)),
      labelLimit: Math.round(200 * scale),
      titleLimit: Math.round(240 * scale),
      labelOverlap: true,
      labelFlush: true,
    },
    legend: {
      labelColor: theme.font.color,
      titleColor: theme.font.color,
      labelFontSize: px(theme.fontSize.legend),
      titleFontSize: px(theme.fontSize.legend),
      labelFont: serif,
      titleFont: serif,
      symbolType: "circle",
      titleLimit: Math.round(160 * scale),
      labelLimit: Math.round(140 * scale),
      padding: Math.round(3 * scale),
      offset: Math.round(4 * scale),
      rowPadding: Math.round(2 * scale),
      columnPadding: Math.round(6 * scale),
      symbolSize: Math.round(40 * scale),
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
