import {
  ArrowAutofitContentRegular,
  ArrowDownloadRegular,
  ArrowRedoRegular,
  ArrowUndoRegular,
  GridRegular,
} from "@fluentui/react-icons";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Separator,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@molcrafts/ui";
import type { JSX } from "react";
import { IconButton } from "@/components/ui/icon-button";
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
      <IconButton icon={<ArrowUndoRegular />} label="Undo" disabled />
      <IconButton icon={<ArrowRedoRegular />} label="Redo" disabled />
      <Separator orientation="vertical" className="mx-1 h-5" />
      <IconButton
        icon={<ArrowAutofitContentRegular />}
        label="Fit canvas"
        onClick={onFit}
      />
      <IconButton
        icon={<GridRegular />}
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
                <ArrowDownloadRegular />
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
