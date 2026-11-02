import type { JSX } from "react";
import { useEffect, useState } from "react";
import { WorkbenchShell } from "@/components/blocks/workbench-shell";
import type { DatumRef } from "@/components/workbench/DataPanel";
import { FigureCanvas } from "@/components/workbench/FigureCanvas";
import { Inspector } from "@/components/workbench/Inspector";
import { LeftRail, type LeftTab } from "@/components/workbench/LeftRail";
import { PlotToolbar } from "@/components/workbench/PlotToolbar";
import { useHostSession } from "@/hooks/useHostSession";
import { downloadExport, type ExportFormat } from "@/lib/host";
import { INLINE_PANEL_BREAKPOINT } from "@/lib/layout";
import { defaultSelection, findNode, scriptStem } from "@/lib/scene";

export function App(): JSX.Element {
  const session = useHostSession();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [leftTab, setLeftTab] = useState<LeftTab>("data");
  const [leftOpen, setLeftOpen] = useState(
    () =>
      typeof window === "undefined" ||
      window.innerWidth >= INLINE_PANEL_BREAKPOINT,
  );
  const [rightOpen, setRightOpen] = useState(
    () =>
      typeof window === "undefined" ||
      window.innerWidth >= INLINE_PANEL_BREAKPOINT,
  );
  const [grid, setGrid] = useState(false);
  const [fitToken, setFitToken] = useState(0);
  const [highlighted, setHighlighted] = useState<DatumRef | null>(null);
  const scene = session.result?.scene;

  useEffect(() => {
    if (!scene) return;
    setSelectedId((current) => {
      if (current && findNode(scene.root, current)) return current;
      return defaultSelection(scene.root);
    });
  }, [scene]);

  const onExport = (fmt: ExportFormat) => {
    if (!session.result) return;
    downloadExport(
      fmt,
      session.result.revision,
      scriptStem(session.result.script),
    );
  };

  return (
    <div className="h-full w-full">
      <WorkbenchShell
        product="MolPlot"
        version="v0.1.6"
        logo={
          <span
            aria-hidden
            className="flex size-6 items-center justify-center text-[24px] leading-none font-semibold text-accent"
          >
            ∿
          </span>
        }
        toolbar={
          <PlotToolbar
            grid={grid}
            onToggleGrid={() => setGrid((value) => !value)}
            onFit={() => setFitToken((value) => value + 1)}
            onExport={onExport}
          />
        }
        left={
          <LeftRail
            tab={leftTab}
            onTabChange={setLeftTab}
            result={session.result}
            selectedId={selectedId}
            highlighted={highlighted}
            applying={session.status === "applying"}
            error={session.error}
            onSelect={setSelectedId}
            onHighlight={setHighlighted}
            onApplyStyle={session.applyStyle}
          />
        }
        right={
          <Inspector
            result={session.result}
            selectedId={selectedId}
            onApply={session.apply}
            onShowData={() => {
              setLeftTab("data");
              setLeftOpen(true);
            }}
          />
        }
        leftOpen={leftOpen}
        rightOpen={rightOpen}
        onLeftOpenChange={setLeftOpen}
        onRightOpenChange={setRightOpen}
        canvas={
          <FigureCanvas
            result={session.result}
            selectedId={selectedId}
            highlighted={highlighted}
            grid={grid}
            fitToken={fitToken}
            onSelect={setSelectedId}
            onApply={session.apply}
            onMove={(nodeId, bbox) => {
              void session.apply({
                type: "set",
                nodeId,
                component: "geometry",
                property: "bbox",
                value: bbox,
              });
            }}
            status={session.status}
            error={session.error}
          />
        }
      />
    </div>
  );
}
