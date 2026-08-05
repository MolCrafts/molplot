import { afterEach, beforeEach, describe, expect, it } from "@rstest/core";
import { parseAspect, parseInteractive, parseSpec } from "../src/element";
import { RawChart } from "../src/raw_chart";
import { __setVegaEmbedForTesting } from "../src/vega_loader";
import {
  type FakeContainer,
  type FakeVega,
  makeFakeContainer,
  makeFakeVega,
} from "./_fake_vega";

let container: FakeContainer;
let fake: FakeVega;

class InspectableRawChart extends RawChart {
  resizeWouldRender(
    previous: { width: number; height: number },
    next: { width: number; height: number },
  ): boolean {
    return this.resizeChanged(previous, next);
  }
}

beforeEach(() => {
  container = makeFakeContainer();
  fake = makeFakeVega();
  __setVegaEmbedForTesting(fake.embed);
});
afterEach(() => __setVegaEmbedForTesting(null));

// parseSpec is pure DOM traversal — stub the slice of the element contract it
// touches (a child <script type="application/json"> and a `spec` attribute)
// rather than stand up a real custom element, keeping the suite headless.
function makeHost(opts: {
  scriptText?: string;
  specAttr?: string;
}): HTMLElement {
  const attrs: Record<string, string> = {};
  if (opts.specAttr !== undefined) attrs.spec = opts.specAttr;
  return {
    querySelector: (sel: string) =>
      sel.includes("application/json") && opts.scriptText !== undefined
        ? ({ textContent: opts.scriptText } as unknown as Element)
        : null,
    getAttribute: (name: string) => attrs[name] ?? null,
  } as unknown as HTMLElement;
}

describe("parseSpec", () => {
  it("reads the Vega-Lite spec from a child JSON script block", () => {
    const spec = parseSpec(
      makeHost({ scriptText: '{ "mark": "line", "data": { "values": [] } }' }),
    );
    expect(spec).toEqual({ mark: "line", data: { values: [] } });
  });

  it("falls back to a `spec` attribute when there is no script block", () => {
    const spec = parseSpec(makeHost({ specAttr: '{ "mark": "bar" }' }));
    expect(spec).toEqual({ mark: "bar" });
  });

  it("prefers the script block over the attribute", () => {
    const spec = parseSpec(
      makeHost({
        scriptText: '{ "mark": "point" }',
        specAttr: '{ "mark": "bar" }',
      }),
    );
    expect(spec).toEqual({ mark: "point" });
  });

  it("returns null on missing or malformed JSON", () => {
    expect(parseSpec(makeHost({}))).toBeNull();
    expect(parseSpec(makeHost({ scriptText: "   " }))).toBeNull();
    expect(parseSpec(makeHost({ scriptText: "{ not json }" }))).toBeNull();
  });
});

describe("parseInteractive", () => {
  it("defaults to on and accepts false-like attribute values", () => {
    expect(parseInteractive(null)).toBe(true);
    expect(parseInteractive("")).toBe(true);
    expect(parseInteractive("true")).toBe(true);
    expect(parseInteractive("false")).toBe(false);
    expect(parseInteractive("OFF")).toBe(false);
    expect(parseInteractive("0")).toBe(false);
  });
});

describe("parseAspect", () => {
  it("accepts ratio strings and falls back to 4:3", () => {
    expect(parseAspect(null)).toBeCloseTo(4 / 3);
    expect(parseAspect("16:9")).toBeCloseTo(16 / 9);
    expect(parseAspect("3/2")).toBeCloseTo(3 / 2);
    expect(parseAspect("1.5")).toBeCloseTo(1.5);
    expect(parseAspect("invalid")).toBeCloseTo(4 / 3);
  });
});

// The element renders its parsed spec through RawChart — cover that path (and
// the new preset/theme fields) directly against the fake embed.
describe("RawChart (the element's renderer)", () => {
  it("embeds the author's Vega-Lite spec verbatim and injects a preset config", async () => {
    const chart = new RawChart(container, {
      spec: {
        mark: "line",
        data: { values: [{ x: 0, y: 1 }] },
        encoding: {
          x: { field: "x", type: "quantitative" },
          y: { field: "y", type: "quantitative" },
        },
      },
    });
    await chart.ready();
    expect(fake.specs).toHaveLength(1);
    const drawn = fake.specs[0] as Record<string, unknown>;
    expect(drawn.mark).toBe("line");
    expect(drawn.data).toEqual({ values: [{ x: 0, y: 1 }] });
    expect(drawn.autosize).toEqual({ type: "fit", contains: "padding" });
    expect(drawn.params as unknown[]).toHaveLength(2);
    // Unified preset injected as config when the spec carries none.
    expect(drawn.config).toBeTruthy();
    chart.dispose();
  });

  it("can disable default interactions", async () => {
    const chart = new RawChart(container, {
      spec: {
        mark: "line",
        encoding: {
          x: { field: "x", type: "quantitative" },
          y: { field: "y", type: "quantitative" },
        },
      },
      interactive: false,
    });
    await chart.ready();
    expect((fake.specs[0] as Record<string, unknown>).params).toBeUndefined();
    chart.dispose();
  });

  it("uses the host box height when layout size is available", async () => {
    let measuredHeight = 120;
    container.getBoundingClientRect = () =>
      ({ width: 400, height: measuredHeight }) as DOMRect;
    const chart = new RawChart(container, {
      spec: {
        mark: "line",
        encoding: {
          x: { field: "x", type: "quantitative" },
          y: { field: "y", type: "quantitative" },
        },
      },
    });
    await chart.ready();
    expect(fake.specs[0]?.width).toBe(400);
    // Host box height wins over width/aspect so the frame fills the layout box.
    expect(fake.specs[0]?.height).toBe(120);

    // Width-only resize re-renders; height feedback is ignored at default ratio
    // (see resizeChanged). Force a width change to re-measure.
    measuredHeight = 900;
    container.getBoundingClientRect = () =>
      ({ width: 500, height: measuredHeight }) as DOMRect;
    await chart.resize();
    expect(fake.specs[1]?.width).toBe(500);
    expect(fake.specs[1]?.height).toBe(900);
    chart.dispose();
  });

  it("ignores height-only ResizeObserver feedback at the default ratio", async () => {
    const chart = new InspectableRawChart(container, {
      spec: { mark: "line" },
    });
    await chart.ready();
    expect(
      chart.resizeWouldRender(
        { width: 400, height: 300 },
        { width: 400, height: 900 },
      ),
    ).toBe(false);
    expect(
      chart.resizeWouldRender(
        { width: 400, height: 300 },
        { width: 500, height: 900 },
      ),
    ).toBe(true);
    chart.dispose();
  });

  it("still responds to height changes when the spec authors a height", async () => {
    const chart = new InspectableRawChart(container, {
      spec: { mark: "point", height: 180 },
    });
    await chart.ready();
    expect(
      chart.resizeWouldRender(
        { width: 400, height: 180 },
        { width: 400, height: 240 },
      ),
    ).toBe(true);
    chart.dispose();
  });

  it("respects an explicitly authored height", async () => {
    const chart = new RawChart(container, {
      spec: { mark: "point", height: 180 },
    });
    await chart.ready();
    expect(fake.specs[0]?.height).toBe(180);
    chart.dispose();
  });

  it("derives height from aspect ratio when the host box height is tiny", async () => {
    // chart_base maps height 0 → fallback 320; height 1 keeps the path that
    // lets RawChart derive from width / aspectRatio.
    container.getBoundingClientRect = () =>
      ({ width: 400, height: 1 }) as DOMRect;
    const chart = new RawChart(container, {
      spec: { mark: "point" },
      aspectRatio: 16 / 9,
    });
    await chart.ready();
    expect(fake.specs[0]?.width).toBe(400);
    expect(fake.specs[0]?.height).toBe(225);
    chart.dispose();
  });

  it("keeps authored params and merges zoom binds for continuous axes", async () => {
    const params = [{ name: "pick", select: "point" }];
    const chart = new RawChart(container, {
      spec: {
        mark: "point",
        params,
        encoding: { x: { field: "x", type: "quantitative" } },
      },
    });
    await chart.ready();
    const out = (fake.specs[0] as Record<string, unknown>).params as {
      name: string;
    }[];
    expect(out.map((p) => p.name)).toEqual(
      expect.arrayContaining(["pick", "zoomX"]),
    );
    chart.dispose();
  });

  it("injects zoom params on layer[0] for layered agent specs", async () => {
    const chart = new RawChart(container, {
      interactive: true,
      spec: {
        layer: [
          {
            mark: "point",
            encoding: {
              x: { field: "N", type: "quantitative" },
              y: { field: "Rg", type: "quantitative" },
            },
          },
        ],
      },
    });
    await chart.ready();
    const layers = (
      fake.specs[0] as { layer: { params?: { name: string }[] }[] }
    ).layer;
    expect(layers[0].params?.map((p) => p.name)).toEqual(["zoomX", "zoomY"]);
    expect((fake.specs[0] as { params?: unknown }).params).toBeUndefined();
    chart.dispose();
  });

  it("deep-merges author config into the scaled preset", async () => {
    const ownConfig = { background: "red" };
    const chart = new RawChart(container, {
      spec: { mark: "point", config: ownConfig },
    });
    await chart.ready();
    const config = (fake.specs[0] as Record<string, unknown>).config as {
      background?: string;
      range?: { category?: unknown };
    };
    expect(config.background).toBe("red");
    // Preset tokens remain after merge (not wiped by partial author config).
    expect(config.range?.category).toBeTruthy();
    chart.dispose();
  });

  it("selects a named preset for the injected config", async () => {
    const chart = new RawChart(container, {
      spec: { mark: "bar" },
      preset: "molplot-paper",
    });
    await chart.ready();
    const config = (fake.specs[0] as Record<string, unknown>).config as {
      range?: { category?: unknown };
    };
    // A real config object was injected (preset tokens flowed through).
    expect(config.range?.category).toBeTruthy();
    chart.dispose();
  });

  it("finalizes the view on dispose", async () => {
    const chart = new RawChart(container, { spec: { mark: "line" } });
    await chart.ready();
    chart.dispose();
    expect(fake.finalized).toBe(1);
  });
});
