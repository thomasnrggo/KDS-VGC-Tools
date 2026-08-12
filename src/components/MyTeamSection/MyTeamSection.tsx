"use client";

import { useState } from "react";
import Image from "next/image";
import type { Team } from "@/types";
import { Modal } from "../Modal";
import { TeamPasteForm } from "../TeamPasteForm";

interface MyTeamSectionProps {
  teams: Team[];
  isLoading: boolean;
  addTeam: (rawPaste: string, name: string) => string | null;
}

/**
 * Onboarding prompt for pasting your own team, shown only until you have at
 * least one — once you do, MyTeamHeader's team switcher takes over and this
 * renders nothing. Mirrors OpponentsSection's empty-state card; for now it
 * has its own self-contained "Add a team" modal rather than sharing
 * MyTeamHeader's internal one, since the two never need to be open at once.
 */
export function MyTeamSection({
  teams,
  isLoading,
  addTeam,
}: MyTeamSectionProps) {
  const [isAdding, setIsAdding] = useState(false);

  if (isLoading || teams.length > 0) {
    return null;
  }

  function handleSubmit(rawPaste: string, name: string) {
    const error = addTeam(rawPaste, name);
    if (!error) {
      setIsAdding(false);
    }
    return error;
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-mauve-300 bg-mauve-50 px-6 py-6 text-center">
        <Image
          src="/resources/logo.png"
          alt=""
          width={56}
          height={56}
          unoptimized
          className="h-14 w-14"
        />
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-semibold text-mauve-900">
            Add your own team
          </h3>
          <p className="max-w-md text-sm text-mauve-600">
            Paste your Pokémon Showdown team export to get started, you&apos;ll
            be able to plan lead and back picks against every opposing team you
            add below.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="rounded-full bg-mauve-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-mauve-700"
        >
          Add a team
        </button>
      </div>

      {isAdding && (
        <Modal
          onClose={() => setIsAdding(false)}
          labelledBy="my-team-section-modal-title"
        >
          <h2
            id="my-team-section-modal-title"
            className="mb-4 text-lg font-semibold text-mauve-900"
          >
            Add a team
          </h2>
          <TeamPasteForm
            onSubmit={handleSubmit}
            onCancel={() => setIsAdding(false)}
          />
        </Modal>
      )}
    </section>
  );
}
