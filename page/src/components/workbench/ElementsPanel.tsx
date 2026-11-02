import type { JSX } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { HostResult } from "@/lib/host";
import { nodeTitle, walk } from "@/lib/scene";
import { cn } from "@/lib/utils";

export function ElementsPanel({
  result,
  selectedId,
  onSelect,
}: {
  result: HostResult | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
}): JSX.Element {
  if (!result) {
    return (
      <EmptyState
        density="compact"
        title="No scene"
        description="The host has not reflected a figure yet."
      />
    );
  }

  return (
    <ScrollArea className="h-full">
      <nav aria-label="Scene" className="flex flex-col p-1">
        {walk(result.scene.root).map(({ node, depth }) => {
          const selected = node.id === selectedId;
          return (
            <button
              key={node.id}
              type="button"
              onClick={() => onSelect(node.id)}
              style={{ paddingLeft: 8 + depth * 12 }}
              className={cn(
                "flex h-7 items-center gap-2 rounded-control pr-2 text-left text-label",
                selected
                  ? "bg-accent-soft text-foreground"
                  : "text-foreground hover:bg-interactive",
              )}
            >
              <span className="w-14 shrink-0 text-micro text-muted-foreground">
                {node.role}
              </span>
              <span className="min-w-0 truncate">{nodeTitle(node)}</span>
            </button>
          );
        })}
      </nav>
    </ScrollArea>
  );
}
