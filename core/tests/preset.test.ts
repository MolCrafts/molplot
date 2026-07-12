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
});
