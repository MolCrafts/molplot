/**
 * Shared product chrome: toolbar · left rail · canvas · right rail.
 *
 * Geometry and interaction come from MolVis 0.3.0: empty resizable slots,
 * overlay rails, snap-close, last-width restore, narrow drawers. Products
 * supply the slots; they must not invent a second page frame.
 */

import {
  type JSX,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useIsNarrow } from "@/hooks/use-is-narrow";
import {
  CANVAS_MIN_PCT,
  COARSE_POINTER_INLINE_PANEL_BREAKPOINT,
  INLINE_PANEL_BREAKPOINT,
  isSidePanelOpen,
  resolveWorkbenchPanelLayout,
  SIDE_PANEL,
  sidePanelMaxPct,
  sidePanelMinPct,
} from "@/lib/layout";
import { cn } from "@/lib/utils";
import {
  type PanelImperativeHandle,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  usePanelRef,
} from "./workbench-resizable";
import { WorkbenchSidePanel } from "./workbench-side-panel";

export interface WorkbenchShellProps {
  /** Product name, top-left, `--text-title` / font-semibold. */
  product: string;
  /** 24×24 mark to the left of the product name. */
  logo?: ReactNode;
  /** Micro mono version string, e.g. `v6.2.12`. */
  version?: string;
  /** Icon-only actions, trailing cluster. Use IconButton. Modes do not live here. */
  toolbar: ReactNode;
  canvas: ReactNode;
  left?: ReactNode;
  right?: ReactNode;
  /** Optional bottom rail (MolVis plugin host). MolPlot omits this. */
  bottom?: ReactNode;
  /** Overlay chrome only (FPS, path). Do not use a full-width status strip. */
  status?: ReactNode;
  /** Controlled left-rail open flag. */
  leftOpen?: boolean;
  rightOpen?: boolean;
  defaultLeftOpen?: boolean;
  defaultRightOpen?: boolean;
  onLeftOpenChange?: (open: boolean) => void;
  onRightOpenChange?: (open: boolean) => void;
  className?: string;
}

/**
 * Collapsed state of a side-panel slot, or `null` while the panel has not
 * registered its constraints with the group yet.
 *
 * react-resizable-panels throws "Panel constraints not found" when the
 * imperative handle is asked before a conditionally-mounted panel finishes
 * registering. Callers treat `null` as "state unknown — skip this pass".
 */
function slotCollapsed(slot: PanelImperativeHandle | null): boolean | null {
  if (!slot) return null;
  try {
    return slot.isCollapsed();
  } catch {
    return null;
  }
}

function withPanelSlot(
  slot: PanelImperativeHandle | null,
  run: (slot: PanelImperativeHandle) => void,
): void {
  if (!slot || slotCollapsed(slot) === null) return;
  try {
    run(slot);
  } catch {
    /* registration raced between the probe and the mutation — next pass */
  }
}

function useOpenFlag(
  controlled: boolean | undefined,
  defaultValue: boolean,
  onChange: ((open: boolean) => void) | undefined,
): [boolean, (open: boolean) => void] {
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const isControlled = controlled !== undefined;
  const open = isControlled ? controlled : uncontrolled;
  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolled(next);
      onChange?.(next);
    },
    [isControlled, onChange],
  );
  return [open, setOpen];
}

export function WorkbenchShell({
  product,
  logo,
  version,
  toolbar,
  canvas,
  left,
  right,
  bottom,
  status,
  leftOpen: leftOpenProp,
  rightOpen: rightOpenProp,
  defaultLeftOpen = true,
  defaultRightOpen = true,
  onLeftOpenChange,
  onRightOpenChange,
  className,
}: WorkbenchShellProps): JSX.Element {
  const hasLeft = Boolean(left);
  const hasRight = Boolean(right);

  const [rootRef, isNarrow, shellWidth] = useIsNarrow<HTMLElement>(
    INLINE_PANEL_BREAKPOINT,
    COARSE_POINTER_INLINE_PANEL_BREAKPOINT,
  );
  const railMinPct = sidePanelMinPct(shellWidth);
  const railMaxPct = sidePanelMaxPct(shellWidth);

  const [leftOpen, setLeftOpenFlag] = useOpenFlag(
    leftOpenProp,
    defaultLeftOpen,
    onLeftOpenChange,
  );
  const [rightOpen, setRightOpenFlag] = useOpenFlag(
    rightOpenProp,
    defaultRightOpen,
    onRightOpenChange,
  );

  const [leftWidthPct, setLeftWidthPct] = useState(() =>
    (leftOpenProp ?? defaultLeftOpen) ? SIDE_PANEL.openDefaultPct : 0,
  );
  const [rightWidthPct, setRightWidthPct] = useState(() =>
    (rightOpenProp ?? defaultRightOpen) ? SIDE_PANEL.openDefaultPct : 0,
  );

  const leftPanelRef = useRef<HTMLElement>(null);
  const rightPanelRef = useRef<HTMLElement>(null);
  const leftSlotRef = usePanelRef();
  const rightSlotRef = usePanelRef();
  const lastLeftWidthRef = useRef<number>(SIDE_PANEL.openDefaultPct);
  const lastRightWidthRef = useRef<number>(SIDE_PANEL.openDefaultPct);
  const draggingRef = useRef(false);

  const applyOverlayWidth = useCallback(
    (side: "left" | "right", pct: number) => {
      const el = side === "left" ? leftPanelRef.current : rightPanelRef.current;
      if (el) el.style.width = `${pct}%`;
    },
    [],
  );

  const showInlineLeft = hasLeft && !isNarrow;
  const showInlineRight = hasRight && !isNarrow;
  const hasInlineSidePanel = showInlineLeft || showInlineRight;

  const {
    defaultLayout,
    leftSize: defaultLeftSize,
    canvasSize: defaultCanvasSize,
    rightSize: defaultRightSize,
  } = useMemo(
    () =>
      resolveWorkbenchPanelLayout({
        showLeft: showInlineLeft,
        showRight: showInlineRight,
        leftOpen,
        rightOpen,
      }),
    [showInlineLeft, showInlineRight, leftOpen, rightOpen],
  );

  // Leave travel: floor the canvas by rail *max*, not min. Two rails at the
  // 240px floor already fill `100 - 2*min`; using min here made maxSize
  // unreachable and the splitter could not grow an open rail.
  const canvasMinPct = Math.min(
    CANVAS_MIN_PCT,
    100 - railMaxPct * ((showInlineLeft ? 1 : 0) + (showInlineRight ? 1 : 0)),
  );

  const openRailWidth = (pct: number) =>
    pct <= 0 ? 0 : Math.max(pct, railMinPct);

  const applyOpen = useCallback(
    (side: "left" | "right", open: boolean) => {
      const slot = side === "left" ? leftSlotRef.current : rightSlotRef.current;
      const last = side === "left" ? lastLeftWidthRef : lastRightWidthRef;
      const setWidth = side === "left" ? setLeftWidthPct : setRightWidthPct;
      if (open) {
        const width = Math.max(last.current, railMinPct);
        setWidth(width);
        applyOverlayWidth(side, width);
        withPanelSlot(slot, (handle) => {
          if (handle.isCollapsed()) handle.expand();
          handle.resize(`${width}%`);
        });
      } else {
        setWidth(0);
        applyOverlayWidth(side, 0);
        withPanelSlot(slot, (handle) => {
          if (!handle.isCollapsed()) handle.collapse();
        });
      }
    },
    [applyOverlayWidth, leftSlotRef, railMinPct, rightSlotRef],
  );

  const setLeftOpen = useCallback(
    (open: boolean) => {
      setLeftOpenFlag(open);
      applyOpen("left", open);
    },
    [applyOpen, setLeftOpenFlag],
  );

  const setRightOpen = useCallback(
    (open: boolean) => {
      setRightOpenFlag(open);
      applyOpen("right", open);
    },
    [applyOpen, setRightOpenFlag],
  );

  // Parent-driven open (e.g. MolPlot "show data") and narrow↔wide remount.
  // Skip while the user is dragging — live layout must not fight the library.
  useEffect(() => {
    if (draggingRef.current || isNarrow) return;
    applyOpen("left", leftOpen);
  }, [applyOpen, isNarrow, leftOpen]);

  useEffect(() => {
    if (draggingRef.current || isNarrow) return;
    applyOpen("right", rightOpen);
  }, [applyOpen, isNarrow, rightOpen]);

  const handlePanelLayout = useCallback(
    (layout: Record<string, number>) => {
      // Mount/programmatic layouts also fire onLayoutChange. Only treat a
      // live pointer drag as dragging — otherwise the open-sync effect never
      // runs and the overlay can sit wider than the slot, covering the handle.
      draggingRef.current = Boolean(
        document.querySelector(
          '[data-slot="resizable-handle"][data-resizing="true"]',
        ),
      );
      if (layout.left !== undefined) {
        applyOverlayWidth("left", layout.left);
        const open = isSidePanelOpen(layout.left);
        setLeftOpenFlag(open);
      }
      if (layout.right !== undefined) {
        applyOverlayWidth("right", layout.right);
        const open = isSidePanelOpen(layout.right);
        setRightOpenFlag(open);
      }
    },
    [applyOverlayWidth, setLeftOpenFlag, setRightOpenFlag],
  );

  const handlePanelLayoutChanged = useCallback(
    (layout: Record<string, number>) => {
      draggingRef.current = false;
      if (layout.left !== undefined) {
        const size = layout.left;
        applyOverlayWidth("left", size);
        if (size > 0 && size < railMinPct) {
          setLeftOpen(false);
        } else {
          const open = isSidePanelOpen(size);
          if (open) {
            lastLeftWidthRef.current = size;
            setLeftWidthPct(size);
          } else {
            setLeftWidthPct(0);
          }
          setLeftOpenFlag(open);
        }
      }
      if (layout.right !== undefined) {
        const size = layout.right;
        applyOverlayWidth("right", size);
        if (size > 0 && size < railMinPct) {
          setRightOpen(false);
        } else {
          const open = isSidePanelOpen(size);
          if (open) {
            lastRightWidthRef.current = size;
            setRightWidthPct(size);
          } else {
            setRightWidthPct(0);
          }
          setRightOpenFlag(open);
        }
      }
    },
    [
      applyOverlayWidth,
      railMinPct,
      setLeftOpen,
      setLeftOpenFlag,
      setRightOpen,
      setRightOpenFlag,
    ],
  );

  return (
    <section
      ref={rootRef}
      data-slot="workbench-shell"
      className={cn(
        "relative flex h-full w-full min-h-0 flex-col overflow-hidden bg-background text-foreground",
        className,
      )}
    >
      <header
        data-slot="workbench-toolbar"
        className="flex h-toolbar shrink-0 items-center justify-between gap-2 border-b border-border bg-background px-2"
      >
        <div className="flex min-w-0 items-center gap-2">
          {logo}
          <span className="truncate px-1 text-title font-semibold tracking-tight">
            {product}
          </span>
          {version ? (
            <span className="px-1 font-mono text-micro leading-none text-muted-foreground">
              {version}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1">{toolbar}</div>
      </header>

      <div className="relative min-h-0 flex-1">
        <ResizablePanelGroup
          orientation="horizontal"
          className="h-full"
          defaultLayout={defaultLayout}
          onLayoutChange={handlePanelLayout}
          onLayoutChanged={handlePanelLayoutChanged}
          resizeTargetMinimumSize={{ fine: 28, coarse: 44 }}
        >
          {showInlineLeft ? (
            <ResizablePanel
              key="left"
              id="left"
              panelRef={leftSlotRef}
              defaultSize={defaultLeftSize}
              collapsible
              collapsedSize="0%"
              minSize={`${railMinPct}%`}
              maxSize={`${railMaxPct}%`}
              aria-hidden="true"
            />
          ) : null}

          {showInlineLeft ? (
            <ResizableHandle
              key="handle-left"
              aria-label="Resize left panel"
              className="z-20"
            />
          ) : null}

          <ResizablePanel
            key="canvas"
            id="canvas"
            defaultSize={defaultCanvasSize}
            minSize={hasInlineSidePanel ? `${canvasMinPct}%` : "100%"}
            className="flex min-w-0 flex-col"
          >
            <div
              data-slot="workbench-canvas"
              className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-canvas"
            >
              {canvas}
              {status}
            </div>
          </ResizablePanel>

          {showInlineRight ? (
            <ResizableHandle
              key="handle-right"
              aria-label="Resize right panel"
              className="z-20"
            />
          ) : null}

          {showInlineRight ? (
            <ResizablePanel
              key="right"
              id="right"
              panelRef={rightSlotRef}
              defaultSize={defaultRightSize}
              collapsible
              collapsedSize="0%"
              minSize={`${railMinPct}%`}
              maxSize={`${railMaxPct}%`}
              aria-hidden="true"
            />
          ) : null}
        </ResizablePanelGroup>

        {isNarrow && (leftOpen || rightOpen) ? (
          <button
            type="button"
            aria-label="Close side panel"
            onClick={() => {
              setLeftOpen(false);
              setRightOpen(false);
            }}
            className="motion-fade-in absolute inset-0 z-20 cursor-default bg-overlay-scrim"
          />
        ) : null}

        {isNarrow && hasLeft && !leftOpen ? (
          <button
            type="button"
            aria-label="Open left panel"
            onClick={() => setLeftOpen(true)}
            className="workbench-split workbench-split-v workbench-split-interactive workbench-split-grip left-0 z-20"
            style={{ position: "absolute", top: 0, bottom: 0, width: 8 }}
          />
        ) : null}

        {isNarrow && hasRight && !rightOpen ? (
          <button
            type="button"
            aria-label="Open right panel"
            onClick={() => setRightOpen(true)}
            className="workbench-split workbench-split-v workbench-split-interactive workbench-split-grip right-0 z-20"
            style={{ position: "absolute", top: 0, bottom: 0, width: 8 }}
          />
        ) : null}

        {hasLeft ? (
          <WorkbenchSidePanel
            drawer={isNarrow}
            inlineWidth={`${openRailWidth(leftWidthPct)}%`}
            label="Left panel"
            open={leftOpen}
            panelRef={leftPanelRef}
            side="left"
          >
            {left}
          </WorkbenchSidePanel>
        ) : null}

        {hasRight ? (
          <WorkbenchSidePanel
            drawer={isNarrow}
            inlineWidth={`${openRailWidth(rightWidthPct)}%`}
            label="Right panel"
            open={rightOpen}
            panelRef={rightPanelRef}
            side="right"
          >
            {right}
          </WorkbenchSidePanel>
        ) : null}
      </div>

      {bottom}
    </section>
  );
}
