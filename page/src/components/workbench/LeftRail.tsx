import { DiamondRegular, ImageMultipleRegular } from "@fluentui/react-icons";
import { Tabs, TabsContent } from "@molcrafts/ui";
import type { JSX } from "react";
import { PanelTabStrip } from "@/components/blocks/panel-tab-strip";
import { ElementsPanel } from "@/components/workbench/ElementsPanel";
import { exportUrl, type FigureItem, type HostResult } from "@/lib/host";
import { cn } from "@/lib/utils";

export type LeftTab = "figures" | "elements";

export function LeftRail({
  tab,
  onTabChange,
  result,
  selectedId,
  onSelect,
  figures,
  figureId,
  onSelectFigure,
}: {
  tab: LeftTab;
  onTabChange: (tab: LeftTab) => void;
  result: HostResult | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  figures: FigureItem[];
  figureId: string | null;
  onSelectFigure: (id: string) => void;
}): JSX.Element {
  return (
    <Tabs
      value={tab}
      onValueChange={(value) => onTabChange(value as LeftTab)}
      className="flex h-full min-h-0 flex-col gap-0"
    >
      <div className="flex h-9 shrink-0 items-center border-b border-border">
        <PanelTabStrip
          label="Figure navigation"
          items={[
            {
              value: "figures",
              label: "Figures",
              icon: <ImageMultipleRegular />,
            },
            { value: "elements", label: "Elements", icon: <DiamondRegular /> },
          ]}
        />
      </div>
      <TabsContent
        value="figures"
        className="min-h-0 flex-1 overflow-y-auto p-3"
      >
        <nav aria-label="Figures" className="space-y-4">
          {figures.map((figure, index) => (
            <button
              key={figure.id}
              type="button"
              aria-pressed={figure.id === figureId}
              onClick={() => onSelectFigure(figure.id)}
              className="group block w-full text-left"
            >
              <div
                className={cn(
                  "flex aspect-[4/3] items-center justify-center overflow-hidden rounded-sm border bg-white p-2",
                  figure.id === figureId
                    ? "border-accent ring-1 ring-accent"
                    : "border-border group-hover:border-accent",
                )}
              >
                <img
                  src={exportUrl("svg", figure.revision, false, figure.id)}
                  alt=""
                  className="max-h-full max-w-full object-contain"
                  loading="lazy"
                />
              </div>
              <div className="mt-1.5 flex gap-2 text-label">
                <span className="text-muted-foreground">{index + 1}</span>
                <span className="truncate">{figure.title}</span>
              </div>
            </button>
          ))}
          {!figures.length && (
            <p className="text-label text-muted-foreground">
              Add a figure with <code>molplot serve plot.py</code> in your
              terminal.
            </p>
          )}
        </nav>
      </TabsContent>
      <TabsContent value="elements" className="min-h-0 flex-1 overflow-hidden">
        <ElementsPanel
          result={result}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      </TabsContent>
    </Tabs>
  );
}
