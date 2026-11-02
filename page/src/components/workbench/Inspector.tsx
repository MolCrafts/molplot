import type { Command, ComponentName, Node } from "@molcrafts/molplot/semantic";
import { type JSX, useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { NumberField } from "@/components/ui/number-field";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  InspectorField,
  InspectorSection,
  ValueChip,
} from "@/components/workbench/InspectorField";
import {
  formatScience,
  formatSize,
  parseNumberList,
  parseStringList,
} from "@/lib/format";
import type { HostResult } from "@/lib/host";
import { editState, nodePath, nodeTitle, scriptStem } from "@/lib/scene";
import { dashForStyle, ptToPx, pxToPt, styleForDash } from "@/lib/units";
import { cn } from "@/lib/utils";

const AXIS_FORMATS = ["auto", "scientific", "plain", "percent"] as const;
const AXIS_SCALES = ["linear", "log", "symlog"] as const;

export function Inspector({
  result,
  selectedId,
  onApply,
  onShowData,
}: {
  result: HostResult | null;
  selectedId: string | null;
  onApply: (command: Omit<Command, "baseRevision">) => Promise<boolean>;
  onShowData: () => void;
}): JSX.Element {
  const node =
    result && selectedId
      ? nodePath(result.scene.root, selectedId).at(-1)
      : undefined;
  if (!result || !node) {
    return (
      <EmptyState
        density="compact"
        title="Nothing selected"
        description="Click an element to format."
      />
    );
  }

  const path = nodePath(result.scene.root, node.id);
  const setValue = (
    component: ComponentName,
    property: string,
    value: unknown,
  ) => {
    void onApply({ type: "set", nodeId: node.id, component, property, value });
  };

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-4 p-3">
        <header className="space-y-1">
          <p className="text-body font-semibold">{nodeTitle(node)}</p>
          <p className="text-micro text-muted-foreground">
            {path.map((item) => item.role).join(" / ")}
          </p>
        </header>
        {node.role === "figure" ? (
          <FigureSection node={node} onSet={setValue} />
        ) : null}
        {node.role === "panel" ? (
          <AxesSection node={node} onSet={setValue} onApply={onApply} />
        ) : null}
        {node.role === "axis" ? (
          <AxisSection node={node} onApply={onApply} />
        ) : null}
        {node.components.stroke &&
        node.role !== "figure" &&
        node.role !== "panel" ? (
          <LineSection node={node} onSet={setValue} />
        ) : null}
        {node.components.fill &&
        node.role !== "figure" &&
        node.role !== "panel" ? (
          <FillSection node={node} onSet={setValue} />
        ) : null}
        {node.components.marker ? (
          <MarkerSection node={node} onSet={setValue} />
        ) : null}
        {node.components.text ? (
          <TextSection node={node} onSet={setValue} />
        ) : null}
        {node.components.typography ? (
          <TypographySection node={node} onSet={setValue} />
        ) : null}
        {node.components.appearance ? (
          <AppearanceSection node={node} onSet={setValue} />
        ) : null}
        {node.components.geometry?.bbox &&
        node.role !== "figure" &&
        node.role !== "series" ? (
          <GeometrySection node={node} onSet={setValue} />
        ) : null}
        <InspectorSection title="Data source">
          <p className="text-micro text-accent">
            {scriptStem(result.script)}.py
          </p>
          <button
            type="button"
            onClick={onShowData}
            className="text-micro text-muted-foreground hover:text-foreground"
          >
            View in data panel
          </button>
        </InspectorSection>
      </div>
    </ScrollArea>
  );
}

function FigureSection({
  node,
  onSet,
}: {
  node: Node;
  onSet: (component: ComponentName, property: string, value: unknown) => void;
}): JSX.Element {
  const layout = node.components.layout;
  return (
    <>
      <InspectorSection title="Figure">
        <InspectorField label="Width">
          {layout?.width == null ? (
            <ValueChip>—</ValueChip>
          ) : (
            <ValueChip>
              <NumberField
                value={layout.width}
                min={0.1}
                step={0.1}
                format={formatSize}
                disabled={editState(node, "layout", "width") !== "editable"}
                onChange={(value) => onSet("layout", "width", value)}
                className="h-auto w-full border-0 bg-transparent px-0"
              />
              <span className="text-muted-foreground">in</span>
            </ValueChip>
          )}
        </InspectorField>
        <InspectorField label="Height">
          {layout?.height == null ? (
            <ValueChip>—</ValueChip>
          ) : (
            <ValueChip>
              <NumberField
                value={layout.height}
                min={0.1}
                step={0.1}
                format={formatSize}
                disabled={editState(node, "layout", "height") !== "editable"}
                onChange={(value) => onSet("layout", "height", value)}
                className="h-auto w-full border-0 bg-transparent px-0"
              />
              <span className="text-muted-foreground">in</span>
            </ValueChip>
          )}
        </InspectorField>
      </InspectorSection>
      <FillSection node={node} onSet={onSet} />
    </>
  );
}

function AxesSection({
  node,
  onSet,
  onApply,
}: {
  node: Node;
  onSet: (component: ComponentName, property: string, value: unknown) => void;
  onApply: (command: Omit<Command, "baseRevision">) => Promise<boolean>;
}): JSX.Element {
  const layout = node.components.layout;
  const limit = (
    label: string,
    property: "xMin" | "xMax" | "yMin" | "yMax",
  ) => {
    const value = layout?.[property];
    return (
      <InspectorField label={label}>
        {value == null ? (
          <ValueChip>—</ValueChip>
        ) : (
          <ValueChip>
            <NumberField
              value={value}
              step={0.1}
              format={formatScience}
              disabled={editState(node, "layout", property) !== "editable"}
              onChange={(next) => onSet("layout", property, next)}
              className="h-auto w-full border-0 bg-transparent px-0"
            />
          </ValueChip>
        )}
      </InspectorField>
    );
  };
  return (
    <>
      <InspectorSection title="Axes">
        {limit("X min", "xMin")}
        {limit("X max", "xMax")}
        {limit("Y min", "yMin")}
        {limit("Y max", "yMax")}
      </InspectorSection>
      {node.children
        .filter((child) => child.role === "axis")
        .map((child) => (
          <AxisSection
            key={child.id}
            node={child}
            onApply={onApply}
            showLimits={false}
          />
        ))}
      <FillSection node={node} onSet={onSet} />
    </>
  );
}

function AxisSection({
  node,
  onApply,
  showLimits = true,
}: {
  node: Node;
  onApply: (command: Omit<Command, "baseRevision">) => Promise<boolean>;
  showLimits?: boolean;
}): JSX.Element {
  const axis = node.components.axis;
  const onSet = (
    component: ComponentName,
    property: string,
    value: unknown,
  ) => {
    void onApply({ type: "set", nodeId: node.id, component, property, value });
  };
  const title = node.label ?? "Axis";
  const ticksText = (axis?.ticks ?? []).map(formatScience).join(", ");
  const labelsText = (axis?.tickLabels ?? []).join(", ");
  return (
    <InspectorSection title={title}>
      {showLimits ? (
        <>
          <InspectorField label="Min">
            {axis?.min == null ? (
              <ValueChip>—</ValueChip>
            ) : (
              <ValueChip>
                <NumberField
                  value={axis.min}
                  step={0.1}
                  format={formatScience}
                  disabled={editState(node, "axis", "min") !== "editable"}
                  onChange={(value) => onSet("axis", "min", value)}
                  className="h-auto w-full border-0 bg-transparent px-0"
                />
              </ValueChip>
            )}
          </InspectorField>
          <InspectorField label="Max">
            {axis?.max == null ? (
              <ValueChip>—</ValueChip>
            ) : (
              <ValueChip>
                <NumberField
                  value={axis.max}
                  step={0.1}
                  format={formatScience}
                  disabled={editState(node, "axis", "max") !== "editable"}
                  onChange={(value) => onSet("axis", "max", value)}
                  className="h-auto w-full border-0 bg-transparent px-0"
                />
              </ValueChip>
            )}
          </InspectorField>
        </>
      ) : null}
      <InspectorField label="Scale">
        <Select
          value={axis?.scale ?? "linear"}
          disabled={editState(node, "axis", "scale") !== "editable"}
          onValueChange={(value) => onSet("axis", "scale", value)}
        >
          <SelectTrigger
            size="sm"
            className="h-control-compact w-full bg-surface"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AXIS_SCALES.map((scale) => (
              <SelectItem key={scale} value={scale}>
                {scale}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </InspectorField>
      <InspectorField label="Formatter">
        <Select
          value={axis?.format ?? "auto"}
          disabled={editState(node, "axis", "format") !== "editable"}
          onValueChange={(value) => onSet("axis", "format", value)}
        >
          <SelectTrigger
            size="sm"
            className="h-control-compact w-full bg-surface"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AXIS_FORMATS.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </InspectorField>
      <InspectorField label="Ticks" htmlFor={`${node.id}-ticks`}>
        <Input
          id={`${node.id}-ticks`}
          key={ticksText}
          defaultValue={ticksText}
          disabled={editState(node, "axis", "ticks") !== "editable"}
          className="h-control-compact bg-surface text-micro"
          onBlur={(event) => {
            const next = parseNumberList(event.target.value);
            if (next == null) return;
            onSet("axis", "ticks", next);
          }}
        />
      </InspectorField>
      <InspectorField label="Tick labels" htmlFor={`${node.id}-tick-labels`}>
        <Input
          id={`${node.id}-tick-labels`}
          key={labelsText}
          defaultValue={labelsText}
          disabled={editState(node, "axis", "tickLabels") !== "editable"}
          className="h-control-compact bg-surface text-micro"
          placeholder="auto"
          onBlur={(event) => {
            onSet("axis", "tickLabels", parseStringList(event.target.value));
          }}
        />
      </InspectorField>
    </InspectorSection>
  );
}

function LineSection({
  node,
  onSet,
}: {
  node: Node;
  onSet: (component: ComponentName, property: string, value: unknown) => void;
}): JSX.Element {
  const stroke = node.components.stroke;
  const style = styleForDash(stroke?.dash);
  return (
    <InspectorSection title="Line">
      <ColorField
        label="Colour"
        value={stroke?.color}
        disabled={editState(node, "stroke", "color") !== "editable"}
        onChange={(value) => onSet("stroke", "color", value)}
      />
      <InspectorField label="Width">
        {stroke?.width == null ? (
          <ValueChip>—</ValueChip>
        ) : (
          <ValueChip>
            <NumberField
              value={pxToPt(stroke.width)}
              min={0.1}
              step={0.1}
              format={formatSize}
              disabled={editState(node, "stroke", "width") !== "editable"}
              onChange={(value) => onSet("stroke", "width", ptToPx(value))}
              className="h-auto w-full border-0 bg-transparent px-0"
            />
            <span className="text-muted-foreground">pt</span>
          </ValueChip>
        )}
      </InspectorField>
      <InspectorField label="Style">
        <Select
          value={style}
          disabled={editState(node, "stroke", "dash") !== "editable"}
          onValueChange={(value) =>
            onSet(
              "stroke",
              "dash",
              dashForStyle(value as "solid" | "dashed" | "dotted" | "dashdot"),
            )
          }
        >
          <SelectTrigger
            size="sm"
            className="h-control-compact w-full bg-surface"
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
      </InspectorField>
      <OpacityField
        label="Opacity"
        value={stroke?.opacity}
        disabled={editState(node, "stroke", "opacity") !== "editable"}
        onChange={(value) => onSet("stroke", "opacity", value)}
      />
    </InspectorSection>
  );
}

function FillSection({
  node,
  onSet,
}: {
  node: Node;
  onSet: (component: ComponentName, property: string, value: unknown) => void;
}): JSX.Element {
  const fill = node.components.fill;
  return (
    <InspectorSection title="Fill">
      <ColorField
        label="Fill colour"
        value={fill?.color}
        disabled={editState(node, "fill", "color") !== "editable"}
        onChange={(value) => onSet("fill", "color", value)}
      />
      <OpacityField
        label="Fill opacity"
        value={fill?.opacity}
        disabled={editState(node, "fill", "opacity") !== "editable"}
        onChange={(value) => onSet("fill", "opacity", value)}
      />
    </InspectorSection>
  );
}

function TextSection({
  node,
  onSet,
}: {
  node: Node;
  onSet: (component: ComponentName, property: string, value: unknown) => void;
}): JSX.Element {
  const content = node.components.text?.content ?? "";
  const disabled = editState(node, "text", "content") !== "editable";
  const [draft, setDraft] = useState(content);
  useEffect(() => setDraft(content), [content]);
  return (
    <InspectorSection title="Text">
      <InspectorField label="Content" htmlFor="text-content">
        <Input
          id="text-content"
          value={draft}
          disabled={disabled}
          className="h-control-compact bg-surface text-micro"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            if (draft !== content) onSet("text", "content", draft);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && draft !== content) {
              onSet("text", "content", draft);
            }
          }}
        />
      </InspectorField>
    </InspectorSection>
  );
}

function MarkerSection({
  node,
  onSet,
}: {
  node: Node;
  onSet: (component: ComponentName, property: string, value: unknown) => void;
}): JSX.Element {
  const marker = node.components.marker;
  const shape = marker?.shape ?? "none";
  return (
    <InspectorSection title="Markers">
      <InspectorField label="Shape">
        <Select
          value={shape}
          disabled={editState(node, "marker", "shape") !== "editable"}
          onValueChange={(value) => onSet("marker", "shape", value)}
        >
          <SelectTrigger
            size="sm"
            className="h-control-compact w-full bg-surface"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="o">Circle</SelectItem>
            <SelectItem value="s">Square</SelectItem>
            <SelectItem value="^">Triangle</SelectItem>
            <SelectItem value="D">Diamond</SelectItem>
            <SelectItem value="x">X</SelectItem>
            <SelectItem value="+">Plus</SelectItem>
          </SelectContent>
        </Select>
      </InspectorField>
      <InspectorField label="Size">
        {marker?.size == null ? (
          <ValueChip>—</ValueChip>
        ) : (
          <ValueChip>
            <NumberField
              value={marker.size}
              min={0.1}
              step={0.1}
              format={formatSize}
              disabled={editState(node, "marker", "size") !== "editable"}
              onChange={(value) => onSet("marker", "size", value)}
              className="h-auto w-full border-0 bg-transparent px-0"
            />
            <span className="text-muted-foreground">pt</span>
          </ValueChip>
        )}
      </InspectorField>
      <ColorField
        label="Fill"
        value={marker?.color}
        disabled={editState(node, "marker", "color") !== "editable"}
        onChange={(value) => onSet("marker", "color", value)}
      />
    </InspectorSection>
  );
}

function TypographySection({
  node,
  onSet,
}: {
  node: Node;
  onSet: (component: ComponentName, property: string, value: unknown) => void;
}): JSX.Element {
  const typo = node.components.typography;
  return (
    <InspectorSection title="Typography">
      <ColorField
        label="Colour"
        value={typo?.color}
        disabled={editState(node, "typography", "color") !== "editable"}
        onChange={(value) => onSet("typography", "color", value)}
      />
      <InspectorField label="Size">
        {typo?.size == null ? (
          <ValueChip>—</ValueChip>
        ) : (
          <ValueChip>
            <NumberField
              value={typo.size}
              min={1}
              step={0.1}
              format={formatSize}
              disabled={editState(node, "typography", "size") !== "editable"}
              onChange={(value) => onSet("typography", "size", value)}
              className="h-auto w-full border-0 bg-transparent px-0"
            />
            <span className="text-muted-foreground">pt</span>
          </ValueChip>
        )}
      </InspectorField>
      <InspectorField label="Weight">
        <Select
          value={
            /bold|^[7-9]|^6\d{2}/i.test(String(typo?.weight ?? ""))
              ? "bold"
              : "normal"
          }
          disabled={editState(node, "typography", "weight") !== "editable"}
          onValueChange={(value) => onSet("typography", "weight", value)}
        >
          <SelectTrigger
            size="sm"
            className="h-control-compact w-full bg-surface"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="bold">Bold</SelectItem>
          </SelectContent>
        </Select>
      </InspectorField>
      <InspectorField label="Style">
        <Select
          value={String(typo?.style ?? "normal")}
          disabled={editState(node, "typography", "style") !== "editable"}
          onValueChange={(value) => onSet("typography", "style", value)}
        >
          <SelectTrigger
            size="sm"
            className="h-control-compact w-full bg-surface"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="italic">Italic</SelectItem>
          </SelectContent>
        </Select>
      </InspectorField>
      <InspectorField label="Family" htmlFor="font-family">
        <Input
          id="font-family"
          key={typo?.family ?? ""}
          defaultValue={typo?.family ?? ""}
          disabled={editState(node, "typography", "family") !== "editable"}
          className="h-control-compact bg-surface text-micro"
          onBlur={(event) => {
            const next = event.target.value.trim();
            if (next && next !== typo?.family)
              onSet("typography", "family", next);
          }}
        />
      </InspectorField>
    </InspectorSection>
  );
}

function AppearanceSection({
  node,
  onSet,
}: {
  node: Node;
  onSet: (component: ComponentName, property: string, value: unknown) => void;
}): JSX.Element {
  const appearance = node.components.appearance;
  const visible = appearance?.visible !== false;
  return (
    <InspectorSection title="Appearance">
      <InspectorField label="Visible">
        <Select
          value={visible ? "yes" : "no"}
          disabled={editState(node, "appearance", "visible") !== "editable"}
          onValueChange={(value) =>
            onSet("appearance", "visible", value === "yes")
          }
        >
          <SelectTrigger
            size="sm"
            className="h-control-compact w-full bg-surface"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="yes">Yes</SelectItem>
            <SelectItem value="no">No</SelectItem>
          </SelectContent>
        </Select>
      </InspectorField>
      <OpacityField
        label="Opacity"
        value={appearance?.opacity}
        disabled={editState(node, "appearance", "opacity") !== "editable"}
        onChange={(value) => onSet("appearance", "opacity", value)}
      />
    </InspectorSection>
  );
}

function GeometrySection({
  node,
  onSet,
}: {
  node: Node;
  onSet: (component: ComponentName, property: string, value: unknown) => void;
}): JSX.Element | null {
  const box = node.components.geometry?.bbox;
  const disabled = editState(node, "geometry", "bbox") !== "editable";
  if (!box) return null;
  const commit = (next: { x: number; y: number }) => {
    onSet("geometry", "bbox", { ...box, ...next });
  };
  return (
    <InspectorSection title="Position">
      <InspectorField label="x">
        <ValueChip>
          <NumberField
            value={box.x}
            step={0.1}
            format={formatSize}
            disabled={disabled}
            onChange={(x) => commit({ x, y: box.y })}
            className="h-auto w-full border-0 bg-transparent px-0"
          />
        </ValueChip>
      </InspectorField>
      <InspectorField label="y">
        <ValueChip>
          <NumberField
            value={box.y}
            step={0.1}
            format={formatSize}
            disabled={disabled}
            onChange={(y) => commit({ x: box.x, y })}
            className="h-auto w-full border-0 bg-transparent px-0"
          />
        </ValueChip>
      </InspectorField>
    </InspectorSection>
  );
}

function ColorField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string | undefined;
  disabled: boolean;
  onChange: (value: string) => void;
}): JSX.Element {
  const hex = value ?? "";
  return (
    <InspectorField label={label}>
      <ValueChip className={cn(disabled && "opacity-50")}>
        <input
          type="color"
          aria-label={label}
          value={hex || "#000000"}
          disabled={disabled || !hex}
          onChange={(event) => onChange(event.target.value)}
          className="size-4 cursor-pointer rounded-sm border-0 bg-transparent p-0"
        />
        <span className="min-w-0 flex-1 truncate uppercase">{hex || "—"}</span>
      </ValueChip>
    </InspectorField>
  );
}

function OpacityField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: number | undefined;
  disabled: boolean;
  onChange: (value: number) => void;
}): JSX.Element {
  const percent = value == null ? null : Math.round(value * 100);
  return (
    <InspectorField label={label}>
      {percent == null ? (
        <ValueChip>—</ValueChip>
      ) : (
        <ValueChip>
          <NumberField
            value={percent}
            min={0}
            max={100}
            step={1}
            disabled={disabled}
            onChange={(next) => onChange(next / 100)}
            className="h-auto w-full border-0 bg-transparent px-0"
          />
        </ValueChip>
      )}
    </InspectorField>
  );
}
