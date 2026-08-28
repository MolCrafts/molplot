import { VegaChart } from "./chart_base";
import { scatterSpec, type VegaLiteSpec } from "./specs";
import type { ChartTheme } from "./theme";
import type { ScatterChartConfig, ScatterClickEvent } from "./types";

type ClickListener = (e: ScatterClickEvent) => void;

/**
 * Points scatter with an optional single-point highlight ring and an optional
 * colour channel (constant / per-point / numeric-with-scale). Colour scales
 * name the same schemes as the Python side (`viridis`, `RdBu`, …) so a
 * PCA/embedding plot keeps its colouring across web and paper renders.
 */
export class ScatterChart extends VegaChart {
  private config: ScatterChartConfig;
  private highlightIndex: number | null;
  private readonly clickListeners = new Set<ClickListener>();

  constructor(container: HTMLElement, config: ScatterChartConfig) {
    super(container, config.theme ?? "auto", config.preset);
    this.config = config;
    this.highlightIndex = config.highlight?.index ?? null;
  }

  async update(partial: Partial<ScatterChartConfig>): Promise<void> {
    this.config = { ...this.config, ...partial };
    if (partial.theme) this.themeMode = partial.theme;
    if (partial.highlight !== undefined) {
      this.highlightIndex = partial.highlight?.index ?? null;
    }
    await this.rerender();
  }

  async setHighlight(index: number | null): Promise<void> {
    this.highlightIndex = index;
    await this.setData("highlight", this.highlightRows());
  }

  onPointClick(cb: ClickListener): () => void {
    this.clickListeners.add(cb);
    return () => {
      this.clickListeners.delete(cb);
    };
  }

  private pointRows(): Record<string, unknown>[] {
    const colorArr = Array.isArray(this.config.marker?.color)
      ? (this.config.marker?.color as (string | number)[])
      : null;
    return this.config.points.map((p, i) => ({
      i,
      x: p.x,
      y: p.y,
      customdata: p.customdata,
      c: colorArr ? colorArr[i] : undefined,
    }));
  }

  private highlightRows(): Record<string, unknown>[] {
    const idx = this.highlightIndex;
    if (idx === null || idx < 0 || idx >= this.config.points.length) return [];
    const p = this.config.points[idx];
    return [{ x: p.x, y: p.y }];
  }

  protected datasets(): Record<string, unknown[]> {
    return { table: this.pointRows(), highlight: this.highlightRows() };
  }

  protected buildSpec(
    theme: ChartTheme,
    sizeHint: { width: number; height: number },
  ): VegaLiteSpec {
    return scatterSpec(this.config, theme, {
      width: "container",
      height: sizeHint.height,
    });
  }

  protected resizeChanged(): boolean {
    return false;
  }

  protected onDatum(datum: Record<string, unknown>): void {
    if (typeof datum.i !== "number") return;
    for (const cb of this.clickListeners) {
      cb({
        index: datum.i as number,
        x: datum.x as number,
        y: datum.y as number,
        customdata: datum.customdata,
      });
    }
  }
}
