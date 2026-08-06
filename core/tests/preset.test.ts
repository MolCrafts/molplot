import { describe, expect, it } from "@rstest/core";
import { getPreset, presetNames } from "../src/preset";
import { CHART_PALETTE, resolveTheme, vegaConfig } from "../src/theme";

describe("preset", () => {
  it("exposes the canonical presets", () => {
    expect(presetNames()).toContain("molplot");
    expect(presetNames()).toContain("molplot-paper");
  });

  it("falls back to the default for an unknown name", () => {
    expect(getPreset("does-not-exist").name).toBe("molplot");
  });

  it("CHART_PALETTE matches the default preset tokens", () => {
    expect(CHART_PALETTE).toEqual(getPreset("molplot").palette.categorical);
    expect(CHART_PALETTE[0]).toBe("#0c5da5");
  });
});

describe("resolveTheme", () => {
  it("resolves light vs dark foreground from the preset", () => {
    const light = resolveTheme("light");
    const dark = resolveTheme("dark");
    expect(light.mode).toBe("light");
    expect(dark.mode).toBe("dark");
    expect(light.font.color).not.toBe(dark.font.color);
  });

  it("carries the preset name through", () => {
    expect(resolveTheme("light", "molplot-paper").presetName).toBe(
      "molplot-paper",
    );
  });
});

describe("vegaConfig", () => {
  it("injects the palette and type scale as a Vega-Lite config", () => {
    const cfg = vegaConfig(resolveTheme("light"));
    // biome-ignore lint/suspicious/noExplicitAny: loose VL config shape
    const c = cfg as any;
    expect(c.range.category[0]).toBe("#0c5da5");
    expect(c.axis.grid).toBe(true);
    expect(typeof c.axis.labelFontSize).toBe("number");
  });

  it("scales type sizes for wide web hosts while keeping paper at 1×", () => {
    const theme = resolveTheme("light");
    // biome-ignore lint/suspicious/noExplicitAny: loose VL config shape
    const paper = vegaConfig(theme, 1) as any;
    // biome-ignore lint/suspicious/noExplicitAny: loose VL config shape
    const screen = vegaConfig(theme, 1.6) as any;
    expect(screen.axis.labelFontSize).toBeCloseTo(
      paper.axis.labelFontSize * 1.6,
      5,
    );
    expect(screen.axis.titleFontSize).toBeCloseTo(
      paper.axis.titleFontSize * 1.6,
      5,
    );
    expect(screen.title.fontSize).toBeCloseTo(paper.title.fontSize * 1.6, 5);
  });
});

describe("fontScaleForHost", () => {
  it("matches page body type (~0.95× body / 9 px paper tick)", async () => {
    const { fontScaleForHost } = await import("../src/theme");
    // Docs .md-typeset ≈ 12.8 px → tick target ≈ 12.2 → scale ≈ 1.35
    const s = fontScaleForHost(560, 12.8);
    expect(s).toBeGreaterThanOrEqual(1.15);
    expect(s).toBeLessThanOrEqual(1.85);
    expect(s).toBeCloseTo((12.8 * 0.95) / 9, 1);
  });

  it("nudges with width but stays within a modest band", async () => {
    const { fontScaleForHost } = await import("../src/theme");
    const narrow = fontScaleForHost(320, 13);
    const wide = fontScaleForHost(800, 13);
    expect(wide).toBeGreaterThanOrEqual(narrow);
    expect(wide).toBeLessThanOrEqual(1.85);
    expect(narrow).toBeGreaterThanOrEqual(1.15);
  });
});

describe("fontScaleForWidth", () => {
  it("delegates to fontScaleForHost with a neutral body size", async () => {
    const { fontScaleForWidth, fontScaleForHost } = await import(
      "../src/theme"
    );
    expect(fontScaleForWidth(560)).toBe(fontScaleForHost(560, 13));
  });
});
