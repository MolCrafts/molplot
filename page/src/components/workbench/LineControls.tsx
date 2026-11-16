import type { Command, Node } from "@molcrafts/molplot/semantic";
import { useId } from "react";
import { NumberField } from "@/components/workbench/NumberField";
import { editState } from "@/lib/scene";
import {
  dashForStyle,
  type LineStyleId,
  ptToPx,
  pxToPt,
  styleForDash,
} from "@/lib/units";

/** The ribbon and floating panel write through the same semantic commands. */
export function LineControls({
  node,
  onApply,
  compact = false,
}: {
  node: Node;
  onApply: (command: Omit<Command, "baseRevision">) => Promise<boolean>;
  compact?: boolean;
}) {
  const widthId = useId();
  const stroke = node.components.stroke;
  if (!stroke) return null;
  const disabled = (property: string) =>
    editState(node, "stroke", property) !== "editable";
  const set = (property: string, value: unknown) => {
    void onApply({
      type: "set",
      nodeId: node.id,
      component: "stroke",
      property,
      value,
    });
  };
  return (
    <>
      <label className="flex shrink-0 items-center gap-2 text-label">
        <span className={compact ? "sr-only" : undefined}>Line colour</span>
        <input
          type="color"
          aria-label="Line colour"
          value={
            /^#[0-9a-f]{6}$/i.test(stroke.color ?? "")
              ? stroke.color
              : "#000000"
          }
          disabled={disabled("color")}
          onChange={(event) => set("color", event.target.value)}
          className="h-7 w-8 cursor-pointer rounded-sm border border-border bg-background p-1 disabled:opacity-40"
        />
      </label>
      <label
        htmlFor={widthId}
        className="flex shrink-0 items-center gap-2 text-label"
      >
        <span className={compact ? "sr-only" : undefined}>Width</span>
        <NumberField
          id={widthId}
          aria-label="Line width"
          value={pxToPt(stroke.width ?? 1)}
          min={0.1}
          step={0.1}
          disabled={disabled("width")}
          onChange={(value) => set("width", ptToPx(value))}
          className="h-7 w-16"
        />
        <span className="text-muted-foreground">pt</span>
      </label>
      <select
        aria-label="Line style"
        className="h-7 shrink-0 rounded-sm border border-border bg-background px-2 text-label disabled:opacity-40"
        value={styleForDash(stroke.dash)}
        disabled={disabled("dash")}
        onChange={(event) =>
          set("dash", dashForStyle(event.target.value as LineStyleId))
        }
      >
        <option value="solid">Solid</option>
        <option value="dashed">Dashed</option>
        <option value="dotted">Dotted</option>
        <option value="dashdot">Dash-dot</option>
      </select>
    </>
  );
}
