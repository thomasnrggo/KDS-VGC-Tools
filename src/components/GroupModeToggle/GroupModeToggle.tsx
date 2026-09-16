"use client";

import { Group, Ungroup } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

interface GroupModeToggleProps {
  grouped: boolean;
  onChange: (grouped: boolean) => void;
  className?: string;
}

/**
 * Icon-only toggle between merging Pokémon tied on the same Speed value into
 * one row ("Grouped") and giving every Pokémon its own row with its name
 * shown ("By Pokémon"). Icon-only to stay compact next to the search field —
 * each button's label lives in its tooltip instead of on the button itself.
 */
export function GroupModeToggle({ grouped, onChange, className = "" }: GroupModeToggleProps) {
  return (
    <div role="tablist" aria-label="Row grouping" className={`flex gap-1.5 ${className}`}>
      <Tooltip>
        <TooltipTrigger
          type="button"
          role="tab"
          aria-selected={grouped}
          aria-label="Grouped"
          onClick={() => onChange(true)}
          className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
            grouped ? "bg-zinc-600 dark:bg-zinc-400 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
          }`}
        >
          <Group size={18} aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent>Grouped</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          type="button"
          role="tab"
          aria-selected={!grouped}
          aria-label="By Pokémon"
          onClick={() => onChange(false)}
          className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
            !grouped ? "bg-zinc-600 dark:bg-zinc-400 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
          }`}
        >
          <Ungroup size={18} aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent>By Pokémon</TooltipContent>
      </Tooltip>
    </div>
  );
}
