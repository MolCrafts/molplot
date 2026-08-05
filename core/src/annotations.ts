import type { VegaLiteSpec } from "./specs";

/**
 * Chart annotations — portable Vega-Lite layers for paper/web.
 *
 * - {@link ScaleBarAnnotation}: a `|———|` scale bar in data coordinates
 * - {@link ArrowAnnotation}: a directed arrow (rule + tip) with optional label
 *
 * Pass via `withAnnotations(spec, …)` or a top-level `annotations` array on a
 * RawChart / fence spec (stripped before vega-embed).
 */

export type ScaleBarAnnotation = {
  kind: "scaleBar";
  /** Data-coordinate start of the bar (x for horizontal, y for vertical). */
  x: number;
  y: number;
  /** Length in data units along the bar axis. */
  length: number;
  label?: string;
  color?: string;
  strokeWidth?: number;
  orientation?: "horizontal" | "vertical";
  /**
   * End-cap half-length in data units on the perpendicular axis.
   * Defaults to a small fraction of `length` (or absolute fallback).
   * Prefer {@link tickRatio} on log scales.
   */
  tick?: number;
  /**
   * Geometric end-cap half-span on log axes: cap runs from
   * `y / tickRatio` to `y * tickRatio` (horizontal bar). Default none.
   */
  tickRatio?: number;
  /** Absolute end (overrides `x + length` when set). */
  x2?: number;
  /** Absolute end for a vertical bar (overrides `y + length` when set). */
  y2?: number;
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

function scaleBarLayers(a: ScaleBarAnnotation): VegaLiteSpec[] {
  const color = a.color ?? "#14271d";
  const sw = a.strokeWidth ?? 1.6;
  const horizontal = (a.orientation ?? "horizontal") === "horizontal";
  const font = "Times New Roman, Times, STIX Two Text, STIXGeneral, serif";
  const layers: VegaLiteSpec[] = [];

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
              ? Math.abs(a.length) * 0.08
              : 0.05));
    const yHi =
      a.tickRatio != null
        ? a.y * a.tickRatio
        : a.y +
          (a.tick ??
            (Number.isFinite(a.length) && a.length
              ? Math.abs(a.length) * 0.08
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
            dy: 12,
            fontSize: 12,
            font,
            fontStyle: "italic",
            color,
            align: "center",
            baseline: "top",
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
        ? Math.abs(a.length) * 0.08
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
            fontSize: 12,
            font,
            fontStyle: "italic",
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
