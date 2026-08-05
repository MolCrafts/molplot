import { takeAnnotations, withAnnotations } from "./annotations";
import { VegaChart } from "./chart_base";
import type { PresetName } from "./preset";
import {
  interactionParams,
  type VegaLiteSpec,
  type ZoomChannel,
} from "./specs";
import { type ChartTheme, fontScaleForWidth, vegaConfig } from "./theme";
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
  /** Add scale-bound pan/zoom controls when the spec has none. Default: true. */
  interactive?: boolean;
  /** Responsive width:height ratio. Default: 4 / 3. */
  aspectRatio?: number;
}

export class RawChart extends VegaChart {
  private spec: VegaLiteSpec;
  private interactive: boolean;
  private aspectRatio: number;

  constructor(container: HTMLElement, config: RawChartConfig) {
    super(container, config.theme ?? "auto", config.preset);
    this.spec = config.spec;
    this.interactive = config.interactive ?? true;
    this.aspectRatio = config.aspectRatio ?? 4 / 3;
  }

  async update(config: RawChartConfig): Promise<void> {
    this.spec = config.spec;
    this.interactive = config.interactive ?? true;
    this.aspectRatio = config.aspectRatio ?? 4 / 3;
    await this.rerender();
  }

  protected datasets(): Record<string, unknown[]> {
    return {};
  }

  protected resizeChanged(
    previous: { width: number; height: number },
    next: { width: number; height: number },
  ): boolean {
    // With the default 4:3 size, height is derived exclusively from width.
    // SVG axes can perturb an auto-height DOM box, but that is render output,
    // not an input resize. Ignoring it prevents ResizeObserver → re-embed loops.
    if (this.spec?.height === undefined) return previous.width !== next.width;
    return super.resizeChanged(previous, next);
  }

  protected buildSpec(
    theme: ChartTheme,
    sizeHint: { width: number; height: number },
  ): VegaLiteSpec {
    // Strip top-level `annotations` and expand to VL layers (scale bar / arrow).
    const taken = takeAnnotations({ ...(this.spec ?? {}) });
    const spec = withAnnotations(taken.spec, taken.annotations);
    const channels = this.interactive ? continuousChannels(spec) : [];
    // Prefer the host box height when the element has a real layout size so a
    // 4:3 (or author aspect) frame is fully painted — not a short SVG floating
    // in a taller white box. Fall back to width/aspect for headless/zero-size.
    const derivedHeight = Math.max(
      1,
      Math.round(sizeHint.width / this.aspectRatio),
    );
    const height =
      sizeHint.height > 1
        ? Math.max(1, Math.round(sizeHint.height))
        : derivedHeight;
    const scale = fontScaleForWidth(sizeHint.width);
    const baseConfig = vegaConfig(theme, scale);
    const authorConfig =
      spec.config && typeof spec.config === "object"
        ? (spec.config as Record<string, unknown>)
        : null;
    const config = authorConfig
      ? deepMergeConfig(baseConfig, authorConfig)
      : baseConfig;

    // `fit` + `contains: "padding"`: width/height are the outer SVG box
    // (axes + legends + pad). Multi-legend specs stay inside the host without
    // overlapping titles when type sizes stay moderate.
    const base: VegaLiteSpec = {
      $schema: "https://vega.github.io/schema/vega-lite/v5.json",
      width: sizeHint.width,
      height,
      autosize: { type: "fit", contains: "padding" },
      ...spec,
      config,
    };

    if (channels.length === 0) return base;

    const zoom = interactionParams(channels);
    // Layered agent/LLM specs put encoding on layer[0]; zoom params must live
    // on a *unit* layer (top-level params on layered specs are illegal /
    // duplicate). Unit specs take top-level params.
    const layers = Array.isArray(spec.layer)
      ? (spec.layer as Record<string, unknown>[])
      : null;
    if (layers && layers.length > 0) {
      const nextLayers = layers.map((layer, i) => {
        if (i !== 0) return layer;
        return {
          ...layer,
          params: mergeZoomParams(layer.params, zoom),
        };
      });
      // Drop any top-level params so we don't duplicate zoom signal names.
      const { params: _drop, ...rest } = base;
      return { ...rest, layer: nextLayers };
    }

    return {
      ...base,
      params: mergeZoomParams(spec.params, zoom),
    };
  }
}

/** Keep author params; replace/add molplot zoom binds by name. */
function mergeZoomParams(
  existing: unknown,
  zoom: ReturnType<typeof interactionParams>,
): unknown[] {
  const zoomNames = new Set(zoom.map((p) => p.name));
  const kept: unknown[] = [];
  if (Array.isArray(existing)) {
    for (const p of existing) {
      const name =
        p && typeof p === "object" && "name" in p
          ? String((p as { name: unknown }).name)
          : "";
      if (name && zoomNames.has(name as "zoomX" | "zoomY")) continue;
      kept.push(p);
    }
  }
  return [...kept, ...zoom];
}

/** Deep-merge plain config objects (arrays / scalars replaced, objects merged). */
function deepMergeConfig(
  base: Record<string, unknown>,
  over: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(over)) {
    const prev = out[key];
    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      prev !== null &&
      typeof prev === "object" &&
      !Array.isArray(prev)
    ) {
      out[key] = deepMergeConfig(
        prev as Record<string, unknown>,
        value as Record<string, unknown>,
      );
    } else {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Continuous x/y channels from a unit spec **or** the first layer of a
 * layered spec (agent/LLM VL almost always uses ``layer``).
 */
function continuousChannels(spec: VegaLiteSpec): ZoomChannel[] {
  const top = spec.encoding as
    | Record<string, { type?: string } | undefined>
    | undefined;
  const layers = Array.isArray(spec.layer)
    ? (spec.layer as { encoding?: Record<string, { type?: string }> }[])
    : [];
  const encoding =
    top ?? layers.find((layer) => layer?.encoding)?.encoding ?? undefined;
  return (["x", "y"] as const).filter((channel) => {
    const type = encoding?.[channel]?.type;
    return type === "quantitative" || type === "temporal";
  });
}
