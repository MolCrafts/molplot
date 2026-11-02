import { describe, expect, it } from "@rstest/core";
import {
  checkSetCommand,
  findByRole,
  notImplemented,
  renderResult,
} from "../../src/semantic/engine";
import { FakeEngine } from "../../src/semantic/fake";
import type { Command, Scene } from "../../src/semantic/generated";

function setColor(nodeId: string, rev: number, value: string): Command {
  return {
    type: "set",
    nodeId,
    component: "stroke",
    property: "color",
    value,
    baseRevision: rev,
  };
}

describe("editor contract (fake engine)", () => {
  it("sets an editable stroke color and bumps revision", async () => {
    const engine = new FakeEngine();
    const series = findByRole(engine.reflect().root, "series")[0];
    const result = await engine.apply(
      setColor(series.id, engine.revision(), "#CC0000"),
      "req-1",
    );
    expect(result.ok).toBe(true);
    expect(result.result?.revision).toBe(2);
    expect(result.result?.scene.root).toBeTruthy();
    const updated = findByRole(result.result!.scene.root, "series")[0];
    expect(updated.components.stroke?.color).toBe("#cc0000");
    expect(result.result!.view.svg).toContain('data-revision="2"');
    expect(result.result!.revision).toBe(engine.revision());
  });

  it("rejects a stale revision without mutating", async () => {
    const engine = new FakeEngine();
    const series = findByRole(engine.reflect().root, "series")[0];
    const before = series.components.stroke?.color;
    const result = await engine.apply(
      setColor(series.id, 0, "#cc0000"),
      "req-stale",
    );
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("stale_revision");
    expect(engine.revision()).toBe(1);
    expect(
      findByRole(engine.reflect().root, "series")[0].components.stroke?.color,
    ).toBe(before);
  });

  it("rejects a readonly property", async () => {
    const engine = new FakeEngine();
    const mapped = findByRole(engine.reflect().root, "series")[1];
    const result = await engine.apply(
      setColor(mapped.id, engine.revision(), "#cc0000"),
      "req-ro",
    );
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("not_editable");
  });

  it("rejects an unknown node", async () => {
    const engine = new FakeEngine();
    const result = await engine.apply(
      setColor("no-such-node", engine.revision(), "#cc0000"),
      "req-missing",
    );
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("unknown_node");
  });

  it("rejects an invalid color", async () => {
    const engine = new FakeEngine();
    const series = findByRole(engine.reflect().root, "series")[0];
    const result = await engine.apply(
      setColor(series.id, engine.revision(), "red"),
      "req-bad",
    );
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("invalid_value");
  });

  it("sets title text", async () => {
    const engine = new FakeEngine();
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
      "req-title",
    );
    expect(result.ok).toBe(true);
    expect(
      findByRole(result.result!.scene.root, "title")[0].components.text
        ?.content,
    ).toBe("Kinetic energy");
  });

  it("reports realize as not_implemented", () => {
    const result = notImplemented("req-realize");
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("not_implemented");
  });

  it("discards a stale request id", async () => {
    const engine = new FakeEngine();
    const first = await renderResult(engine, "1");
    const second = await renderResult(engine, "2");
    let seen = first.requestId;
    const accept = (id: string) => {
      if (Number(id) < Number(seen)) return false;
      seen = id;
      return true;
    };
    expect(accept(second.requestId)).toBe(true);
    expect(accept(first.requestId)).toBe(false);
  });

  it("checkSetCommand is backend-free", () => {
    const engine = new FakeEngine();
    const scene = engine.reflect();
    const err = checkSetCommand(scene, setColor("series-0", 1, "#cc0000"), 1);
    expect(err).toBeNull();
  });

  it("rejects invalid dash, opacity, size, and visible", () => {
    const scene: Scene = {
      engineId: "vega",
      root: {
        id: "n",
        role: "series",
        children: [],
        components: {},
        editability: {
          stroke: { dash: "editable", opacity: "editable" },
          appearance: { visible: "editable", zIndex: "editable" },
          typography: { size: "editable", family: "editable" },
        },
      },
    };
    const set = (
      property: string,
      value: unknown,
      component: Command["component"] = "stroke",
    ): Command => ({
      type: "set",
      nodeId: "n",
      component,
      property,
      value,
      baseRevision: 1,
    });
    expect(checkSetCommand(scene, set("dash", [2, 1]), 1)).toBeNull();
    expect(checkSetCommand(scene, set("dash", "dotted"), 1)?.code).toBe(
      "invalid_value",
    );
    expect(checkSetCommand(scene, set("opacity", 2), 1)?.code).toBe(
      "invalid_value",
    );
    expect(checkSetCommand(scene, set("size", 0, "typography"), 1)?.code).toBe(
      "invalid_value",
    );
    expect(
      checkSetCommand(scene, set("visible", "yes", "appearance"), 1)?.code,
    ).toBe("invalid_value");
    expect(
      checkSetCommand(scene, set("zIndex", "front", "appearance"), 1)?.code,
    ).toBe("invalid_value");
    expect(
      checkSetCommand(scene, set("family", "  ", "typography"), 1)?.code,
    ).toBe("invalid_value");
  });

  it("rejects invalid axis ticks, labels, and format", () => {
    const scene: Scene = {
      engineId: "vega",
      root: {
        id: "ax",
        role: "axis",
        children: [],
        components: {},
        editability: {
          axis: {
            min: "editable",
            ticks: "editable",
            tickLabels: "editable",
            format: "editable",
            scale: "editable",
          },
        },
      },
    };
    const set = (property: string, value: unknown): Command => ({
      type: "set",
      nodeId: "ax",
      component: "axis",
      property,
      value,
      baseRevision: 1,
    });
    expect(checkSetCommand(scene, set("ticks", [0, 1, 2]), 1)).toBeNull();
    expect(checkSetCommand(scene, set("ticks", "0,1"), 1)?.code).toBe(
      "invalid_value",
    );
    expect(checkSetCommand(scene, set("tickLabels", ["a", "b"]), 1)).toBeNull();
    expect(checkSetCommand(scene, set("tickLabels", [1]), 1)?.code).toBe(
      "invalid_value",
    );
    expect(checkSetCommand(scene, set("format", "scientific"), 1)).toBeNull();
    expect(checkSetCommand(scene, set("format", "  "), 1)?.code).toBe(
      "invalid_value",
    );
    expect(checkSetCommand(scene, set("min", 1e-3), 1)).toBeNull();
  });
});
