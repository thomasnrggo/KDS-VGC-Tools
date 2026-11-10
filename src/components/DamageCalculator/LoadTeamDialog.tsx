"use client";

import { useState } from "react";
import { Modal, ModalActions, ModalDescription, ModalTitle } from "../Modal";
import { Button } from "../Button";
import { PokemonSprite } from "../PokemonSprite";
import { ItemIcon } from "../ItemIcon";
import { useGroups } from "@/hooks/useGroups";
import { useGroupOpponents } from "@/hooks/useGroupOpponents";
import { usePlannerSource, type PlannerSource } from "@/hooks/usePlannerSource";
import { useIsPhone } from "@/hooks/useIsPhone";
import { useMessages, usePokemonText } from "@/hooks/useLanguage";
import { foldForSearch, parseSearchTerms, pokemonMatchesQuery } from "@/lib/pokemonMatchesQuery";
import { tagsMatchQuery } from "@/lib/opponentTags";
import { hasStatPoints } from "@/lib/hasStatPoints";
import type { Opponent, ParsedPokemon, Team } from "@/types";
import { cn } from "@/lib/utils";

interface LoadTeamDialogProps {
  /** Your own opponents (the Matchup Planner's "My opponents"). */
  opponents: Opponent[];
  onLoad: (opponent: Opponent) => void;
  onClose: () => void;
  labelledBy: string;
}

/**
 * The Damage Calculator's "Load Team": a saved opponent's roster onto a side.
 * Lists your own opponents or one of your prep groups' — starting on whichever
 * the Matchup Planner last showed — with a search (like the Opponents list's)
 * and a preview of each team, flagging teams that would load without Stat
 * Points. (The Attacker's version, for your own teams, is LoadMyTeamDialog.)
 */
export function LoadTeamDialog({ opponents, onLoad, onClose, labelledBy }: LoadTeamDialogProps) {
  const t = useMessages();
  const text = usePokemonText();
  const { activeGroups } = useGroups();
  const plannerSource = usePlannerSource();
  const [pickedSource, setPickedSource] = useState<PlannerSource | null>(null);
  const [query, setQuery] = useState("");

  // A group you've since left or archived falls back to your own list.
  const wanted = pickedSource ?? plannerSource;
  const group = activeGroups.find((g) => g.id === wanted) ?? null;
  const groupList = useGroupOpponents(group);
  const list = group ? groupList.opponents : opponents;
  const isLoadingGroup = !!group && groupList.isLoading;

  // Every term has to match the team's name, one of its Pokémon or items, or one of its tags.
  const terms = parseSearchTerms(query);
  const visible = list.filter((opponent) =>
    terms.every(
      (term) =>
        foldForSearch(opponent.label).includes(term) ||
        opponent.team.pokemon.some((mon) => pokemonMatchesQuery(mon, term, text)) ||
        tagsMatchQuery(opponent.tags, term),
    ),
  );

  const sources: Array<{ id: PlannerSource; label: string }> = [
    { id: "personal", label: t.groups.myOpponents },
    ...activeGroups.map((g) => ({ id: g.id, label: g.name })),
  ];

  return (
    <Modal onClose={onClose} labelledBy={labelledBy} fullScreenOnPhone>
      <ModalTitle id={labelledBy}>{t.calcPanel.loadTeam}</ModalTitle>
      <ModalDescription className="mb-3">{t.calcPanel.loadIntro}</ModalDescription>

      {sources.length > 1 && (
        <div
          role="radiogroup"
          aria-label={t.groups.switchList}
          className="mb-2 flex shrink-0 gap-1.5 overflow-x-auto pb-1"
        >
          {sources.map((source) => {
            const isSelected = source.id === (group ? group.id : "personal");
            return (
              <button
                key={source.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setPickedSource(source.id)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1 text-sm whitespace-nowrap transition-colors",
                  isSelected
                    ? "border-chrome-600 bg-chrome-600 font-medium text-white"
                    : "border-zinc-300 text-zinc-700 hover:bg-zinc-100",
                )}
              >
                {source.label}
              </button>
            );
          })}
        </div>
      )}

      <LoadableTeamList
        teams={visible.map((opponent) => ({
          id: opponent.id,
          label: opponent.label,
          pokemon: opponent.team.pokemon,
        }))}
        isEmpty={list.length === 0 && !isLoadingGroup}
        emptyText={group ? t.calcPanel.noGroupOpponents : t.calcPanel.noOpponents}
        isLoading={isLoadingGroup}
        noMatchesText={t.calcPanel.loadNoMatches}
        query={query}
        onQueryChange={setQuery}
        onPick={(id) => {
          const opponent = visible.find((o) => o.id === id);
          if (opponent) onLoad(opponent);
        }}
      />
      <ModalActions>
        <Button variant="outline" onClick={onClose}>
          {t.common.cancel}
        </Button>
      </ModalActions>
    </Modal>
  );
}

interface LoadMyTeamDialogProps {
  /** Your own (non-archived) teams, in the My Teams order. */
  teams: Team[];
  /** The header's active team — marked in the list. */
  activeTeamId: string | null;
  onLoad: (team: Team) => void;
  onClose: () => void;
  labelledBy: string;
}

/**
 * The Attacker's "Load Team": one of your own teams onto that side, with the
 * same search and preview as the opponents' dialog above.
 */
export function LoadMyTeamDialog({
  teams,
  activeTeamId,
  onLoad,
  onClose,
  labelledBy,
}: LoadMyTeamDialogProps) {
  const t = useMessages();
  const text = usePokemonText();
  const [query, setQuery] = useState("");

  const terms = parseSearchTerms(query);
  const visible = teams.filter((team) =>
    terms.every(
      (term) =>
        foldForSearch(team.name).includes(term) ||
        team.pokemon.some((mon) => pokemonMatchesQuery(mon, term, text)),
    ),
  );

  return (
    <Modal onClose={onClose} labelledBy={labelledBy} fullScreenOnPhone>
      <ModalTitle id={labelledBy}>{t.calcPanel.loadTeam}</ModalTitle>
      <ModalDescription className="mb-3">{t.calcPanel.loadMyTeamIntro}</ModalDescription>
      <LoadableTeamList
        teams={visible.map((team) => ({
          id: team.id,
          label: team.name,
          pokemon: team.pokemon,
          badge: team.id === activeTeamId ? t.calcPanel.activeTeam : undefined,
        }))}
        isEmpty={teams.length === 0}
        emptyText={t.calcPanel.noTeams}
        isLoading={false}
        noMatchesText={t.calcPanel.loadNoTeamMatches}
        searchPlaceholder={t.calcPanel.loadTeamSearch}
        query={query}
        onQueryChange={setQuery}
        onPick={(id) => {
          const team = visible.find((candidate) => candidate.id === id);
          if (team) onLoad(team);
        }}
      />
      <ModalActions>
        <Button variant="outline" onClick={onClose}>
          {t.common.cancel}
        </Button>
      </ModalActions>
    </Modal>
  );
}

interface LoadableTeamListProps {
  teams: Array<{ id: string; label: string; pokemon: ParsedPokemon[]; badge?: string }>;
  /** Nothing saved at all (rather than nothing matching the search). */
  isEmpty: boolean;
  emptyText: string;
  isLoading: boolean;
  noMatchesText: string;
  /** Defaults to the opponents' "Pokémon, item or tag". */
  searchPlaceholder?: string;
  query: string;
  onQueryChange: (query: string) => void;
  onPick: (id: string) => void;
}

/**
 * Both Load Team dialogs' search and team list: each team's name, a warning
 * when it would load without Stat Points, and its Pokémon at a glance.
 */
function LoadableTeamList({
  teams,
  isEmpty,
  emptyText,
  isLoading,
  noMatchesText,
  searchPlaceholder,
  query,
  onQueryChange,
  onPick,
}: LoadableTeamListProps) {
  const t = useMessages();
  const text = usePokemonText();
  const isPhone = useIsPhone();
  const placeholder = searchPlaceholder ?? t.calcPanel.loadSearch;

  if (isEmpty) return <p className="text-sm text-zinc-600">{emptyText}</p>;

  return (
    <>
      <input
        type="search"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        autoFocus={!isPhone}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        className="mb-2 w-full rounded-lg border border-zinc-300 bg-field px-3 py-2 text-sm text-zinc-900 focus:ring-2 focus:ring-zinc-400 focus:outline-none"
      />
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto sm:max-h-96">
        {isLoading && <p className="px-1 py-2 text-sm text-zinc-500">{t.common.loading}</p>}
        {!isLoading && teams.length === 0 && (
          <p className="px-1 py-2 text-sm text-zinc-500">{noMatchesText}</p>
        )}
        {teams.map((team) => {
          const withoutSp = team.pokemon.filter((mon) => !hasStatPoints(mon)).length;
          const spWarning =
            withoutSp === 0
              ? null
              : withoutSp === team.pokemon.length
                ? t.calcPanel.noStatPoints
                : t.calcPanel.someWithoutStatPoints(withoutSp);
          return (
            <button
              key={team.id}
              type="button"
              onClick={() => onPick(team.id)}
              className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-1.5 text-left hover:bg-zinc-100"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-sm font-medium text-zinc-900" title={team.label}>
                    {team.label}
                  </span>
                  {team.badge && (
                    <span className="shrink-0 rounded-full bg-zinc-200 px-1.5 py-0.5 text-[10px] font-medium text-zinc-700">
                      {team.badge}
                    </span>
                  )}
                </span>
                {/* The calc would treat these as 0 in every stat, so the numbers would be off. */}
                {spWarning && (
                  <span
                    className="truncate text-xs text-amber-700"
                    title={t.calcPanel.statPointsHint}
                  >
                    {spWarning}
                  </span>
                )}
              </span>
              {/* The team at a glance, on the same line as the name: each Pokémon with its item, a smaller take on the team bars' tiles. */}
              <span
                className="flex shrink-0 gap-1"
                aria-label={team.pokemon.map((mon) => text.species(mon.species)).join(", ")}
              >
                {team.pokemon.map((mon, index) => (
                  <span
                    key={index}
                    className="relative h-8 w-8 shrink-0 rounded-md bg-zinc-200/60 sm:h-9 sm:w-9"
                  >
                    <span className="absolute inset-0.5">
                      <PokemonSprite species={mon.species} item={mon.item} fill />
                    </span>
                    {mon.item && (
                      <span className="absolute -right-1 -bottom-1">
                        <ItemIcon item={mon.item} size={14} />
                      </span>
                    )}
                  </span>
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
