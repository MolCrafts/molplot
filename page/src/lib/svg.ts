export function stripSvgPreamble(svg: string): string {
  return svg.replace(/<\?xml[^>]*>/i, "").replace(/<!DOCTYPE[^>]*>/i, "");
}

export interface SvgSize {
  width: number;
  height: number;
  unit: "pt" | "px" | "mm";
}

const SIZE_RE = /^([\d.]+)\s*(pt|px|mm|in|cm)?$/i;

function toMm(value: number, unit: string | undefined): { mm: number } {
  switch ((unit || "px").toLowerCase()) {
    case "mm":
      return { mm: value };
    case "cm":
      return { mm: value * 10 };
    case "in":
      return { mm: value * 25.4 };
    case "pt":
      return { mm: (value * 25.4) / 72 };
    default:
      return { mm: (value * 25.4) / 96 };
  }
}

export function parseSvgSize(
  svg: string,
): { widthMm: number; heightMm: number } | null {
  const widthMatch = svg.match(/\bwidth="([^"]+)"/i);
  const heightMatch = svg.match(/\bheight="([^"]+)"/i);
  if (!widthMatch || !heightMatch) return null;
  const widthParts = SIZE_RE.exec(widthMatch[1]);
  const heightParts = SIZE_RE.exec(heightMatch[1]);
  if (!widthParts || !heightParts) return null;
  const width = Number(widthParts[1]);
  const height = Number(heightParts[1]);
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return null;
  }
  return {
    widthMm: toMm(width, widthParts[2]).mm,
    heightMm: toMm(height, heightParts[2]).mm,
  };
}

export function formatMm(value: number): string {
  return `${Math.round(value)} mm`;
}
