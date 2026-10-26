"use client";

import { Group, Ungroup } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { useMessages } from "@/hooks/useLanguage";
import { cn } from "@/lib/utils";

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
  const t = useMessages();
  return (
    <div role="tablist" aria-label={t.groupMode.label} className={cn("flex gap-1.5", className)}>
      <Tooltip>
        <TooltipTrigger
          type="button"
          role="tab"
          aria-selected={grouped}
          aria-label={t.groupMode.grouped}
          onClick={() => onChange(true)}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full transition-colors",
            grouped ? "bg-chrome-600 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200",
          )}
        >
          <Group size={18} aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent>{t.groupMode.grouped}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          type="button"
          role="tab"
          aria-selected={!grouped}
          aria-label={t.groupMode.byPokemon}
          onClick={() => onChange(false)}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full transition-colors",
            !grouped ? "bg-chrome-600 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200",
          )}
        >
          <Ungroup size={18} aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent>{t.groupMode.byPokemon}</TooltipContent>
      </Tooltip>
    </div>
  );
}
