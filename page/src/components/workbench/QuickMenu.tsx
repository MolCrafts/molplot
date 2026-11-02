import type { Command, ComponentName, Node } from "@molcrafts/molplot/semantic";
import { type JSX, useLayoutEffect, useRef, useState } from "react";
import { NumberField } from "@/components/ui/number-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { formatSize } from "@/lib/format";
import { placeQuickMenu } from "@/lib/overlay";
import { editState } from "@/lib/scene";
import { dashForStyle, ptToPx, pxToPt, styleForDash } from "@/lib/units";
import { cn } from "@/lib/utils";

export function QuickMenu({
  node,
  onApply,
  anchor,
}: {
  node: Node;
  onApply: (command: Omit<Command, "baseRevision">) => Promise<boolean>;
  anchor: { x: number; y: number };
}): JSX.Element | null {
  const stroke = node.components.stroke;
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(anchor);
  useLayoutEffect(() => {
    const el = menuRef.current;
    const paper = el?.offsetParent;
    if (!(el instanceof HTMLElement) || !(paper instanceof HTMLElement)) return;
    const next = placeQuickMenu(
      anchor,
      { w: paper.clientWidth, h: paper.clientHeight },
      { w: el.offsetWidth, h: el.offsetHeight },
    );
    setPos((prev) => (prev.x === next.x && prev.y === next.y ? prev : next));
  }, [anchor]);
  if (!stroke || node.role === "figure" || node.role === "panel") return null;

  const setValue = (
    component: ComponentName,
    property: string,
    value: unknown,
  ) => {
    void onApply({ type: "set", nodeId: node.id, component, property, value });
  };
  const style = styleForDash(stroke.dash);
  const widthPt = stroke.width == null ? null : pxToPt(stroke.width);

  return (
    <div
      ref={menuRef}
      data-quick-menu
      className={cn(
        "pointer-events-auto absolute z-20 flex h-8 items-center gap-1.5",
        "rounded-full border border-border bg-popover px-2 shadow-overlay",
      )}
      style={{ left: pos.x, top: pos.y }}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerMove={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      <label className="flex size-5 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-border">
        <input
          type="color"
          aria-label="Colour"
          value={stroke.color || "#000000"}
          disabled={editState(node, "stroke", "color") !== "editable"}
          onChange={(event) => setValue("stroke", "color", event.target.value)}
          className="size-7 -translate-x-1 -translate-y-1 cursor-pointer border-0 bg-transparent p-0"
        />
      </label>
      <Separator orientation="vertical" className="h-4" />
      {widthPt == null ? (
        <span className="px-1 font-mono text-micro text-muted-foreground">
          —
        </span>
      ) : (
        <span className="flex items-center gap-1">
          <NumberField
            aria-label="Line width"
            value={widthPt}
            min={0.1}
            step={0.1}
            format={formatSize}
            disabled={editState(node, "stroke", "width") !== "editable"}
            onChange={(value) => setValue("stroke", "width", ptToPx(value))}
            className="h-6 w-10 border-0 bg-transparent px-1 text-center"
          />
          <span className="pr-1 text-micro text-muted-foreground">pt</span>
        </span>
      )}
      <Separator orientation="vertical" className="h-4" />
      <Select
        value={style}
        disabled={editState(node, "stroke", "dash") !== "editable"}
        onValueChange={(value) =>
          setValue(
            "stroke",
            "dash",
            dashForStyle(value as "solid" | "dashed" | "dotted" | "dashdot"),
          )
        }
      >
        <SelectTrigger
          size="sm"
          aria-label="Line style"
          className="h-6 w-[5.5rem] border-0 bg-transparent px-1 shadow-none"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="solid">Solid</SelectItem>
          <SelectItem value="dashed">Dashed</SelectItem>
          <SelectItem value="dotted">Dotted</SelectItem>
          <SelectItem value="dashdot">Dash-dot</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
