import type * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type BaseButtonProps = Omit<
  React.ComponentProps<typeof Button>,
  "variant" | "size" | "children" | "aria-label" | "title" | "aria-pressed"
>;

export interface IconButtonProps extends BaseButtonProps {
  /** Lucide (or equivalent) glyph. Never text. */
  icon: React.ReactNode;
  /** Accessible name and tooltip. Required — icon-only controls have no visible label. */
  label: string;
  selected?: boolean;
  tooltipSide?: React.ComponentProps<typeof TooltipContent>["side"];
}

/**
 * Shared chrome control: icon-only, no border, compact 28px hit target.
 *
 * Toolbar, panel headers, and rails MUST use this — never a labeled or
 * outlined `Button`. Selected state is a fill, not a stroke.
 */
export function IconButton({
  icon,
  label,
  selected,
  tooltipSide = "bottom",
  className,
  ...props
}: IconButtonProps): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={selected ? "secondary" : "ghost"}
          size="icon-sm"
          aria-label={label}
          aria-pressed={selected === undefined ? undefined : selected}
          className={cn(
            "size-control-compact border-0 shadow-none [&_svg]:size-4",
            className,
          )}
          {...props}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side={tooltipSide}>{label}</TooltipContent>
    </Tooltip>
  );
}
