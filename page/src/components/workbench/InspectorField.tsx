import type { JSX, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function InspectorField({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <div
      className={cn(
        "flex min-h-control-compact items-center justify-between gap-3",
        className,
      )}
    >
      <label
        htmlFor={htmlFor}
        className="w-[7rem] shrink-0 text-label text-muted-foreground"
      >
        {label}
      </label>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function ValueChip({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <div
      className={cn(
        "flex h-control-compact w-full items-center gap-2 rounded-control bg-surface px-2 py-1 font-mono text-micro text-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function InspectorSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <details className="group border-b border-border pb-3">
      <summary className="cursor-pointer py-1 text-label font-semibold text-foreground">
        {title}
      </summary>
      <div className="space-y-1.5 pt-2">{children}</div>
    </details>
  );
}
