import type { JSX, ReactNode, RefObject } from "react";
import { mmToPx, rulerTicks } from "@/lib/ruler";
import { cn } from "@/lib/utils";

export const RULER_PX = 20;

export function FigureRulers({
  widthMm,
  heightMm,
  widthPx,
  heightPx,
  cursorXRef,
  cursorYRef,
  children,
}: {
  widthMm: number;
  heightMm: number;
  widthPx: number;
  heightPx: number;
  cursorXRef: RefObject<HTMLSpanElement | null>;
  cursorYRef: RefObject<HTMLSpanElement | null>;
  children: ReactNode;
}): JSX.Element {
  return (
    <div
      className="grid"
      style={{
        gridTemplateColumns: `${RULER_PX}px minmax(0, 1fr)`,
        gridTemplateRows: `${RULER_PX}px max-content`,
      }}
    >
      <div className="bg-canvas" />
      <RulerTrack
        lengthMm={widthMm}
        lengthPx={widthPx}
        axis="x"
        cursorRef={cursorXRef}
        className="border-b border-border"
      />
      <RulerTrack
        lengthMm={heightMm}
        lengthPx={heightPx}
        axis="y"
        cursorRef={cursorYRef}
        className="border-r border-border"
      />
      {children}
    </div>
  );
}

function RulerTrack({
  lengthMm,
  lengthPx,
  axis,
  cursorRef,
  className,
}: {
  lengthMm: number;
  lengthPx: number;
  axis: "x" | "y";
  cursorRef: RefObject<HTMLSpanElement | null>;
  className?: string;
}): JSX.Element {
  const ticks = rulerTicks(lengthMm);
  const vertical = axis === "y";
  return (
    <div
      aria-hidden
      className={cn("relative overflow-hidden bg-canvas", className)}
      style={
        vertical
          ? { width: RULER_PX, height: lengthPx }
          : { width: lengthPx, height: RULER_PX }
      }
    >
      {ticks.map((tick) => {
        const pos = mmToPx(tick.mm, lengthMm, lengthPx);
        const major = tick.major;
        const size = major ? 8 : 4;
        return (
          <span
            key={`${axis}-${tick.mm}`}
            className="absolute bg-muted-foreground/70"
            style={
              vertical
                ? {
                    top: pos,
                    right: 0,
                    width: size,
                    height: 1,
                  }
                : {
                    left: pos,
                    bottom: 0,
                    width: 1,
                    height: size,
                  }
            }
          />
        );
      })}
      {ticks
        .filter((tick) => tick.major && tick.mm !== 0)
        .map((tick) => {
          const pos = mmToPx(tick.mm, lengthMm, lengthPx);
          return (
            <span
              key={`${axis}-label-${tick.mm}`}
              className="absolute font-mono text-[9px] leading-none text-muted-foreground"
              style={
                vertical
                  ? {
                      top: pos,
                      right: 9,
                      transform: "translate(50%, -50%) rotate(-90deg)",
                    }
                  : {
                      left: pos,
                      top: 2,
                      transform: "translateX(-50%)",
                    }
              }
            >
              {tick.mm}
            </span>
          );
        })}
      <span
        ref={cursorRef}
        className="pointer-events-none absolute bg-accent"
        hidden
        style={
          vertical
            ? { left: 0, right: 0, height: 1 }
            : { top: 0, bottom: 0, width: 1 }
        }
      />
    </div>
  );
}
