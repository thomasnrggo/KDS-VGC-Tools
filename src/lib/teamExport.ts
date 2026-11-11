import { toast } from "@/components/Toast";
import { getMessages } from "@/lib/i18n/settings";
import { formatPokemonPaste, formatTeamPaste } from "./formatPokemonPaste";
import { createOpponent } from "./opponent";
import { createTeam, validateTeamSize } from "./team";
import { parseTeam } from "./parseTeam";
import { teamFingerprint } from "./teamIdentity";
import type { Opponent, ParsedPokemon, SharedTeam, Team, TeamSheetMode } from "@/types";

/**
 * Copies one Pokémon's Showdown export to the clipboard and toasts the
 * result — the Team Report cards' copy button, on the owner's page and the
 * shared link alike. `name` is the (localized) species name for the toast.
 */
export async function copyPokemonExport(
  pokemon: ParsedPokemon,
  name: string,
  sheet: TeamSheetMode = "closed",
): Promise<void> {
  const t = getMessages();
  try {
    await navigator.clipboard.writeText(formatPokemonPaste(pokemon, { sheet }));
    toast.success(t.calcPanel.copied(name));
  } catch {
    toast.error(t.calcPanel.copyFailed);
  }
}

/** Copies a whole team's Showdown export (same as copyPokemonExport, for the Team Report's "Copy team"). */
export async function copyTeamExport(
  pokemon: ParsedPokemon[],
  sheet: TeamSheetMode = "closed",
): Promise<void> {
  const t = getMessages();
  try {
    await navigator.clipboard.writeText(formatTeamPaste(pokemon, { sheet }));
    toast.success(t.calcPanel.copiedTeam(pokemon.length));
  } catch {
    toast.error(t.calcPanel.copyFailed);
  }
}

/**
 * Adds `paste` to the Matchup Planner's opponents under `regulationId` — the
 * Team Report's "Add to opponents". Toasts instead when the same team
 * (teamFingerprint) is already an opponent there, so a second tap doesn't make a duplicate.
 */
export function addPasteToOpponents({
  name,
  paste,
  regulationId,
  pokepasteUrl,
  opponents,
  addOpponents,
}: {
  name: string;
  paste: string;
  regulationId: string;
  pokepasteUrl?: string;
  opponents: Opponent[];
  addOpponents: (opponents: Opponent[]) => void;
}): void {
  const t = getMessages();
  const trimmed = paste.trim();
  // Same test as the Matchup Planner's import (analyzeImport): the same
  // Pokémon, items and moves, whatever the slot order, nicknames or EVs.
  const fingerprint = teamFingerprint(parseTeam(trimmed));
  const existing = opponents.find(
    (opponent) =>
      opponent.regulationId === regulationId &&
      teamFingerprint(opponent.team.pokemon) === fingerprint,
  );
  if (existing) {
    toast.info(t.teamPage.alreadyInOpponents(existing.label));
    return;
  }
  addOpponents([createOpponent(name, trimmed, regulationId, pokepasteUrl)]);
  toast.success(t.teamPage.addedToOpponents(name));
}

/**
 * Saves a shared team as a new team of mine — the shared report's "Add to
 * my teams". Keeps its post details (creator, links, overview); toasts
 * instead when one of my teams already has the same paste.
 */
export function addSharedTeamToMyTeams({
  shared,
  regulationId,
  myTeams,
  addTeam,
}: {
  shared: SharedTeam;
  regulationId: string;
  myTeams: Team[];
  addTeam: (team: Team) => void;
}): void {
  const t = getMessages();
  const paste = formatTeamPaste(shared.pokemon, { sheet: shared.sheet });
  const existing = myTeams.find((mine) => mine.rawPaste === paste);
  if (existing) {
    toast.info(t.teamPage.alreadyInMyTeams(existing.name));
    return;
  }
  const team: Team = {
    ...createTeam(paste, shared.name, regulationId),
    creator: shared.creator,
    pokepasteUrl: shared.pokepasteUrl,
    replicaCode: shared.replicaCode,
    overview: shared.overview,
  };
  const sizeError = validateTeamSize(team.pokemon);
  if (sizeError) {
    toast.error(sizeError);
    return;
  }
  addTeam(team);
  toast.success(t.teamPage.addedToMyTeams(shared.name));
}
