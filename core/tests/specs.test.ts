import { describe, expect, it } from "@rstest/core";
import { compile } from "vega-lite";
import {
  barSpec,
  ganttSpec,
  lineSpec,
  scatterSpec,
  ZOOM_EVENT_FLAG,
  ZOOM_PARAM,
  zoomParamsOf,
} from "../src/specs";
import { resolveTheme } from "../src/theme";

// biome-ignore lint/suspicious/noExplicitAny: spec is intentionally loosely typed JSON
const S = (o: unknown) => o as any;

const light = resolveTheme("light");

/** Compile through the real Vega-Lite, collecting warnings and every signal
 * name in the emitted Vega spec (top level plus nested group marks). */
function compiled(spec: unknown) {
  const warnings: string[] = [];
  const logger = {
    level: () => logger,
    warn: (...a: unknown[]) => {
      warnings.push(a.join(" "));
      return logger;
    },
    info: () => logger,
    debug: () => logger,
    error: () => logger,
  };
  // biome-ignore lint/suspicious/noExplicitAny: vega-lite's compile takes a TopLevelSpec
  const out = compile(spec as any, { logger: logger as any });
  const names: string[] = [];
  // biome-ignore lint/suspicious/noExplicitAny: walking untyped Vega output
  const walk = (node: any) => {
    for (const s of node.signals ?? []) names.push(s.name);
    for (const m of node.marks ?? []) if (m.type === "group") walk(m);
  };
  walk(out.spec);
  const duplicates = names.filter((n, i) => names.indexOf(n) !== i);
  return { vega: S(out.spec), warnings, duplicates };
}

type Mark = { clip?: boolean };

/** Every mark in the spec tree, whether the spec is layered or a unit spec. */
// biome-ignore lint/suspicious/noExplicitAny: spec is loosely typed JSON
const marksOf = (spec: any): Mark[] =>
  spec.layer ? spec.layer.map((l: { mark: Mark }) => l.mark) : [spec.mark];

describe("lineSpec", () => {
  it("carries the schema, preset config and named data", () => {
    const spec = S(
      lineSpec({ series: [{ id: "a", label: "A" }] }, light, { height: 200 }),
    );
    expect(spec.$schema).toContain("vega-lite/v5");
    expect(spec.data).toEqual({ name: "table" });
    expect(spec.height).toBe(200);
    // The unified preset is injected as the Vega-Lite config.
    expect(spec.config.range.category[0]).toBe(light.palette[0]);
    expect(spec.config.background).toBe("transparent");
  });

  it("maps each series to a colour-scale entry", () => {
    const spec = S(
      lineSpec(
        {
          series: [
            { id: "a", label: "A", color: "#111111" },
            { id: "b", label: "B" },
          ],
        },
        light,
      ),
    );
    const color = spec.layer[0].encoding.color;
    expect(color.scale.domain).toEqual(["A", "B"]);
    expect(color.scale.range[0]).toBe("#111111");
    // Legend hidden unless showLegend.
    expect(color.legend).toBeNull();
  });

  it("adds a marker layer only for lines+markers series", () => {
    const spec = S(
      lineSpec(
        { series: [{ id: "a", mode: "lines+markers" }, { id: "b" }] },
        light,
      ),
    );
    const markerLayer = spec.layer[1];
    expect(markerLayer.transform[0].filter.oneOf).toEqual(["a"]);
  });
});

describe("scatterSpec", () => {
  it("uses a sequential scheme for a numeric colour channel", () => {
    const spec = S(
      scatterSpec(
        {
          points: [{ x: 0, y: 0 }],
          xAxis: {},
          yAxis: {},
          marker: { color: [1, 2, 3], colorscale: "magma", showscale: true },
        },
        light,
      ),
    );
    const color = spec.layer[0].encoding.color;
    expect(color.type).toBe("quantitative");
    expect(color.scale.scheme).toBe("magma");
    expect(color.legend).toEqual({});
  });

  it("emits a highlight dataset layer", () => {
    const spec = S(scatterSpec({ points: [], xAxis: {}, yAxis: {} }, light));
    expect(spec.layer[1].data).toEqual({ name: "highlight" });
  });
});

describe("barSpec", () => {
  it("groups with an offset channel", () => {
    const spec = S(
      barSpec({ series: [{ id: "a", points: [] }], mode: "group" }, light),
    );
    expect(spec.layer[0].encoding.xOffset).toEqual({ field: "key" });
    expect(spec.layer[0].encoding.y.stack).toBeNull();
  });

  it("stacks by default value channel", () => {
    const spec = S(
      barSpec({ series: [{ id: "a", points: [] }], mode: "stack" }, light),
    );
    expect(spec.layer[0].encoding.y.stack).toBe(true);
    expect(spec.layer[0].encoding.xOffset).toBeUndefined();
  });

  it("flips channels when horizontal", () => {
    const spec = S(
      barSpec({ series: [{ id: "a", points: [] }], orientation: "h" }, light),
    );
    expect(spec.layer[0].encoding.y.field).toBe("cat");
    expect(spec.layer[0].encoding.x.field).toBe("val");
  });

  it("adds a line overlay layer for line series", () => {
    const spec = S(
      barSpec(
        {
          series: [
            { id: "a", points: [{ x: "x", y: 1 }] },
            { id: "b", type: "line", points: [{ x: "x", y: 3 }] },
          ],
          mode: "stack",
        },
        light,
      ),
    );
    expect(spec.layer.length).toBe(2);
    expect(spec.layer[1].data).toEqual({ name: "line" });
  });
});

describe("ganttSpec", () => {
  it("spans bars from start to end with status colouring", () => {
    const spec = S(
      ganttSpec(
        {
          tasks: [
            { id: "t1", label: "Build", start: 0, end: 10, statusGroup: "ok" },
          ],
          statusColors: { ok: "#22c55e" },
        },
        light,
      ),
    );
    expect(spec.encoding.x.field).toBe("start");
    expect(spec.encoding.x2.field).toBe("end");
    expect(spec.encoding.color.scale.range).toEqual(["#22c55e"]);
  });
});

describe("pan/zoom interaction", () => {
  const specs = {
    line: () =>
      lineSpec({ series: [{ id: "a", mode: "lines+markers" }] }, light),
    scatter: () =>
      scatterSpec({ points: [{ x: 0, y: 0 }], xAxis: {}, yAxis: {} }, light),
    bar: () =>
      barSpec({ series: [{ id: "a", points: [{ x: "c", y: 1 }] }] }, light),
    gantt: () =>
      ganttSpec(
        {
          tasks: [{ id: "t", label: "L", start: 0, end: 1, statusGroup: "ok" }],
          statusColors: { ok: "#22c55e" },
        },
        light,
      ),
  };

  const cases = Object.entries(specs);
  const channels = (spec: unknown) =>
    zoomParamsOf(S(spec)).map((p) => p.select.encodings[0]);

  it.each(
    cases,
  )("%s declares one scale binding per zoomable axis", (_k, make) => {
    for (const param of zoomParamsOf(S(make()))) {
      expect(param.bind).toBe("scales");
      expect(param.select.type).toBe("interval");
      // One param drives exactly one scale, which is what lets a wheel over a
      // single axis gutter zoom that axis alone.
      expect(param.select.encodings).toHaveLength(1);
      const channel = param.select.encodings[0];
      expect(param.name).toBe(ZOOM_PARAM[channel]);
      // `view:` (not the default `scope`) is what lets a wheel over an axis
      // reach the selection at all — axes render with pointer-events: none,
      // outside the plot group. `VegaChart` stamps the flag; `|| shiftKey`
      // keeps the spec self-sufficient when nobody stamps it.
      expect(param.select.zoom).toBe(
        `view:wheel![event.${ZOOM_EVENT_FLAG[channel]} || event.shiftKey]`,
      );
    }
  });

  it.each(cases)("%s clips every mark to the plot rect", (_k, make) => {
    // Without clip a zoomed-in mark paints over the axes.
    for (const mark of marksOf(S(make()))) expect(mark.clip).toBe(true);
  });

  it.each([
    ["line", ["x", "y"]],
    ["scatter", ["x", "y"]],
    // The remaining axis of each is a band scale, which cannot take a binding.
    ["bar", ["y"]],
    ["gantt", ["x"]],
  ] as const)("%s binds only its continuous channels", (key, want) => {
    expect(channels(specs[key]())).toEqual(want);
  });

  it("follows the value axis when a bar chart is horizontal", () => {
    const horizontal = barSpec(
      { series: [{ id: "a", points: [] }], orientation: "h" },
      light,
    );
    expect(channels(horizontal)).toEqual(["x"]);
  });

  it.each(cases)("%s compiles without duplicate Vega signals", (_k, make) => {
    // A selection param at the top level of a *layered* spec is copied into
    // every layer; Vega then throws "Duplicate signal name" at parse time while
    // vl.compile() stays silent. Only a browser (or this test) catches it.
    expect(compiled(make()).duplicates).toEqual([]);
  });

  it.each(cases)("%s never binds a discrete scale", (_k, make) => {
    // Listing a band channel in `encodings` logs "Scale bindings are currently
    // only supported for scales with unbinned, continuous domains." (ganttSpec
    // emits unrelated opacity/legend warnings, so match on this one only.)
    const { warnings } = compiled(make());
    expect(warnings.filter((w) => w.includes("Scale binding"))).toEqual([]);
  });

  it("lets the interaction override zero/nice and an explicit domain", () => {
    // `bind: "scales"` adds domainRaw, which wins over the computed domain at
    // runtime — so rangemode/tozero still picks the *initial* view only.
    const spec = lineSpec(
      {
        series: [{ id: "a" }],
        xAxis: { rangemode: "tozero" },
        yAxis: { range: [0, 5] },
      },
      light,
    );
    const { vega } = compiled(spec);
    const scale = (n: string) =>
      vega.scales.find((s: { name: string }) => s.name === n);
    expect(scale("x").domainRaw).toEqual({ signal: `${ZOOM_PARAM.x}["x"]` });
    expect(scale("y").domainRaw).toEqual({ signal: `${ZOOM_PARAM.y}["y"]` });
    expect(scale("y").domain).toEqual([0, 5]);
  });
});
