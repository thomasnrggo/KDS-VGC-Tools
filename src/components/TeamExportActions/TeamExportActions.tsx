"use client";

import { Button } from "../Button";
import { Icon } from "../Icon";
import { IconName } from "@/enums";
import { useMessages } from "@/hooks/useLanguage";
import { copyTeamExport } from "@/lib/teamExport";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import type { ParsedPokemon, TeamSheetMode } from "@/types";

interface TeamExportActionsProps {
  pokemon: ParsedPokemon[];
  /** "open" leaves EVs and Nature out of the copied text (see formatPokemonPaste). */
  sheet?: TeamSheetMode;
  /** Omit to hide "Add to my teams" — on your own team, where it'd only make a duplicate. */
  onAddToMyTeams?: () => void;
  /** "Add to my teams"'s label and hint, when it copies more than the team — a shared report's "Add everything". */
  addToMyTeamsText?: { label: string; hint: string };
  onAddToOpponents: () => void;
  /**
   * "bar": centered under the cards, full width on phones (a shared report).
   * "inline": smaller, in a row beside other actions (your team's Overview).
   */
  layout?: "bar" | "inline";
  /** More actions after these, in the same style (your team's Edit). */
  children?: ReactNode;
}

/**
 * The bar under a Team Report's cards — on the owner's page and a shared
 * link alike: copy the team as Showdown export text, save it in My Teams, or
 * add it to the Matchup Planner's opponents (not shown on your own team). Stacked full width on phones.
 */
export function TeamExportActions({
  pokemon,
  sheet = "closed",
  onAddToMyTeams,
  addToMyTeamsText,
  onAddToOpponents,
  layout = "bar",
  children,
}: TeamExportActionsProps) {
  const t = useMessages();
  const buttonClass = cn(
    "flex items-center justify-center gap-2",
    layout === "bar" ? "px-5 py-2.5" : "px-4 py-1.5 text-sm",
  );

  return (
    <div
      className={cn(
        "flex gap-2",
        layout === "bar" ? "flex-col sm:flex-row sm:justify-center" : "flex-wrap items-center",
      )}
    >
      <Button
        onClick={() => copyTeamExport(pokemon, sheet)}
        title={t.teamPage.copyTeamHint}
        className={buttonClass}
      >
        <Icon name={IconName.ContentCopy} size={18} />
        {t.teamPage.copyTeam}
      </Button>
      {onAddToMyTeams && (
        <Button
          variant="outline"
          onClick={onAddToMyTeams}
          title={addToMyTeamsText?.hint ?? t.teamPage.addToMyTeamsHint}
          className={buttonClass}
        >
          <Icon name={IconName.Add} size={18} />
          {addToMyTeamsText?.label ?? t.teamPage.addToMyTeams}
        </Button>
      )}
      <Button
        variant="outline"
        onClick={onAddToOpponents}
        title={t.teamPage.addToOpponentsHint}
        className={buttonClass}
      >
        <Icon name={IconName.PersonAdd} size={18} />
        {t.teamPage.addToOpponents}
      </Button>
      {children}
    </div>
  );
}
