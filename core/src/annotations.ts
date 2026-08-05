import type { VegaLiteSpec } from "./specs";

/**
 * Chart annotations — one object owns a complete artist (matplotlib model).
 *
 * - {@link scaleBar} / `kind: "scaleBar"` ≈ `FancyArrowPatch(arrowstyle='|-|')`
 *   — spine + both end-caps + label. Never hand-draw caps as separate layers.
 * - {@link arrow} / `kind: "arrow"` ≈ `annotate(..., arrowstyle='->')`.
 *
 * Pass via `withAnnotations(spec, …)` or a top-level `annotations` array on a
 * RawChart / fence spec (expanded to VL layers; stripped before vega-embed).
 */

/** Factory: one complete `|———|` (spine + ⊥ caps + label). */
export function scaleBar(
  partial: Omit<ScaleBarAnnotation, "kind">,
): ScaleBarAnnotation {
  const hasEnds = partial.x2 != null && partial.y2 != null;
  return {
    color: "#18432b",
    strokeWidth: 1.8,
    orientation: hasEnds ? "along" : "horizontal",
    offsetLog: hasEnds ? 0.42 : undefined,
    capLog: hasEnds ? 0.16 : undefined,
    ...partial,
    kind: "scaleBar",
  };
}

/** Factory: one complete arrow (shaft + tip + optional label). */
export function arrow(
  partial: Omit<ArrowAnnotation, "kind">,
): ArrowAnnotation {
  return {
    color: "#18432b",
    strokeWidth: 1.6,
    tipSize: 55,
    ...partial,
    kind: "arrow",
  };
}

export type ScaleBarAnnotation = {
  kind: "scaleBar";
  /** Start of the bar (data coords). */
  x: number;
  y: number;
  /**
   * Length along a horizontal/vertical axis. Ignored when both
   * {@link x2} and {@link y2} are set (matplotlib-style chord on a curve).
   */
  length?: number;
  label?: string;
  color?: string;
  strokeWidth?: number;
  /**
   * `horizontal` / `vertical` axis-aligned bars, or `along` for a free
   * segment (x,y)→(x2,y2) with end-caps ⊥ in log–log space (default when
   * both ends are given).
   */
  orientation?: "horizontal" | "vertical" | "along";
  /** Linear end-cap half-length (axis-aligned modes). */
  tick?: number;
  /** Geometric end-cap half-span on log axes (axis-aligned modes). */
  tickRatio?: number;
  /** End x (with y2: chord along curve). */
  x2?: number;
  /** End y (with x2: chord along curve). */
  y2?: number;
  /**
   * Log-space half-length of end-caps for `along` chords (default 0.16).
   * Caps are perpendicular to the bar in (ln x, ln y).
   */
  capLog?: number;
  /**
   * Log-space offset of an `along` bar from the chord (x,y)→(x2,y2),
   * along the path normal so the bar does not sit on the curve (default 0.42).
   * Set 0 to draw on the chord itself.
   */
  offsetLog?: number;
};

export type ArrowAnnotation = {
  kind: "arrow";
  /** Tail (start). */
  x: number;
  y: number;
  /** Tip (end). */
  x2: number;
  y2: number;
  label?: string;
  color?: string;
  strokeWidth?: number;
  /** Tip mark size (Vega point size, area in px²). Default 55. */
  tipSize?: number;
};

export type Annotation = ScaleBarAnnotation | ArrowAnnotation;

function cleanLayer(layer: Record<string, unknown>): VegaLiteSpec {
  for (const k of Object.keys(layer)) {
    if (layer[k] === undefined) delete layer[k];
  }
  return layer as VegaLiteSpec;
}

/** End-cap endpoints ⊥ to (x0,y0)→(x1,y1) in log–log space (matplotlib-like). */
function logPerpCap(
  x: number,
  y: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  s: number,
): { x: number; y: number; x2: number; y2: number } {
  const dx = Math.log(x1 / x0);
  const dy = Math.log(y1 / y0);
  const n = Math.hypot(dx, dy) || 1;
  const px = (-dy / n) * s;
  const py = (dx / n) * s;
  return {
    x: Math.exp(Math.log(x) + px),
    y: Math.exp(Math.log(y) + py),
    x2: Math.exp(Math.log(x) - px),
    y2: Math.exp(Math.log(y) - py),
  };
}

function scaleBarLayers(a: ScaleBarAnnotation): VegaLiteSpec[] {
  const color = a.color ?? "#14271d";
  const sw = a.strokeWidth ?? 1.8;
  const font = "Times New Roman, Times, STIX Two Text, STIXGeneral, serif";
  const layers: VegaLiteSpec[] = [];

  // Matplotlib-style chord on a curve: both ends fully specified.
  const along =
    a.orientation === "along" ||
    (a.x2 != null &&
      a.y2 != null &&
      a.orientation !== "horizontal" &&
      a.orientation !== "vertical");

  if (along && a.x2 != null && a.y2 != null) {
    // Chord on the curve (reference), then translate along the log-normal so
    // the visible bar is parallel and does not overlap the path.
    const rx0 = a.x;
    const ry0 = a.y;
    const rx1 = a.x2;
    const ry1 = a.y2;
    const dx = Math.log(rx1 / rx0);
    const dy = Math.log(ry1 / ry0);
    const n = Math.hypot(dx, dy) || 1;
    const ux = dx / n;
    const uy = dy / n;
    // Prefer the normal that raises mid-y (above the curve on log–log plots).
    let side = 1;
    {
      const midYPlus = Math.exp(
        0.5 * (Math.log(ry0) + Math.log(ry1)) + ux * 0.1,
      );
      const midYMinus = Math.exp(
        0.5 * (Math.log(ry0) + Math.log(ry1)) - ux * 0.1,
      );
      // offset uses perp (-uy, ux); mid log-y shift is ±ux * s
      if (midYMinus > midYPlus) side = -1;
    }
    const sOff = a.offsetLog ?? 0.42;
    const ox = -uy * sOff * side;
    const oy = ux * sOff * side;
    const x0 = Math.exp(Math.log(rx0) + ox);
    const y0 = Math.exp(Math.log(ry0) + oy);
    const x1 = Math.exp(Math.log(rx1) + ox);
    const y1 = Math.exp(Math.log(ry1) + oy);
    const sCap = a.capLog ?? 0.16;
    const c0 = logPerpCap(x0, y0, x0, y0, x1, y1, sCap);
    const c1 = logPerpCap(x1, y1, x0, y0, x1, y1, sCap);
    // Label further out along the same normal.
    const sLab = sOff + 0.32;
    const lx = Math.exp(
      0.5 * (Math.log(rx0) + Math.log(rx1)) + -uy * sLab * side,
    );
    const ly = Math.exp(
      0.5 * (Math.log(ry0) + Math.log(ry1)) + ux * sLab * side,
    );
    layers.push(
      cleanLayer({
        data: { values: [{ x: x0, y: y0, x2: x1, y2: y1 }] },
        mark: { type: "rule", strokeWidth: sw, color, strokeCap: "butt" },
        encoding: {
          x: { field: "x", type: "quantitative" },
          y: { field: "y", type: "quantitative" },
          x2: { field: "x2" },
          y2: { field: "y2" },
        },
      }),
      cleanLayer({
        data: { values: [c0, c1] },
        mark: { type: "rule", strokeWidth: sw, color },
        encoding: {
          x: { field: "x", type: "quantitative" },
          y: { field: "y", type: "quantitative" },
          x2: { field: "x2" },
          y2: { field: "y2" },
        },
      }),
    );
    if (a.label) {
      layers.push(
        cleanLayer({
          data: { values: [{ x: lx, y: ly, label: a.label }] },
          mark: {
            type: "text",
            font,
            fontStyle: "normal",
            color,
            align: "center",
            baseline: "middle",
          },
          encoding: {
            x: { field: "x", type: "quantitative" },
            y: { field: "y", type: "quantitative" },
            text: { field: "label", type: "nominal" },
          },
        }),
      );
    }
    return layers;
  }

  const horizontal = (a.orientation ?? "horizontal") === "horizontal";

  if (horizontal) {
    const x0 = a.x;
    const x1 =
      a.x2 ?? a.x + (Number.isFinite(a.length) ? (a.length as number) : 0);
    const mid = (x0 + x1) / 2;
    const yLo =
      a.tickRatio != null
        ? a.y / a.tickRatio
        : a.y -
          (a.tick ??
            (Number.isFinite(a.length) && a.length
              ? Math.abs(a.length as number) * 0.08
              : 0.05));
    const yHi =
      a.tickRatio != null
        ? a.y * a.tickRatio
        : a.y +
          (a.tick ??
            (Number.isFinite(a.length) && a.length
              ? Math.abs(a.length as number) * 0.08
              : 0.05));
    layers.push(
      cleanLayer({
        data: { values: [{ x: x0, x2: x1, y: a.y }] },
        mark: { type: "rule", strokeWidth: sw, color, strokeCap: "butt" },
        encoding: {
          x: { field: "x", type: "quantitative" },
          x2: { field: "x2" },
          y: { field: "y", type: "quantitative" },
        },
      }),
      cleanLayer({
        data: {
          values: [
            { x: x0, y: yLo, y2: yHi },
            { x: x1, y: yLo, y2: yHi },
          ],
        },
        mark: { type: "rule", strokeWidth: sw, color },
        encoding: {
          x: { field: "x", type: "quantitative" },
          y: { field: "y", type: "quantitative" },
          y2: { field: "y2" },
        },
      }),
    );
    if (a.label) {
      layers.push(
        cleanLayer({
          data: { values: [{ x: mid, y: a.y, label: a.label }] },
          mark: {
            type: "text",
            dy: -10,
            font,
            fontStyle: "normal",
            color,
            align: "center",
            baseline: "bottom",
          },
          encoding: {
            x: { field: "x", type: "quantitative" },
            y: { field: "y", type: "quantitative" },
            text: { field: "label", type: "nominal" },
          },
        }),
      );
    }
  } else {
    const y0 = a.y;
    const y1 =
      a.y2 ?? a.y + (Number.isFinite(a.length) ? (a.length as number) : 0);
    const mid = (y0 + y1) / 2;
    const tick =
      a.tick ??
      (Number.isFinite(a.length) && a.length
        ? Math.abs(a.length as number) * 0.08
        : 0.05);
    const xLo = a.tickRatio != null ? a.x / a.tickRatio : a.x - tick;
    const xHi = a.tickRatio != null ? a.x * a.tickRatio : a.x + tick;
    layers.push(
      cleanLayer({
        data: { values: [{ x: a.x, y: y0, y2: y1 }] },
        mark: { type: "rule", strokeWidth: sw, color, strokeCap: "butt" },
        encoding: {
          x: { field: "x", type: "quantitative" },
          y: { field: "y", type: "quantitative" },
          y2: { field: "y2" },
        },
      }),
      cleanLayer({
        data: {
          values: [
            { x: xLo, x2: xHi, y: y0 },
            { x: xLo, x2: xHi, y: y1 },
          ],
        },
        mark: { type: "rule", strokeWidth: sw, color },
        encoding: {
          x: { field: "x", type: "quantitative" },
          x2: { field: "x2" },
          y: { field: "y", type: "quantitative" },
        },
      }),
    );
    if (a.label) {
      layers.push(
        cleanLayer({
          data: { values: [{ x: a.x, y: mid, label: a.label }] },
          mark: {
            type: "text",
            dx: 10,
            font,
            fontStyle: "normal",
            color,
            align: "left",
            baseline: "middle",
          },
          encoding: {
            x: { field: "x", type: "quantitative" },
            y: { field: "y", type: "quantitative" },
            text: { field: "label", type: "nominal" },
          },
        }),
      );
    }
  }

  return layers;
}

function arrowLayers(a: ArrowAnnotation): VegaLiteSpec[] {
  const color = a.color ?? "#14271d";
  const sw = a.strokeWidth ?? 1.6;
  const tipSize = a.tipSize ?? 55;
  // Vega point `angle` is degrees clockwise from north; atan2 is from +x CCW.
  const angleDeg = (Math.atan2(a.y2 - a.y, a.x2 - a.x) * 180) / Math.PI + 90;

  const layers: VegaLiteSpec[] = [
    cleanLayer({
      data: {
        values: [{ x: a.x, y: a.y, x2: a.x2, y2: a.y2 }],
      },
      mark: { type: "rule", strokeWidth: sw, color, strokeCap: "round" },
      encoding: {
        x: { field: "x", type: "quantitative" },
        y: { field: "y", type: "quantitative" },
        x2: { field: "x2" },
        y2: { field: "y2" },
      },
    }),
    cleanLayer({
      data: {
        values: [{ x: a.x2, y: a.y2, angle: angleDeg }],
      },
      mark: {
        type: "point",
        shape: "triangle",
        filled: true,
        size: tipSize,
        color,
      },
      encoding: {
        x: { field: "x", type: "quantitative" },
        y: { field: "y", type: "quantitative" },
        angle: { field: "angle", type: "quantitative" },
      },
    }),
  ];

  if (a.label) {
    const mx = (a.x + a.x2) / 2;
    const my = (a.y + a.y2) / 2;
    layers.push(
      cleanLayer({
        data: { values: [{ x: mx, y: my, label: a.label }] },
        mark: {
          type: "text",
          dy: -8,
          fontSize: 11,
          color,
          align: "center",
          baseline: "bottom",
        },
        encoding: {
          x: { field: "x", type: "quantitative" },
          y: { field: "y", type: "quantitative" },
          text: { field: "label", type: "nominal" },
        },
      }),
    );
  }

  return layers;
}

/** Expand annotations into Vega-Lite unit layers (own data, no shared scales). */
export function annotationLayers(annotations: Annotation[]): VegaLiteSpec[] {
  const out: VegaLiteSpec[] = [];
  for (const a of annotations) {
    if (a.kind === "scaleBar") out.push(...scaleBarLayers(a));
    else if (a.kind === "arrow") out.push(...arrowLayers(a));
  }
  return out;
}

/**
 * Merge annotation layers into a unit or layered Vega-Lite spec.
 * Unit specs become layered; existing `layer` arrays are appended to.
 */
export function withAnnotations(
  spec: VegaLiteSpec,
  annotations: Annotation[] | undefined | null,
): VegaLiteSpec {
  if (!annotations?.length) return spec;
  const extra = annotationLayers(annotations);
  if (!extra.length) return spec;

  if (Array.isArray(spec.layer)) {
    return {
      ...spec,
      layer: [...(spec.layer as VegaLiteSpec[]), ...extra],
    };
  }

  // Unit → layered. Keep top-level data only if the unit layer still needs it
  // via inheritance; copy unit fields into layer[0] for a self-contained base.
  const { mark, encoding, data, transform, params, ...rest } = spec as Record<
    string,
    unknown
  >;

  if (mark !== undefined || encoding !== undefined) {
    const baseLayer: VegaLiteSpec = {};
    if (data !== undefined) baseLayer.data = data;
    if (mark !== undefined) baseLayer.mark = mark;
    if (encoding !== undefined) baseLayer.encoding = encoding;
    if (transform !== undefined) baseLayer.transform = transform;
    if (params !== undefined) baseLayer.params = params;
    return {
      ...rest,
      layer: [baseLayer, ...extra],
    } as VegaLiteSpec;
  }

  // Already a multi-view / facet without unit marks — attach layers only.
  return {
    ...spec,
    layer: extra,
  };
}

/**
 * Pull a top-level `annotations` key off a fence/RawChart payload and merge.
 * Returns `{ spec, annotations }` where `spec` has no `annotations` field.
 */
export function takeAnnotations(spec: VegaLiteSpec): {
  spec: VegaLiteSpec;
  annotations: Annotation[];
} {
  const raw = (spec as { annotations?: unknown }).annotations;
  if (!Array.isArray(raw) || raw.length === 0) {
    if ("annotations" in spec) {
      const { annotations: _drop, ...rest } = spec as Record<string, unknown>;
      return { spec: rest as VegaLiteSpec, annotations: [] };
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
  const { annotations: _drop, ...rest } = spec as Record<string, unknown>;
  return { spec: rest as VegaLiteSpec, annotations };
}
