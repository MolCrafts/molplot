import type { BBox, Command } from "@molcrafts/molplot/semantic";
import type {
  JSX,
  DragEvent as ReactDragEvent,
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
} from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import type { DatumRef } from "@/components/workbench/DataPanel";
import { FigureRulers } from "@/components/workbench/FigureRulers";
import { QuickMenu } from "@/components/workbench/QuickMenu";
import { SelectionChrome } from "@/components/workbench/SelectionChrome";
import type { HostResult } from "@/lib/host";
import { hitTest } from "@/lib/overlay";
import {
  bboxOf,
  canMove,
  findByRole,
  findNode,
  nodePath,
  nodeTitle,
  walk,
} from "@/lib/scene";
import { formatMm, parseSvgSize, stripSvgPreamble } from "@/lib/svg";
import {
  clearDatumHighlight,
  clearPenSelection,
  findArtistPath,
  hitSvgSeries,
  paintDatumHighlight,
  paintPenSelection,
} from "@/lib/svg-pen";

interface DragState {
  nodeId: string;
  box: BBox;
  page: DOMRect;
  x0: number;
  y0: number;
  next?: BBox;
}

export function FigureCanvas({
  result,
  selectedId,
  highlighted,
  grid,
  fitToken,
  onSelect,
  onApply,
  onMove,
  status,
  error,
}: {
  result: HostResult | null;
  selectedId: string | null;
  highlighted: DatumRef | null;
  grid: boolean;
  fitToken: number;
  onSelect: (id: string | null) => void;
  onApply: (command: Omit<Command, "baseRevision">) => Promise<boolean>;
  onMove: (nodeId: string, bbox: BBox) => void;
  status: string;
  error: string | null;
}): JSX.Element {
  const pageRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const cursorXRef = useRef<HTMLSpanElement>(null);
  const cursorYRef = useRef<HTMLSpanElement>(null);
  const [paperPx, setPaperPx] = useState({ w: 0, h: 0 });
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(
    null,
  );
  const clickSelect = useRef<string | null>(null);
  const lastBoxes = useRef<Record<string, BBox>>({});
  const drag = useRef<DragState | null>(null);
  const space = useRef(false);
  const [pan, setPan] = useState({ x: 0, y: 0, scale: 1 });
  const panDrag = useRef<{
    x0: number;
    y0: number;
    panX: number;
    panY: number;
  } | null>(null);

  useEffect(() => {
    setPan({ x: 0, y: 0, scale: 1 });
    void fitToken;
  }, [fitToken]);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.matches("input, textarea, select, [contenteditable='true']")
      ) {
        return;
      }
      event.preventDefault();
      space.current = true;
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === "Space") space.current = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  if (result) {
    for (const { node } of walk(result.scene.root)) {
      const box = bboxOf(node);
      if (box) lastBoxes.current[node.id] = box;
    }
  }

  const markup = useMemo(
    () => (result ? stripSvgPreamble(result.view.svg) : ""),
    [result],
  );

  useEffect(() => {
    const host = pageRef.current;
    if (!host) return;
    host.replaceChildren();
    if (!markup) return;
    const parsed = new DOMParser().parseFromString(markup, "image/svg+xml");
    const svg = parsed.documentElement;
    if (svg.tagName.toLowerCase() !== "svg") return;
    svg.setAttribute("draggable", "false");
    svg.style.pointerEvents = "none";
    svg.style.userSelect = "none";
    svg.style.setProperty("-webkit-user-drag", "none");
    host.append(document.importNode(svg, true));
    const mounted = host.querySelector("svg");
    if (mounted instanceof SVGElement) {
      mounted.setAttribute("draggable", "false");
      mounted.style.pointerEvents = "none";
      mounted.style.setProperty("-webkit-user-drag", "none");
    }
  }, [markup]);

  useEffect(() => {
    if (!result) return;
    const paper = paperRef.current;
    if (!paper) return;
    const sync = () =>
      setPaperPx({ w: paper.clientWidth, h: paper.clientHeight });
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(paper);
    return () => observer.disconnect();
  }, [result]);

  useEffect(() => {
    const svg = pageRef.current?.querySelector("svg");
    if (!(svg instanceof SVGSVGElement)) return;
    clearPenSelection(svg);
    if (!selectedId || !result) return;
    const node = findNode(result.scene.root, selectedId);
    if (node?.role !== "series") return;
    const path = findArtistPath(svg, selectedId);
    if (path) paintPenSelection(svg, path);
  }, [selectedId, result]);

  useEffect(() => {
    const revision = result?.revision;
    void revision;
    const svg = pageRef.current?.querySelector("svg");
    if (!(svg instanceof SVGSVGElement)) return;
    clearDatumHighlight(svg);
    if (!highlighted) return;
    const path = findArtistPath(svg, highlighted.nodeId);
    if (path) paintDatumHighlight(svg, path, highlighted.index);
  }, [highlighted, result]);

  useEffect(() => {
    if (!selectedId || !result) return;
    if (clickSelect.current === selectedId) return;
    const paper = paperRef.current;
    if (!paper || paper.clientWidth <= 0) return;
    const node = findNode(result.scene.root, selectedId);
    const box = node ? bboxOf(node) : undefined;
    if (!box) {
      setMenuAnchor({ x: paper.clientWidth / 2, y: 28 });
      return;
    }
    setMenuAnchor({
      x: (box.x + box.w / 2) * paper.clientWidth,
      y: box.y * paper.clientHeight,
    });
  }, [selectedId, result]);

  const size = useMemo(
    () => (result ? parseSvgSize(result.view.svg) : null),
    [result],
  );
  const titleNode = result
    ? findByRole(result.scene.root, "title")[0]
    : undefined;
  const caption = titleNode ? nodeTitle(titleNode) : "Figure";
  const selected =
    selectedId && result ? findNode(result.scene.root, selectedId) : undefined;

  if (status === "loading" && !result) {
    return <EmptyState density="compact" title="Loading figure…" />;
  }
  if (status === "error" && !result) {
    return (
      <EmptyState
        density="compact"
        title="Host is not reachable"
        description={error || "Run molplot serve <script.py>, then reload."}
      />
    );
  }
  if (!result) {
    return <EmptyState density="compact" title="No figure" />;
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (space.current || event.button === 1) {
      panDrag.current = {
        x0: event.clientX,
        y0: event.clientY,
        panX: pan.x,
        panY: pan.y,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    const host = pageRef.current;
    if (!host) return;
    const page = host.getBoundingClientRect();
    if (page.width <= 0 || page.height <= 0) return;
    const clearSelection = () => {
      onSelect(null);
      setMenuAnchor(null);
      clickSelect.current = null;
    };
    if (
      event.clientX < page.left ||
      event.clientX > page.right ||
      event.clientY < page.top ||
      event.clientY > page.bottom
    ) {
      clearSelection();
      return;
    }
    const p = {
      x: (event.clientX - page.left) / page.width,
      y: (event.clientY - page.top) / page.height,
    };
    const seriesIds = walk(result.scene.root)
      .filter(({ node }) => node.role === "series")
      .map(({ node }) => node.id);
    const svg = host.querySelector("svg");
    const svgHit =
      svg instanceof SVGSVGElement
        ? hitSvgSeries(svg, event.clientX, event.clientY, seriesIds)
        : null;
    const boxes = walk(result.scene.root).flatMap(({ node }) => {
      if (
        node.role === "series" &&
        svg instanceof SVGSVGElement &&
        findArtistPath(svg, node.id)
      ) {
        return [];
      }
      const box = bboxOf(node) ?? lastBoxes.current[node.id];
      if (!box) return [];
      return [{ id: node.id, role: node.role, box }];
    });
    const nodeId = svgHit ?? hitTest(p, [], boxes, page.width, page.height);
    if (!nodeId) {
      clearSelection();
      return;
    }
    const node = findNode(result.scene.root, nodeId);
    if (!node) {
      clearSelection();
      return;
    }
    onSelect(node.id);
    const paperEl = paperRef.current;
    if (paperEl && paperEl.clientWidth > 0) {
      const rect = paperEl.getBoundingClientRect();
      clickSelect.current = node.id;
      setMenuAnchor({
        x: ((event.clientX - rect.left) / rect.width) * paperEl.clientWidth,
        y: ((event.clientY - rect.top) / rect.height) * paperEl.clientHeight,
      });
    }
    const box = bboxOf(node);
    if (!box || !canMove(node)) return;
    drag.current = {
      nodeId: node.id,
      box,
      page,
      x0: event.clientX,
      y0: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const syncRulerCursor = (clientX: number, clientY: number) => {
    const paper = paperRef.current;
    const xHair = cursorXRef.current;
    const yHair = cursorYRef.current;
    if (!paper || !xHair || !yHair) return;
    const rect = paper.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      xHair.hidden = true;
      yHair.hidden = true;
      return;
    }
    const t = (clientX - rect.left) / rect.width;
    const u = (clientY - rect.top) / rect.height;
    const inside = t >= 0 && t <= 1 && u >= 0 && u <= 1;
    xHair.hidden = !inside;
    yHair.hidden = !inside;
    if (!inside) return;
    xHair.style.left = `${t * paper.clientWidth}px`;
    yHair.style.top = `${u * paper.clientHeight}px`;
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    syncRulerCursor(event.clientX, event.clientY);
    if (panDrag.current) {
      const dx = event.clientX - panDrag.current.x0;
      const dy = event.clientY - panDrag.current.y0;
      setPan({
        x: panDrag.current.panX + dx,
        y: panDrag.current.panY + dy,
        scale: pan.scale,
      });
      return;
    }
    const current = drag.current;
    if (!current) return;
    const dx = (event.clientX - current.x0) / current.page.width;
    const dy = (event.clientY - current.y0) / current.page.height;
    const next = {
      x: current.box.x + dx,
      y: current.box.y + dy,
      w: current.box.w,
      h: current.box.h,
    };
    current.next = next;
    const el = event.currentTarget.querySelector<HTMLElement>(
      `[data-node="${current.nodeId}"]`,
    );
    if (el) {
      el.style.left = `${next.x * 100}%`;
      el.style.top = `${next.y * 100}%`;
    }
  };

  const onDragStart = (event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    panDrag.current = null;
    const current = drag.current;
    if (!current) return;
    const el = event.currentTarget.querySelector<HTMLElement>(
      `[data-node="${current.nodeId}"]`,
    );
    el?.classList.remove("opacity-80");
    drag.current = null;
    if (current.next) onMove(current.nodeId, current.next);
  };

  const onWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.08 : 0.92;
    setPan((prev) => ({
      ...prev,
      scale: Math.min(4, Math.max(0.4, prev.scale * factor)),
    }));
  };

  return (
    <div
      role="application"
      aria-label="Figure canvas"
      className="relative flex h-full min-h-0 flex-col bg-canvas"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={() => {
        const xHair = cursorXRef.current;
        const yHair = cursorYRef.current;
        if (xHair) xHair.hidden = true;
        if (yHair) yHair.hidden = true;
      }}
      onWheel={onWheel}
      onDragStart={onDragStart}
      style={
        grid
          ? {
              backgroundImage:
                "linear-gradient(to right, var(--molplot-border) 1px, transparent 1px), linear-gradient(to bottom, var(--molplot-border) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }
          : undefined
      }
    >
      <div className="flex h-7 shrink-0 items-center justify-between px-8 text-micro text-muted-foreground">
        <p>Figure 1 / {caption}</p>
        <p>
          {size
            ? `${formatMm(size.widthMm).replace(" mm", "")} × ${formatMm(size.heightMm)}`
            : `rev ${result.revision}`}
        </p>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-6 pt-2">
        <div
          className="w-[min(48rem,100%)]"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${pan.scale})`,
            transformOrigin: "center center",
          }}
        >
          <FigureRulers
            widthMm={size?.widthMm ?? 0}
            heightMm={size?.heightMm ?? 0}
            widthPx={paperPx.w}
            heightPx={paperPx.h}
            cursorXRef={cursorXRef}
            cursorYRef={cursorYRef}
          >
            <div
              ref={paperRef}
              className="relative w-full bg-paper shadow-[0_0_0_1px_var(--molplot-border)]"
            >
              <div
                ref={pageRef}
                className="relative w-full select-none [&_svg]:pointer-events-none [&_svg]:block [&_svg]:h-auto [&_svg]:w-full [&_svg]:[-webkit-user-drag:none]"
              />
              <div className="pointer-events-none absolute inset-0 overflow-visible">
                {selected ? (
                  <SelectionChrome
                    node={selected}
                    fallback={lastBoxes.current[selected.id]}
                    panelBox={
                      selected.role === "axis"
                        ? bboxOf(
                            [...nodePath(result.scene.root, selected.id)]
                              .reverse()
                              .find((item) => item.role === "panel") ??
                              selected,
                          )
                        : undefined
                    }
                  />
                ) : null}
              </div>
              {selected && menuAnchor ? (
                <QuickMenu
                  node={selected}
                  onApply={onApply}
                  anchor={menuAnchor}
                />
              ) : null}
            </div>
          </FigureRulers>
        </div>
      </div>
      <p className="shrink-0 px-8 py-3 text-center text-micro text-muted-foreground">
        Click an element to format · Click empty canvas to deselect · Space to
        pan · Scroll to zoom
      </p>
    </div>
  );
}
