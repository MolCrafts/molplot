import type { JSX } from "react";
import { useEffect, useState } from "react";
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
import { formatSize } from "@/lib/format";
import type {
  CustomRc,
  HostResult,
  StyleCommand,
  StyleSource,
} from "@/lib/host";
import { cn } from "@/lib/utils";

const LINE_STYLES = ["solid", "dashed", "dotted", "dashdot"] as const;
const TICK_DIRS = ["in", "out", "inout"] as const;
const CMAPS = [
  "viridis",
  "plasma",
  "inferno",
  "magma",
  "cividis",
  "coolwarm",
  "gray",
  "turbo",
] as const;
const FAMILIES = ["sans-serif", "serif", "monospace"] as const;

function isCapabilityWarning(text: string): boolean {
  return (
    text.includes("type1cm") ||
    text.includes("pip install") ||
    text.includes("no-latex")
  );
}

function WarningNote({ children }: { children: string }): JSX.Element {
  return (
    <p
      role="status"
      className="rounded-control bg-warning-soft px-2 py-1.5 text-micro text-warning-foreground"
    >
      {children}
    </p>
  );
}

export function PresetPanel({
  result,
  applying,
  error,
  onApplyStyle,
}: {
  result: HostResult | null;
  applying: boolean;
  error: string | null;
  onApplyStyle: (command: StyleCommand) => Promise<boolean>;
}): JSX.Element {
  const style = result?.style;
  const current = style?.current;
  const sources = style?.sources ?? [];
  const [picked, setPicked] = useState(current?.source ?? "script");
  const [pickedName, setPickedName] = useState(current?.name ?? "script");
  const [draft, setDraft] = useState<CustomRc | null>(style?.rc ?? null);

  useEffect(() => {
    if (current?.source) setPicked(current.source);
    if (current?.name) setPickedName(current.name);
  }, [current?.source, current?.name]);

  useEffect(() => {
    if (style?.rc) setDraft(style.rc);
  }, [style?.rc]);

  if (!result || !style) {
    return (
      <EmptyState
        density="compact"
        title="No figure loaded"
        description="Open a script with molplot serve."
      />
    );
  }

  const source = sources.find((item) => item.id === picked) ?? sources[0];
  const unavailable = source != null && !source.available;
  const showStyles =
    source != null &&
    source.id !== "script" &&
    source.id !== "custom" &&
    source.styles.length > 0;

  const applyNamed = (nextSource: StyleSource, name: string) => {
    if (!nextSource.available) return;
    void onApplyStyle({
      type: "style",
      source: nextSource.id,
      name,
      rc: nextSource.id === "custom" ? (draft ?? style.rc) : undefined,
    });
  };

  const commitRc = (patch: Partial<CustomRc>) => {
    const next = { ...(draft ?? style.rc), ...patch };
    setDraft(next);
    void onApplyStyle({
      type: "style",
      source: "custom",
      name: "custom",
      rc: next,
    });
  };

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-4 p-3">
        <InspectorSection title="Preset">
          <div className="space-y-1">
            <p className="text-label text-muted-foreground">Source</p>
            <Select
              value={picked}
              disabled={applying}
              onValueChange={(value) => {
                const next = sources.find((item) => item.id === value);
                setPicked(value);
                if (!next) return;
                const name = next.styles[0]?.id ?? value;
                setPickedName(name);
                applyNamed(next, name);
              }}
            >
              <SelectTrigger
                size="sm"
                className="h-control-compact w-full bg-surface"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sources.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {showStyles ? (
            <div className="space-y-1">
              <p className="text-label text-muted-foreground">Style</p>
              <Select
                value={pickedName}
                disabled={applying || unavailable}
                onValueChange={(value) => {
                  setPickedName(value);
                  if (source) applyNamed(source, value);
                }}
              >
                <SelectTrigger
                  size="sm"
                  className="h-control-compact w-full bg-surface"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {source.styles.map((item) => (
                    <SelectItem
                      key={item.id}
                      value={item.id}
                      disabled={unavailable}
                    >
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          {source?.hint ? <WarningNote>{source.hint}</WarningNote> : null}
          {error && !unavailable && error !== source?.hint ? (
            isCapabilityWarning(error) ? (
              <WarningNote>{error}</WarningNote>
            ) : (
              <p className="text-micro text-destructive">{error}</p>
            )
          ) : null}
        </InspectorSection>
        {picked === "custom" && draft ? (
          <CustomRcForm
            rc={draft}
            disabled={applying}
            latex={style.latex}
            onCommit={commitRc}
          />
        ) : null}
      </div>
    </ScrollArea>
  );
}

function CustomRcForm({
  rc,
  disabled,
  latex,
  onCommit,
}: {
  rc: CustomRc;
  disabled: boolean;
  latex?: { available: boolean; hint: string | null };
  onCommit: (patch: Partial<CustomRc>) => void;
}): JSX.Element {
  const families = FAMILIES.includes(rc.fontFamily as (typeof FAMILIES)[number])
    ? FAMILIES
    : ([rc.fontFamily, ...FAMILIES] as string[]);
  const cmaps = CMAPS.includes(rc.cmap as (typeof CMAPS)[number])
    ? CMAPS
    : ([rc.cmap, ...CMAPS] as string[]);
  return (
    <>
      <InspectorSection title="Figure">
        <SizeField
          label="Width"
          value={rc.figureWidth}
          unit="in"
          disabled={disabled}
          onChange={(figureWidth) => onCommit({ figureWidth })}
        />
        <SizeField
          label="Height"
          value={rc.figureHeight}
          unit="in"
          disabled={disabled}
          onChange={(figureHeight) => onCommit({ figureHeight })}
        />
        <SizeField
          label="DPI"
          value={rc.dpi}
          step={10}
          min={50}
          disabled={disabled}
          onChange={(dpi) => onCommit({ dpi })}
        />
        <ColorField
          label="Face"
          value={rc.figureFace}
          disabled={disabled}
          onChange={(figureFace) => onCommit({ figureFace })}
        />
      </InspectorSection>
      <InspectorSection title="Font">
        <InspectorField label="Family">
          <Select
            value={rc.fontFamily}
            disabled={disabled}
            onValueChange={(fontFamily) => onCommit({ fontFamily })}
          >
            <SelectTrigger
              size="sm"
              className="h-control-compact w-full bg-surface"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {families.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </InspectorField>
        <SizeField
          label="Size"
          value={rc.fontSize}
          unit="pt"
          disabled={disabled}
          onChange={(fontSize) => onCommit({ fontSize })}
        />
        <ChoiceField
          label="Weight"
          value={/bold|^[7-9]|^6\d{2}/i.test(rc.fontWeight) ? "bold" : "normal"}
          options={["normal", "bold"]}
          disabled={disabled}
          onChange={(fontWeight) => onCommit({ fontWeight })}
        />
        <ChoiceField
          label="Style"
          value={rc.fontStyle === "italic" ? "italic" : "normal"}
          options={["normal", "italic"]}
          disabled={disabled}
          onChange={(fontStyle) => onCommit({ fontStyle })}
        />
      </InspectorSection>
      <InspectorSection title="Text">
        <ColorField
          label="Colour"
          value={rc.textColor}
          disabled={disabled}
          onChange={(textColor) => onCommit({ textColor })}
        />
        <BoolField
          label="TeX"
          value={rc.usetex}
          disabled={disabled || latex?.available === false}
          onChange={(usetex) => onCommit({ usetex })}
        />
        {latex?.available === false && latex.hint ? (
          <WarningNote>{latex.hint}</WarningNote>
        ) : null}
      </InspectorSection>
      <InspectorSection title="Axes">
        <ColorField
          label="Face"
          value={rc.axesFace}
          disabled={disabled}
          onChange={(axesFace) => onCommit({ axesFace })}
        />
        <ColorField
          label="Edge"
          value={rc.axesEdge}
          disabled={disabled}
          onChange={(axesEdge) => onCommit({ axesEdge })}
        />
        <SizeField
          label="Width"
          value={rc.axesLineWidth}
          unit="pt"
          disabled={disabled}
          onChange={(axesLineWidth) => onCommit({ axesLineWidth })}
        />
        <SizeField
          label="Title"
          value={rc.titleSize}
          unit="pt"
          disabled={disabled}
          onChange={(titleSize) => onCommit({ titleSize })}
        />
        <SizeField
          label="Labels"
          value={rc.labelSize}
          unit="pt"
          disabled={disabled}
          onChange={(labelSize) => onCommit({ labelSize })}
        />
        <ColorField
          label="Label"
          value={rc.labelColor}
          disabled={disabled}
          onChange={(labelColor) => onCommit({ labelColor })}
        />
        <BoolField
          label="Grid"
          value={rc.grid}
          disabled={disabled}
          onChange={(grid) => onCommit({ grid })}
        />
      </InspectorSection>
      <InspectorSection title="Lines">
        <SizeField
          label="Width"
          value={rc.lineWidth}
          unit="pt"
          disabled={disabled}
          onChange={(lineWidth) => onCommit({ lineWidth })}
        />
        <ChoiceField
          label="Style"
          value={rc.lineStyle}
          options={LINE_STYLES}
          disabled={disabled}
          onChange={(lineStyle) => onCommit({ lineStyle })}
        />
        <SizeField
          label="Marker"
          value={rc.markerSize}
          unit="pt"
          disabled={disabled}
          onChange={(markerSize) => onCommit({ markerSize })}
        />
        <InspectorField label="Cycle" htmlFor="preset-palette">
          <Input
            id="preset-palette"
            key={rc.palette.join(",")}
            defaultValue={rc.palette.join(", ")}
            disabled={disabled}
            className="h-control-compact bg-surface text-micro"
            onBlur={(event) => {
              const palette = event.target.value
                .split(/[,\s]+/)
                .map((item) => item.trim())
                .filter((item) => /^#[0-9a-fA-F]{6}$/.test(item));
              if (palette.length) onCommit({ palette });
            }}
          />
        </InspectorField>
      </InspectorSection>
      <InspectorSection title="Ticks">
        <SizeField
          label="Size"
          value={rc.tickSize}
          unit="pt"
          disabled={disabled}
          onChange={(tickSize) => onCommit({ tickSize })}
        />
        <ChoiceField
          label="Direction"
          value={rc.tickDirection}
          options={TICK_DIRS}
          disabled={disabled}
          onChange={(tickDirection) => onCommit({ tickDirection })}
        />
        <ColorField
          label="Colour"
          value={rc.tickColor}
          disabled={disabled}
          onChange={(tickColor) => onCommit({ tickColor })}
        />
      </InspectorSection>
      <InspectorSection title="Grid">
        <ColorField
          label="Colour"
          value={rc.gridColor}
          disabled={disabled}
          onChange={(gridColor) => onCommit({ gridColor })}
        />
        <ChoiceField
          label="Style"
          value={rc.gridStyle}
          options={LINE_STYLES}
          disabled={disabled}
          onChange={(gridStyle) => onCommit({ gridStyle })}
        />
        <SizeField
          label="Width"
          value={rc.gridWidth}
          unit="pt"
          disabled={disabled}
          onChange={(gridWidth) => onCommit({ gridWidth })}
        />
        <InspectorField label="Opacity">
          <ValueChip>
            <NumberField
              value={Math.round(rc.gridAlpha * 100)}
              min={0}
              max={100}
              step={1}
              disabled={disabled}
              onChange={(next) => onCommit({ gridAlpha: next / 100 })}
              className="h-auto w-full border-0 bg-transparent px-0"
            />
          </ValueChip>
        </InspectorField>
      </InspectorSection>
      <InspectorSection title="Legend">
        <SizeField
          label="Size"
          value={rc.legendSize}
          unit="pt"
          disabled={disabled}
          onChange={(legendSize) => onCommit({ legendSize })}
        />
        <BoolField
          label="Frame"
          value={rc.legendFrame}
          disabled={disabled}
          onChange={(legendFrame) => onCommit({ legendFrame })}
        />
      </InspectorSection>
      <InspectorSection title="Image">
        <ChoiceField
          label="Colormap"
          value={rc.cmap}
          options={cmaps}
          disabled={disabled}
          onChange={(cmap) => onCommit({ cmap })}
        />
      </InspectorSection>
      <InspectorSection title="Save">
        <ChoiceField
          label="Crop"
          value={rc.savefigBbox === "tight" ? "tight" : "standard"}
          options={["standard", "tight"]}
          disabled={disabled}
          onChange={(savefigBbox) => onCommit({ savefigBbox })}
        />
      </InspectorSection>
    </>
  );
}

function SizeField({
  label,
  value,
  unit,
  min = 0.1,
  step = 0.1,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  unit?: string;
  min?: number;
  step?: number;
  disabled: boolean;
  onChange: (value: number) => void;
}): JSX.Element {
  return (
    <InspectorField label={label}>
      <ValueChip>
        <NumberField
          value={value}
          min={min}
          step={step}
          format={formatSize}
          disabled={disabled}
          onChange={onChange}
          className="h-auto w-full border-0 bg-transparent px-0"
        />
        {unit ? <span className="text-muted-foreground">{unit}</span> : null}
      </ValueChip>
    </InspectorField>
  );
}

function ChoiceField({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  disabled: boolean;
  onChange: (value: string) => void;
}): JSX.Element {
  return (
    <InspectorField label={label}>
      <Select value={value} disabled={disabled} onValueChange={onChange}>
        <SelectTrigger
          size="sm"
          className="h-control-compact w-full bg-surface"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((item) => (
            <SelectItem key={item} value={item}>
              {item}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </InspectorField>
  );
}

function BoolField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}): JSX.Element {
  return (
    <ChoiceField
      label={label}
      value={value ? "yes" : "no"}
      options={["yes", "no"]}
      disabled={disabled}
      onChange={(next) => onChange(next === "yes")}
    />
  );
}

function ColorField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}): JSX.Element {
  return (
    <InspectorField label={label}>
      <ValueChip className={cn(disabled && "opacity-50")}>
        <input
          type="color"
          aria-label={label}
          value={value || "#000000"}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="size-4 cursor-pointer rounded-sm border-0 bg-transparent p-0"
        />
        <span className="min-w-0 flex-1 truncate uppercase">
          {value || "—"}
        </span>
      </ValueChip>
    </InspectorField>
  );
}
