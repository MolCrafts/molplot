import { VegaChart } from "./chart_base";
import { barSpec, type VegaLiteSpec } from "./specs";
import type { ChartTheme } from "./theme";
import type { AxisConfig, LegendConfig, ThemeMode } from "./types";

export interface BarPoint {
  x: number | string;
  y: number;
  /** Optional per-bar text used by the tooltip. */
  text?: string;
  /** Optional payload echoed back in ``onBarClick``. */
  customdata?: unknown;
}

export interface BarSeriesConfig {
  id: string;
  label?: string;
  color?: string;
  points: BarPoint[];
  /**
   * Trace type for this series. Defaults to ``"bar"``; ``"line"`` overlays as
   * a line over stacked / grouped bars (e.g. a "Started" reference line on top
   * of "Succeeded/Failed" bars).
   */
  type?: "bar" | "line";
  /** Retained for API compatibility; tooltips are preset-driven. */
  hovertemplate?: string;
}

export type BarMode = "stack" | "group" | "overlay";

export interface BarChartConfig {
  series: BarSeriesConfig[];
  /** Default ``"group"`` (side-by-side). */
  mode?: BarMode;
  /** Bar orientation: ``"v"`` (default) draws ``y`` over ``x``; ``"h"`` flips them. */
  orientation?: "v" | "h";
  xAxis?: AxisConfig & { dtype?: "category" | "date" | "linear" };
  yAxis?: AxisConfig & { dtype?: "category" | "date" | "linear" };
  /** Show legend strip. Default false. */
  showLegend?: boolean;
  /** Legend orientation / position overrides; honoured only when ``showLegend`` is true. */
  legend?: LegendConfig;
  /** Interaction toolbar visible. Default false. */
  modebar?: boolean;
  /** Retained for API compatibility; advisory under the Vega renderer. */
  modebarRemove?: string[];
  /** Gap between bars as a band-scale padding fraction. */
  bargap?: number;
  theme?: ThemeMode;
  /** Named preset from presets/*.json. Default "molplot". */
  preset?: string;
  /** ``hovermode``; retained for API compatibility. */
  hovermode?: "closest" | "x" | "x unified";
}

export interface BarClickEvent {
  seriesId: string;
  index: number;
  x: number | string;
  y: number;
  customdata?: unknown;
}

type ClickListener = (e: BarClickEvent) => void;

/**
 * Categorical / time bar chart. Stacking & grouping are picked via
 * {@link BarChartConfig.mode}; a `type:"line"` series overlays as a line that
 * tracks the cumulative stack total. Mirrors {@link LineChart}'s lifecycle.
 */
export class BarChart extends VegaChart {
  private config: BarChartConfig;
  private readonly clickListeners = new Set<ClickListener>();

  constructor(container: HTMLElement, config: BarChartConfig) {
    super(container, config.theme ?? "auto", config.preset);
    this.config = config;
  }

  async update(partial: Partial<BarChartConfig>): Promise<void> {
    this.config = { ...this.config, ...partial };
    if (partial.theme) this.themeMode = partial.theme;
    await this.rerender();
  }

  onBarClick(cb: ClickListener): () => void {
    this.clickListeners.add(cb);
    return () => {
      this.clickListeners.delete(cb);
    };
  }

  private barRows(): Record<string, unknown>[] {
    const out: Record<string, unknown>[] = [];
    for (const s of this.config.series) {
      if ((s.type ?? "bar") !== "bar") continue;
      const key = s.label ?? s.id;
      s.points.forEach((p, i) => {
        out.push({
          s: s.id,
          key,
          i,
          cat: p.x,
          val: p.y,
          text: p.text,
          customdata: p.customdata,
        });
      });
    }
    return out;
  }

  private lineRows(): Record<string, unknown>[] {
    const lineSeries = this.config.series.filter((s) => s.type === "line");
    if (lineSeries.length === 0) return [];
    const stack = (this.config.mode ?? "group") === "stack";
    const cumulative: number[] = [];
    if (stack) {
      for (const s of this.config.series) {
        if ((s.type ?? "bar") !== "bar") continue;
        s.points.forEach((p, i) => {
          cumulative[i] = (cumulative[i] ?? 0) + (p.y ?? 0);
        });
      }
    }
    const out: Record<string, unknown>[] = [];
    for (const s of lineSeries) {
      const key = s.label ?? s.id;
      s.points.forEach((p, i) => {
        out.push({
          s: s.id,
          key,
          i,
          cat: p.x,
          val: stack ? (cumulative[i] ?? 0) : p.y,
          customdata: p.customdata,
        });
      });
    }
    return out;
  }

  protected datasets(): Record<string, unknown[]> {
    const data: Record<string, unknown[]> = { table: this.barRows() };
    const line = this.lineRows();
    if (line.length > 0) data.line = line;
    return data;
  }

  protected buildSpec(
    theme: ChartTheme,
    sizeHint: { width: number; height: number },
  ): VegaLiteSpec {
    return barSpec(this.config, theme, {
      width: "container",
      height: sizeHint.height,
    });
  }

  protected resizeChanged(): boolean {
    return false;
  }

  protected onDatum(datum: Record<string, unknown>): void {
    if (typeof datum.s !== "string") return;
    for (const cb of this.clickListeners) {
      cb({
        seriesId: datum.s as string,
        index: datum.i as number,
        x: datum.cat as number | string,
        y: datum.val as number,
        customdata: datum.customdata,
      });
    }
  }
}
