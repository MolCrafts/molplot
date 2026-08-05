import { describe, expect, it } from "@rstest/core";
import {
  annotationLayers,
  takeAnnotations,
  withAnnotations,
  type Annotation,
} from "../src/annotations";

describe("annotations", () => {
  it("builds a horizontal scale bar as rule + end-caps (+ optional label)", () => {
    const layers = annotationLayers([
      {
        kind: "scaleBar",
        x: 10,
        y: 1,
        length: 20,
        label: "20 τ",
      },
    ]);
    expect(layers.length).toBe(3);
    expect((layers[0].mark as { type: string }).type).toBe("rule");
    expect((layers[1].mark as { type: string }).type).toBe("rule");
    expect((layers[2].mark as { type: string }).type).toBe("text");
  });

  it("builds an along-curve chord with log-perp end-caps", () => {
    const layers = annotationLayers([
      {
        kind: "scaleBar",
        orientation: "along",
        x: 0.18,
        y: 0.0324,
        x2: 0.65,
        y2: 0.4225,
        label: "ballistic",
      },
    ]);
    expect(layers.length).toBe(3);
    const bar = layers[0].data as { values: { x2: number; y2: number }[] };
    expect(bar.values[0].x2).toBeCloseTo(0.65);
    expect(bar.values[0].y2).toBeCloseTo(0.4225);
    const caps = layers[1].data as { values: unknown[] };
    expect(caps.values).toHaveLength(2);
  });

  it("builds an arrow as rule + tip (+ optional label)", () => {
    const layers = annotationLayers([
      {
        kind: "arrow",
        x: 0,
        y: 0,
        x2: 1,
        y2: 1,
        label: "diffusive",
      },
    ]);
    expect(layers.length).toBe(3);
    expect((layers[0].mark as { type: string }).type).toBe("rule");
    expect((layers[1].mark as { type: string }).type).toBe("point");
    expect((layers[2].mark as { type: string }).type).toBe("text");
  });

  it("withAnnotations converts a unit spec into a layered one", () => {
    const unit = {
      mark: "line",
      data: { values: [{ t: 1, msd: 1 }] },
      encoding: {
        x: { field: "t", type: "quantitative" },
        y: { field: "msd", type: "quantitative" },
      },
    };
    const anns: Annotation[] = [
      { kind: "scaleBar", x: 1, y: 0.5, length: 2, label: "2" },
    ];
    const layered = withAnnotations(unit, anns);
    expect(Array.isArray(layered.layer)).toBe(true);
    const layers = layered.layer as unknown[];
    expect(layers.length).toBeGreaterThan(1);
    expect(layered.mark).toBeUndefined();
  });

  it("takeAnnotations strips the top-level key", () => {
    const { spec, annotations } = takeAnnotations({
      mark: "point",
      annotations: [
        { kind: "arrow", x: 0, y: 0, x2: 1, y2: 1 },
        { kind: "nope" },
      ],
    } as never);
    expect(annotations).toHaveLength(1);
    expect(annotations[0].kind).toBe("arrow");
    expect("annotations" in spec).toBe(false);
  });
});
