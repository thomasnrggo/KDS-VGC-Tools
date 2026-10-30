"use client";

import { RegulationSelect } from "@/components/Select";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Team } from "@/types";
import { REGULATIONS } from "@/data/regulations";
import { isTeamArchived, addRegulationTag, removeRegulationTag } from "@/lib/team";
import { foldForSearch, parseSearchTerms, pokemonMatchesQuery } from "@/lib/pokemonMatchesQuery";
import { TeamRoster } from "../TeamRoster";
import { Modal, ModalDescription, ModalTitle } from "../Modal";
import { TeamPasteForm } from "../TeamPasteForm";
import { SearchField } from "../SearchField";
import { TeamRegulationTags } from "../TeamRegulationTags";
import { Icon } from "../Icon";
import { IconName } from "@/enums";
import { useMessages, usePokemonText } from "@/hooks/useLanguage";
import { cn } from "@/lib/utils";
import { Button, IconButton, iconButtonVariants } from "@/components/Button";
import { LoadingState } from "@/components/LoadingState";

interface MyTeamsSectionProps {
  teams: Team[];
  isLoading: boolean;
  addTeam: (rawPaste: string, name: string, regulationId: string) => string | null;
  duplicateTeam: (id: string) => void;
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

/**
 * The team rows' stacked icon actions. Phones show just Edit and Duplicate, at a
 * tappable size — Archive and Remove live in the team page's ⋯ menu there.
 */
const rowActionClass = "h-10 w-10 text-zinc-500 hover:bg-zinc-50 md:h-6 md:w-6";
const desktopRowActionClass = "hidden text-zinc-500 hover:bg-zinc-50 md:flex";

/** "My Teams" list page's content — search, regulation switcher, active/archived tabs, add/edit/archive/delete, each row navigating to /teams/[id] on click. Mirrors OpponentsSection's structure, simplified (no bulk import/mass-clear — these are your own handful of teams, not a big opponent list). */
export function MyTeamsSection({
  teams,
  isLoading,
  addTeam,
  duplicateTeam,
  updateTeam,
  removeTeam,
  archiveTeam,
  unarchiveTeam,
  reorderTeams,
  selectedRegulationId,
  setSelectedRegulationId,
}: MyTeamsSectionProps) {
  const t = useMessages();
  const pokemonText = usePokemonText();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("active");
  const [isAdding, setIsAdding] = useState(false);
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
          foldForSearch(team.name).includes(foldForSearch(searchQuery.trim())) ||
          searchTerms.every((term) =>
            team.pokemon.some((mon) => pokemonMatchesQuery(mon, term, pokemonText)),
          ),
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
      <RegulationSelect value={selectedRegulationId} onChange={setSelectedRegulationId} />
    ) : (
      <span className="shrink-0 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-500">
        {REGULATIONS[0] && t.common.regulationLabel(REGULATIONS[0].label)}
      </span>
    );

  // Hidden once search is open — the field itself (below) has its own icon,
  // and its trailing button takes over closing search.
  const searchToggleButton = canSearch && !isSearchOpen && (
    <button
      type="button"
      onClick={toggleSearch}
      aria-label={t.myTeams.searchTeams}
      aria-expanded={isSearchOpen}
      title={t.myTeams.searchHint}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
    >
      <Icon name={IconName.Search} size={18} />
    </button>
  );

  const tabsControl = (
    <div role="tablist" aria-label={t.myTeams.teamStatus} className="flex gap-1.5">
      <button
        type="button"
        role="tab"
        aria-selected={tab === "active"}
        onClick={() => switchTab("active")}
        className={cn(
          "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
          tab === "active"
            ? "bg-chrome-600 text-white"
            : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200",
        )}
      >
        {t.myTeams.active(activeRegulationTeams.length)}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={tab === "archived"}
        onClick={() => switchTab("archived")}
        className={cn(
          "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
          tab === "archived"
            ? "bg-chrome-600 text-white"
            : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200",
        )}
      >
        {t.myTeams.archived(archivedRegulationTeams.length)}
      </button>
    </div>
  );

  return (
    <section className="flex flex-col gap-4">
      {/* Mobile: title + regulation on their own row, search (left) and add
          (right) below — mirrors OpponentsSection's mobile header. */}
      <div className="flex flex-col gap-3 md:hidden">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold whitespace-nowrap text-zinc-900">
            {t.myTeams.title}
          </h2>
          {regulationControl}
        </div>
        <div className="flex items-center gap-2">
          {searchToggleButton}
          {isSearchOpen && canSearch && (
            <SearchField
              query={searchQuery}
              onQueryChange={setSearchQuery}
              placeholder={t.myTeams.searchPlaceholder}
              ariaLabel={t.myTeams.searchLabel}
              onClose={toggleSearch}
              autoFocus
              className="min-w-0 flex-1"
            />
          )}
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            aria-label={t.myTeams.createTeam}
            title={t.myTeams.createTeam}
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-chrome-600 text-white hover:bg-chrome-700"
          >
            <Icon name={IconName.Add} size={20} />
          </button>
        </div>
      </div>

      {/* Desktop: title + regulation, then one toolbar row below. */}
      <div className="hidden items-center gap-3 md:flex">
        <h2 className="text-xl font-semibold text-zinc-900">{t.myTeams.title}</h2>
        {regulationControl}
      </div>

      <div className="flex items-center justify-between gap-4">
        {tabsControl}
        {/* Desktop only — mobile has search and add in its header row above. */}
        <div className="hidden min-w-0 flex-1 items-center justify-end gap-2 md:flex">
          {canSearch && (
            <SearchField
              query={searchQuery}
              onQueryChange={setSearchQuery}
              placeholder={t.myTeams.searchPlaceholder}
              ariaLabel={t.myTeams.searchLabel}
              className="w-full max-w-xl"
            />
          )}
          <Button onClick={() => setIsAdding(true)} className="shrink-0">
            {t.myTeams.createTeam}
          </Button>
        </div>
      </div>

      {isAdding && (
        <Modal onClose={() => setIsAdding(false)} labelledBy="add-team-modal-title">
          <ModalTitle id="add-team-modal-title" className="mb-4">
            {t.myTeams.createTeamTitle}
          </ModalTitle>
          <TeamPasteForm onSubmit={handleAddSubmit} onCancel={() => setIsAdding(false)} />
          <p className="mt-4 border-t border-zinc-200 pt-3 text-sm text-zinc-600">
            <Link href="/team-builder" className="font-medium text-zinc-800 underline">
              {t.teamBuilder.orBuild}
            </Link>
          </p>
        </Modal>
      )}

      {confirmRemoveTeam && (
        <Modal onClose={() => setConfirmRemoveId(null)} labelledBy="confirm-remove-team-title">
          <ModalTitle id="confirm-remove-team-title" className="mb-2">
            {t.myTeams.confirmRemoveTitle(confirmRemoveTeam.name)}
          </ModalTitle>
          <ModalDescription>{t.myTeams.confirmRemoveBody}</ModalDescription>
          <div className="flex gap-2">
            <Button variant="danger" onClick={confirmRemove}>
              {t.myTeams.removeTeam}
            </Button>
            <Button variant="outline" onClick={() => setConfirmRemoveId(null)}>
              {t.common.cancel}
            </Button>
          </div>
        </Modal>
      )}

      {isLoading ? (
        <LoadingState />
      ) : tabTeams.length === 0 ? (
        tab === "active" ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-6 py-14 text-center">
            <h3 className="text-lg font-semibold text-zinc-900">
              {regulationTeams.length === 0 ? t.myTeams.noTeams : t.myTeams.noActiveTeams}
            </h3>
            <p className="max-w-md text-sm text-zinc-600">
              {regulationTeams.length === 0 ? t.myTeams.noTeamsBody : t.myTeams.allArchivedBody}
            </p>
            <Button onClick={() => setIsAdding(true)}>{t.myTeams.createTeam}</Button>
          </div>
        ) : (
          <p className="py-12 text-center text-sm text-zinc-500">{t.myTeams.noArchived}</p>
        )
      ) : isSearching && visibleTeams.length === 0 ? (
        <p className="py-12 text-center text-sm text-zinc-500">
          {t.myTeams.noMatches(tab, searchQuery.trim())}
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
              className={cn(
                "flex gap-3 p-4",
                !isSearching ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
                index % 2 === 0 ? "bg-zinc-200" : "bg-zinc-100",
                draggedId === team.id && "opacity-40",
                dragOverId === team.id &&
                  draggedId !== team.id &&
                  "outline outline-2 -outline-offset-2 outline-zinc-500",
              )}
            >
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  {!isSearching && (
                    <Icon
                      name={IconName.DragIndicator}
                      size={16}
                      className="-ml-1 shrink-0 text-zinc-400"
                    />
                  )}
                  <span
                    title={team.name}
                    className="max-w-xs truncate text-xs font-semibold tracking-wide text-zinc-600 uppercase"
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
                {/* Natural width at md+: TeamRoster switches to fixed-px
                    tiles there, and stretching this wrapper would space them
                    apart. On phones its fluid tiles need the full width. */}
                <div className="min-w-0 md:w-fit">
                  <TeamRoster
                    pokemon={team.pokemon}
                    isMatch={
                      isSearching
                        ? (mon) =>
                            searchTerms.some((term) => pokemonMatchesQuery(mon, term, pokemonText))
                        : undefined
                    }
                  />
                </div>
              </div>
              {/* The row's actions, stacked down its right edge. Clicks and
                  Enter/Space stop here so they don't also open the team. */}
              <div
                role="group"
                aria-label={t.myTeams.teamOptions(team.name)}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
                className="flex shrink-0 flex-col justify-center gap-0.5"
              >
                <Link
                  href={`/teams/${team.id}/edit`}
                  draggable={false}
                  aria-label={t.myTeams.editTeam}
                  title={t.myTeams.editTeam}
                  className={cn(iconButtonVariants({ variant: "ghost" }), rowActionClass)}
                >
                  <Icon name={IconName.Edit} size={18} />
                </Link>
                <IconButton
                  variant="ghost"
                  onClick={() => duplicateTeam(team.id)}
                  aria-label={t.myTeams.duplicate}
                  title={t.myTeams.duplicate}
                  className={rowActionClass}
                >
                  <Icon name={IconName.ContentCopy} size={18} />
                </IconButton>
                {tab === "active" ? (
                  <IconButton
                    variant="ghost"
                    onClick={() => archiveTeam(team.id)}
                    aria-label={t.myTeams.archive}
                    title={t.myTeams.archive}
                    className={desktopRowActionClass}
                  >
                    <Icon name={IconName.Archive} size={16} />
                  </IconButton>
                ) : (
                  <IconButton
                    variant="ghost"
                    onClick={() => unarchiveTeam(team.id)}
                    aria-label={t.myTeams.unarchive}
                    title={t.myTeams.unarchive}
                    className={desktopRowActionClass}
                  >
                    <Icon name={IconName.Unarchive} size={16} />
                  </IconButton>
                )}
                <IconButton
                  variant="ghost"
                  onClick={() => setConfirmRemoveId(team.id)}
                  aria-label={t.myTeams.removeTeam}
                  title={t.myTeams.removeTeam}
                  className={cn(
                    desktopRowActionClass,
                    "hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950",
                  )}
                >
                  <Icon name={IconName.Delete} size={16} />
                </IconButton>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
