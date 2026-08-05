/**
 * RawChart must inject zoom params for layered agent/LLM specs (encoding on
 * layer[0], not top-level) and must not skip empty ``params: []``.
 */

import { describe, expect, it } from "@rstest/core";
import { interactionParams } from "./specs";

// Mirror the pure helpers used by RawChart (kept local so the test stays
// free of DOM / vega-embed).
type ZoomChannel = "x" | "y";

function continuousChannels(spec: Record<string, unknown>): ZoomChannel[] {
  const top = spec.encoding as
    | Record<string, { type?: string } | undefined>
    | undefined;
  const layers = Array.isArray(spec.layer)
    ? (spec.layer as { encoding?: Record<string, { type?: string }> }[])
    : [];
  const encoding =
    top ?? layers.find((layer) => layer?.encoding)?.encoding ?? undefined;
  return (["x", "y"] as const).filter((channel) => {
    const type = encoding?.[channel]?.type;
    return type === "quantitative" || type === "temporal";
  });
}

function mergeZoomParams(existing: unknown, zoom: ReturnType<typeof interactionParams>) {
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

describe("RawChart interactive injection (layered agent specs)", () => {
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
