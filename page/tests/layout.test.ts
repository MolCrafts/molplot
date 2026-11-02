import { describe, expect, it } from "@rstest/core";
import * as layout from "@/lib/layout";
import {
  CANVAS_MIN_PCT,
  isSidePanelOpen,
  resolveWorkbenchPanelLayout,
  SIDE_PANEL,
  SIDE_PANEL_MIN_TRAVEL_PCT,
  sidePanelMaxPct,
  sidePanelMinPct,
} from "@/lib/layout";

describe("workbench panel layout", () => {
  it("uses unified SIDE_PANEL tokens for left and right rails", () => {
    expect(SIDE_PANEL.minPct).toBe(15);
    expect(SIDE_PANEL.maxPct).toBe(30);
    expect(SIDE_PANEL.openDefaultPct).toBeGreaterThanOrEqual(SIDE_PANEL.minPct);
    expect(SIDE_PANEL.openDefaultPct).toBeLessThanOrEqual(SIDE_PANEL.maxPct);
    expect(CANVAS_MIN_PCT).toBe(100 - SIDE_PANEL.maxPct);
    expect(CANVAS_MIN_PCT).toBe(70);
  });

  it("opens both rails at the default width when both start open", () => {
    const resolved = resolveWorkbenchPanelLayout({
      showLeft: true,
      showRight: true,
      leftOpen: true,
      rightOpen: true,
    });
    const open = SIDE_PANEL.openDefaultPct;
    const canvas = 100 - open * 2;
    expect(resolved.defaultLayout).toEqual({
      left: open,
      canvas,
      right: open,
    });
    expect(resolved.leftSize).toBe(`${open}%`);
    expect(resolved.canvasSize).toBe(`${canvas}%`);
    expect(resolved.rightSize).toBe(`${open}%`);
  });

  it("keeps a zero-width left slot when the left rail is closed", () => {
    const resolved = resolveWorkbenchPanelLayout({
      showLeft: true,
      showRight: true,
      leftOpen: false,
      rightOpen: true,
    });
    const open = SIDE_PANEL.openDefaultPct;
    expect(resolved.defaultLayout).toEqual({
      left: 0,
      canvas: 100 - open,
      right: open,
    });
    expect(resolved.leftSize).toBe("0%");
  });

  it("treats widths below the minimum as closed", () => {
    expect(isSidePanelOpen(0)).toBe(false);
    expect(isSidePanelOpen(SIDE_PANEL.minPct - 1)).toBe(false);
    expect(isSidePanelOpen(SIDE_PANEL.minPct)).toBe(true);
    expect(isSidePanelOpen(SIDE_PANEL.openDefaultPct)).toBe(true);
  });

  it("holds the rail to a 240px pixel floor", () => {
    expect(layout.SIDE_PANEL_MIN_PX).toBe(240);
  });

  it("resolves the rail minimum in px terms for the container", () => {
    expect((sidePanelMinPct(1280) / 100) * 1280).toBeGreaterThanOrEqual(240);
    expect(sidePanelMinPct(3000)).toBe(SIDE_PANEL.minPct);
  });
});

describe("sidePanelMaxPct", () => {
  it("keeps the cap on a shell wide enough for it", () => {
    expect(sidePanelMaxPct(1600)).toBe(SIDE_PANEL.maxPct);
    expect(sidePanelMinPct(1600)).toBeLessThan(sidePanelMaxPct(1600));
  });

  it("guarantees drag travel where the px floor meets the cap", () => {
    for (const width of [400, 600, 800, 900, 1024, 1280, 1600, 2560]) {
      const travel =
        Math.round((sidePanelMaxPct(width) - sidePanelMinPct(width)) * 100) /
        100;
      expect(travel).toBeGreaterThanOrEqual(SIDE_PANEL_MIN_TRAVEL_PCT);
    }
  });

  it("is never below the min for the same width", () => {
    for (const width of [320, 800, 1440]) {
      expect(sidePanelMaxPct(width)).toBeGreaterThan(sidePanelMinPct(width));
    }
  });
});
