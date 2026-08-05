/**
 * Chart annotations — matplotlib-style artists drawn in **screen space**.
 *
 * Vega-Lite has no `annotate` / `arrowstyle='|-|'`. Geometry that must stay
 * visually perpendicular (log axes, non-square panels) is computed at render
 * time from Vega's scale functions, not pre-baked into VL layers.
 *
 * - {@link scaleBar}: complete `|———|` (spine + both caps + label)
 * - {@link arrow}: shaft + tip + optional label
 *
 * Put an `annotations` array on the RawChart / fence payload. RawChart strips
 * it before embed and paints an SVG overlay after layout / on pan-zoom.
 */

export type ScaleBarAnnotation = {
  kind: "scaleBar";
  /** Start in data coordinates (on the curve for `along`). */
  x: number;
  y: number;
  /** End in data coordinates (with `x2`/`y2` → along-curve bar). */
  x2?: number;
  y2?: number;
  /** Axis-aligned length when only one end is given. */
  length?: number;
  label?: string;
  color?: string;
  /** Stroke width in CSS px. Default 1.8. */
  strokeWidth?: number;
  /**
   * `along` (default when both ends set): bar parallel to (x,y)→(x2,y2).
   * `horizontal` / `vertical`: axis-aligned size bar.
   */
  orientation?: "horizontal" | "vertical" | "along";
  /**
   * Screen-space offset of an `along` bar from the chord, as a fraction of
   * the shorter plot side (default 0.05). Keeps the bar off the curve.
   */
  offset?: number;
  /**
   * End-cap half-length in screen px (default 8).
   */
  capSize?: number;
  /** Label font size in px (default 14). */
  fontSize?: number;
};

export type ArrowAnnotation = {
  kind: "arrow";
  x: number;
  y: number;
  x2: number;
  y2: number;
  label?: string;
  color?: string;
  strokeWidth?: number;
  /** Tip size in px (default 8). */
  tipSize?: number;
  fontSize?: number;
};

export type Annotation = ScaleBarAnnotation | ArrowAnnotation;

/** Factory: one complete `|———|`. */
export function scaleBar(
  partial: Omit<ScaleBarAnnotation, "kind">,
): ScaleBarAnnotation {
  const hasEnds = partial.x2 != null && partial.y2 != null;
  return {
    color: "#18432b",
    strokeWidth: 1.8,
    orientation: hasEnds ? "along" : "horizontal",
    offset: 0.05,
    capSize: 8,
    fontSize: 14,
    ...partial,
    kind: "scaleBar",
  };
}

/** Factory: one complete arrow. */
export function arrow(
  partial: Omit<ArrowAnnotation, "kind">,
): ArrowAnnotation {
  return {
    color: "#18432b",
    strokeWidth: 1.6,
    tipSize: 8,
    fontSize: 14,
    ...partial,
    kind: "arrow",
  };
}

/**
 * Pull top-level `annotations` off a payload (ignored by Vega-Lite).
 * Returns a clean VL-shaped object plus the annotation list.
 */
export function takeAnnotations(spec: Record<string, unknown>): {
  spec: Record<string, unknown>;
  annotations: Annotation[];
} {
  const raw = spec.annotations;
  if (!Array.isArray(raw) || raw.length === 0) {
    if ("annotations" in spec) {
      const { annotations: _drop, ...rest } = spec;
      return { spec: rest, annotations: [] };
    }
    return { spec, annotations: [] };
  }
  const annotations = raw.filter(
    (a): a is Annotation =>
      !!a &&
      typeof a === "object" &&
      ((a as Annotation).kind === "scaleBar" ||
        (a as Annotation).kind === "arrow"),
  );
  const { annotations: _drop, ...rest } = spec;
  return { spec: rest, annotations };
}

/** Minimal view surface needed to project data → SVG pixels. */
export interface AnnotationView {
  /** Vega scale: data value → plot-local pixel. */
  scale(name: string): ((v: number) => number) | undefined;
  /** Top-left of the plot rectangle inside the SVG. */
  origin(): number[];
  signal(name: string): unknown;
}

const SVG_NS = "http://www.w3.org/2000/svg";
const OVERLAY_ATTR = "data-molplot-annotations";

function lineEl(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  width: number,
): SVGLineElement {
  const el = document.createElementNS(SVG_NS, "line");
  el.setAttribute("x1", String(x1));
  el.setAttribute("y1", String(y1));
  el.setAttribute("x2", String(x2));
  el.setAttribute("y2", String(y2));
  el.setAttribute("stroke", color);
  el.setAttribute("stroke-width", String(width));
  el.setAttribute("stroke-linecap", "butt");
  return el;
}

function textEl(
  x: number,
  y: number,
  text: string,
  color: string,
  fontSize: number,
): SVGTextElement {
  const el = document.createElementNS(SVG_NS, "text");
  el.setAttribute("x", String(x));
  el.setAttribute("y", String(y));
  el.setAttribute("fill", color);
  el.setAttribute("font-size", String(fontSize));
  el.setAttribute(
    "font-family",
    "Times New Roman, Times, STIX Two Text, STIXGeneral, serif",
  );
  el.setAttribute("font-style", "normal");
  el.setAttribute("text-anchor", "middle");
  el.setAttribute("dominant-baseline", "middle");
  el.textContent = text;
  return el;
}

/**
 * Paint annotations into `svg` using the live Vega scales (screen-correct).
 * Idempotent: replaces any previous overlay group. `pointer-events: none`
 * so pan/zoom on the plot still works.
 */
export function drawAnnotations(
  svg: SVGSVGElement,
  view: AnnotationView,
  annotations: Annotation[],
): void {
  svg.querySelector(`[${OVERLAY_ATTR}]`)?.remove();
  if (!annotations.length) return;

  const xScale = view.scale("x");
  const yScale = view.scale("y");
  if (!xScale || !yScale) return;

  const [ox, oy] = view.origin();
  const width = Number(view.signal("width")) || 0;
  const height = Number(view.signal("height")) || 0;
  if (width <= 0 || height <= 0) return;

  const toPx = (x: number, y: number): [number, number] => [
    ox + xScale(x),
    oy + yScale(y),
  ];

  const g = document.createElementNS(SVG_NS, "g");
  g.setAttribute(OVERLAY_ATTR, "");
  g.setAttribute("style", "pointer-events: none");

  for (const a of annotations) {
    if (a.kind === "scaleBar") drawScaleBar(g, a, toPx, width, height);
    else if (a.kind === "arrow") drawArrow(g, a, toPx);
  }

  svg.appendChild(g);
}

function drawScaleBar(
  g: SVGGElement,
  a: ScaleBarAnnotation,
  toPx: (x: number, y: number) => [number, number],
  plotW: number,
  plotH: number,
): void {
  const color = a.color ?? "#18432b";
  const sw = a.strokeWidth ?? 1.8;
  const capHalf = a.capSize ?? 8;
  const fontSize = a.fontSize ?? 14;
  const orient =
    a.orientation ??
    (a.x2 != null && a.y2 != null ? "along" : "horizontal");

  let x0 = a.x;
  let y0 = a.y;
  let x1: number;
  let y1: number;

  if (orient === "along" && a.x2 != null && a.y2 != null) {
    x1 = a.x2;
    y1 = a.y2;
  } else if (orient === "vertical") {
    x1 = a.x;
    y1 = a.y2 ?? a.y + (a.length ?? 0);
  } else {
    x1 = a.x2 ?? a.x + (a.length ?? 0);
    y1 = a.y;
  }

  let [px0, py0] = toPx(x0, y0);
  let [px1, py1] = toPx(x1, y1);

  // Screen-space direction along the bar
  let dx = px1 - px0;
  let dy = py1 - py0;
  const len = Math.hypot(dx, dy) || 1;
  const tx = dx / len;
  const ty = dy / len;
  // Screen-space normal (rotate 90°)
  let nx = -ty;
  let ny = tx;
  // Prefer normal that points "up" on screen (smaller y in SVG)
  if (ny > 0) {
    nx = -nx;
    ny = -ny;
  }

  if (orient === "along") {
    const offsetPx =
      (a.offset ?? 0.05) * Math.min(plotW, plotH);
    px0 += nx * offsetPx;
    py0 += ny * offsetPx;
    px1 += nx * offsetPx;
    py1 += ny * offsetPx;
  }

  // Spine
  g.appendChild(lineEl(px0, py0, px1, py1, color, sw));
  // Caps ⊥ spine in screen space
  g.appendChild(
    lineEl(
      px0 + nx * capHalf,
      py0 + ny * capHalf,
      px0 - nx * capHalf,
      py0 - ny * capHalf,
      color,
      sw,
    ),
  );
  g.appendChild(
    lineEl(
      px1 + nx * capHalf,
      py1 + ny * capHalf,
      px1 - nx * capHalf,
      py1 - ny * capHalf,
      color,
      sw,
    ),
  );

  if (a.label) {
    const mx = (px0 + px1) / 2 + nx * (capHalf + fontSize * 0.7);
    const my = (py0 + py1) / 2 + ny * (capHalf + fontSize * 0.7);
    g.appendChild(textEl(mx, my, a.label, color, fontSize));
  }
}

function drawArrow(
  g: SVGGElement,
  a: ArrowAnnotation,
  toPx: (x: number, y: number) => [number, number],
): void {
  const color = a.color ?? "#18432b";
  const sw = a.strokeWidth ?? 1.6;
  const tip = a.tipSize ?? 8;
  const [px0, py0] = toPx(a.x, a.y);
  const [px1, py1] = toPx(a.x2, a.y2);
  g.appendChild(lineEl(px0, py0, px1, py1, color, sw));

  const dx = px1 - px0;
  const dy = py1 - py0;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  // Arrowhead as two short lines
  const hx = -ux * tip + -uy * tip * 0.5;
  const hy = -uy * tip + ux * tip * 0.5;
  const hx2 = -ux * tip + uy * tip * 0.5;
  const hy2 = -uy * tip + -ux * tip * 0.5;
  g.appendChild(lineEl(px1, py1, px1 + hx, py1 + hy, color, sw));
  g.appendChild(lineEl(px1, py1, px1 + hx2, py1 + hy2, color, sw));

  if (a.label) {
    const fontSize = a.fontSize ?? 14;
    g.appendChild(
      textEl(
        (px0 + px1) / 2,
        (py0 + py1) / 2 - fontSize,
        a.label,
        color,
        fontSize,
      ),
    );
  }
}
