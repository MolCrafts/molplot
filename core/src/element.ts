import type { PresetName } from "./preset";
import { RawChart } from "./raw_chart";
import type { VegaLiteSpec } from "./specs";
import type { ThemeMode } from "./types";

/**
 * The `<molplot-chart>` custom element — a native Web Component wrapper around
 * {@link RawChart} so a Vega-Lite spec can be dropped straight into Markdown (or
 * any HTML) and rendered live in the browser. The unified molplot preset is
 * injected as the spec `config` (unless the spec carries its own), and
 * `<html class="dark">` is tracked, exactly as {@link RawChart} does.
 *
 * The author-facing content **is a plain Vega-Lite spec** — no bespoke schema.
 * It is read from the first child `<script type="application/json">` block, so
 * multiline JSON with `<`/`>`/braces survives Markdown/HTML sanitization:
 *
 * ```html
 * <molplot-chart preset="molplot" theme="auto">
 *   <script type="application/json">
 *   { "mark": "line",
 *     "data": { "values": [ {"x":0,"y":1}, {"x":1,"y":2} ] },
 *     "encoding": { "x": {"field":"x","type":"quantitative"},
 *                   "y": {"field":"y","type":"quantitative"} } }
 *   </script>
 * </molplot-chart>
 * ```
 *
 * Attributes: `preset` (unified preset name, default the molplot preset),
 * `theme` (`auto` | `light` | `dark`, default `auto`), and `spec` (inline JSON,
 * a one-line alternative to the script block).
 */

/**
 * Parse the Vega-Lite spec an author embedded in a `<molplot-chart>`. Reads the
 * first child `<script type="application/json">`; falls back to a `spec`
 * attribute holding inline JSON. Returns null when no spec is present or the
 * JSON is malformed — the element renders an inline error rather than throwing,
 * so a typo in one doc block never breaks the page.
 */
export function parseSpec(el: HTMLElement): VegaLiteSpec | null {
  const script = el.querySelector('script[type="application/json"]');
  const raw = script?.textContent ?? el.getAttribute("spec");
  if (!raw?.trim()) return null;
  try {
    return JSON.parse(raw) as VegaLiteSpec;
  } catch {
    return null;
  }
}

/** Coerce a `theme` attribute to a valid mode, defaulting to `auto`. */
function parseTheme(value: string | null): ThemeMode {
  return value === "light" || value === "dark" ? value : "auto";
}

/**
 * Register the `<molplot-chart>` custom element. Idempotent and browser-only:
 * a no-op when there is no `customElements` registry (SSR/Node) or the tag is
 * already defined. The element class is created here, on call, so merely
 * importing this module never evaluates `class extends HTMLElement` — the
 * library stays import-side-effect-free and safe to load in Node.
 */
export function defineMolplotChart(tag = "molplot-chart"): void {
  if (
    typeof customElements === "undefined" ||
    typeof HTMLElement === "undefined"
  )
    return;
  if (customElements.get(tag)) return;

  class MolplotChartElement extends HTMLElement {
    static readonly observedAttributes = ["spec", "preset", "theme"];

    private chart: RawChart | null = null;
    private surface: HTMLElement | null = null;

    connectedCallback(): void {
      this.mount();
    }

    disconnectedCallback(): void {
      this.teardown();
    }

    attributeChangedCallback(): void {
      // Attributes are also set before the first connect; only react once live.
      if (this.isConnected && this.chart) {
        this.teardown();
        this.mount();
      }
    }

    private mount(): void {
      if (this.chart) return; // already mounted (guard double-connect)
      const surface = document.createElement("div");
      // Render into a dedicated child so the base class's `querySelector("svg")`
      // and ResizeObserver have a stable host — never the sibling <script>.
      surface.style.display = "block";
      this.appendChild(surface);
      this.surface = surface;

      const spec = parseSpec(this);
      if (!spec) {
        surface.textContent =
          "molplot-chart: missing or invalid Vega-Lite spec";
        return;
      }
      const preset =
        (this.getAttribute("preset") as PresetName | null) ?? undefined;
      const theme = parseTheme(this.getAttribute("theme"));
      this.chart = new RawChart(surface, { spec, preset, theme });
      void this.chart.ready().then(() => {
        if (this.chart) this.dispatchEvent(new CustomEvent("molplot:ready"));
      });
    }

    private teardown(): void {
      this.chart?.dispose();
      this.chart = null;
      this.surface?.remove();
      this.surface = null;
    }
  }

  customElements.define(tag, MolplotChartElement);
}
