import type { BBox, Command, Node } from "@molcrafts/molplot/semantic";
import { type RefObject, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LineControls } from "@/components/workbench/LineControls";
import { placeQuickMenu, quickMenuObstacles } from "@/lib/overlay";

export function QuickMenu({
  node,
  paperRef,
  anchor,
  onApply,
  paths,
  boxes,
}: {
  node: Node;
  paths: { id: string; points: readonly { x: number; y: number }[] }[];
  boxes: { id: string; role: string; box: BBox }[];
  paperRef: RefObject<HTMLDivElement | null>;
  anchor: { x: number; y: number };
  onApply: (command: Omit<Command, "baseRevision">) => Promise<boolean>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [closed, setClosed] = useState(false);
  useLayoutEffect(() => {
    if (closed) return;
    let previous = "";
    const sync = () => {
      const paper = paperRef.current?.getBoundingClientRect();
      const menu = ref.current?.getBoundingClientRect();
      if (!paper || !menu) return;
      const at = {
        x: paper.left + anchor.x * paper.width,
        y: paper.top + anchor.y * paper.height,
      };
      const key = `${paper.x},${paper.y},${paper.width},${paper.height},${menu.width},${menu.height},${window.innerWidth},${window.innerHeight}`;
      if (previous === key) return;
      previous = key;
      const frame = { x: paper.x, y: paper.y, w: paper.width, h: paper.height };
      const obstacles = quickMenuObstacles(paths, boxes, frame);
      // Matplotlib tick labels are SVG glyph groups and are not separate scene nodes.
      for (const text of paperRef.current?.querySelectorAll(
        'svg [id^="text_"], svg text',
      ) ?? []) {
        const r = text.getBoundingClientRect();
        if (r.width && r.height)
          obstacles.push({
            x: r.x - 4,
            y: r.y - 4,
            w: r.width + 8,
            h: r.height + 8,
          });
      }
      const canvas = paperRef.current
        ?.closest('[aria-label="Figure canvas"]')
        ?.getBoundingClientRect();
      const area = canvas
        ? {
            x: Math.max(0, canvas.x),
            y: Math.max(0, canvas.y),
            w:
              Math.min(window.innerWidth, canvas.right) - Math.max(0, canvas.x),
            h:
              Math.min(window.innerHeight, canvas.bottom) -
              Math.max(0, canvas.y),
          }
        : { w: window.innerWidth, h: window.innerHeight };
      const next = placeQuickMenu(
        at,
        area,
        { w: menu.width, h: menu.height },
        10,
        obstacles,
      );
      setPosition((current) =>
        current?.x === next?.x && current?.y === next?.y ? current : next,
      );
    };
    // Follow pan, zoom, resizing and scrolling without scaling the controls themselves.
    let frame = 0;
    const follow = () => {
      sync();
      frame = requestAnimationFrame(follow);
    };
    follow();
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setClosed(true);
      }
    };
    const onOutside = (event: PointerEvent) => {
      if (
        event.target instanceof Element &&
        !ref.current?.contains(event.target)
      )
        setClosed(true);
    };
    document.addEventListener("pointerdown", onOutside, true);
    document.addEventListener("keydown", onEscape);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", onOutside, true);
      document.removeEventListener("keydown", onEscape);
    };
  }, [paperRef, anchor, closed, paths, boxes]);
  if (closed) return null;
  return createPortal(
    <div
      ref={ref}
      data-quick-menu
      role="toolbar"
      aria-label="Quick line adjustments"
      className="fixed z-50 flex max-w-[calc(100vw-20px)] items-center gap-2 overflow-x-auto rounded-md border border-border bg-popover p-1.5 shadow-overlay"
      style={{
        left: position?.x ?? 0,
        top: position?.y ?? 0,
        visibility: position ? "visible" : "hidden",
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerMove={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      <LineControls node={node} onApply={onApply} compact />
    </div>,
    document.body,
  );
}
