"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Team } from "@/types";
import { REGULATIONS } from "@/data/regulations";
import { isTeamArchived, addRegulationTag, removeRegulationTag } from "@/lib/team";
import { parseSearchTerms, pokemonMatchesQuery } from "@/lib/pokemonMatchesQuery";
import { TeamRoster } from "../TeamRoster";
import { Modal } from "../Modal";
import { TeamPasteForm } from "../TeamPasteForm";
import { SearchField } from "../SearchField";
import { RowActionsMenu } from "../RowActionsMenu";
import { TeamRegulationTags } from "../TeamRegulationTags";
import { Icon } from "../Icon";
import { IconName } from "@/enums";

interface MyTeamsSectionProps {
  teams: Team[];
  isLoading: boolean;
  addTeam: (rawPaste: string, name: string, regulationId: string) => string | null;
  editTeam: (id: string, rawPaste: string, name: string) => string | null;
  updateTeam: (id: string, updater: (team: Team) => Team) => void;
  removeTeam: (id: string) => void;
  archiveTeam: (id: string) => void;
  unarchiveTeam: (id: string) => void;
  reorderTeams: (orderedIds: string[]) => void;
  /** Lifted up to the page (see teams/page.tsx) so MyTeamHeader's team switcher can scope its offered list to the same regulation this section's list is already filtered by. */
  selectedRegulationId: string;
  setSelectedRegulationId: (id: string) => void;
}

type Tab = "active" | "archived";

/** "My Teams" list page's content — search, regulation switcher, active/archived tabs, add/edit/archive/delete, each row navigating to /teams/[id] on click. Mirrors OpponentsSection's structure, simplified (no bulk import/mass-clear — these are your own handful of teams, not a big opponent list). */
export function MyTeamsSection({
  teams,
  isLoading,
  addTeam,
  editTeam,
  updateTeam,
  removeTeam,
  archiveTeam,
  unarchiveTeam,
  reorderTeams,
  selectedRegulationId,
  setSelectedRegulationId,
}: MyTeamsSectionProps) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("active");
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Highest sortOrder first, matching sortByCustomOrder in useMyTeams — this
  // component gets the raw (unsorted) teams array from the page, so it needs
  // its own copy of the ordering to render and drag-reorder correctly.
  const regulationTeams = teams
    .filter((team) => team.regulationIds.includes(selectedRegulationId))
    .sort((a, b) => b.sortOrder - a.sortOrder);
  const activeRegulationTeams = regulationTeams.filter((team) => !isTeamArchived(team));
  const archivedRegulationTeams = regulationTeams.filter(isTeamArchived);
  // Search is scoped to whichever tab is open, not both at once — the tabs
  // are meant to be a hard partition of the list.
  const tabTeams = tab === "active" ? activeRegulationTeams : archivedRegulationTeams;

  const searchTerms = parseSearchTerms(searchQuery);
  const isSearching = searchTerms.length > 0;
  const visibleTeams = isSearching
    ? tabTeams.filter(
        (team) =>
          team.name.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
          searchTerms.every((term) => team.pokemon.some((mon) => pokemonMatchesQuery(mon, term))),
      )
    : tabTeams;

  function toggleSearch() {
    setIsSearchOpen((open) => {
      const next = !open;
      if (!next) setSearchQuery("");
      return next;
    });
  }

  function switchTab(next: Tab) {
    setTab(next);
    setSearchQuery("");
  }

  function handleAddSubmit(rawPaste: string, name: string) {
    const error = addTeam(rawPaste, name, selectedRegulationId);
    if (!error) setIsAdding(false);
    return error;
  }

  /**
   * Drops `draggedId` onto `targetId`'s position within `tabTeams` — the
   * current tab's regulation-scoped list, same set the row `<li>`s are
   * rendered from — and persists the new order. Never touches teams outside
   * that list (a different regulation, or the other Active/Archived tab),
   * matching reorderTeams' contract in src/lib/team.ts.
   */
  function handleDrop(targetId: string) {
    setDragOverId(null);
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      return;
    }
    const ids = tabTeams.map((team) => team.id);
    const fromIndex = ids.indexOf(draggedId);
    if (fromIndex === -1) {
      setDraggedId(null);
      return;
    }
    ids.splice(fromIndex, 1);
    const toIndex = ids.indexOf(targetId);
    ids.splice(toIndex === -1 ? ids.length : toIndex, 0, draggedId);
    reorderTeams(ids);
    setDraggedId(null);
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

  const canSearch = !isLoading && tabTeams.length > 0;

  const regulationControl =
    REGULATIONS.length > 1 ? (
      <div className="relative shrink-0">
        <select
          value={selectedRegulationId}
          onChange={(event) => setSelectedRegulationId(event.target.value)}
          aria-label="Regulation"
          className="appearance-none rounded-full border border-zinc-300 bg-zinc-50 py-1 pl-3 pr-8 text-xs font-medium text-zinc-700"
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
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500"
        />
      </div>
    ) : (
      <span className="shrink-0 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-500">
        {REGULATIONS[0]?.label}
      </span>
    );

  // Hidden once search is open — the field itself (below) has its own icon,
  // and its trailing button takes over closing search.
  const searchToggleButton = canSearch && !isSearchOpen && (
    <button
      type="button"
      onClick={toggleSearch}
      aria-label="Search teams"
      aria-expanded={isSearchOpen}
      title="Search by team name, Pokémon, or item"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
    >
      <Icon name={IconName.Search} size={18} />
    </button>
  );

  const tabsControl = (
    <div role="tablist" aria-label="Team status" className="flex gap-1.5">
      <button
        type="button"
        role="tab"
        aria-selected={tab === "active"}
        onClick={() => switchTab("active")}
        className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
          tab === "active"
            ? "bg-zinc-600 dark:bg-zinc-400 text-white"
            : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
        }`}
      >
        Active{activeRegulationTeams.length > 0 ? ` (${activeRegulationTeams.length})` : ""}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={tab === "archived"}
        onClick={() => switchTab("archived")}
        className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
          tab === "archived"
            ? "bg-zinc-600 dark:bg-zinc-400 text-white"
            : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
        }`}
      >
        Archived{archivedRegulationTeams.length > 0 ? ` (${archivedRegulationTeams.length})` : ""}
      </button>
    </div>
  );

  return (
    <section className="flex flex-col gap-4">
      {/* Mobile: title + regulation on their own row, search (left) and add
          (right) below — mirrors OpponentsSection's mobile header. */}
      <div className="flex flex-col gap-3 md:hidden">
        <div className="flex items-center justify-between gap-3">
          <h2 className="whitespace-nowrap text-xl font-semibold text-zinc-900">
            My Teams
          </h2>
          {regulationControl}
        </div>
        <div className="flex items-center gap-2">
          {searchToggleButton}
          {isSearchOpen && canSearch && (
            <SearchField
              query={searchQuery}
              onQueryChange={setSearchQuery}
              placeholder='Search by team name, Pokémon, or item… (e.g. "charizard scarf")'
              ariaLabel="Search my teams"
              onClose={toggleSearch}
              autoFocus
              className="min-w-0 flex-1"
            />
          )}
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            aria-label="Add team"
            title="Add team"
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-zinc-600 dark:bg-zinc-400 text-white hover:bg-zinc-700 dark:hover:bg-zinc-300"
          >
            <Icon name={IconName.Add} size={20} />
          </button>
        </div>
      </div>

      {/* Desktop: unchanged single-row layout. */}
      <div className="hidden items-center justify-between md:flex">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-zinc-900">My Teams</h2>
          {regulationControl}
        </div>
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="rounded-full bg-zinc-600 dark:bg-zinc-400 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:hover:bg-zinc-300"
        >
          Add team
        </button>
      </div>

      {tabsControl}

      {/* Desktop only — mobile shows this inline in the row above instead. */}
      {canSearch && (
        <SearchField
          query={searchQuery}
          onQueryChange={setSearchQuery}
          placeholder='Search by team name, Pokémon, or item… (e.g. "charizard scarf")'
          ariaLabel="Search my teams"
          className="hidden md:block"
        />
      )}

      {isAdding && (
        <Modal onClose={() => setIsAdding(false)} labelledBy="add-team-modal-title">
          <h2 id="add-team-modal-title" className="mb-4 text-lg font-semibold text-zinc-900">
            Add a team
          </h2>
          <TeamPasteForm onSubmit={handleAddSubmit} onCancel={() => setIsAdding(false)} />
        </Modal>
      )}

      {editingTeam && (
        <Modal onClose={() => setEditingId(null)} labelledBy="edit-team-modal-title">
          <h2 id="edit-team-modal-title" className="mb-4 text-lg font-semibold text-zinc-900">
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
          <h2 id="confirm-remove-team-title" className="mb-2 text-lg font-semibold text-zinc-900">
            Remove {confirmRemoveTeam.name}?
          </h2>
          <p className="mb-4 text-sm text-zinc-600">
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
              className="rounded-full border border-zinc-300 px-5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {isLoading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : tabTeams.length === 0 ? (
        tab === "active" ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-6 py-14 text-center">
            <h3 className="text-lg font-semibold text-zinc-900">
              {regulationTeams.length === 0 ? "No teams yet" : "No active teams"}
            </h3>
            <p className="max-w-md text-sm text-zinc-600">
              {regulationTeams.length === 0
                ? "Paste a Pokémon Showdown export to add a team here — you'll get a Team Report page for it with per-Pokémon notes and any lead/back combinations you want to save."
                : "Every team under this regulation is archived — check the Archived tab, or add a new one."}
            </p>
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="rounded-full bg-zinc-600 dark:bg-zinc-400 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:hover:bg-zinc-300"
            >
              Add team
            </button>
          </div>
        ) : (
          <p className="py-12 text-center text-sm text-zinc-500">
            No archived teams under this regulation — archiving a team (from its &ldquo;⋯&rdquo; menu on
            the Active tab) moves it here instead of deleting it.
          </p>
        )
      ) : isSearching && visibleTeams.length === 0 ? (
        <p className="py-12 text-center text-sm text-zinc-500">
          No {tab} teams match &ldquo;{searchQuery.trim()}&rdquo;.
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
              // Whole-row draggable rather than a dedicated handle-only drag
              // zone — simpler, and a plain click (no pointer movement)
              // still fires normally, so the row's onClick navigation above
              // is unaffected. Disabled while searching since visibleTeams
              // then isn't the full tab list reorderTeams operates over.
              draggable={!isSearching}
              onDragStart={(event) => {
                event.stopPropagation();
                setDraggedId(team.id);
                event.dataTransfer.effectAllowed = "move";
              }}
              onDragEnd={() => {
                setDraggedId(null);
                setDragOverId(null);
              }}
              onDragOver={(event) => {
                if (!draggedId) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                if (dragOverId !== team.id) setDragOverId(team.id);
              }}
              onDrop={(event) => {
                event.preventDefault();
                handleDrop(team.id);
              }}
              className={`flex flex-col gap-2 p-4 ${!isSearching ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} ${
                index % 2 === 0 ? "bg-zinc-200" : "bg-zinc-100"
              } ${draggedId === team.id ? "opacity-40" : ""} ${
                dragOverId === team.id && draggedId !== team.id
                  ? "outline outline-2 -outline-offset-2 outline-zinc-500"
                  : ""
              }`}
            >
              {/* Its own full-width row (rather than living inside the
                  roster wrapper below) so RowActionsMenu can sit flush
                  against the row's right edge via justify-between, instead
                  of only ever being pushed as far right as the name/chips
                  happen to reach. */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  {!isSearching && (
                    <Icon
                      name={IconName.DragIndicator}
                      size={16}
                      className="shrink-0 -ml-1 text-zinc-400"
                    />
                  )}
                  <span
                    title={team.name}
                    className="max-w-xs truncate text-xs font-semibold uppercase tracking-wide text-zinc-600"
                  >
                    {team.name}
                  </span>
                  <TeamRegulationTags
                    team={team}
                    onTag={(regulationId) =>
                      updateTeam(team.id, (current) => addRegulationTag(current, regulationId))
                    }
                    onUntag={(regulationId) =>
                      updateTeam(team.id, (current) => removeRegulationTag(current, regulationId))
                    }
                  />
                </div>
                <RowActionsMenu
                  label={`${team.name} options`}
                  onEdit={() => setEditingId(team.id)}
                  onRemove={() => setConfirmRemoveId(team.id)}
                  middleAction={
                    tab === "active"
                      ? {
                          label: "Archive",
                          icon: IconName.Archive,
                          onClick: () => archiveTeam(team.id),
                        }
                      : {
                          label: "Unarchive",
                          icon: IconName.Unarchive,
                          onClick: () => unarchiveTeam(team.id),
                        }
                  }
                />
              </div>
              <div className="flex items-center gap-4 md:justify-between">
                {/* flex-1 (mobile only): TeamRoster's fluid aspect-square
                    tiles need to be stretched to fill the row's width to size
                    themselves sensibly. At md+ TeamRoster switches to
                    fixed-px tiles instead, sized for its OTHER context
                    (OpponentCard's auto-width grid column) — stretching
                    this wrapper there would stretch TeamRoster's grid
                    tracks along with it, spacing the fixed-size tiles apart
                    instead of keeping them snug, so it reverts to natural
                    (unstretched) width and md:justify-between (above) keeps
                    the chevron pinned right. */}
                <div className="min-w-0 flex-1 md:flex-none">
                  <TeamRoster
                    pokemon={team.pokemon}
                    isMatch={
                      isSearching
                        ? (mon) => searchTerms.some((term) => pokemonMatchesQuery(mon, term))
                        : undefined
                    }
                  />
                </div>
                <Icon
                  name={IconName.ExpandMore}
                  size={20}
                  className="shrink-0 -rotate-90 text-zinc-400"
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
