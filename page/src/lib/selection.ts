import type { BBox, Node, Role } from "@molcrafts/molplot/semantic";

/** Photoshop / Origin Pro selection paint. Accent matches MolPlot teal. */
export const SELECTION = {
  accent: "#007d7e",
  halo: "#ffffff",
  /** Screen-size transform handle (px). */
  handlePx: 7,
  /** SVG user-unit vertex handle. */
  vertex: 5,
  /** SVG user-unit selected datum. */
  datum: 8,
  hairline: 1,
  haloWidth: 2,
} as const;

export type ChromeKind =
  | "figure"
  | "panel"
  | "axis-x"
  | "axis-y"
  | "box"
  | "path"
  | "none";

/** Which canvas chrome a Scene role uses. */
export function chromeKind(node: Node): ChromeKind {
  const role: Role = node.role;
  if (role === "figure") return "figure";
  if (role === "panel") return "panel";
  if (role === "series") return "path";
  if (role === "axis") return axisWhich(node) === "y" ? "axis-y" : "axis-x";
  if (
    role === "legend" ||
    role === "title" ||
    role === "annotation" ||
    role === "colorbar"
  ) {
    return "box";
  }
  return "none";
}

export function axisWhich(node: Node): "x" | "y" {
  if (node.id.endsWith("/axis/y") || /\by axis$/i.test(node.label ?? "")) {
    return "y";
  }
  return "x";
}

/** Eight Photoshop-style handles, figure-fraction. */
export function handlePoints(box: BBox): { x: number; y: number }[] {
  const { x, y, w, h } = box;
  const mx = x + w / 2;
  const my = y + h / 2;
  return [
    { x, y },
    { x: mx, y },
    { x: x + w, y },
    { x, y: my },
    { x: x + w, y: my },
    { x, y: y + h },
    { x: mx, y: y + h },
    { x: x + w, y: y + h },
  ];
}

/**
 * Origin-style axis strip along the panel edge, figure-fraction.
 * `thickness` is a fraction of the panel’s short side.
 */
export function axisStrip(
  panel: BBox,
  which: "x" | "y",
  thickness = 0.012,
): BBox {
  if (which === "x") {
    return {
      x: panel.x,
      y: panel.y + panel.h - thickness,
      w: panel.w,
      h: thickness,
    };
  }
  return {
    x: panel.x,
    y: panel.y,
    w: thickness,
    h: panel.h,
  };
}
