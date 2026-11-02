/** Matplotlib default canvas DPI. Scene stroke.width is stored in px. */
export const MPL_DPI = 100;

export function pxToPt(px: number): number {
  return (px * 72) / MPL_DPI;
}

export function ptToPx(pt: number): number {
  return (pt * MPL_DPI) / 72;
}

export const DASHED_PX = [6, 4];
export const DOTTED_PX = [1.5, 2.5];
export const DASHDOT_PX = [6, 3, 1.5, 3];

export type LineStyleId = "solid" | "dashed" | "dotted" | "dashdot";

export function dashForStyle(style: LineStyleId): number[] {
  if (style === "dashed") return [...DASHED_PX];
  if (style === "dotted") return [...DOTTED_PX];
  if (style === "dashdot") return [...DASHDOT_PX];
  return [];
}

export function styleForDash(dash: readonly number[] | undefined): LineStyleId {
  if (!dash || dash.length === 0) return "solid";
  const key = dash.join(",");
  if (key === DOTTED_PX.join(",")) return "dotted";
  if (key === DASHDOT_PX.join(",")) return "dashdot";
  return "dashed";
}
