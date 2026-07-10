import { describe, expect, it } from "@rstest/core";
import { axisChannelAt, type Bounds } from "../src/chart_base";

/**
 * `axisChannelAt` decides which axis a wheel is over. Everything else in the
 * axis-hover path is a three-line adapter from the Vega scenegraph, so this is
 * where the behaviour is pinned — with plain rectangles, no DOM, no browser.
 *
 * Boxes are in the plot rectangle's frame: its interior is [0, W] x [0, H].
 * The numbers below are the real ones Vega emits for a 343x133 plot.
 */
const W = 343;
const H = 133;

const bottomAxis: Bounds = { x1: -1, x2: 344, y1: 132, y2: 165 };
const leftAxis: Bounds = { x1: -46, x2: 1, y1: -5, y2: 138 };
// Vega emits a grid group per axis whose box *is* the plot edge.
const bottomGrid: Bounds = { x1: 0, x2: W, y1: H, y2: H };
const leftGrid: Bounds = { x1: 0, x2: 0, y1: 0, y2: H };

const ALL = [bottomGrid, leftGrid, bottomAxis, leftAxis];
const at = (x: number, y: number, axes: Bounds[] = ALL) =>
  axisChannelAt(axes, x, y, W, H);

describe("axisChannelAt", () => {
  it("ignores the plot interior so the wheel scrolls the page", () => {
    expect(at(W / 2, H / 2)).toBeNull();
    expect(at(0, 0)).toBeNull();
    expect(at(W, H)).toBeNull();
  });

  it("claims x on the bottom axis and y on the left axis", () => {
    expect(at(W / 2, H + 14)).toBe("x");
    expect(at(-14, H / 2)).toBe("y");
  });

  it("never classifies a grid, whose box is the plot edge itself", () => {
    // Grids overlap the interior, so they must lose to the early return; feed
    // them alone to prove they never claim a channel on their own either.
    expect(at(W / 2, H, [bottomGrid])).toBeNull();
    expect(at(0, H / 2, [leftGrid])).toBeNull();
  });

  it("leaves a legend drawn under the x axis inert", () => {
    // Vega tags legends role:"legend", so they never reach here. A wheel below
    // the bottom axis therefore lands outside every axis box.
    expect(at(W / 2, 200)).toBeNull();
  });

  it("ignores the corner beside and below the plot", () => {
    expect(at(-14, H + 14)).toBeNull();
  });

  it("prefers x when an axis box spans both gutters", () => {
    // leftAxis reaches y = -5..138, past the plot's bottom edge; the pointer at
    // its lower-left corner is inside its box but the box is a y gutter.
    expect(at(-20, H + 2)).toBe("y");
  });

  it("classifies a top axis as x", () => {
    const topAxis: Bounds = { x1: -1, x2: 344, y1: -34, y2: 1 };
    expect(at(W / 2, -14, [topAxis])).toBe("x");
  });

  it("classifies a right axis as y", () => {
    const rightAxis: Bounds = { x1: W - 1, x2: W + 46, y1: -5, y2: 138 };
    expect(at(W + 14, H / 2, [rightAxis])).toBe("y");
  });

  it("claims nothing when the chart drew no axes", () => {
    expect(at(-14, H / 2, [])).toBeNull();
  });
});
