import { afterEach, beforeEach, describe, expect, it } from "@rstest/core";
import { parseSpec } from "../src/element";
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

// The element renders its parsed spec through RawChart — cover that path (and
// the new preset/theme fields) directly against the fake embed.
describe("RawChart (the element's renderer)", () => {
  it("embeds the author's Vega-Lite spec verbatim and injects a preset config", async () => {
    const chart = new RawChart(container, {
      spec: {
        mark: "line",
        data: { values: [{ x: 0, y: 1 }] },
        encoding: { x: { field: "x" }, y: { field: "y" } },
      },
    });
    await chart.ready();
    expect(fake.specs).toHaveLength(1);
    const drawn = fake.specs[0] as Record<string, unknown>;
    expect(drawn.mark).toBe("line");
    expect(drawn.data).toEqual({ values: [{ x: 0, y: 1 }] });
    // Unified preset injected as config when the spec carries none.
    expect(drawn.config).toBeTruthy();
    chart.dispose();
  });

  it("respects a spec that carries its own config", async () => {
    const ownConfig = { background: "red" };
    const chart = new RawChart(container, {
      spec: { mark: "point", config: ownConfig },
    });
    await chart.ready();
    expect((fake.specs[0] as Record<string, unknown>).config).toBe(ownConfig);
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
