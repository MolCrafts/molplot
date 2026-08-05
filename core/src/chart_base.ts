import {
  type VegaLiteSpec,
  ZOOM_EVENT_FLAG,
  type ZoomChannel,
  zoomParamsOf,
} from "./specs";
import { type ChartTheme, resolveTheme } from "./theme";
import type { ThemeMode } from "./types";
import { loadVegaEmbed, type VegaEmbed } from "./vega_loader";

/** A scenegraph item's box, in the plot rectangle's coordinate frame. */
export interface Bounds {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

interface SceneItem {
  role?: string;
  bounds?: Bounds;
  items?: SceneItem[];
}

/** Minimal shape of the vega-embed result we depend on. */
export interface EmbedResult {
  view: {
    data(name: string, values?: unknown[]): unknown;
    resize(): { run(): unknown };
    run(): unknown;
    /** Top-left of the plot rectangle within the rendered element. */
    origin(): number[];
    signal(name: string): unknown;
    /** Named scale: data value → plot-local pixel (undefined if missing). */
    scale(name: string): ((value: number) => number) | undefined;
    scenegraph(): { root: SceneItem };
    addEventListener(
      type: string,
      handler: (e: unknown, item?: unknown) => void,
    ): void;
    finalize(): void;
  };
}

/** A wheel event carrying the axis-gutter flags the zoom params filter on. */
type ZoomWheelEvent = WheelEvent & {
  [ZOOM_EVENT_FLAG.x]?: boolean;
  [ZOOM_EVENT_FLAG.y]?: boolean;
};

/**
 * Which axis, if any, the pointer sits on. All coordinates share the plot
 * rectangle's frame: its interior is `[0, width] × [0, height]`, so an axis
 * governing x lies above or below it and one governing y lies beside it.
 *
 * `axes` must be the `role: "axis"` scenegraph items. Vega emits one per axis
 * plus one per grid; a grid's box *is* the plot edge, so its centre lands on
 * the boundary and it classifies as neither gutter. Legends carry
 * `role: "legend"` and never reach here — a legend drawn under the x axis
 * (gantt) must stay inert.
 */
export function axisChannelAt(
  axes: Bounds[],
  x: number,
  y: number,
  width: number,
  height: number,
): ZoomChannel | null {
  if (x >= 0 && x <= width && y >= 0 && y <= height) return null;
  for (const box of axes) {
    if (x < box.x1 || x > box.x2 || y < box.y1 || y > box.y2) continue;
    const centreY = (box.y1 + box.y2) / 2;
    if (centreY > height || centreY < 0) return "x";
    const centreX = (box.x1 + box.x2) / 2;
    if (centreX < 0 || centreX > width) return "y";
  }
  return null;
}

/** Boxes of every axis Vega drew, in the plot rectangle's frame. */
function axisBounds(root: SceneItem): Bounds[] {
  const out: Bounds[] = [];
  for (const frame of root.items ?? [])
    for (const item of frame.items ?? [])
      if (item.role === "axis" && item.bounds) out.push(item.bounds);
  return out;
}

/**
 * Shared lifecycle for every chart: lazy vega-embed load, spec→embed render,
 * cheap streaming data updates (`view.data(name, rows)`), rAF-debounced
 * re-embed on resize, `<html class="dark">` theme tracking, and click→datum
 * wiring. Subclasses implement {@link buildSpec} (produce a Vega-Lite spec —
 * the portable intermediate language) and {@link datasets} (current rows per
 * named dataset), and optionally {@link onDatum} (turn a clicked datum into a
 * typed event).
 */
export abstract class VegaChart {
  protected readonly container: HTMLElement;
  protected themeMode: ThemeMode;
  protected presetName: string | undefined;
  protected disposed = false;
  protected embed: VegaEmbed | null = null;
  protected result: EmbedResult | null = null;
  protected readonly mountPromise: Promise<void>;
  private resizeObserver: ResizeObserver | null = null;
  private themeObserver: MutationObserver | null = null;
  private detachAxisZoom: (() => void) | null = null;
  /** The element Vega rendered into, and whether its spec declares zoom params. */
  private rendered: Element | null = null;
  private zoomable = false;
  private resizeRaf: number | null = null;
  private lastW = 0;
  private lastH = 0;
  private renderInFlight: Promise<void> | null = null;

  constructor(
    container: HTMLElement,
    themeMode: ThemeMode,
    presetName?: string,
  ) {
    this.container = container;
    this.themeMode = themeMode;
    this.presetName = presetName;
    this.mountPromise = this.mount();
    this.setupResizeObserver();
    this.detachAxisZoom = this.bindAxisHoverZoom();
    if (this.themeMode === "auto") this.setupThemeObserver();
  }

  /** Resolves once the initial render completes. */
  ready(): Promise<void> {
    return this.mountPromise;
  }

  async resize(): Promise<void> {
    await this.mountPromise;
    if (this.disposed) return;
    await this.render();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (
      this.resizeRaf !== null &&
      typeof cancelAnimationFrame !== "undefined"
    ) {
      cancelAnimationFrame(this.resizeRaf);
    }
    this.resizeObserver?.disconnect();
    this.themeObserver?.disconnect();
    this.detachAxisZoom?.();
    this.resizeObserver = null;
    this.themeObserver = null;
    this.detachAxisZoom = null;
    this.result?.view.finalize();
    this.result = null;
    this.rendered = null;
  }

  /** Build the Vega-Lite spec for the current state + theme. */
  protected abstract buildSpec(
    theme: ChartTheme,
    size: { width: number; height: number },
  ): VegaLiteSpec;

  /** Current rows per named dataset referenced by the spec. */
  protected abstract datasets(): Record<string, unknown[]>;

  /** Handle a clicked datum. Default: no-op. */
  protected onDatum(_datum: Record<string, unknown>): void {}

  private async mount(): Promise<void> {
    this.embed = await loadVegaEmbed();
    if (this.disposed) return;
    await this.render();
  }

  /** Full re-embed. Serialised so a theme/resize fire can't interleave. */
  protected async render(): Promise<void> {
    if (this.renderInFlight) await this.renderInFlight;
    const run = this.renderImpl();
    this.renderInFlight = run.finally(() => {
      if (this.renderInFlight === run) this.renderInFlight = null;
    });
    return run;
  }

  private async renderImpl(): Promise<void> {
    if (!this.embed || this.disposed) return;
    const theme = resolveTheme(this.themeMode, this.presetName);
    const { width, height } = this.dims();
    this.lastW = width;
    this.lastH = height;
    const spec = this.buildSpec(theme, { width, height });
    this.result?.view.finalize();
    this.result = null;
    this.rendered = null;
    const result = (await this.embed(this.container, spec as never, {
      actions: false,
      renderer: "svg",
      tooltip: true,
    })) as unknown as EmbedResult;
    if (this.disposed) {
      result.view.finalize();
      return;
    }
    this.feed(result);
    result.view.addEventListener("click", (_e, item) => {
      const datum = (item as { datum?: Record<string, unknown> } | undefined)
        ?.datum;
      if (datum) this.onDatum(datum);
    });
    // A spec that never went through a builder (RawChart) has no zoom params,
    // so its wheels can skip the hit test entirely.
    this.zoomable = zoomParamsOf(spec).length > 0;
    this.rendered = this.container.querySelector("svg");
    this.result = result;
    this.afterRender(result);
  }

  /**
   * Hook after a successful embed. Default no-op.
   * Annotations are VL layers (see `withAnnotations`), not a post-render overlay.
   */
  protected afterRender(_result: EmbedResult): void {}

  /**
   * Wheel interaction for scale zoom:
   * - Axis gutter → that axis alone (classic molplot behaviour)
   * - Plot interior → both continuous axes (embed-friendly; chat ScrollAreas
   *   no longer need Shift+wheel for a first useful zoom)
   * - Shift+wheel still works via the VL filter without flags
   *
   * Bound once on `container` (vega-embed never replaces it). Non-passive so
   * we can `preventDefault` and stop the host page/chat from scrolling when
   * a zoom actually applies.
   */
  private bindAxisHoverZoom(): () => void {
    const onWheel = (event: Event): void => {
      if (!this.zoomable || !this.result || !this.rendered) return;
      const { view } = this.result;
      const rect = this.rendered.getBoundingClientRect();
      const [originX, originY] = view.origin();
      const wheel = event as ZoomWheelEvent;
      const width = view.signal("width") as number;
      const height = view.signal("height") as number;
      const localX = wheel.clientX - rect.left - originX;
      const localY = wheel.clientY - rect.top - originY;
      const channel = axisChannelAt(
        axisBounds(view.scenegraph().root),
        localX,
        localY,
        width,
        height,
      );
      if (channel) {
        wheel[ZOOM_EVENT_FLAG[channel]] = true;
        wheel.preventDefault();
        return;
      }
      // Plot interior: stamp both flags so ordinary wheel zooms the chart
      // (otherwise only gutter hits or Shift+wheel did anything).
      const inPlot =
        localX >= 0 && localX <= width && localY >= 0 && localY <= height;
      if (inPlot || wheel.shiftKey) {
        wheel[ZOOM_EVENT_FLAG.x] = true;
        wheel[ZOOM_EVENT_FLAG.y] = true;
        wheel.preventDefault();
      }
    };
    const options: AddEventListenerOptions = { capture: true, passive: false };
    this.container.addEventListener("wheel", onWheel, options);
    return () => this.container.removeEventListener("wheel", onWheel, options);
  }

  /** Push the current datasets into a freshly embedded view. */
  private feed(result: EmbedResult): void {
    const data = this.datasets();
    let changed = false;
    for (const [name, rows] of Object.entries(data)) {
      try {
        result.view.data(name, rows);
        changed = true;
      } catch {
        /* dataset not present in this spec — skip */
      }
    }
    if (changed) result.view.resize().run();
  }

  /** Cheap in-place data swap (streaming path); re-embeds if no live view. */
  protected async setData(name: string, rows: unknown[]): Promise<void> {
    await this.mountPromise;
    if (this.disposed) return;
    if (this.result) {
      try {
        this.result.view.data(name, rows);
        this.result.view.resize().run();
        return;
      } catch {
        /* fall through to a full re-embed */
      }
    }
    await this.render();
  }

  /** Await mount then re-embed — the entry point full mutators call. */
  protected async rerender(): Promise<void> {
    await this.mountPromise;
    if (this.disposed) return;
    await this.render();
  }

  protected dims(): { width: number; height: number } {
    const rect = this.container.getBoundingClientRect?.();
    const width = Math.max(1, Math.round(rect?.width || 0) || 640);
    const height = Math.max(1, Math.round(rect?.height || 0) || 320);
    return { width, height };
  }

  /** Whether a ResizeObserver measurement requires a full re-embed. */
  protected resizeChanged(
    previous: { width: number; height: number },
    next: { width: number; height: number },
  ): boolean {
    return previous.width !== next.width || previous.height !== next.height;
  }

  private setupResizeObserver(): void {
    if (typeof ResizeObserver === "undefined") return;
    this.resizeObserver = new ResizeObserver(() => {
      if (this.resizeRaf !== null) return;
      this.resizeRaf = requestAnimationFrame(() => {
        this.resizeRaf = null;
        if (this.disposed) return;
        const { width, height } = this.dims();
        if (
          !this.resizeChanged(
            { width: this.lastW, height: this.lastH },
            { width, height },
          )
        )
          return;
        void this.render();
      });
    });
    this.resizeObserver.observe(this.container);
  }

  private setupThemeObserver(): void {
    if (typeof MutationObserver === "undefined") return;
    if (typeof document === "undefined") return;
    this.themeObserver = new MutationObserver(() => {
      if (this.disposed) return;
      void this.render();
    });
    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
  }
}
