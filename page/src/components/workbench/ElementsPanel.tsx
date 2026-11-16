import type { Node } from "@molcrafts/molplot/semantic";
import { EmptyState, ScrollArea } from "@molcrafts/ui";
import { useEffect, useState } from "react";
import type { HostResult } from "@/lib/host";
import { nodePath, nodeTitle } from "@/lib/scene";
import { cn } from "@/lib/utils";

export function ElementsPanel({
  result,
  selectedId,
  onSelect,
}: {
  result: HostResult | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (!result)
    return (
      <EmptyState
        density="compact"
        title="No scene"
        description="Select a figure to inspect its elements."
      />
    );
  const path = selectedId
    ? nodePath(result.scene.root, selectedId).map((node) => node.id)
    : [];
  return (
    <ScrollArea className="h-full">
      <nav aria-label="Scene" className="p-1">
        <ElementBranch
          node={result.scene.root}
          depth={0}
          selectedId={selectedId}
          path={path}
          onSelect={onSelect}
        />
      </nav>
    </ScrollArea>
  );
}

function ElementBranch({
  node,
  depth,
  selectedId,
  path,
  onSelect,
}: {
  node: Node;
  depth: number;
  selectedId: string | null;
  path: string[];
  onSelect: (id: string) => void;
}) {
  const reveal = path.includes(node.id);
  const [open, setOpen] = useState(depth === 0 || reveal);
  useEffect(() => {
    if (reveal) setOpen(true);
  }, [reveal]);
  return (
    <div>
      <div
        className={cn(
          "flex h-8 items-center rounded-sm text-label",
          node.id === selectedId ? "bg-accent-soft" : "hover:bg-interactive",
        )}
        style={{ paddingLeft: 4 + depth * 12 }}
      >
        {node.children.length ? (
          <button
            type="button"
            aria-label={`${open ? "Collapse" : "Expand"} ${nodeTitle(node)}`}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="h-7 w-5 shrink-0 text-muted-foreground"
          >
            {open ? "▾" : "▸"}
          </button>
        ) : (
          <span className="w-5 shrink-0" />
        )}
        <button
          type="button"
          aria-pressed={node.id === selectedId}
          onClick={() => onSelect(node.id)}
          className="flex h-full min-w-0 flex-1 items-center gap-2 pr-2 text-left"
        >
          <span className="shrink-0 text-micro text-muted-foreground">
            {node.role}
          </span>
          <span className="truncate">{nodeTitle(node)}</span>
        </button>
      </div>
      {open &&
        node.children.map((child) => (
          <ElementBranch
            key={child.id}
            node={child}
            depth={depth + 1}
            selectedId={selectedId}
            path={path}
            onSelect={onSelect}
          />
        ))}
    </div>
  );
}
