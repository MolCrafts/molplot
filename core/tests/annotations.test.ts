import { describe, expect, it } from "@rstest/core";
import {
  annotationLayers,
  scaleBar,
  takeAnnotations,
  withAnnotations,
} from "../src/annotations";

describe("annotations", () => {
  it("scaleBar expands to VL rule + cap + label layers", () => {
    const layers = annotationLayers([
      scaleBar({
        x: 0.18,
        y: 0.03,
        x2: 0.65,
        y2: 0.42,
        label: "ballistic",
      }),
    ]);
    expect(layers.length).toBe(3);
    expect((layers[0].mark as { type: string }).type).toBe("rule");
    expect((layers[1].mark as { type: string }).type).toBe("rule");
    expect((layers[2].mark as { type: string }).type).toBe("text");
  });

  it("withAnnotations appends layers so marks pan with the chart", () => {
    const out = withAnnotations(
      {
        layer: [
          {
            mark: "line",
            encoding: {
              x: { field: "x", type: "quantitative" },
              y: { field: "y", type: "quantitative" },
            },
          },
        ],
      },
      [scaleBar({ x: 1, y: 1, x2: 2, y2: 2, label: "a" })],
    );
    expect(Array.isArray(out.layer)).toBe(true);
    expect((out.layer as unknown[]).length).toBe(1 + 3);
  });

  it("takeAnnotations strips the extension key", () => {
    const { spec, annotations } = takeAnnotations({
      mark: "point",
      annotations: [{ kind: "scaleBar", x: 0, y: 0, length: 1 }],
    });
    expect(annotations).toHaveLength(1);
    expect("annotations" in spec).toBe(false);
  });

  it("layered annotations + layer0 zoom params compile without duplicate signals", async () => {
    // Regression: top-level params + multi-layer → VL emits duplicate
    // zoomX_x / zoomY_y signals and vega.parse throws (chart invisible).
    const { compile } = await import("vega-lite");
    const { parse } = await import("vega");
    const { interactionParams } = await import("../src/specs");

    const expanded = withAnnotations(
      {
        encoding: {
          x: {
            type: "quantitative",
            scale: { type: "log", domain: [0.1, 100] },
          },
          y: {
            type: "quantitative",
            scale: { type: "log", domain: [0.008, 120] },
          },
        },
        layer: [
          {
            data: {
              values: [
                { x: 0.1, y: 0.01 },
                { x: 1, y: 1 },
                { x: 10, y: 10 },
              ],
            },
            mark: { type: "line" },
            encoding: { x: { field: "x" }, y: { field: "y" } },
          },
        ],
      },
      [
        scaleBar({
          x: 0.18,
          y: 0.03,
          x2: 0.65,
          y2: 0.42,
          label: "ballistic",
        }),
      ],
    );
    const layers = (expanded.layer as Record<string, unknown>[]).map(
      (layer, i) =>
        i === 0 ? { ...layer, params: interactionParams(["x", "y"]) } : layer,
    );
    const full = {
      $schema: "https://vega.github.io/schema/vega-lite/v5.json",
      width: 400,
      height: 225,
      encoding: expanded.encoding,
      layer: layers,
    };
    const compiled = compile(full as never).spec as {
      signals?: { name: string }[];
      scales?: { name: string; domainRaw?: unknown }[];
    };
    const names = (compiled.signals ?? []).map((s) => s.name);
    const dups = names.filter((n, i) => names.indexOf(n) !== i);
    expect(dups).toEqual([]);
    expect(
      compiled.scales?.find((s) => s.name === "x")?.domainRaw,
    ).toBeTruthy();
    // Must parse: this is what vega-embed does.
    expect(() => parse(compiled as never)).not.toThrow();
  });
});
