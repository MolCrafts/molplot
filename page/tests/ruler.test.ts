import { describe, expect, it } from "@rstest/core";
import { mmToPx, pxToMm, rulerTicks } from "@/lib/ruler";
import { ptToPx, pxToPt } from "@/lib/units";

describe("rulerTicks", () => {
  it("marks every 5 mm as major", () => {
    const ticks = rulerTicks(12);
    expect(ticks[0]).toEqual({ mm: 0, major: true });
    expect(ticks[1]).toEqual({ mm: 1, major: false });
    expect(ticks[5]).toEqual({ mm: 5, major: true });
    expect(ticks[ticks.length - 1]?.mm).toBe(12);
  });
});

describe("mmToPx", () => {
  it("maps millimetres onto the paper pixel length", () => {
    expect(mmToPx(43.2, 86.4, 400)).toBeCloseTo(200);
  });
});

describe("pxToMm", () => {
  it("inverts mmToPx", () => {
    expect(pxToMm(200, 86.4, 400)).toBeCloseTo(43.2);
  });
});

describe("pt/px", () => {
  it("round-trips matplotlib default dpi", () => {
    expect(pxToPt(ptToPx(1.4))).toBeCloseTo(1.4);
    expect(pxToPt(1.9444444444444444)).toBeCloseTo(1.4);
  });
});
