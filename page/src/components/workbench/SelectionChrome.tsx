import type { BBox, Node } from "@molcrafts/molplot/semantic";
import type { JSX } from "react";
import { clampBox } from "@/lib/overlay";
import { bboxOf, canMove } from "@/lib/scene";
import { axisStrip, axisWhich, chromeKind, SELECTION } from "@/lib/selection";
import { cn } from "@/lib/utils";

type HandleLayout = "corners" | "ends-x" | "ends-y" | "none";

/**
 * Photoshop transform box / Origin object chrome for the selected node.
 * Series path chrome lives in svg-pen; this paints paper-space frames.
 */
export function SelectionChrome({
  node,
  fallback,
  panelBox,
}: {
  node: Node;
  fallback?: BBox;
  panelBox?: BBox;
}): JSX.Element | null {
  const kind = chromeKind(node);
  if (kind === "path" || kind === "none") return null;

  if (kind === "axis-x" || kind === "axis-y") {
    const host = panelBox ?? bboxOf(node) ?? fallback;
    if (!host) return null;
    const { box } = clampBox(axisStrip(host, axisWhich(node)));
    return (
      <Frame
        nodeId={node.id}
        box={box}
        dashed={false}
        handles={kind === "axis-y" ? "ends-y" : "ends-x"}
        bar
      />
    );
  }

  const raw = bboxOf(node) ?? fallback;
  if (!raw) return null;
  const { box, clipped } = clampBox(raw);
  const movable = canMove(node) && !clipped;

  if (kind === "figure") {
    return <Frame nodeId={node.id} box={box} dashed inset handles="none" />;
  }

  return (
    <Frame
      nodeId={node.id}
      box={box}
      dashed={clipped}
      handles={movable ? "corners" : "none"}
    />
  );
}

function handleSpots(layout: HandleLayout): { left: string; top: string }[] {
  if (layout === "corners") {
    return [
      { left: "0%", top: "0%" },
      { left: "50%", top: "0%" },
      { left: "100%", top: "0%" },
      { left: "0%", top: "50%" },
      { left: "100%", top: "50%" },
      { left: "0%", top: "100%" },
      { left: "50%", top: "100%" },
      { left: "100%", top: "100%" },
    ];
  }
  if (layout === "ends-x") {
    return [
      { left: "0%", top: "50%" },
      { left: "100%", top: "50%" },
    ];
  }
  if (layout === "ends-y") {
    return [
      { left: "50%", top: "0%" },
      { left: "50%", top: "100%" },
    ];
  }
  return [];
}

function Frame({
  nodeId,
  box,
  dashed,
  handles,
  inset,
  bar,
}: {
  nodeId: string;
  box: BBox;
  dashed: boolean;
  handles: HandleLayout;
  inset?: boolean;
  bar?: boolean;
}): JSX.Element {
  return (
    <div
      data-node={nodeId}
      data-slot="selection-chrome"
      className="pointer-events-none absolute"
      style={{
        left: `${box.x * 100}%`,
        top: `${box.y * 100}%`,
        width: `${box.w * 100}%`,
        height: `${box.h * 100}%`,
      }}
    >
      <div
        className={cn(
          "absolute box-border",
          dashed
            ? "border border-dashed border-accent"
            : "border border-accent",
          !dashed && "shadow-[0_0_0_1px_#fff]",
          bar && "bg-accent/35",
        )}
        style={{ inset: inset ? 3 : 0 }}
      />
      {handleSpots(handles).map((spot) => (
        <span
          key={`${spot.left}-${spot.top}`}
          className="absolute border border-accent bg-paper"
          style={{
            left: spot.left,
            top: spot.top,
            width: SELECTION.handlePx,
            height: SELECTION.handlePx,
            transform: "translate(-50%, -50%)",
          }}
        />
      ))}
    </div>
  );
}
