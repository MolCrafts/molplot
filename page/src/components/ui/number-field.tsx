import type React from "react";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface NumberFieldProps
  extends Omit<
    React.ComponentProps<typeof Input>,
    | "type"
    | "value"
    | "min"
    | "max"
    | "step"
    | "onChange"
    | "onBlur"
    | "onKeyDown"
  > {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  /** Display transform. Size fields use two decimals; science fields use e-notation. */
  format?: (value: number) => string;
  onChange: (value: number) => void;
}

/**
 * Numeric input that holds a string draft while editing and commits a
 * clamped, step-rounded value on blur or Enter. Shared by the View-tab
 * render controls and the Data Source per-component parameters.
 */
export function NumberField({
  value,
  min,
  max,
  step,
  format,
  onChange,
  className,
  ...inputProps
}: NumberFieldProps) {
  const shown = format ? format(value) : String(value);
  const [draft, setDraft] = useState(shown);
  useEffect(() => setDraft(shown), [shown]);

  const commit = () => {
    let v = Number(draft);
    if (Number.isNaN(v)) v = value;
    if (min !== undefined) v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    if (step !== undefined) v = Math.round(v / step) * step;
    onChange(v);
    setDraft(format ? format(v) : String(v));
  };

  return (
    <Input
      {...inputProps}
      type={format ? "text" : "number"}
      inputMode="decimal"
      className={cn(
        "h-control-compact w-16 shrink-0 px-2 text-label tabular-nums",
        className,
      )}
      value={draft}
      min={min}
      max={max}
      step={step}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && commit()}
    />
  );
}
