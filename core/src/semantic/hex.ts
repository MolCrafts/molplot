const HEX = /^#[0-9a-f]{6}$/;

/** Normalize `#RGB` / `#RRGGBB` (any case) to lowercase `#rrggbb`. */
export function normalizeHex(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim().toLowerCase();
  if (HEX.test(raw)) return raw;
  if (/^#[0-9a-f]{3}$/.test(raw)) {
    const r = raw[1];
    const g = raw[2];
    const b = raw[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return null;
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
