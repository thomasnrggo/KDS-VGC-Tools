"use client";

import { useState } from "react";
import { useOpponents } from "@/hooks/useOpponents";
import type { ParsedPokemon } from "@/lib/parseTeam";
import { OpponentForm } from "./OpponentForm";
import { OpponentCard } from "./OpponentCard";

interface OpponentsSectionProps {
  myTeamPokemon: ParsedPokemon[];
  hasMyTeam: boolean;
}

export function OpponentsSection({ myTeamPokemon, hasMyTeam }: OpponentsSectionProps) {
  const { opponents, isLoading, addOpponent, removeOpponent, updateOpponent, editOpponentTeam } =
    useOpponents();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  function handleSubmit(label: string, rawPaste: string, pokepasteUrl: string) {
    const result = addOpponent(label, rawPaste, pokepasteUrl);
    if (typeof result === "string") {
      return result;
    }
    setIsAdding(false);
    return null;
  }

  function startAdding() {
    setEditingId(null);
    setIsAdding(true);
  }

  function startEditing(id: string) {
    setIsAdding(false);
    setEditingId(id);
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Opponents</h2>
        {!isAdding && (
          <button
            type="button"
            onClick={startAdding}
            className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            Add opponent
          </button>
        )}
      </div>

      {isAdding && <OpponentForm onSubmit={handleSubmit} onCancel={() => setIsAdding(false)} />}

      {isLoading ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
      ) : opponents.length === 0 && !isAdding ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No opponents yet. Add one to start planning matchups.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {opponents.map((opponent) =>
            editingId === opponent.id ? (
              <li key={opponent.id}>
                <OpponentForm
                  initialLabel={opponent.label}
                  initialPokepasteUrl={opponent.pokepasteUrl ?? ""}
                  initialRawPaste={opponent.team.rawPaste}
                  submitLabel="Save changes"
                  onSubmit={(label, rawPaste, pokepasteUrl) => {
                    const result = editOpponentTeam(opponent.id, label, rawPaste, pokepasteUrl);
                    if (result) {
                      return result;
                    }
                    setEditingId(null);
                    return null;
                  }}
                  onCancel={() => setEditingId(null)}
                />
              </li>
            ) : (
              <OpponentCard
                key={opponent.id}
                opponent={opponent}
                myTeamPokemon={myTeamPokemon}
                hasMyTeam={hasMyTeam}
                onEdit={() => startEditing(opponent.id)}
                onRemove={() => removeOpponent(opponent.id)}
                onUpdate={(updater) => updateOpponent(opponent.id, updater)}
              />
            ),
          )}
        </ul>
      )}
    </section>
  );
}
