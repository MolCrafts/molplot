import type { Node } from "@molcrafts/molplot/semantic";
import { describe, expect, it } from "@rstest/core";
import {
  canMove,
  defaultSelection,
  findNode,
  nodePath,
  nodeTitle,
  scriptStem,
  walk,
} from "@/lib/scene";

function node(partial: Partial<Node> & Pick<Node, "id" | "role">): Node {
  return {
    children: [],
    components: {},
    editability: {},
    ...partial,
  };
}

describe("scene helpers", () => {
  const series = node({
    id: "s1",
    role: "series",
    label: "Catalyst A",
    editability: { geometry: { bbox: "readonly" } },
  });
  const legend = node({
    id: "leg",
    role: "legend",
    label: "Legend",
    editability: { geometry: { bbox: "editable" } },
  });
  const root = node({
    id: "fig",
    role: "figure",
    label: "Figure",
    children: [series, legend],
  });

  it("walks depth-first", () => {
    expect(walk(root).map((item) => item.node.id)).toEqual([
      "fig",
      "s1",
      "leg",
    ]);
  });

  it("finds a nested node and its path", () => {
    expect(findNode(root, "s1")?.label).toBe("Catalyst A");
    expect(nodePath(root, "leg").map((item) => item.id)).toEqual([
      "fig",
      "leg",
    ]);
  });

  it("prefers a series as the default selection", () => {
    expect(defaultSelection(root)).toBe("s1");
  });

  it("reports movable geometry from editability", () => {
    expect(canMove(series)).toBe(false);
    expect(canMove(legend)).toBe(true);
  });

  it("titles from label then id", () => {
    expect(nodeTitle(series)).toBe("Catalyst A");
    expect(nodeTitle(node({ id: "x", role: "panel" }))).toBe("x");
  });

  it("stems a python script path", () => {
    expect(scriptStem("/tmp/kinetics.py")).toBe("kinetics");
    expect(scriptStem(undefined)).toBe("figure");
  });
});
