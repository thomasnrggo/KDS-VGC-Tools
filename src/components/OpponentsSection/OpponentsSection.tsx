"use client";

import { useState } from "react";
import { useOpponents } from "@/hooks/useOpponents";
import type { ParsedPokemon, TeamFolderEntry } from "@/types";
import { OpponentForm } from "../OpponentForm";
import { OpponentCard } from "../OpponentCard";
import { BulkImportForm } from "../BulkImportForm";

interface OpponentsSectionProps {
  myTeamPokemon: ParsedPokemon[];
  activeTeamId: string | null;
}

export function OpponentsSection({ myTeamPokemon, activeTeamId }: OpponentsSectionProps) {
  const {
    opponents,
    isLoading,
    addOpponent,
    addOpponentsFromFolder,
    removeOpponent,
    updateOpponentPlan,
    editOpponentTeam,
  } = useOpponents();
  const [isAdding, setIsAdding] = useState(false);
  const [isBulkImporting, setIsBulkImporting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  function handleSubmit(label: string, rawPaste: string, pokepasteUrl: string) {
    const result = addOpponent(label, rawPaste, pokepasteUrl);
    if (typeof result === "string") {
      return result;
    }
    setIsAdding(false);
    return null;
  }

  function handleBulkImport(entries: TeamFolderEntry[]) {
    const { importedCount, skipped } = addOpponentsFromFolder(entries);
    setIsBulkImporting(false);
    if (importedCount === 0) {
      setImportNotice("Couldn't import any teams from that paste — check the format and try again.");
    } else if (skipped.length > 0) {
      setImportNotice(
        `Imported ${importedCount} team${importedCount === 1 ? "" : "s"}. Skipped ${skipped.length}: ${skipped.join("; ")}`,
      );
    } else {
      setImportNotice(`Imported ${importedCount} team${importedCount === 1 ? "" : "s"}.`);
    }
  }

  function startAdding() {
    setEditingId(null);
    setIsBulkImporting(false);
    setIsAdding(true);
  }

  function startBulkImporting() {
    setEditingId(null);
    setIsAdding(false);
    setImportNotice(null);
    setIsBulkImporting(true);
  }

  function startEditing(id: string) {
    setIsAdding(false);
    setIsBulkImporting(false);
    setEditingId(id);
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Opponents</h2>
        {!isAdding && !isBulkImporting && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={startBulkImporting}
              className="rounded-full border border-zinc-300 px-5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Import teams
            </button>
            <button
              type="button"
              onClick={startAdding}
              className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
            >
              Add opponent
            </button>
          </div>
        )}
      </div>

      {isAdding && <OpponentForm onSubmit={handleSubmit} onCancel={() => setIsAdding(false)} />}
      {isBulkImporting && (
        <BulkImportForm onImport={handleBulkImport} onCancel={() => setIsBulkImporting(false)} />
      )}
      {importNotice && (
        <div
          role="status"
          className="flex items-start justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-300"
        >
          <span>{importNotice}</span>
          <button
            type="button"
            onClick={() => setImportNotice(null)}
            aria-label="Dismiss"
            className="shrink-0 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            ×
          </button>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
      ) : opponents.length === 0 && !isAdding && !isBulkImporting ? (
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
                activeTeamId={activeTeamId}
                onEdit={() => startEditing(opponent.id)}
                onRemove={() => removeOpponent(opponent.id)}
                onUpdatePlan={(updater) => {
                  if (activeTeamId) {
                    updateOpponentPlan(opponent.id, activeTeamId, updater);
                  }
                }}
              />
            ),
          )}
        </ul>
      )}
    </section>
  );
}
