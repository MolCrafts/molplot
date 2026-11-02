import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "@rstest/core";
import { VegaEngine } from "../../src/engines/vega/vega_engine";
import { findByRole, findNode } from "../../src/semantic/engine";
import type { Command } from "../../src/semantic/generated";

const fixture = JSON.parse(
  readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "../../../tests/fixtures/editor/set-stroke-color.json",
    ),
    "utf8",
  ),
) as {
  select: { role: "series"; index: number };
  command: {
    type: "set";
    component: "stroke";
    property: "color";
    value: string;
  };
};

const constantLine = {
  $schema: "https://vega.github.io/schema/vega-lite/v6.json",
  mark: { type: "line", color: "#0c5da5", strokeWidth: 2 },
  data: {
    values: [
      { x: 0, y: 1 },
      { x: 1, y: 2 },
    ],
  },
  encoding: {
    x: { field: "x", type: "quantitative" },
    y: { field: "y", type: "quantitative" },
  },
  title: "Energy",
};

const mappedColor = {
  $schema: "https://vega.github.io/schema/vega-lite/v6.json",
  mark: "line",
  data: {
    values: [
      { x: 0, y: 1, k: "a" },
      { x: 1, y: 2, k: "b" },
    ],
  },
  encoding: {
    x: { field: "x", type: "quantitative" },
    y: { field: "y", type: "quantitative" },
    color: { field: "k", type: "nominal" },
  },
};

describe("VegaEngine", () => {
  it("reflects figure / panel / series / title without using the scenegraph as Scene", async () => {
    const engine = new VegaEngine(constantLine);
    const scene = engine.reflect();
    expect(scene.engineId).toBe("vega");
    expect(scene.root.role).toBe("figure");
    expect(findByRole(scene.root, "panel")).toHaveLength(1);
    expect(findByRole(scene.root, "series").length).toBeGreaterThanOrEqual(1);
    expect(findByRole(scene.root, "title")[0].components.text?.content).toBe(
      "Energy",
    );
    const view = await engine.render();
    expect(view.kind).toBe("svg");
    expect(view.svg).toContain("<svg");
  });

  it("applies the shared set-stroke-color fixture", async () => {
    const engine = new VegaEngine(constantLine);
    const node = findByRole(engine.reflect().root, fixture.select.role)[
      fixture.select.index
    ];
    expect(node.editability.stroke?.color).toBe("editable");
    const command: Command = {
      type: "set",
      nodeId: node.id,
      component: fixture.command.component,
      property: fixture.command.property,
      value: fixture.command.value,
      baseRevision: engine.revision(),
    };
    const result = await engine.apply(command, "vega-set-color");
    expect(result.ok).toBe(true);
    const updated = findNode(result.result!.scene.root, node.id);
    expect(updated?.components.stroke?.color).toBe("#cc0000");
    expect(result.result!.revision).toBe(
      result.result!.scene.root ? engine.revision() : -1,
    );
    expect(result.result!.view.svg).toContain("<svg");
  });

  it("marks data-driven color readonly and refuses Set", async () => {
    const engine = new VegaEngine(mappedColor);
    const series = findByRole(engine.reflect().root, "series")[0];
    expect(series.editability.stroke?.color).toBe("readonly");
    const result = await engine.apply(
      {
        type: "set",
        nodeId: series.id,
        component: "stroke",
        property: "color",
        value: "#cc0000",
        baseRevision: engine.revision(),
      },
      "vega-mapped",
    );
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("not_editable");
    expect(engine.revision()).toBe(1);
  });

  it("sets title content", async () => {
    const engine = new VegaEngine(constantLine);
    const title = findByRole(engine.reflect().root, "title")[0];
    const result = await engine.apply(
      {
        type: "set",
        nodeId: title.id,
        component: "text",
        property: "content",
        value: "Kinetic energy",
        baseRevision: engine.revision(),
      },
      "vega-title",
    );
    expect(result.ok).toBe(true);
    expect(
      findByRole(result.result!.scene.root, "title")[0].components.text
        ?.content,
    ).toBe("Kinetic energy");
  });

  it("keeps Scene when facet is unsupported", () => {
    const engine = new VegaEngine({
      ...constantLine,
      facet: { field: "k" },
    });
    const scene = engine.reflect();
    expect(scene.root.role).toBe("figure");
    expect(
      engine
        .diagnostics()
        .traversal.some((row) => row.status === "unsupported"),
    ).toBe(true);
  });
});
