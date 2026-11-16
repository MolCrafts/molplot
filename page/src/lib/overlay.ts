import type { BBox } from "@molcrafts/molplot/semantic";

/** Keep a selection chrome on the paper when the real bbox leaves [0, 1]. */
export function clampBox(
  box: BBox,
  minSpan = 0.02,
): { box: BBox; clipped: boolean } {
  const x2 = box.x + box.w;
  const y2 = box.y + box.h;
  const visX = Math.max(0, box.x);
  const visY = Math.max(0, box.y);
  const visX2 = Math.min(1, x2);
  const visY2 = Math.min(1, y2);
  if (visX2 > visX && visY2 > visY) {
    const clipped = visX > box.x || visY > box.y || visX2 < x2 || visY2 < y2;
    if (!clipped) return { box, clipped: false };
    return {
      box: { x: visX, y: visY, w: visX2 - visX, h: visY2 - visY },
      clipped: true,
    };
  }
  let x = visX;
  let y = visY;
  if (x2 <= 0) x = 0;
  else if (box.x >= 1) x = 1 - minSpan;
  if (y2 <= 0) y = 0;
  else if (box.y >= 1) y = 1 - minSpan;
  return { box: { x, y, w: minSpan, h: minSpan }, clipped: true };
}

/** Stay beside the click; flip at the edges and prefer clear space among nearby positions. */
export function placeQuickMenu(
  click: { x: number; y: number },
  area: { x?: number; y?: number; w: number; h: number },
  menu: { w: number; h: number },
  gap = 10,
  obstacles: readonly BBox[] = [],
): { x: number; y: number } | null {
  const left = (area.x ?? 0) + gap;
  const top = (area.y ?? 0) + gap;
  const right = (area.x ?? 0) + area.w - menu.w - gap;
  const bottom = (area.y ?? 0) + area.h - menu.h - gap;
  if (right < left || bottom < top) return null;
  // Only the four positions touching the pointer's gap are candidates. Dense
  // chart ink must never send the panel to the other side of the chart.
  const xs = [click.x + gap, click.x - menu.w - gap];
  const ys = [click.y + gap, click.y - menu.h - gap];
  if (click.x + gap > right) xs.reverse();
  if (click.y + gap > bottom) ys.reverse();
  const candidates = ys.flatMap((y) =>
    xs.map((x) => ({
      x: Math.min(right, Math.max(left, x)),
      y: Math.min(bottom, Math.max(top, y)),
    })),
  );
  const overlap = (p: { x: number; y: number }, b: BBox) =>
    Math.max(0, Math.min(p.x + menu.w, b.x + b.w) - Math.max(p.x, b.x)) *
    Math.max(0, Math.min(p.y + menu.h, b.y + b.h) - Math.max(p.y, b.y));
  const pointer = {
    x: click.x - gap,
    y: click.y - gap,
    w: gap * 2,
    h: gap * 2,
  };
  // Keep the clicked point clear first, then avoid nearby labels and curves.
  candidates.sort(
    (a, b) =>
      overlap(a, pointer) - overlap(b, pointer) ||
      obstacles.reduce(
        (sum, box) => sum + overlap(a, box) - overlap(b, box),
        0,
      ),
  );
  return candidates[0] ?? null;
}

/** Convert the existing chart hit geometry to padded screen-space obstacles. */
export function quickMenuObstacles(
  paths: readonly { id: string; points: readonly { x: number; y: number }[] }[],
  boxes: readonly { id: string; role: string; box: BBox }[],
  frame: BBox,
): BBox[] {
  const result: BBox[] = [];
  const add = (x: number, y: number, w: number, h: number) =>
    result.push({
      x: frame.x + x * frame.w - 4,
      y: frame.y + y * frame.h - 4,
      w: w * frame.w + 8,
      h: h * frame.h + 8,
    });
  for (const { id, role, box } of boxes) {
    if (role === "figure") continue;
    if (role === "panel") {
      add(box.x, box.y, box.w, 0);
      add(box.x, box.y + box.h, box.w, 0);
      add(box.x, box.y, 0, box.h);
      add(box.x + box.w, box.y, 0, box.h);
    } else if (
      role !== "series" ||
      !paths.some((path) => path.id === id || path.id.startsWith(`${id}/`))
    )
      add(box.x, box.y, box.w, box.h);
  }
  for (const path of paths) {
    for (let i = 0; i < path.points.length; i++) {
      const a = path.points[i];
      const b = path.points[Math.max(0, i - 1)];
      if (!a || !b || ![a.x, a.y, b.x, b.y].every(Number.isFinite)) continue;
      add(
        Math.min(a.x, b.x),
        Math.min(a.y, b.y),
        Math.abs(a.x - b.x),
        Math.abs(a.y - b.y),
      );
    }
  }
  return result;
}

export function pathToD(points: readonly { x: number; y: number }[]): string {
  return points
    .map((point, index) => {
      const cmd = index === 0 ? "M" : "L";
      return `${cmd} ${point.x * 100} ${point.y * 100}`;
    })
    .join(" ");
}

export interface PathHit {
  id: string;
  points: readonly { x: number; y: number }[];
}

export interface BoxHit {
  id: string;
  role: string;
  box: BBox;
}

function distanceToSegment(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(
    0,
    Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2),
  );
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function distanceToPath(
  p: { x: number; y: number },
  points: readonly { x: number; y: number }[],
): number {
  if (points.length === 0) return Number.POSITIVE_INFINITY;
  if (points.length === 1) {
    return Math.hypot(p.x - points[0].x, p.y - points[0].y);
  }
  let min = Number.POSITIVE_INFINITY;
  for (let i = 1; i < points.length; i += 1) {
    min = Math.min(min, distanceToSegment(p, points[i - 1], points[i]));
  }
  return min;
}

/** Pixel distance from a figure-fraction point to a figure-fraction polyline. */
export function distanceToPathPx(
  p: { x: number; y: number },
  points: readonly { x: number; y: number }[],
  width: number,
  height: number,
): number {
  return distanceToPath(
    { x: p.x * width, y: p.y * height },
    points.map((point) => ({ x: point.x * width, y: point.y * height })),
  );
}

function contains(box: BBox, p: { x: number; y: number }): boolean {
  return (
    p.x >= box.x && p.x <= box.x + box.w && p.y >= box.y && p.y <= box.y + box.h
  );
}

function roleRank(role: string): number {
  if (role === "figure") return 3;
  if (role === "panel") return 2;
  return 1;
}

/**
 * Prefer a nearby series path, then the smallest non-figure box, then the panel,
 * then the figure. `pathThresholdPx` is the click slop in CSS pixels.
 */
export function hitTest(
  p: { x: number; y: number },
  paths: readonly PathHit[],
  boxes: readonly BoxHit[],
  width: number,
  height: number,
  pathThresholdPx = 14,
): string | null {
  let bestId: string | null = null;
  let bestDist = pathThresholdPx;
  for (const path of paths) {
    const dist = distanceToPathPx(p, path.points, width, height);
    if (dist < bestDist) {
      bestDist = dist;
      bestId = path.id;
    }
  }
  if (bestId) return bestId;

  const containing = boxes.filter((item) => contains(item.box, p));
  containing.sort((a, b) => {
    const rank = roleRank(a.role) - roleRank(b.role);
    if (rank !== 0) return rank;
    return a.box.w * a.box.h - b.box.w * b.box.h;
  });
  return containing[0]?.id ?? null;
}
