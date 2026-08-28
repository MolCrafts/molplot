import { VegaChart } from "./chart_base";
import { ganttSpec, type VegaLiteSpec } from "./specs";
import type { ChartTheme } from "./theme";
import type { AxisConfig, ThemeMode } from "./types";

export interface GanttTask {
  /** Stable identifier — surfaced in click events. */
  id: string;
  /** Y-axis label; tasks with the same label collapse onto one row. */
  label: string;
  start: Date | string | number;
  end: Date | string | number;
  /** Bucket key into {@link GanttChartConfig.statusColors}. */
  statusGroup: string;
  /** Optional inline hover text; falls back to a default if omitted. */
  hover?: string;
  /** Free-form payload echoed back in click events. */
  customdata?: unknown;
}

export interface GanttChartConfig {
  tasks: GanttTask[];
  /** Map ``statusGroup`` → CSS colour. Missing keys fall back to ``#a3a3a3``. */
  statusColors: Record<string, string>;
  /** Optional friendly label per status group used in the legend. */
  statusLabels?: Record<string, string>;
  /** Optional per-status opacity (0–1) to fade pending/queued bars. */
  statusOpacity?: Record<string, number>;
  /** Order in which legend groups appear. Unknown keys are appended. */
  statusOrder?: string[];
  /** Bar thickness in pixels. Default 18. */
  barWidth?: number;
  /** Per-row spacing in pixels — drives total height. Default 28. */
  rowHeight?: number;
  /** Show the legend strip. Default true. */
  showLegend?: boolean;
  xAxis?: AxisConfig;
  modebar?: boolean;
  theme?: ThemeMode;
  /** Named preset from presets/*.json. Default "molplot". */
  preset?: string;
}

export interface GanttClickEvent {
  taskId: string;
  label: string;
  customdata?: unknown;
}

type ClickListener = (e: GanttClickEvent) => void;

const toIso = (value: Date | string | number): string => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") return new Date(value).toISOString();
  return value;
};

/**
 * Gantt chart drawn as one time-spanning bar per task (Vega-Lite bar with
 * `x`/`x2`), coloured by status group. Cleaner than the former plotly
 * line-segment recipe while keeping the same config surface and the
 * `onTaskClick` contract.
 */
export class GanttChart extends VegaChart {
  private config: GanttChartConfig;
  private readonly clickListeners = new Set<ClickListener>();

  constructor(container: HTMLElement, config: GanttChartConfig) {
    super(container, config.theme ?? "auto", config.preset);
    this.config = config;
  }

  async update(partial: Partial<GanttChartConfig>): Promise<void> {
    this.config = { ...this.config, ...partial };
    if (partial.theme) this.themeMode = partial.theme;
    await this.rerender();
  }

  onTaskClick(cb: ClickListener): () => void {
    this.clickListeners.add(cb);
    return () => {
      this.clickListeners.delete(cb);
    };
  }

  private rows(): Record<string, unknown>[] {
    return this.config.tasks.map((t) => ({
      id: t.id,
      label: t.label,
      start: toIso(t.start),
      end: toIso(t.end),
      group: t.statusGroup,
      groupLabel: this.config.statusLabels?.[t.statusGroup] ?? t.statusGroup,
      customdata: t.customdata,
    }));
  }

  protected datasets(): Record<string, unknown[]> {
    return { table: this.rows() };
  }

  protected buildSpec(
    theme: ChartTheme,
    sizeHint: { width: number; height: number },
  ): VegaLiteSpec {
    return ganttSpec(this.config, theme, {
      width: "container",
      height: sizeHint.height,
    });
  }

  protected resizeChanged(): boolean {
    return false;
  }

  protected onDatum(datum: Record<string, unknown>): void {
    if (typeof datum.id !== "string") return;
    for (const cb of this.clickListeners) {
      cb({
        taskId: datum.id as string,
        label: datum.label as string,
        customdata: datum.customdata,
      });
    }
  }
}
