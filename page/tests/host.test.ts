import { describe, expect, it } from "@rstest/core";
import { commandsUrl, exportUrl, resultUrl } from "@/lib/host";
import { formatMm, parseSvgSize, stripSvgPreamble } from "@/lib/svg";

describe("host urls", () => {
  it("builds result and export urls", () => {
    expect(resultUrl("ui-1")).toBe("/api/result?requestId=ui-1");
    expect(commandsUrl()).toBe("/api/commands");
    expect(exportUrl("pdf", 4, true)).toBe("/api/export/pdf?r=4&download=true");
    expect(exportUrl("svg", 1)).toBe("/api/export/svg?r=1");
  });
});

describe("svg helpers", () => {
  it("strips xml preamble", () => {
    const svg =
      '<?xml version="1.0"?><!DOCTYPE svg><svg width="10pt" height="5pt"></svg>';
    expect(stripSvgPreamble(svg).startsWith("<svg")).toBe(true);
  });

  it("parses matplotlib pt sizes into mm", () => {
    const size = parseSvgSize('<svg width="72pt" height="36pt"></svg>');
    expect(size).not.toBeNull();
    expect(size?.widthMm).toBeCloseTo(25.4);
    expect(size?.heightMm).toBeCloseTo(12.7);
    expect(formatMm(25.4)).toBe("25 mm");
  });
});
