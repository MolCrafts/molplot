import { type JSX, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatScience } from "@/lib/format";
import type { Dataset, HostResult } from "@/lib/host";
import { cn } from "@/lib/utils";

export interface DatumRef {
  nodeId: string;
  index: number;
}

export function DataPanel({
  result,
  selectedId,
  highlighted,
  onSelect,
  onHighlight,
}: {
  result: HostResult | null;
  selectedId: string | null;
  highlighted: DatumRef | null;
  onSelect: (id: string) => void;
  onHighlight: (datum: DatumRef | null) => void;
}): JSX.Element {
  const datasets = result?.datasets ?? [];
  const [picked, setPicked] = useState<string | null>(null);
  const activeId =
    (picked && datasets.some((item) => item.nodeId === picked)
      ? picked
      : null) ??
    (selectedId && datasets.some((item) => item.nodeId === selectedId)
      ? selectedId
      : null) ??
    datasets[0]?.nodeId ??
    null;
  const active = datasets.find((item) => item.nodeId === activeId);

  if (!result) {
    return (
      <EmptyState
        density="compact"
        title="No figure loaded"
        description="Open a script with molplot serve."
      />
    );
  }
  if (!active) {
    return <EmptyState density="compact" title="No series data" />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 p-2">
        <Select
          value={active.nodeId}
          onValueChange={(value) => {
            setPicked(value);
            onSelect(value);
            onHighlight(null);
          }}
        >
          <SelectTrigger
            size="sm"
            aria-label="Dataset"
            className="h-control-compact w-full bg-surface"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {datasets.map((dataset) => (
              <SelectItem key={dataset.nodeId} value={dataset.nodeId}>
                {dataset.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <DataList
        dataset={active}
        highlighted={highlighted}
        onHighlight={onHighlight}
        onSelect={onSelect}
      />
    </div>
  );
}

function DataList({
  dataset,
  highlighted,
  onHighlight,
  onSelect,
}: {
  dataset: Dataset;
  highlighted: DatumRef | null;
  onHighlight: (datum: DatumRef | null) => void;
  onSelect: (id: string) => void;
}): JSX.Element {
  const columns = dataset.columns;
  const rowCount = columns[0]?.values.length ?? 0;
  return (
    <div className="min-h-0 flex-1 overflow-auto border-t border-border">
      <table className="w-full border-collapse text-micro">
        <thead className="sticky top-0 z-10 bg-surface">
          <tr className="text-muted-foreground">
            <th className="px-2 py-1 text-left font-medium">#</th>
            {columns.map((column) => (
              <th key={column.name} className="px-2 py-1 text-left font-medium">
                {column.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rowCount }, (_, row) => {
            const active =
              highlighted?.nodeId === dataset.nodeId &&
              highlighted.index === row;
            return (
              <tr
                key={`${dataset.nodeId}:${columns[0]?.values[row]}:${columns[1]?.values[row]}`}
                className={cn(
                  "cursor-pointer",
                  active
                    ? "bg-accent-soft"
                    : row % 2 === 0
                      ? "bg-background hover:bg-interactive"
                      : "bg-paper hover:bg-interactive",
                )}
                onClick={() => {
                  onSelect(dataset.nodeId);
                  onHighlight({ nodeId: dataset.nodeId, index: row });
                }}
              >
                <td className="px-2 py-1 font-mono text-muted-foreground">
                  {row + 1}
                </td>
                {columns.map((column) => (
                  <td
                    key={column.name}
                    className={cn(
                      "px-2 py-1 font-mono",
                      active ? "text-accent" : "",
                    )}
                  >
                    {formatCell(column.values[row])}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function formatCell(value: number | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return formatScience(value);
}
