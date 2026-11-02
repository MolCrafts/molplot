/**
 * Display formats for the figure workbench.
 *
 * Size fields (pt, inches, bbox, opacity %) keep two decimal places.
 * Science fields (axis limits, ticks, data) use scientific notation when
 * the magnitude is large or small; otherwise two decimals.
 */

export function formatSize(value: number): string {
  if (!Number.isFinite(value)) return "";
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2);
}

export function formatScience(value: number): string {
  if (!Number.isFinite(value)) return "";
  if (value === 0) return "0";
  const abs = Math.abs(value);
  if (abs >= 1e3 || abs < 1e-2) {
    return value.toExponential(2);
  }
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2);
}

export function parseNumberList(text: string): number[] | null {
  const parts = text
    .trim()
    .split(/[\s,;]+/)
    .filter(Boolean);
  const out: number[] = [];
  for (const part of parts) {
    const n = Number(part);
    if (!Number.isFinite(n)) return null;
    out.push(n);
  }
  return out;
}

export function parseStringList(text: string): string[] {
  if (!text.trim()) return [];
  return text.split(",").map((part) => part.trim());
}
