"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useMyTeams } from "@/hooks/useMyTeams";
import { useAuth } from "@/hooks/useAuth";
import { MAX_TOTAL_STAT_POINTS } from "@/lib/stats/calculateFinalStats";
import { MyTeamHeader } from "@/components/MyTeamHeader";
import { PokemonEditor } from "@/components/PokemonEditor";
import { PokemonSprite } from "@/components/PokemonSprite";
import { ItemIcon } from "@/components/ItemIcon";
import { Icon } from "@/components/Icon";
import { IconName } from "@/enums";
import { applyStatOverrides, type StatOverrides } from "@/lib/stats/applyStatOverrides";
import { formatTeamPaste } from "@/lib/formatPokemonPaste";
import { REGULATIONS } from "@/data/regulations";
import type { ParsedPokemon } from "@/types";
import { cn } from "@/lib/utils";

interface TeamBuilderDetailPageProps {
  params: Promise<{ teamId: string }>;
}

const MAX_SLOTS = 6;

/** The Team Builder edits a Pokémon's Stat Points/nature directly and permanently (unlike the Damage Calculator's `statOverrides`, a theorycraft layer kept separate from the saved team) — always passed empty so PokemonEditor's stat table shows the pokemon's own real values, and every edit is applied immediately via `applyStatOverrides` + saved back, not accumulated here. */
const EMPTY_STAT_OVERRIDES: StatOverrides = {};

export default function TeamBuilderDetailPage({ params }: TeamBuilderDetailPageProps) {
  const { teamId } = use(params);
  const {
    activeTeams,
    activeTeamId,
    isLoading,
    addTeam,
    editTeam,
    removeTeam,
    setActiveTeamId,
    updateTeam,
    teams,
  } = useMyTeams();
  const { user, isLoading: isAuthLoading, signInWithGoogle, signOut } = useAuth();
  const [selectedIndex, setSelectedIndex] = useState(0);

  const team = teams.find((t) => t.id === teamId) ?? null;
  const pokemonList = team?.pokemon ?? [];
  // Never more than one slot past the roster's current end — you can only
  // ever be adding "the next" Pokémon, not one further out (see the slot
  // grid below, which only makes the very next empty slot clickable).
  const clampedIndex = Math.min(selectedIndex, pokemonList.length);
  const selectedPokemon = clampedIndex < pokemonList.length ? pokemonList[clampedIndex] : null;

  function saveSlot(index: number, updated: ParsedPokemon) {
    updateTeam(teamId, (t) => {
      const nextPokemon = [...t.pokemon];
      nextPokemon[index] = updated;
      return { ...t, pokemon: nextPokemon, rawPaste: formatTeamPaste(nextPokemon) };
    });
  }

  function appendSlot(newPokemon: ParsedPokemon) {
    updateTeam(teamId, (t) => {
      const nextPokemon = [...t.pokemon, newPokemon];
      return { ...t, pokemon: nextPokemon, rawPaste: formatTeamPaste(nextPokemon) };
    });
    setSelectedIndex(pokemonList.length);
  }

  function handleSpeciesChange(newPokemon: ParsedPokemon) {
    if (clampedIndex < pokemonList.length) {
      saveSlot(clampedIndex, newPokemon);
    } else {
      appendSlot(newPokemon);
    }
  }

  function handleAbilityChange(ability: string) {
    if (!selectedPokemon) return;
    saveSlot(clampedIndex, { ...selectedPokemon, ability });
  }

  function handleItemChange(item: string | undefined) {
    if (!selectedPokemon) return;
    saveSlot(clampedIndex, { ...selectedPokemon, item });
  }

  function handleMovesChange(moves: string[]) {
    if (!selectedPokemon) return;
    saveSlot(clampedIndex, { ...selectedPokemon, moves });
  }

  function handleStatOverridesChange(overrides: StatOverrides) {
    if (!selectedPokemon) return;
    saveSlot(clampedIndex, applyStatOverrides(selectedPokemon, overrides));
  }

  return (
    <div className="flex flex-1 flex-col">
      <MyTeamHeader
        teams={activeTeams}
        activeTeamId={activeTeamId}
        isLoading={isLoading}
        addTeam={addTeam}
        editTeam={editTeam}
        removeTeam={removeTeam}
        setActiveTeamId={setActiveTeamId}
        currentPage="team-builder"
        selectedRegulationId={team?.regulationIds[0] ?? REGULATIONS[0]?.id ?? ""}
        authUser={user}
        isAuthLoading={isAuthLoading}
        onSignIn={signInWithGoogle}
        onSignOut={signOut}
      />

      {isLoading ? (
        <p className="p-6 text-sm text-zinc-500">Loading…</p>
      ) : !team ? (
        <div className="flex flex-col items-center gap-3 p-14 text-center">
          <p className="text-lg font-semibold text-zinc-900">Team not found</p>
          <p className="text-sm text-zinc-600">It may have been removed on another device.</p>
          <Link href="/team-builder" className="text-sm font-medium text-zinc-600 hover:underline">
            ← Back to Team Builder
          </Link>
        </div>
      ) : (
        <div className="flex w-full flex-col gap-6 px-3 py-4 sm:p-6">
          <div className="flex items-center gap-2">
            <Link
              href="/team-builder"
              aria-label="Back to Team Builder"
              title="Back to Team Builder"
              className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
            >
              <Icon name={IconName.ExpandMore} size={20} className="rotate-90" />
            </Link>
            <h2 className="truncate text-xl font-semibold text-zinc-900">{team.name}</h2>
            <span className="shrink-0 text-xs text-zinc-500">
              {pokemonList.length}/{MAX_SLOTS} Pokémon
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {pokemonList.map((mon, index) => {
              const isSelected = clampedIndex === index;
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => setSelectedIndex(index)}
                  title={mon.item ? `${mon.species} @ ${mon.item}` : mon.species}
                  className={cn(
                    "relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 bg-zinc-50 transition-colors",
                    isSelected ? "border-zinc-600" : "border-transparent hover:border-zinc-300",
                  )}
                >
                  <PokemonSprite species={mon.species} item={mon.item} fill />
                  {mon.item && (
                    <span className="absolute -right-1 -bottom-1">
                      <ItemIcon item={mon.item} size={16} />
                    </span>
                  )}
                </button>
              );
            })}
            {pokemonList.length < MAX_SLOTS && (
              <button
                type="button"
                onClick={() => setSelectedIndex(pokemonList.length)}
                aria-label="Add Pokémon"
                title="Add Pokémon"
                className={cn(
                  "flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border-2 border-dashed transition-colors",
                  clampedIndex === pokemonList.length
                    ? "border-zinc-600 text-zinc-700"
                    : "border-zinc-300 text-zinc-400 hover:border-zinc-400 hover:text-zinc-600",
                )}
              >
                <Icon name={IconName.Add} size={20} />
              </button>
            )}
          </div>

          <div className="w-full max-w-6xl rounded-lg border border-zinc-200 p-4">
            <p className="mb-3 text-xs font-medium text-zinc-500">
              Regulation: {REGULATIONS[0].label}
            </p>
            <PokemonEditor
              title={selectedPokemon ? selectedPokemon.species : `Slot ${clampedIndex + 1}`}
              pokemon={selectedPokemon}
              onSpeciesChange={handleSpeciesChange}
              statOverrides={EMPTY_STAT_OVERRIDES}
              onStatOverridesChange={handleStatOverridesChange}
              onAbilityChange={handleAbilityChange}
              onItemChange={handleItemChange}
              onMovesChange={handleMovesChange}
              maxTotalStatPoints={MAX_TOTAL_STAT_POINTS}
              layout="columns"
            />
          </div>
        </div>
      )}
    </div>
  );
}
