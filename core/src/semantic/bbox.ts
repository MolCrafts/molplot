import type { BBox } from "./generated";
import { isFiniteNumber } from "./hex";

/** Figure-fraction, y-down axis-aligned box from a Set command value. */
export function parseBBox(value: unknown): BBox | null {
  if (value === null || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (
    !isFiniteNumber(raw.x) ||
    !isFiniteNumber(raw.y) ||
    !isFiniteNumber(raw.w) ||
    !isFiniteNumber(raw.h)
  ) {
    return null;
  }
  if (raw.w <= 0 || raw.h <= 0) return null;
  return { x: raw.x, y: raw.y, w: raw.w, h: raw.h };
}
