/**
 * Workbench resizable wrappers. Thin `react-resizable-panels` surface with
 * `usePanelRef`, live `onLayoutChange`, and committed `onLayoutChanged`.
 *
 * Distinct from `src/components/ui/resizable.tsx` (molexp persistence shim).
 * Products must not assemble a page frame from these — use WorkbenchShell.
 */

import type * as React from "react";
import {
  Group as ResizableGroup,
  Panel as ResizablePanelPrimitive,
  Separator as ResizableSeparator,
  usePanelRef,
} from "react-resizable-panels";

import { cn } from "@/lib/utils";

export type { PanelImperativeHandle } from "react-resizable-panels";
export { usePanelRef };

function ResizablePanelGroup({
  className,
  ...props
}: React.ComponentProps<typeof ResizableGroup>) {
  return (
    <ResizableGroup
      data-slot="resizable-panel-group"
      className={cn("flex h-full w-full", className)}
      {...props}
    />
  );
}

function ResizablePanel({
  ...props
}: React.ComponentProps<typeof ResizablePanelPrimitive>) {
  return <ResizablePanelPrimitive data-slot="resizable-panel" {...props} />;
}

/**
 * Workbench splitter — 1px hairline via `.workbench-split*` plus a centered
 * grip pill so closed rails stay discoverable without toolbar panel toggles.
 */
function ResizableHandle({
  className,
  ...props
}: React.ComponentProps<typeof ResizableSeparator>) {
  return (
    <ResizableSeparator
      data-slot="resizable-handle"
      className={cn(
        "workbench-split workbench-split-v workbench-split-interactive workbench-split-grip outline-hidden",
        "focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1",
        className,
      )}
      {...props}
    />
  );
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup };
