import { Download, Redo2, Scan, Table2, Undo2 } from "lucide-react";
import type { JSX } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EXPORT_FORMATS, type ExportFormat } from "@/lib/host";

export function PlotToolbar({
  grid,
  onToggleGrid,
  onFit,
  onExport,
}: {
  grid: boolean;
  onToggleGrid: () => void;
  onFit: () => void;
  onExport: (fmt: ExportFormat) => void;
}): JSX.Element {
  return (
    <>
      <IconButton icon={<Undo2 />} label="Undo" disabled />
      <IconButton icon={<Redo2 />} label="Redo" disabled />
      <Separator orientation="vertical" className="mx-1 h-5" />
      <IconButton icon={<Scan />} label="Fit canvas" onClick={onFit} />
      <IconButton
        icon={<Table2 />}
        label="Canvas grid"
        selected={grid}
        onClick={onToggleGrid}
      />
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Export"
                className="size-control-compact border-0 shadow-none [&_svg]:size-4"
              >
                <Download />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Export</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end">
          {EXPORT_FORMATS.map((fmt) => (
            <DropdownMenuItem key={fmt} onSelect={() => onExport(fmt)}>
              {fmt.toUpperCase()}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
