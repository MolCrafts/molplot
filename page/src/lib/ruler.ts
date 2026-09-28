export interface RulerTick {
  mm: number;
  major: boolean;
}

/** Millimetre ticks along a figure edge. Major every 5 mm. */
export function rulerTicks(lengthMm: number, majorEvery = 5): RulerTick[] {
  if (!Number.isFinite(lengthMm) || lengthMm <= 0) return [];
  const end = Math.ceil(lengthMm - 1e-6);
  const ticks: RulerTick[] = [];
  for (let mm = 0; mm <= end; mm += 1) {
    ticks.push({ mm, major: mm % majorEvery === 0 });
  }
  return ticks;
}

export function mmToPx(mm: number, lengthMm: number, lengthPx: number): number {
  if (lengthMm <= 0) return 0;
  return (mm / lengthMm) * lengthPx;
}

export function pxToMm(px: number, lengthMm: number, lengthPx: number): number {
  if (lengthPx <= 0) return 0;
  return (px / lengthPx) * lengthMm;
}
