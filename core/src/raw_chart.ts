import { VegaChart } from "./chart_base";
import type { PresetName } from "./preset";
import type { VegaLiteSpec } from "./specs";
import { type ChartTheme, vegaConfig } from "./theme";
import type { ThemeMode } from "./types";

/**
 * Escape hatch: render an arbitrary Vega-Lite spec verbatim. Now that the
 * intermediate language *is* Vega-Lite, "render whatever upstream emitted"
 * (an LLM agent, a saved report, a Python-built spec shipped to the browser)
 * is a first-class path — the same spec the Python package can render to
 * matplotlib. The unified preset `config` is injected unless the spec already
 * carries its own.
 *
 * NOTE (migration): the former plotly-based `RawChart` accepted
 * `{data, layout, config}` plotly JSON. That is not portable to Vega; callers
 * that fed plotly specs must now supply a Vega-Lite spec via `config.spec`.
 */
export interface RawChartConfig {
  /** A Vega-Lite top-level spec. Inline `data.values` is rendered as-is. */
  spec: VegaLiteSpec;
  /**
   * Which unified preset to inject as the spec `config` when the spec carries
   * none. Defaults to the default preset — the same tokens the Python package
   * applies. A spec with its own `config` is always respected verbatim.
   */
  preset?: PresetName;
  /** Theme mode. `auto` (default) tracks `<html class="dark">`. */
  theme?: ThemeMode;
}

export class RawChart extends VegaChart {
  private spec: VegaLiteSpec;

  constructor(container: HTMLElement, config: RawChartConfig) {
    super(container, config.theme ?? "auto", config.preset);
    this.spec = config.spec;
  }

  async update(config: RawChartConfig): Promise<void> {
    this.spec = config.spec;
    await this.rerender();
  }

  protected datasets(): Record<string, unknown[]> {
    return {};
  }

  protected buildSpec(
    theme: ChartTheme,
    sizeHint: { width: number; height: number },
  ): VegaLiteSpec {
    const spec = this.spec ?? {};
    return {
      $schema: "https://vega.github.io/schema/vega-lite/v5.json",
      width: sizeHint.width,
      height: sizeHint.height,
      ...spec,
      config: (spec.config as Record<string, unknown>) ?? vegaConfig(theme),
    };
  }
}
