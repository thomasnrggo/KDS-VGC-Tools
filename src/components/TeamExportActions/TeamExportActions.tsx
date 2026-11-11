"use client";

import { Button } from "../Button";
import { Icon } from "../Icon";
import { IconName } from "@/enums";
import { useMessages } from "@/hooks/useLanguage";
import { copyTeamExport } from "@/lib/teamExport";
import type { ParsedPokemon, TeamSheetMode } from "@/types";

interface TeamExportActionsProps {
  pokemon: ParsedPokemon[];
  /** "open" leaves EVs and Nature out of the copied text (see formatPokemonPaste). */
  sheet?: TeamSheetMode;
  /** Omit to hide "Add to my teams" — on your own team, where it'd only make a duplicate. */
  onAddToMyTeams?: () => void;
  onAddToOpponents: () => void;
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
  onAddToOpponents,
}: TeamExportActionsProps) {
  const t = useMessages();
  const buttonClass = "flex items-center justify-center gap-2 px-5 py-2.5";

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
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
          title={t.teamPage.addToMyTeamsHint}
          className={buttonClass}
        >
          <Icon name={IconName.Add} size={18} />
          {t.teamPage.addToMyTeams}
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
    </div>
  );
}
