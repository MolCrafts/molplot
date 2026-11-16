import { describe, expect, it } from "@rstest/core";
import { clampBox, hitTest, pathToD, placeQuickMenu } from "@/lib/overlay";

describe("clampBox", () => {
  it("keeps an on-paper box", () => {
    const { box, clipped } = clampBox({ x: 0.2, y: 0.3, w: 0.1, h: 0.1 });
    expect(clipped).toBe(false);
    expect(box).toEqual({ x: 0.2, y: 0.3, w: 0.1, h: 0.1 });
  });

  it("clips a box that leaves the paper", () => {
    const { box, clipped } = clampBox({ x: -0.1, y: 0.2, w: 0.3, h: 0.1 });
    expect(clipped).toBe(true);
    expect(box.x).toBe(0);
    expect(box.w).toBeCloseTo(0.2);
  });

  it("pins a fully off-paper box to the nearest edge", () => {
    const { box, clipped } = clampBox({ x: -0.5, y: -0.5, w: 0.1, h: 0.1 });
    expect(clipped).toBe(true);
    expect(box.x).toBe(0);
    expect(box.y).toBe(0);
    expect(box.w).toBeGreaterThan(0);
    expect(box.h).toBeGreaterThan(0);
  });
});

describe("pathToD", () => {
  it("builds a figure-fraction polyline", () => {
    expect(
      pathToD([
        { x: 0, y: 0 },
        { x: 0.5, y: 1 },
      ]),
    ).toBe("M 0 0 L 50 100");
  });
});

describe("hitTest", () => {
  const line = {
    id: "series-0",
    points: [
      { x: 0.1, y: 0.5 },
      { x: 0.9, y: 0.5 },
    ],
  };
  const panel = {
    id: "panel-0",
    role: "panel",
    box: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 },
  };
  const figure = {
    id: "figure-0",
    role: "figure",
    box: { x: 0, y: 0, w: 1, h: 1 },
  };

  it("selects a series when the click is near the path", () => {
    expect(
      hitTest({ x: 0.5, y: 0.51 }, [line], [panel, figure], 400, 300, 14),
    ).toBe("series-0");
  });

  it("falls through to the panel when the click is in the axes but not on a line", () => {
    expect(
      hitTest({ x: 0.5, y: 0.2 }, [line], [panel, figure], 400, 300, 14),
    ).toBe("panel-0");
  });

  it("selects the figure in the margin", () => {
    expect(
      hitTest({ x: 0.02, y: 0.02 }, [line], [panel, figure], 400, 300, 14),
    ).toBe("figure-0");
  });
});

describe("placeQuickMenu", () => {
  const menu = { w: 180, h: 32 };
  const bounds = { w: 400, h: 300 };
  it("opens beside a click and flips left at the right edge", () => {
    expect(placeQuickMenu({ x: 200, y: 120 }, bounds, menu)).toEqual({
      x: 210,
      y: 130,
    });
    expect(placeQuickMenu({ x: 390, y: 120 }, bounds, menu)).toEqual({
      x: 200,
      y: 130,
    });
  });
  it("stays beside the pointer even when every nearby position contains chart ink", () => {
    const position = placeQuickMenu(
      { x: 200, y: 120 },
      { w: 1000, h: 800 },
      menu,
      10,
      [{ x: 0, y: 0, w: 1000, h: 800 }],
    );
    expect(position).toEqual({ x: 210, y: 130 });
  });
  it("keeps the popup visible after the selected point is panned offscreen", () => {
    expect(placeQuickMenu({ x: 900, y: 900 }, bounds, menu)).toEqual({
      x: 210,
      y: 258,
    });
    expect(placeQuickMenu({ x: -900, y: -900 }, bounds, menu)).toEqual({
      x: 10,
      y: 10,
    });
  });
});
