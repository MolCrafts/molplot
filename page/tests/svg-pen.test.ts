import { describe, expect, it } from "@rstest/core";
import { artistGid, pathVertices, sampleAnchors } from "@/lib/svg-pen";

describe("artistGid", () => {
  it("mirrors the Python SVG id", () => {
    expect(artistGid("figure/0/panel/0/series/0")).toBe(
      "molplot-figure-0-panel-0-series-0",
    );
  });
});

describe("pathVertices", () => {
  it("reads matplotlib M/L path data", () => {
    const d = `M 39.223636 153.9 
L 125.46 27.9 
L 211.696364 90.9 
`;
    expect(pathVertices(d)).toEqual([
      { x: 39.223636, y: 153.9 },
      { x: 125.46, y: 27.9 },
      { x: 211.696364, y: 90.9 },
    ]);
  });
});

describe("datum vertex", () => {
  it("addresses a table row by path vertex index", () => {
    const d = "M 0 0 L 10 20 L 30 10";
    expect(pathVertices(d)[1]).toEqual({ x: 10, y: 20 });
  });
});

describe("series selection vertices", () => {
  it("uses sampled anchors so a dense path still gets Origin-style squares", () => {
    const d = Array.from({ length: 40 }, (_, i) =>
      i === 0 ? `M ${i} 0` : `L ${i} 0`,
    ).join(" ");
    const verts = pathVertices(d);
    expect(sampleAnchors(verts, 16)).toHaveLength(16);
    expect(sampleAnchors(verts, 16)[0]).toEqual(verts[0]);
    expect(sampleAnchors(verts, 16).at(-1)).toEqual(verts.at(-1));
  });
});

describe("sampleAnchors", () => {
  it("keeps short polylines intact", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 0 },
    ];
    expect(sampleAnchors(points, 16)).toEqual(points);
  });

  it("keeps endpoints when thinning", () => {
    const points = Array.from({ length: 21 }, (_, i) => ({ x: i, y: 0 }));
    const sampled = sampleAnchors(points, 5);
    expect(sampled[0]).toEqual({ x: 0, y: 0 });
    expect(sampled[sampled.length - 1]).toEqual({ x: 20, y: 0 });
    expect(sampled).toHaveLength(5);
  });
});
