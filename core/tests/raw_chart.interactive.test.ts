/**
 * RawChart interactive injection helpers (mirrored pure logic).
 */

import { describe, expect, it } from "@rstest/core";
import { interactionParams } from "../src/specs";

type ZoomChannel = "x" | "y";

function continuousChannels(spec: Record<string, unknown>): ZoomChannel[] {
  const top = spec.encoding as
    | Record<string, { type?: string; field?: string } | undefined>
    | undefined;
  const layers = Array.isArray(spec.layer)
    ? (spec.layer as {
        encoding?: Record<string, { type?: string; field?: string }>;
      }[])
    : [];
  const layerEnc = layers.find((layer) => layer?.encoding)?.encoding;
  return (["x", "y"] as const).filter((channel) => {
    const type = top?.[channel]?.type ?? layerEnc?.[channel]?.type;
    if (type === "quantitative" || type === "temporal") return true;
    const field = top?.[channel]?.field ?? layerEnc?.[channel]?.field;
    return Boolean(field && top?.[channel]);
  });
}

function mergeZoomParams(
  existing: unknown,
  zoom: ReturnType<typeof interactionParams>,
) {
  const zoomNames = new Set(zoom.map((p) => p.name));
  const kept: unknown[] = [];
  if (Array.isArray(existing)) {
    for (const p of existing) {
      const name =
        p && typeof p === "object" && "name" in p
          ? String((p as { name: unknown }).name)
          : "";
      if (name && zoomNames.has(name as "zoomX" | "zoomY")) continue;
      kept.push(p);
    }
  }
  return [...kept, ...zoom];
}

/** Where zoom params should be placed for a given spec shape. */
function zoomPlacement(
  spec: Record<string, unknown>,
): "top" | "layer0" | "none" {
  const channels = continuousChannels(spec);
  if (channels.length === 0) return "none";
  const layers = Array.isArray(spec.layer) ? spec.layer : null;
  // Multi-layer always uses layer0 — top-level params duplicate VL selection
  // signals when annotation (or any extra) layers are present.
  if (layers && layers.length > 0) return "layer0";
  return "top";
}

describe("RawChart interactive injection", () => {
  it("finds continuous channels on layer[0].encoding", () => {
    const channels = continuousChannels({
      layer: [
        {
          encoding: {
            x: { field: "N", type: "quantitative" },
            y: { field: "Rg", type: "quantitative" },
          },
        },
      ],
    });
    expect(channels).toEqual(["x", "y"]);
  });

  it("reads continuous type from top encoding when fields are on layers", () => {
    const channels = continuousChannels({
      encoding: {
        x: { type: "quantitative", scale: { type: "log" } },
        y: { type: "quantitative", scale: { type: "log" } },
      },
      layer: [
        {
          encoding: {
            x: { field: "x" },
            y: { field: "y" },
          },
        },
      ],
    });
    expect(channels).toEqual(["x", "y"]);
  });

  it("places zoom params on layer0 when encoding is shared on a layered chart", () => {
    expect(
      zoomPlacement({
        encoding: {
          x: { type: "quantitative" },
          y: { type: "quantitative" },
        },
        layer: [{ encoding: { x: { field: "x" }, y: { field: "y" } } }],
      }),
    ).toBe("layer0");
  });

  it("places zoom params on layer0 when only unit layers have encoding", () => {
    expect(
      zoomPlacement({
        layer: [
          {
            encoding: {
              x: { field: "N", type: "quantitative" },
              y: { field: "Rg", type: "quantitative" },
            },
          },
        ],
      }),
    ).toBe("layer0");
  });

  it("places zoom params on layer0 when annotation layers are present", () => {
    expect(
      zoomPlacement({
        encoding: {
          x: { type: "quantitative" },
          y: { type: "quantitative" },
        },
        layer: [
          { encoding: { x: { field: "x" }, y: { field: "y" } } },
          {
            mark: "rule",
            encoding: {
              x: { field: "x", type: "quantitative" },
              y: { field: "y", type: "quantitative" },
            },
          },
        ],
      }),
    ).toBe("layer0");
  });

  it("merges zoom params over empty params:[]", () => {
    const zoom = interactionParams(["x", "y"]);
    const merged = mergeZoomParams([], zoom);
    expect(merged).toHaveLength(2);
    expect(merged.map((p) => (p as { name: string }).name)).toEqual([
      "zoomX",
      "zoomY",
    ]);
  });
});
