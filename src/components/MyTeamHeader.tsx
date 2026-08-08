"use client";

import { useState } from "react";
import type { Team } from "@/lib/team";
import { Modal } from "./Modal";
import { TeamPasteForm } from "./TeamPasteForm";
import { PokemonSprite } from "./PokemonSprite";

interface MyTeamHeaderProps {
  team: Team | null;
  isLoading: boolean;
  saveFromPaste: (rawPaste: string) => string | null;
  onClear: () => void;
}

function EditIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

export function MyTeamHeader({ team, isLoading, saveFromPaste, onClear }: MyTeamHeaderProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  function handleSubmit(raw: string) {
    const error = saveFromPaste(raw);
    if (!error) {
      setIsModalOpen(false);
    }
    return error;
  }

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between gap-4 border-b border-zinc-200 bg-zinc-100/95 px-6 py-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
      <h1 className="leading-tight">
        <span className="block text-base text-zinc-500 dark:text-zinc-400">Matchup</span>
        <span className="block text-2xl font-bold text-zinc-900 dark:text-zinc-50">Planner</span>
      </h1>

      <div className="flex items-center gap-2">
        {isLoading ? null : team ? (
          <>
            <div className="flex gap-1">
              {team.pokemon.map((mon, index) => (
                <PokemonSprite key={index} species={mon.species} size={40} />
              ))}
            </div>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              aria-label="Edit team"
              title="Edit team"
              className="rounded-full p-2 text-zinc-500 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              <EditIcon />
            </button>
            <button
              type="button"
              onClick={onClear}
              aria-label="Remove team"
              title="Remove team"
              className="rounded-full p-2 text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-950"
            >
              <TrashIcon />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            Add your team
          </button>
        )}
      </div>

      {isModalOpen && (
        <Modal onClose={() => setIsModalOpen(false)} labelledBy="my-team-modal-title">
          <h2
            id="my-team-modal-title"
            className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50"
          >
            {team ? "Edit your team" : "Add your team"}
          </h2>
          <TeamPasteForm
            initialValue={team?.rawPaste}
            onSubmit={handleSubmit}
            onCancel={() => setIsModalOpen(false)}
          />
        </Modal>
      )}
    </header>
  );
}
