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
import type { Opponent } from "@/types";
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
 * Points.
 */
export function LoadTeamDialog({ opponents, onLoad, onClose, labelledBy }: LoadTeamDialogProps) {
  const t = useMessages();
  const text = usePokemonText();
  const isPhone = useIsPhone();
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

      {list.length === 0 && !isLoadingGroup ? (
        <p className="text-sm text-zinc-600">
          {group ? t.calcPanel.noGroupOpponents : t.calcPanel.noOpponents}
        </p>
      ) : (
        <>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.calcPanel.loadSearch}
            aria-label={t.calcPanel.loadSearch}
            autoFocus={!isPhone}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className="mb-2 w-full rounded-lg border border-zinc-300 bg-field px-3 py-2 text-sm text-zinc-900 focus:ring-2 focus:ring-zinc-400 focus:outline-none"
          />
          <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto sm:max-h-96">
            {isLoadingGroup && (
              <p className="px-1 py-2 text-sm text-zinc-500">{t.common.loading}</p>
            )}
            {!isLoadingGroup && visible.length === 0 && (
              <p className="px-1 py-2 text-sm text-zinc-500">{t.calcPanel.loadNoMatches}</p>
            )}
            {visible.map((opponent) => {
              const withoutSp = opponent.team.pokemon.filter((mon) => !hasStatPoints(mon)).length;
              const spWarning =
                withoutSp === 0
                  ? null
                  : withoutSp === opponent.team.pokemon.length
                    ? t.calcPanel.noStatPoints
                    : t.calcPanel.someWithoutStatPoints(withoutSp);
              return (
                <button
                  key={opponent.id}
                  type="button"
                  onClick={() => onLoad(opponent)}
                  className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-1.5 text-left hover:bg-zinc-100"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span
                      className="truncate text-sm font-medium text-zinc-900"
                      title={opponent.label}
                    >
                      {opponent.label}
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
                    aria-label={opponent.team.pokemon
                      .map((mon) => text.species(mon.species))
                      .join(", ")}
                  >
                    {opponent.team.pokemon.map((mon, index) => (
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
      )}
      <ModalActions>
        <Button variant="outline" onClick={onClose}>
          {t.common.cancel}
        </Button>
      </ModalActions>
    </Modal>
  );
}
