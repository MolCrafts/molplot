import { afterEach, beforeEach, describe, expect, it } from "@rstest/core";
import { LineChart } from "../src/line_chart";
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

describe("LineChart", () => {
  it("embeds a spec and seeds initial points into the table dataset", async () => {
    const chart = new LineChart(container, {
      series: [{ id: "a", label: "A", initialPoints: [{ x: 0, y: 1 }] }],
    });
    await chart.ready();
    expect(fake.specs.length).toBe(1);
    expect(fake.data.table).toEqual([{ s: "a", key: "A", i: 0, x: 0, y: 1 }]);
    chart.dispose();
  });

  it("appendPoints pushes a cheap data update (no re-embed)", async () => {
    const chart = new LineChart(container, { series: [{ id: "a" }] });
    await chart.ready();
    await chart.appendPoints("a", [
      { x: 1, y: 2 },
      { x: 2, y: 4 },
    ]);
    expect(fake.specs.length).toBe(1); // still a single embed
    expect(fake.data.table).toHaveLength(2);
    expect(fake.data.table[1]).toMatchObject({ x: 2, y: 4 });
    chart.dispose();
  });

  it("enforces the sliding window", async () => {
    const chart = new LineChart(container, {
      series: [{ id: "a" }],
      windowSize: 2,
    });
    await chart.ready();
    await chart.appendPoints("a", [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ]);
    expect(fake.data.table).toHaveLength(2);
    expect(fake.data.table[0]).toMatchObject({ x: 1 });
    chart.dispose();
  });

  it("routes clicks to onPointClick with the series id", async () => {
    const chart = new LineChart(container, {
      series: [{ id: "a", label: "A" }],
    });
    await chart.ready();
    const seen: unknown[] = [];
    chart.onPointClick((e) => seen.push(e));
    fake.click({ s: "a", i: 3, x: 5, y: 6 });
    expect(seen).toEqual([{ seriesId: "a", index: 3, x: 5, y: 6 }]);
    chart.dispose();
  });

  it("throws on an unknown series id", async () => {
    const chart = new LineChart(container, { series: [{ id: "a" }] });
    await chart.ready();
    await expect(chart.appendPoints("zzz", [{ x: 0, y: 0 }])).rejects.toThrow(
      /unknown series/,
    );
    chart.dispose();
  });

  it("finalizes the view on dispose", async () => {
    const chart = new LineChart(container, { series: [{ id: "a" }] });
    await chart.ready();
    chart.dispose();
    expect(fake.finalized).toBe(1);
  });

  it("binds one axis-hover wheel listener and drops it on dispose", async () => {
    // The listener lives on the container, which survives every re-embed, so
    // setAxisRange (which re-embeds) must not add a second one.
    const chart = new LineChart(container, { series: [{ id: "a" }] });
    await chart.ready();
    await chart.setAxisRange("x", [0, 1]);
    expect(container.listenerCount()).toBe(1);
    chart.dispose();
    expect(container.listenerCount()).toBe(0);
  });
});
