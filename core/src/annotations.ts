/**
 * Chart annotations as **Vega-Lite layers** (not a separate overlay).
 *
 * Vega-Lite has no `annotate` / `arrowstyle='|-|'` and no official plugin
 * system for annotations (research prototypes only). We expand a small
 * molplot extension (`annotations: [...]`) into ordinary `rule` / `text`
 * layers so they live in the VL scenegraph and **pan/zoom with the chart**.
 *
 * Caps are axis-aligned ticks in data space (VL-native). Perfect screen-space
 * right angles on log axes would need post-layout pixel math and an overlay
 * that is hard to keep in sync with `bind: scales`.
 */

import type { VegaLiteSpec } from "./specs";

export type ScaleBarAnnotation = {
  kind: "scaleBar";
  /** Start (data coords). For `along`, a point on the curve. */
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  length?: number;
  label?: string;
  color?: string;
  strokeWidth?: number;
  /**
   * `along` — chord (x,y)→(x2,y2), optionally shifted in data space.
   * `horizontal` / `vertical` — axis-aligned size bar.
   */
  orientation?: "horizontal" | "vertical" | "along";
  /**
   * Multiplicative y-shift for `along` bars (default 1.4) so the bar sits
   * above the curve on log–y plots without leaving the VL scenegraph.
   */
  yOffset?: number;
  /** End-cap half-length as a fraction of local y (log-friendly). Default 0.25. */
  capFrac?: number;
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
  fontSize?: number;
};

export type Annotation = ScaleBarAnnotation | ArrowAnnotation;

export function scaleBar(
  partial: Omit<ScaleBarAnnotation, "kind">,
): ScaleBarAnnotation {
  const hasEnds = partial.x2 != null && partial.y2 != null;
  return {
    color: "#18432b",
    strokeWidth: 2,
    orientation: hasEnds ? "along" : "horizontal",
    yOffset: 1.4,
    capFrac: 0.25,
    fontSize: 14,
    ...partial,
    kind: "scaleBar",
  };
}

export function arrow(partial: Omit<ArrowAnnotation, "kind">): ArrowAnnotation {
  return {
    color: "#18432b",
    strokeWidth: 1.6,
    fontSize: 14,
    ...partial,
    kind: "arrow",
  };
}

export function takeAnnotations(spec: Record<string, unknown>): {
  spec: Record<string, unknown>;
  annotations: Annotation[];
} {
  const raw = spec.annotations;
  if (!Array.isArray(raw) || raw.length === 0) {
    if ("annotations" in spec) {
      const { annotations: _d, ...rest } = spec;
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
  const { annotations: _d, ...rest } = spec;
  return { spec: rest, annotations };
}

function clean(layer: Record<string, unknown>): VegaLiteSpec {
  for (const k of Object.keys(layer)) {
    if (layer[k] === undefined) delete layer[k];
  }
  return layer as VegaLiteSpec;
}

/**
 * Expand annotations into VL layers (rule / text). These join the chart
 * scenegraph so pan/zoom applies automatically.
 */
export function annotationLayers(annotations: Annotation[]): VegaLiteSpec[] {
  const out: VegaLiteSpec[] = [];
  for (const a of annotations) {
    if (a.kind === "scaleBar") out.push(...scaleBarLayers(a));
    else if (a.kind === "arrow") out.push(...arrowLayers(a));
  }
  return out;
}

/** Merge annotation layers into a unit or layered VL spec. */
export function withAnnotations(
  spec: VegaLiteSpec,
  annotations: Annotation[] | undefined | null,
): VegaLiteSpec {
  if (!annotations?.length) return spec;
  const extra = annotationLayers(annotations);
  if (!extra.length) return spec;

  if (Array.isArray(spec.layer)) {
    return { ...spec, layer: [...(spec.layer as VegaLiteSpec[]), ...extra] };
  }
  if (spec.mark !== undefined || spec.encoding !== undefined) {
    const { mark, encoding, data, transform, params, ...rest } = spec as Record<
      string,
      unknown
    >;
    const base: VegaLiteSpec = {};
    if (data !== undefined) base.data = data;
    if (mark !== undefined) base.mark = mark;
    if (encoding !== undefined) base.encoding = encoding;
    if (transform !== undefined) base.transform = transform;
    if (params !== undefined) base.params = params;
    return { ...rest, layer: [base, ...extra] } as VegaLiteSpec;
  }
  return { ...spec, layer: extra };
}

function scaleBarLayers(a: ScaleBarAnnotation): VegaLiteSpec[] {
  const color = a.color ?? "#18432b";
  const sw = a.strokeWidth ?? 2;
  const fontSize = a.fontSize ?? 14;
  const orient =
    a.orientation ?? (a.x2 != null && a.y2 != null ? "along" : "horizontal");
  const layers: VegaLiteSpec[] = [];
  const q = { type: "quantitative" as const };

  if (orient === "along" && a.x2 != null && a.y2 != null) {
    // Lift the whole bar above the curve in data y (works on linear & log-y).
    const yMul = a.yOffset ?? 1.4;
    const x0 = a.x;
    const x1 = a.x2;
    const y0 = a.y * yMul;
    const y1 = a.y2 * yMul;
    const capFrac = a.capFrac ?? 0.25;
    // Vertical caps in data space (VL-native; pan/zoom with scales).
    const c0lo = y0 / (1 + capFrac);
    const c0hi = y0 * (1 + capFrac);
    const c1lo = y1 / (1 + capFrac);
    const c1hi = y1 * (1 + capFrac);
    const midX = Math.sqrt(x0 * x1); // geometric mid for log-x
    const midY = Math.sqrt(y0 * y1) * (1 + capFrac * 0.5);

    layers.push(
      clean({
        data: { values: [{ x: x0, y: y0, x2: x1, y2: y1 }] },
        mark: { type: "rule", strokeWidth: sw, color, strokeCap: "butt" },
        encoding: {
          x: { field: "x", ...q },
          y: { field: "y", ...q },
          x2: { field: "x2" },
          y2: { field: "y2" },
        },
      }),
      clean({
        data: {
          values: [
            { x: x0, y: c0lo, y2: c0hi },
            { x: x1, y: c1lo, y2: c1hi },
          ],
        },
        mark: { type: "rule", strokeWidth: sw, color },
        encoding: {
          x: { field: "x", ...q },
          y: { field: "y", ...q },
          y2: { field: "y2" },
        },
      }),
    );
    if (a.label) {
      layers.push(
        clean({
          data: { values: [{ x: midX, y: midY, label: a.label }] },
          mark: {
            type: "text",
            fontSize,
            font: "Times New Roman, Times, STIX Two Text, serif",
            fontStyle: "normal",
            color,
            align: "center",
            baseline: "bottom",
          },
          encoding: {
            x: { field: "x", ...q },
            y: { field: "y", ...q },
            text: { field: "label", type: "nominal" },
          },
        }),
      );
    }
    return layers;
  }

  if (orient === "vertical") {
    const y1 = a.y2 ?? a.y + (a.length ?? 0);
    const mid = (a.y + y1) / 2;
    const tick = Math.abs(y1 - a.y) * 0.08 || a.x * 0.05;
    layers.push(
      clean({
        data: { values: [{ x: a.x, y: a.y, y2: y1 }] },
        mark: { type: "rule", strokeWidth: sw, color },
        encoding: {
          x: { field: "x", ...q },
          y: { field: "y", ...q },
          y2: { field: "y2" },
        },
      }),
      clean({
        data: {
          values: [
            { x: a.x - tick, x2: a.x + tick, y: a.y },
            { x: a.x - tick, x2: a.x + tick, y: y1 },
          ],
        },
        mark: { type: "rule", strokeWidth: sw, color },
        encoding: {
          x: { field: "x", ...q },
          x2: { field: "x2" },
          y: { field: "y", ...q },
        },
      }),
    );
    if (a.label) {
      layers.push(
        clean({
          data: { values: [{ x: a.x, y: mid, label: a.label }] },
          mark: {
            type: "text",
            dx: 10,
            fontSize,
            font: "Times New Roman, Times, serif",
            color,
            align: "left",
            baseline: "middle",
          },
          encoding: {
            x: { field: "x", ...q },
            y: { field: "y", ...q },
            text: { field: "label", type: "nominal" },
          },
        }),
      );
    }
    return layers;
  }

  // horizontal
  const x1 = a.x2 ?? a.x + (a.length ?? 0);
  const mid = (a.x + x1) / 2;
  const capFrac = a.capFrac ?? 0.25;
  const yLo = a.y / (1 + capFrac);
  const yHi = a.y * (1 + capFrac);
  layers.push(
    clean({
      data: { values: [{ x: a.x, x2: x1, y: a.y }] },
      mark: { type: "rule", strokeWidth: sw, color, strokeCap: "butt" },
      encoding: {
        x: { field: "x", ...q },
        x2: { field: "x2" },
        y: { field: "y", ...q },
      },
    }),
    clean({
      data: {
        values: [
          { x: a.x, y: yLo, y2: yHi },
          { x: x1, y: yLo, y2: yHi },
        ],
      },
      mark: { type: "rule", strokeWidth: sw, color },
      encoding: {
        x: { field: "x", ...q },
        y: { field: "y", ...q },
        y2: { field: "y2" },
      },
    }),
  );
  if (a.label) {
    layers.push(
      clean({
        data: { values: [{ x: mid, y: yHi, label: a.label }] },
        mark: {
          type: "text",
          dy: -4,
          fontSize,
          font: "Times New Roman, Times, serif",
          color,
          align: "center",
          baseline: "bottom",
        },
        encoding: {
          x: { field: "x", ...q },
          y: { field: "y", ...q },
          text: { field: "label", type: "nominal" },
        },
      }),
    );
  }
  return layers;
}

function arrowLayers(a: ArrowAnnotation): VegaLiteSpec[] {
  const color = a.color ?? "#18432b";
  const sw = a.strokeWidth ?? 1.6;
  const fontSize = a.fontSize ?? 14;
  const q = { type: "quantitative" as const };
  const layers: VegaLiteSpec[] = [
    clean({
      data: {
        values: [{ x: a.x, y: a.y, x2: a.x2, y2: a.y2 }],
      },
      mark: { type: "rule", strokeWidth: sw, color, strokeCap: "round" },
      encoding: {
        x: { field: "x", ...q },
        y: { field: "y", ...q },
        x2: { field: "x2" },
        y2: { field: "y2" },
      },
    }),
  ];
  if (a.label) {
    layers.push(
      clean({
        data: {
          values: [
            {
              x: (a.x + a.x2) / 2,
              y: (a.y + a.y2) / 2,
              label: a.label,
            },
          ],
        },
        mark: {
          type: "text",
          dy: -8,
          fontSize,
          font: "Times New Roman, Times, serif",
          color,
          align: "center",
          baseline: "bottom",
        },
        encoding: {
          x: { field: "x", ...q },
          y: { field: "y", ...q },
          text: { field: "label", type: "nominal" },
        },
      }),
    );
  }
  return layers;
}
