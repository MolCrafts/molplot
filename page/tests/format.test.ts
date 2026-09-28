import { describe, expect, it } from "@rstest/core";
import {
  formatScience,
  formatSize,
  parseNumberList,
  parseStringList,
} from "@/lib/format";

describe("formatSize", () => {
  it("keeps integers as integers", () => {
    expect(formatSize(2)).toBe("2");
    expect(formatSize(0)).toBe("0");
  });

  it("keeps two decimal places for size values", () => {
    expect(formatSize(1.4)).toBe("1.40");
    expect(formatSize(3.456)).toBe("3.46");
    expect(formatSize(0.1)).toBe("0.10");
  });
});

describe("formatScience", () => {
  it("uses scientific notation for large and tiny magnitudes", () => {
    expect(formatScience(12345)).toBe("1.23e+4");
    expect(formatScience(0.00012)).toBe("1.20e-4");
    expect(formatScience(-2.5e6)).toBe("-2.50e+6");
  });

  it("keeps readable values at ordinary magnitudes", () => {
    expect(formatScience(0)).toBe("0");
    expect(formatScience(60)).toBe("60");
    expect(formatScience(1.25)).toBe("1.25");
  });
});

describe("parseNumberList", () => {
  it("splits commas, spaces, and scientific tokens", () => {
    expect(parseNumberList("0, 20, 40")).toEqual([0, 20, 40]);
    expect(parseNumberList("1e-3 1e-2")).toEqual([0.001, 0.01]);
    expect(parseNumberList("")).toEqual([]);
    expect(parseNumberList("1, foo")).toBeNull();
  });
});

describe("parseStringList", () => {
  it("splits comma-separated tick labels", () => {
    expect(parseStringList("0, 20, 40")).toEqual(["0", "20", "40"]);
    expect(parseStringList("")).toEqual([]);
  });
});
