import { VegaChart } from "./chart_base";
import { lineSpec, type VegaLiteSpec } from "./specs";
import type { ChartTheme } from "./theme";
import type {
  LineChartClickEvent,
  LineChartConfig,
  LineSeriesConfig,
  SeriesPoint,
} from "./types";

type ClickListener = (e: LineChartClickEvent) => void;

/**
 * Streaming line chart. Holds one `{x[], y[]}` buffer per series and pushes
 * cheap `view.data("table", rows)` updates on each mutation (no re-embed). The
 * streaming method surface (`appendPoint` / `appendPoints` / `setSeries` /
 * `setWindow`) is preserved verbatim from the former plotly build so consumers
 * like molexp's metric panes keep working unchanged.
 */
export class LineChart extends VegaChart {
  private config: LineChartConfig;
  private readonly seriesIds: string[];
  private readonly buffers: Map<string, { x: number[]; y: number[] }>;
  private readonly seriesConfigs: Map<string, LineSeriesConfig>;
  private readonly clickListeners = new Set<ClickListener>();
  private windowSize: number | null;

  constructor(container: HTMLElement, config: LineChartConfig) {
    super(container, config.theme ?? "auto", config.preset);
    this.config = config;
    this.seriesIds = config.series.map((s) => s.id);
    this.buffers = new Map();
    this.seriesConfigs = new Map();
    this.windowSize = config.windowSize ?? null;
    for (const s of config.series) {
      const pts = s.initialPoints ?? [];
      this.buffers.set(s.id, {
        x: pts.map((p) => p.x),
        y: pts.map((p) => p.y),
      });
      this.seriesConfigs.set(s.id, s);
    }
  }

  async setSeries(id: string, points: SeriesPoint[]): Promise<void> {
    if (!this.buffers.has(id))
      throw new Error(`LineChart: unknown series ${id}`);
    const buf = { x: points.map((p) => p.x), y: points.map((p) => p.y) };
    this.trim(buf);
    this.buffers.set(id, buf);
    await this.setData("table", this.rows());
  }

  async appendPoint(id: string, point: SeriesPoint): Promise<void> {
    await this.appendPoints(id, [point]);
  }

  async appendPoints(id: string, points: SeriesPoint[]): Promise<void> {
    if (points.length === 0) return;
    const buf = this.buffers.get(id);
    if (!buf) throw new Error(`LineChart: unknown series ${id}`);
    const series = this.seriesConfigs.get(id);
    const key = series?.label ?? id;
    const start = buf.x.length;
    for (const p of points) {
      buf.x.push(p.x);
      buf.y.push(p.y);
    }
    if (this.windowSize !== null && buf.x.length > this.windowSize) {
      this.trim(buf);
      await this.setData("table", this.rows());
      return;
    }
    const rows = points.map((p, offset) => ({
      s: id,
      key,
      i: start + offset,
      x: p.x,
      y: p.y,
    }));
    if (!(await this.insertData("table", rows))) {
      await this.setData("table", this.rows());
    }
  }

  async clear(id?: string): Promise<void> {
    const ids = id ? [id] : this.seriesIds;
    for (const seriesId of ids) {
      const buf = this.buffers.get(seriesId);
      if (buf) {
        buf.x.length = 0;
        buf.y.length = 0;
      }
    }
    await this.setData("table", this.rows());
  }

  async setWindow(maxPoints: number | null): Promise<void> {
    this.windowSize = maxPoints;
    if (maxPoints !== null) {
      for (const buf of this.buffers.values()) this.trim(buf);
    }
    await this.setData("table", this.rows());
  }

  async setAxisRange(
    axis: "x" | "y",
    range: [number, number] | "auto",
  ): Promise<void> {
    const value = range === "auto" ? undefined : range;
    const key = axis === "x" ? "xAxis" : "yAxis";
    this.config = {
      ...this.config,
      [key]: { ...(this.config[key] ?? {}), range: value },
    };
    await this.rerender();
  }

  onPointClick(cb: ClickListener): () => void {
    this.clickListeners.add(cb);
    return () => {
      this.clickListeners.delete(cb);
    };
  }

  private trim(buf: { x: number[]; y: number[] }): void {
    if (this.windowSize === null || buf.x.length <= this.windowSize) return;
    const drop = buf.x.length - this.windowSize;
    buf.x.splice(0, drop);
    buf.y.splice(0, drop);
  }

  private rows(): Record<string, unknown>[] {
    const out: Record<string, unknown>[] = [];
    for (const s of this.config.series) {
      const key = s.label ?? s.id;
      const buf = this.buffers.get(s.id) ?? { x: [], y: [] };
      for (let i = 0; i < buf.x.length; i++) {
        out.push({ s: s.id, key, i, x: buf.x[i], y: buf.y[i] });
      }
    }
    return out;
  }

  protected datasets(): Record<string, unknown[]> {
    return { table: this.rows() };
  }

  protected buildSpec(
    theme: ChartTheme,
    _sizeHint: { width: number; height: number },
  ): VegaLiteSpec {
    return lineSpec(this.config, theme, {
      width: "container",
      height: "container",
    });
  }

  /** Width and height are `"container"` — never re-embed just because the box changed. */
  protected resizeChanged(): boolean {
    return false;
  }

  protected onDatum(datum: Record<string, unknown>): void {
    if (typeof datum.s !== "string") return;
    for (const cb of this.clickListeners) {
      cb({
        seriesId: datum.s as string,
        index: datum.i as number,
        x: datum.x as number,
        y: datum.y as number,
      });
    }
  }
}
