import { TextBoldRegular, TextItalicRegular } from "@fluentui/react-icons";
import type { Command, ComponentName, Node } from "@molcrafts/molplot/semantic";
import { IconButton } from "@/components/ui/icon-button";
import { LineControls } from "@/components/workbench/LineControls";
import { NumberField } from "@/components/workbench/NumberField";
import { editState, nodeTitle } from "@/lib/scene";

const control =
  "h-7 rounded-sm border border-border bg-background px-2 text-label disabled:opacity-40";

export function FormatToolbar({
  node,
  onApply,
}: {
  node?: Node;
  onApply: (command: Omit<Command, "baseRevision">) => Promise<boolean>;
}) {
  const set = (component: ComponentName, property: string, value: unknown) => {
    if (node)
      void onApply({
        type: "set",
        nodeId: node.id,
        component,
        property,
        value,
      });
  };
  const disabled = (component: ComponentName, property: string) =>
    !node || editState(node, component, property) !== "editable";
  const typo = node?.components.typography;
  const stroke = node?.components.stroke;
  const bold = /bold|^[7-9]|^6\d{2}/i.test(String(typo?.weight ?? ""));
  const color = (
    component: "typography" | "stroke" | "fill",
    value?: string,
  ) => (
    <label className="flex items-center gap-2 text-label">
      <span>
        {component === "typography"
          ? "Font colour"
          : component === "stroke"
            ? "Line colour"
            : "Fill"}
      </span>
      <input
        type="color"
        aria-label={`${component} colour`}
        value={/^#[0-9a-f]{6}$/i.test(value ?? "") ? value : "#000000"}
        disabled={disabled(component, "color")}
        onChange={(event) => set(component, "color", event.target.value)}
        className="h-7 w-8 cursor-pointer rounded-sm border border-border bg-background p-1 disabled:opacity-40"
      />
    </label>
  );
  return (
    <div
      role="toolbar"
      aria-label="Format selection"
      className="flex min-h-11 shrink-0 items-center gap-3 overflow-x-auto border-b border-border bg-background px-3 py-1.5"
    >
      <span
        className="w-24 shrink-0 truncate border-r border-border pr-3 text-label font-semibold"
        title={node ? nodeTitle(node) : undefined}
      >
        {node ? `${node.role[0].toUpperCase()}${node.role.slice(1)}` : "Format"}
      </span>
      {typo && (
        <>
          <input
            key={`${node?.id}-${typo.family}`}
            aria-label="Font family"
            defaultValue={typo.family ?? ""}
            disabled={disabled("typography", "family")}
            className={`${control} w-36`}
            onBlur={(event) => {
              const value = event.target.value.trim();
              if (value && value !== typo.family)
                set("typography", "family", value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
          />
          <NumberField
            aria-label="Font size"
            value={typo.size ?? 10}
            min={1}
            step={0.1}
            disabled={disabled("typography", "size")}
            onChange={(value) => set("typography", "size", value)}
            className="h-7 w-16"
          />
          <IconButton
            icon={<TextBoldRegular />}
            label="Bold"
            selected={bold}
            disabled={disabled("typography", "weight")}
            onClick={() =>
              set("typography", "weight", bold ? "normal" : "bold")
            }
          />
          <IconButton
            icon={<TextItalicRegular />}
            label="Italic"
            selected={typo.style === "italic"}
            disabled={disabled("typography", "style")}
            onClick={() =>
              set(
                "typography",
                "style",
                typo.style === "italic" ? "normal" : "italic",
              )
            }
          />
          {color("typography", typo.color)}
        </>
      )}
      {node && stroke && node.role !== "figure" && node.role !== "panel" && (
        <LineControls node={node} onApply={onApply} />
      )}
      {node?.components.fill && color("fill", node.components.fill.color)}
      {!typo && !stroke && !node?.components.fill && (
        <span className="text-label text-muted-foreground">
          {node
            ? "Open a property group on the right to edit this element."
            : "Select text, a curve, or an element to format."}
        </span>
      )}
    </div>
  );
}
