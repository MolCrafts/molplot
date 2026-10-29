import { Input } from "@molcrafts/ui";
import type React from "react";
import { useEffect, useState } from "react";
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
 * Inspector number draft. Compact because the property rows are a stated
 * space constraint. `format` keeps a text draft so scientific notation can
 * round-trip through the design Input.
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
    let next = Number(draft);
    if (Number.isNaN(next)) next = value;
    if (min !== undefined) next = Math.max(min, next);
    if (max !== undefined) next = Math.min(max, next);
    if (step !== undefined) next = Math.round(next / step) * step;
    onChange(next);
    setDraft(format ? format(next) : String(next));
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
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") commit();
      }}
    />
  );
}
