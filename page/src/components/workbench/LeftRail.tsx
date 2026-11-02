import { Database, Diamond, Palette } from "lucide-react";
import type { JSX } from "react";
import { PanelTabStrip } from "@/components/blocks/panel-tab-strip";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { DataPanel, type DatumRef } from "@/components/workbench/DataPanel";
import { ElementsPanel } from "@/components/workbench/ElementsPanel";
import { PresetPanel } from "@/components/workbench/PresetPanel";
import type { HostResult, StyleCommand } from "@/lib/host";

export type LeftTab = "data" | "elements" | "preset";

export function LeftRail({
  tab,
  onTabChange,
  result,
  selectedId,
  highlighted,
  applying,
  error,
  onSelect,
  onHighlight,
  onApplyStyle,
}: {
  tab: LeftTab;
  onTabChange: (tab: LeftTab) => void;
  result: HostResult | null;
  selectedId: string | null;
  highlighted: DatumRef | null;
  applying: boolean;
  error: string | null;
  onSelect: (id: string) => void;
  onHighlight: (datum: DatumRef | null) => void;
  onApplyStyle: (command: StyleCommand) => Promise<boolean>;
}): JSX.Element {
  return (
    <Tabs
      value={tab}
      onValueChange={(value) => onTabChange(value as LeftTab)}
      className="flex h-full min-h-0 flex-col gap-0"
    >
      <div className="flex h-7 shrink-0 items-center border-b border-border">
        <PanelTabStrip
          label="Data, elements, or preset"
          items={[
            { value: "data", label: "Data", icon: <Database /> },
            { value: "elements", label: "Elements", icon: <Diamond /> },
            { value: "preset", label: "Preset", icon: <Palette /> },
          ]}
        />
      </div>
      <TabsContent
        value="data"
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <DataPanel
          result={result}
          selectedId={selectedId}
          highlighted={highlighted}
          onSelect={onSelect}
          onHighlight={onHighlight}
        />
      </TabsContent>
      <TabsContent value="elements" className="min-h-0 overflow-hidden">
        <ElementsPanel
          result={result}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      </TabsContent>
      <TabsContent
        value="preset"
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <PresetPanel
          result={result}
          applying={applying}
          error={error}
          onApplyStyle={onApplyStyle}
        />
      </TabsContent>
    </Tabs>
  );
}
