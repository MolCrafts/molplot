import type { Node } from "@molcrafts/molplot/semantic";
import { describe, expect, it } from "@rstest/core";
import {
  axisStrip,
  axisWhich,
  chromeKind,
  handlePoints,
} from "@/lib/selection";

function node(partial: Partial<Node> & Pick<Node, "id" | "role">): Node {
  return {
    children: [],
    components: {},
    editability: {},
    ...partial,
  };
}

describe("chromeKind", () => {
  it("maps roles to Photoshop / Origin chrome", () => {
    expect(chromeKind(node({ id: "f", role: "figure" }))).toBe("figure");
    expect(chromeKind(node({ id: "p", role: "panel" }))).toBe("panel");
    expect(chromeKind(node({ id: "s", role: "series" }))).toBe("path");
    expect(chromeKind(node({ id: "l", role: "legend" }))).toBe("box");
    expect(chromeKind(node({ id: "t", role: "title" }))).toBe("box");
    expect(
      chromeKind(node({ id: "a/axis/x", role: "axis", label: "x axis" })),
    ).toBe("axis-x");
    expect(
      chromeKind(node({ id: "a/axis/y", role: "axis", label: "y axis" })),
    ).toBe("axis-y");
  });
});

describe("axisWhich", () => {
  it("reads x/y from the node id", () => {
    expect(axisWhich(node({ id: "p/axis/x", role: "axis" }))).toBe("x");
    expect(axisWhich(node({ id: "p/axis/y", role: "axis" }))).toBe("y");
  });
});

describe("handlePoints", () => {
  it("places eight transform handles", () => {
    const pts = handlePoints({ x: 0.1, y: 0.2, w: 0.4, h: 0.2 });
    expect(pts).toHaveLength(8);
    expect(pts[0]).toEqual({ x: 0.1, y: 0.2 });
    expect(pts[2]).toEqual({ x: 0.5, y: 0.2 });
    expect(pts[7]).toEqual({ x: 0.5, y: 0.4 });
  });
});

describe("axisStrip", () => {
  const panel = { x: 0.1, y: 0.1, w: 0.8, h: 0.6 };
  it("runs along the bottom for x", () => {
    const strip = axisStrip(panel, "x", 0.05);
    expect(strip.x).toBeCloseTo(0.1);
    expect(strip.w).toBeCloseTo(0.8);
    expect(strip.y + strip.h).toBeCloseTo(0.7);
  });
  it("runs along the left for y", () => {
    const strip = axisStrip(panel, "y", 0.05);
    expect(strip.x).toBeCloseTo(0.1);
    expect(strip.y).toBeCloseTo(0.1);
    expect(strip.h).toBeCloseTo(0.6);
  });
});
