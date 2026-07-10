import { afterEach, beforeEach, describe, expect, it } from "@rstest/core";
import { ScatterChart } from "../src/scatter_chart";
import { __setVegaEmbedForTesting } from "../src/vega_loader";
import { type FakeVega, makeFakeContainer, makeFakeVega } from "./_fake_vega";

let container: HTMLElement;
let fake: FakeVega;

beforeEach(() => {
  container = makeFakeContainer();
  fake = makeFakeVega();
  __setVegaEmbedForTesting(fake.embed);
});
afterEach(() => __setVegaEmbedForTesting(null));

describe("ScatterChart", () => {
  it("seeds points and an empty highlight dataset", async () => {
    const chart = new ScatterChart(container, {
      points: [{ x: 1, y: 2, customdata: "p0" }],
      xAxis: {},
      yAxis: {},
    });
    await chart.ready();
    expect(fake.data.table).toEqual([
      { i: 0, x: 1, y: 2, customdata: "p0", c: undefined },
    ]);
    expect(fake.data.highlight).toEqual([]);
    chart.dispose();
  });

  it("setHighlight updates only the highlight dataset (no re-embed)", async () => {
    const chart = new ScatterChart(container, {
      points: [
        { x: 1, y: 2 },
        { x: 3, y: 4 },
      ],
      xAxis: {},
      yAxis: {},
    });
    await chart.ready();
    await chart.setHighlight(1);
    expect(fake.specs.length).toBe(1);
    expect(fake.data.highlight).toEqual([{ x: 3, y: 4 }]);
    chart.dispose();
  });

  it("routes clicks with the point index and customdata", async () => {
    const chart = new ScatterChart(container, {
      points: [{ x: 1, y: 2, customdata: { id: 7 } }],
      xAxis: {},
      yAxis: {},
    });
    await chart.ready();
    const seen: unknown[] = [];
    chart.onPointClick((e) => seen.push(e));
    fake.click({ i: 0, x: 1, y: 2, customdata: { id: 7 } });
    expect(seen).toEqual([{ index: 0, x: 1, y: 2, customdata: { id: 7 } }]);
    chart.dispose();
  });
});
