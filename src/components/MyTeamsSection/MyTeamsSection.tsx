"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Team } from "@/types";
import { REGULATIONS } from "@/data/regulations";
import { parseSearchTerms, pokemonMatchesQuery } from "@/lib/pokemonMatchesQuery";
import { PokemonSprite } from "../PokemonSprite";
import { ItemIcon } from "../ItemIcon";
import { Modal } from "../Modal";
import { TeamPasteForm } from "../TeamPasteForm";
import { Icon } from "../Icon";
import { IconName } from "@/enums";

interface MyTeamsSectionProps {
  teams: Team[];
  isLoading: boolean;
  addTeam: (rawPaste: string, name: string, regulationId: string) => string | null;
  editTeam: (id: string, rawPaste: string, name: string) => string | null;
  removeTeam: (id: string) => void;
}

/** "My Teams" list page's content — search, regulation switcher, add/edit/delete, each row navigating to /teams/[id] on click. Mirrors OpponentsSection's structure, simplified (no bulk import/mass-clear — these are your own handful of teams, not a big opponent list). */
export function MyTeamsSection({ teams, isLoading, addTeam, editTeam, removeTeam }: MyTeamsSectionProps) {
  const router = useRouter();
  const [selectedRegulationId, setSelectedRegulationId] = useState(REGULATIONS[0]?.id ?? "");
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSearchOpen) searchInputRef.current?.focus();
  }, [isSearchOpen]);

  const regulationTeams = teams.filter((team) => team.regulationId === selectedRegulationId);

  const searchTerms = parseSearchTerms(searchQuery);
  const isSearching = searchTerms.length > 0;
  const visibleTeams = isSearching
    ? regulationTeams.filter(
        (team) =>
          team.name.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
          searchTerms.every((term) => team.pokemon.some((mon) => pokemonMatchesQuery(mon, term))),
      )
    : regulationTeams;

  function toggleSearch() {
    setIsSearchOpen((open) => {
      const next = !open;
      if (!next) setSearchQuery("");
      return next;
    });
  }

  function handleAddSubmit(rawPaste: string, name: string) {
    const error = addTeam(rawPaste, name, selectedRegulationId);
    if (!error) setIsAdding(false);
    return error;
  }

  const editingTeam = editingId ? (teams.find((team) => team.id === editingId) ?? null) : null;
  const confirmRemoveTeam = confirmRemoveId
    ? (teams.find((team) => team.id === confirmRemoveId) ?? null)
    : null;

  function confirmRemove() {
    if (!confirmRemoveId) return;
    removeTeam(confirmRemoveId);
    setConfirmRemoveId(null);
  }

  return (
    <section className="flex w-full max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-mauve-900">My Teams</h2>
          {REGULATIONS.length > 1 ? (
            <div className="relative">
              <select
                value={selectedRegulationId}
                onChange={(event) => setSelectedRegulationId(event.target.value)}
                aria-label="Regulation"
                className="appearance-none rounded-full border border-mauve-300 bg-white py-1 pl-3 pr-8 text-xs font-medium text-mauve-700"
              >
                {REGULATIONS.map((regulation) => (
                  <option key={regulation.id} value={regulation.id}>
                    {regulation.label}
                  </option>
                ))}
              </select>
              <Icon
                name={IconName.ExpandMore}
                size={14}
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-mauve-500"
              />
            </div>
          ) : (
            <span className="rounded-full border border-mauve-200 bg-mauve-50 px-3 py-1 text-xs font-medium text-mauve-500">
              {REGULATIONS[0]?.label}
            </span>
          )}
          {!isLoading && regulationTeams.length > 0 && (
            <button
              type="button"
              onClick={toggleSearch}
              aria-label={isSearchOpen ? "Hide search" : "Search teams"}
              aria-expanded={isSearchOpen}
              title="Search by team name, Pokémon, or item"
              className={`flex h-8 w-8 items-center justify-center rounded-full text-mauve-500 hover:bg-mauve-100 hover:text-mauve-700 ${
                isSearchOpen ? "bg-mauve-100 text-mauve-700" : ""
              }`}
            >
              <Icon name={IconName.Search} size={18} />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="rounded-full bg-mauve-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-mauve-700"
        >
          Add team
        </button>
      </div>

      {isSearchOpen && !isLoading && regulationTeams.length > 0 && (
        <div className="relative">
          <Icon
            name={IconName.Search}
            size={18}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mauve-400"
          />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder='Search by team name, Pokémon, or item… (e.g. "charizard scarf")'
            aria-label="Search my teams"
            className="w-full rounded-full border border-mauve-300 bg-white py-2 pl-9 pr-9 text-sm text-mauve-800 placeholder:text-mauve-400 focus:outline-none focus:ring-2 focus:ring-mauve-400"
          />
          {isSearching && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
              title="Clear search"
              className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-mauve-400 hover:bg-mauve-100 hover:text-mauve-700"
            >
              <Icon name={IconName.Close} size={14} />
            </button>
          )}
        </div>
      )}

      {isAdding && (
        <Modal onClose={() => setIsAdding(false)} labelledBy="add-team-modal-title">
          <h2 id="add-team-modal-title" className="mb-4 text-lg font-semibold text-mauve-900">
            Add a team
          </h2>
          <TeamPasteForm onSubmit={handleAddSubmit} onCancel={() => setIsAdding(false)} />
        </Modal>
      )}

      {editingTeam && (
        <Modal onClose={() => setEditingId(null)} labelledBy="edit-team-modal-title">
          <h2 id="edit-team-modal-title" className="mb-4 text-lg font-semibold text-mauve-900">
            Edit team
          </h2>
          <TeamPasteForm
            initialName={editingTeam.name}
            initialValue={editingTeam.rawPaste}
            onSubmit={(rawPaste, name) => {
              const error = editTeam(editingTeam.id, rawPaste, name);
              if (!error) setEditingId(null);
              return error;
            }}
            onCancel={() => setEditingId(null)}
          />
        </Modal>
      )}

      {confirmRemoveTeam && (
        <Modal onClose={() => setConfirmRemoveId(null)} labelledBy="confirm-remove-team-title">
          <h2 id="confirm-remove-team-title" className="mb-2 text-lg font-semibold text-mauve-900">
            Remove {confirmRemoveTeam.name}?
          </h2>
          <p className="mb-4 text-sm text-mauve-600">
            This can&apos;t be undone — you&apos;ll need to paste the team again, and any notes or
            combinations on its Team Report page will be lost.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={confirmRemove}
              className="rounded-full bg-red-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
            >
              Remove team
            </button>
            <button
              type="button"
              onClick={() => setConfirmRemoveId(null)}
              className="rounded-full border border-mauve-300 px-5 py-2 text-sm font-medium text-mauve-700 hover:bg-mauve-100"
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {isLoading ? (
        <p className="text-sm text-mauve-500">Loading…</p>
      ) : regulationTeams.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-mauve-300 bg-mauve-50 px-6 py-14 text-center">
          <h3 className="text-lg font-semibold text-mauve-900">No teams yet</h3>
          <p className="max-w-md text-sm text-mauve-600">
            Paste a Pokémon Showdown export to add a team here — you&apos;ll get a Team Report page
            for it with per-Pokémon notes and any lead/back combinations you want to save.
          </p>
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="rounded-full bg-mauve-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-mauve-700"
          >
            Add team
          </button>
        </div>
      ) : isSearching && visibleTeams.length === 0 ? (
        <p className="py-12 text-center text-sm text-mauve-500">
          No teams match &ldquo;{searchQuery.trim()}&rdquo;.
        </p>
      ) : (
        <ul className="flex flex-col">
          {visibleTeams.map((team, index) => (
            <li
              key={team.id}
              role="link"
              tabIndex={0}
              onClick={() => router.push(`/teams/${team.id}`)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  router.push(`/teams/${team.id}`);
                }
              }}
              className={`flex cursor-pointer items-center gap-4 p-4 ${
                index % 2 === 0 ? "bg-mauve-200" : "bg-mauve-100"
              }`}
            >
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex items-center gap-1">
                  <span
                    title={team.name}
                    className="max-w-xs truncate text-xs font-semibold uppercase tracking-wide text-mauve-600"
                  >
                    {team.name}
                  </span>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setEditingId(team.id);
                    }}
                    aria-label={`Edit ${team.name}`}
                    title="Edit team"
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-mauve-500 hover:bg-mauve-300 hover:text-mauve-700"
                  >
                    <Icon name={IconName.Edit} size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setConfirmRemoveId(team.id);
                    }}
                    aria-label={`Remove ${team.name}`}
                    title="Remove team"
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-mauve-500 hover:bg-red-100 hover:text-red-600"
                  >
                    <Icon name={IconName.Delete} size={14} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {team.pokemon.map((mon, monIndex) => (
                    <span
                      key={`${mon.species}-${monIndex}`}
                      className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-mauve-500/20"
                    >
                      <PokemonSprite species={mon.species} item={mon.item} fill />
                      {mon.item && (
                        <span className="absolute -bottom-1 -right-1">
                          <ItemIcon item={mon.item} size={16} />
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
              <Icon name={IconName.ExpandMore} size={20} className="shrink-0 -rotate-90 text-mauve-400" />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
