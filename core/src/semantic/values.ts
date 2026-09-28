import { isFiniteNumber } from "./hex";

export function parseOpacity(value: unknown): number | null {
  if (!isFiniteNumber(value) || value < 0 || value > 1) return null;
  return value;
}

export function parseSize(value: unknown): number | null {
  if (!isFiniteNumber(value) || value <= 0) return null;
  return value;
}

export function parseDash(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  const out: number[] = [];
  for (const item of value) {
    if (!isFiniteNumber(item) || item < 0) return null;
    out.push(item);
  }
  return out;
}

export function parseName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim();
  return name || null;
}

export function parseBool(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

export function parseTicks(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  const out: number[] = [];
  for (const item of value) {
    if (!isFiniteNumber(item)) return null;
    out.push(item);
  }
  return out;
}

export function parseTickLabels(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") return null;
    out.push(item);
  }
  return out;
}
