"use client";

import { RegulationSelect } from "@/components/Select";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Team } from "@/types";
import { useTeamFolders } from "@/hooks/useTeamFolders";
import { folderOf, sortedFolders, teamsInFolder } from "@/lib/myTeamFolders";
import { RowActionsMenu } from "../RowActionsMenu";
import { toast } from "../Toast";
import { REGULATIONS } from "@/data/regulations";
import { isTeamArchived, addRegulationTag, removeRegulationTag } from "@/lib/team";
import { foldForSearch, parseSearchTerms, pokemonMatchesQuery } from "@/lib/pokemonMatchesQuery";
import { TeamRoster } from "../TeamRoster";
import { Modal, ModalDescription, ModalTitle } from "../Modal";
import { SearchField } from "../SearchField";
import { TeamRegulationTags } from "../TeamRegulationTags";
import { Icon } from "../Icon";
import { IconName } from "@/enums";
import { useMessages, usePokemonText } from "@/hooks/useLanguage";
import { cn } from "@/lib/utils";
import { Button, IconButton } from "@/components/Button";
import { LoadingState } from "@/components/LoadingState";

interface MyTeamsSectionProps {
  teams: Team[];
  isLoading: boolean;
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

/** ?folder= for the teams in no folder. */
const UNFILED = "none";
/** ?folder= for the archived teams — the panel's last entry, once there are any. */
const ARCHIVED = "archived";

/** A team row's Duplicate button — tappable on phones, compact on desktop. */
const rowActionClass = "h-10 w-10 text-zinc-500 hover:bg-zinc-50 md:h-8 md:w-8";

/** "My Teams" list page's content — search, regulation switcher, active/archived tabs, add/edit/archive/delete, each row navigating to /teams/[id] on click. Mirrors OpponentsSection's structure, simplified (no bulk import/mass-clear — these are your own handful of teams, not a big opponent list). */
export function MyTeamsSection({
  teams,
  isLoading,
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
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  // Folders (docs/team-folders.md): yours, the team being moved, and the
  // new/rename folder dialog's draft (no id: a new folder).
  const teamFolders = useTeamFolders();
  const orderedFolders = sortedFolders(teamFolders.folders);
  const hasFolders = orderedFolders.length > 0;
  // What the folder panel has picked (?folder=, so Back and returning from a
  // team keep it): a folder, "none" (teams in no folder), or nothing (all teams).
  const searchParams = useSearchParams();
  const folderParam = searchParams.get("folder");
  const openFolder = orderedFolders.find((folder) => folder.id === folderParam) ?? null;
  const showingUnfiled = folderParam === UNFILED && hasFolders;
  const [movingTeamId, setMovingTeamId] = useState<string | null>(null);
  const [folderDraft, setFolderDraft] = useState<{ id?: string; name: string } | null>(null);

  // Highest sortOrder first, matching sortByCustomOrder in useMyTeams — this
  // component gets the raw (unsorted) teams array from the page, so it needs
  // its own copy of the ordering to render and drag-reorder correctly.
  const regulationTeams = teams
    .filter((team) => team.regulationIds.includes(selectedRegulationId))
    .sort((a, b) => b.sortOrder - a.sortOrder);
  const activeRegulationTeams = regulationTeams.filter((team) => !isTeamArchived(team));
  const archivedRegulationTeams = regulationTeams.filter(isTeamArchived);
  // Archived teams are their own entry in the folder panel; everywhere else
  // (All teams, a folder, No folder) shows active teams only.
  const showingArchived = folderParam === ARCHIVED && archivedRegulationTeams.length > 0;
  const tab: Tab = showingArchived ? "archived" : "active";
  const tabTeams = showingArchived ? archivedRegulationTeams : activeRegulationTeams;

  const searchTerms = parseSearchTerms(searchQuery);
  const isSearching = searchTerms.length > 0;
  // All active teams, the picked folder's, or the archived ones; search looks within them.
  const pickedTeams = openFolder
    ? teamsInFolder(tabTeams, teamFolders.folders, openFolder.id)
    : showingUnfiled
      ? teamsInFolder(tabTeams, teamFolders.folders, null)
      : tabTeams;
  const visibleTeams = isSearching
    ? pickedTeams.filter(
        (team) =>
          foldForSearch(team.name).includes(foldForSearch(searchQuery.trim())) ||
          searchTerms.every((term) =>
            team.pokemon.some((mon) => pokemonMatchesQuery(mon, term, pokemonText)),
          ),
      )
    : pickedTeams;
  const isFiltered = !!openFolder || showingUnfiled || showingArchived;

  /** Picks an entry in the panel (UNFILED: teams in none; ARCHIVED; null: all teams). */
  function pickFolder(folderId: string | null) {
    router.push(folderId ? `/teams?folder=${encodeURIComponent(folderId)}` : "/teams", {
      scroll: false,
    });
  }

  function toggleSearch() {
    setIsSearchOpen((open) => {
      const next = !open;
      if (!next) setSearchQuery("");
      return next;
    });
  }

  /**
   * A new team starts in the Team Builder (a whole team can be pasted there
   * too, via Import / Export), in the regulation this list is showing — and
   * the folder that's open.
   */
  function createTeam() {
    const params = new URLSearchParams({ regulation: selectedRegulationId });
    // Made from inside a folder, it's filed there (see the Team Builder page).
    if (openFolder) params.set("folder", openFolder.id);
    router.push(`/team-builder?${params}`);
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

  /** One team's row — `index` stripes the list. */
  function renderTeamRow(team: Team, index: number) {
    return (
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
            {team.collab && (
              <span
                title={t.collab.collaborativeBadge}
                className="flex items-center gap-1 rounded-full bg-zinc-300 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-zinc-600 uppercase"
              >
                <Icon name={IconName.Group} size={12} />
                {t.collab.collaborativeBadge}
              </span>
            )}
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
                  ? (mon) => searchTerms.some((term) => pokemonMatchesQuery(mon, term, pokemonText))
                  : undefined
              }
            />
          </div>
        </div>
        {/* The row's actions: Duplicate, and a ⋯ with the rest. Clicks and
            Enter/Space stop here so they don't also open the team. */}
        <div
          role="group"
          aria-label={t.myTeams.teamOptions(team.name)}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
          className="flex shrink-0 items-start gap-1"
        >
          <IconButton
            variant="ghost"
            onClick={() => duplicateTeam(team.id)}
            aria-label={t.myTeams.duplicate}
            title={t.myTeams.duplicate}
            className={rowActionClass}
          >
            <Icon name={IconName.ContentCopy} size={18} />
          </IconButton>
          <RowActionsMenu
            label={t.myTeams.teamOptions(team.name)}
            onEdit={() => router.push(`/teams/${team.id}/edit`)}
            editLabel={t.myTeams.editTeam}
            middleAction={{
              label: t.teamFolders.moveTo,
              icon: IconName.Folder,
              onClick: () => setMovingTeamId(team.id),
            }}
            // A collaborative team is left or stopped from its page (Collaborate).
            extraActions={
              team.collab
                ? []
                : [
                    !isTeamArchived(team)
                      ? {
                          label: t.myTeams.archive,
                          icon: IconName.Archive,
                          onClick: () => archiveTeam(team.id),
                        }
                      : {
                          label: t.myTeams.unarchive,
                          icon: IconName.Unarchive,
                          onClick: () => unarchiveTeam(team.id),
                        },
                  ]
            }
            onRemove={team.collab ? undefined : () => setConfirmRemoveId(team.id)}
            removeLabel={t.myTeams.removeTeam}
          />
        </div>
      </li>
    );
  }

  /**
   * A panel entry a team can be dropped on: a folder or No folder files it
   * there (`folderId`, null: none); Archived (ARCHIVED) archives it.
   */
  function folderDropProps(folderId: string | null) {
    const dropKey = `folder:${folderId ?? UNFILED}`;
    return {
      isOver: dragOverId === dropKey,
      onDragOver: (event: React.DragEvent) => {
        if (!draggedId) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        if (dragOverId !== dropKey) setDragOverId(dropKey);
      },
      onDragLeave: () => {
        if (dragOverId === dropKey) setDragOverId(null);
      },
      onDrop: (event: React.DragEvent) => {
        event.preventDefault();
        const dragged = draggedId ? teams.find((team) => team.id === draggedId) : undefined;
        if (dragged && folderId === ARCHIVED) {
          // A collaborative team is left or stopped from its page, not archived.
          if (!dragged.collab && !isTeamArchived(dragged)) archiveTeam(dragged.id);
        } else if (dragged) {
          teamFolders.moveTeam(dragged.id, folderId);
        }
        setDraggedId(null);
        setDragOverId(null);
      },
    };
  }

  /** A folder's ⋮: rename, move up / down, delete (its teams stay, unfiled). */
  function folderMenu(folderId: string, name: string) {
    const index = orderedFolders.findIndex((folder) => folder.id === folderId);
    return (
      <RowActionsMenu
        label={t.teamFolders.options(name)}
        extraActions={[
          {
            label: t.teamFolders.rename,
            icon: IconName.Edit,
            onClick: () => setFolderDraft({ id: folderId, name }),
          },
          {
            label: t.teamFolders.moveUp,
            icon: IconName.ArrowUpward,
            onClick: () => teamFolders.moveFolder(folderId, -1),
            disabled: index <= 0,
          },
          {
            label: t.teamFolders.moveDown,
            icon: IconName.ArrowDownward,
            onClick: () => teamFolders.moveFolder(folderId, 1),
            disabled: index === orderedFolders.length - 1,
          },
          {
            label: t.teamFolders.delete,
            icon: IconName.Delete,
            onClick: () => {
              teamFolders.deleteFolder(folderId);
              if (openFolder?.id === folderId) router.replace("/teams", { scroll: false });
            },
          },
        ]}
      />
    );
  }

  /**
   * One entry of the folder panel: picks it on click; a folder (or No folder)
   * also takes dropped teams, and a folder has its ⋮.
   */
  function renderPanelEntry(entry: {
    key: string;
    /** What picking it sets ?folder= to (null: none — all teams). */
    pick: string | null;
    /** A folder's id (it has a ⋮), or what a drop does (see folderDropProps). */
    folderId: string | null;
    name: string;
    count: number;
    isPicked: boolean;
    icon: IconName;
    droppable: boolean;
  }) {
    const { isOver, ...drop } = folderDropProps(entry.folderId);
    return (
      <li
        key={entry.key}
        {...(entry.droppable ? drop : {})}
        className={cn(
          "flex items-center rounded-lg",
          entry.isPicked ? "bg-zinc-200" : "hover:bg-zinc-100",
          entry.droppable && isOver && "outline outline-2 -outline-offset-2 outline-zinc-500",
        )}
      >
        <button
          type="button"
          onClick={() => pickFolder(entry.pick)}
          aria-current={entry.isPicked ? "true" : undefined}
          className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-sm"
        >
          <Icon name={entry.icon} size={18} className="shrink-0 text-zinc-500" />
          <span
            className={cn(
              "min-w-0 flex-1 truncate",
              entry.isPicked ? "font-semibold text-zinc-900" : "text-zinc-700",
            )}
          >
            {entry.name}
          </span>
          <span className="shrink-0 text-xs text-zinc-500">{entry.count}</span>
        </button>
        {entry.folderId && entry.folderId !== ARCHIVED && folderMenu(entry.folderId, entry.name)}
      </li>
    );
  }

  const panelEntries = [
    {
      key: "all",
      pick: null,
      folderId: null,
      name: t.teamFolders.allTeams,
      count: activeRegulationTeams.length,
      isPicked: !isFiltered,
      icon: IconName.Folder,
      droppable: false,
    },
    ...orderedFolders.map((folder) => ({
      key: folder.id,
      pick: folder.id,
      folderId: folder.id,
      name: folder.name,
      count: teamsInFolder(activeRegulationTeams, teamFolders.folders, folder.id).length,
      isPicked: openFolder?.id === folder.id,
      icon: IconName.Folder,
      droppable: true,
    })),
    ...(hasFolders
      ? [
          {
            key: UNFILED,
            pick: UNFILED,
            folderId: null,
            name: t.teamFolders.noFolder,
            count: teamsInFolder(activeRegulationTeams, teamFolders.folders, null).length,
            isPicked: showingUnfiled,
            icon: IconName.Close,
            droppable: true,
          },
        ]
      : []),
    ...(archivedRegulationTeams.length > 0
      ? [
          {
            key: ARCHIVED,
            pick: ARCHIVED,
            folderId: ARCHIVED,
            name: t.teamFolders.archived,
            count: archivedRegulationTeams.length,
            isPicked: showingArchived,
            icon: IconName.Archive,
            droppable: true,
          },
        ]
      : []),
  ];

  const newFolderButton = (
    <button
      type="button"
      onClick={() => setFolderDraft({ name: "" })}
      className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
    >
      <Icon name={IconName.Add} size={18} />
      {t.teamFolders.newFolder}
    </button>
  );

  const movingTeam = movingTeamId ? teams.find((team) => team.id === movingTeamId) : undefined;

  /** Files the team being moved (the Move to folder dialog) and closes it. */
  function moveTo(folderId: string | null, folderName: string) {
    if (!movingTeam) return;
    teamFolders.moveTeam(movingTeam.id, folderId);
    toast.success(t.teamFolders.moved(movingTeam.name, folderName));
    setMovingTeamId(null);
  }

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
            onClick={createTeam}
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

      {/* Desktop only — mobile has search and add in its header row above. The
          same columns as below: search across the list, Create team across the panel. */}
      <div className="hidden items-center gap-6 md:grid md:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="min-w-0">
          {canSearch && (
            <SearchField
              query={searchQuery}
              onQueryChange={setSearchQuery}
              placeholder={t.myTeams.searchPlaceholder}
              ariaLabel={t.myTeams.searchLabel}
              className="w-full"
            />
          )}
        </div>
        <Button onClick={createTeam} className="w-full">
          {t.myTeams.createTeam}
        </Button>
      </div>

      {folderDraft && (
        <Modal onClose={() => setFolderDraft(null)} labelledBy="folder-name-title">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const name = folderDraft.name.trim();
              if (!name) return;
              if (folderDraft.id) teamFolders.renameFolder(folderDraft.id, name);
              else teamFolders.createFolder(name);
              setFolderDraft(null);
            }}
            className="flex flex-col gap-3"
          >
            <ModalTitle id="folder-name-title">
              {folderDraft.id ? t.teamFolders.renameTitle : t.teamFolders.newFolderTitle}
            </ModalTitle>
            <input
              value={folderDraft.name}
              onChange={(event) => setFolderDraft({ ...folderDraft, name: event.target.value })}
              placeholder={t.teamFolders.namePlaceholder}
              aria-label={t.teamFolders.name}
              maxLength={60}
              autoFocus
              className="w-full rounded-lg border border-zinc-300 bg-field p-2 text-sm text-zinc-900 focus:ring-2 focus:ring-zinc-400 focus:outline-none"
            />
            <div className="flex gap-2">
              <Button type="submit" disabled={!folderDraft.name.trim()}>
                {folderDraft.id ? t.common.save : t.teamFolders.create}
              </Button>
              <Button variant="outline" onClick={() => setFolderDraft(null)}>
                {t.common.cancel}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {movingTeam && (
        <Modal onClose={() => setMovingTeamId(null)} labelledBy="move-team-title">
          <div className="flex flex-col gap-3">
            <ModalTitle id="move-team-title">{t.teamFolders.moveTitle(movingTeam.name)}</ModalTitle>
            <ul className="flex flex-col gap-1">
              {[
                ...orderedFolders.map((folder) => ({ id: folder.id, name: folder.name })),
                { id: null, name: t.teamFolders.noFolder },
              ].map((option) => {
                const isCurrent = folderOf(teamFolders.folders, movingTeam.id) === option.id;
                return (
                  <li key={option.id ?? "none"}>
                    <button
                      type="button"
                      disabled={isCurrent}
                      onClick={() => moveTo(option.id, option.name)}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-zinc-900 enabled:hover:bg-zinc-100 disabled:text-zinc-500"
                    >
                      <Icon
                        name={option.id ? IconName.Folder : IconName.Close}
                        size={16}
                        className="shrink-0 text-zinc-500"
                      />
                      <span className="min-w-0 flex-1 truncate">{option.name}</span>
                      {isCurrent && (
                        <span className="text-xs text-zinc-500">{t.teamFolders.current}</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
            {/* A new folder, with this team in it. */}
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const input = event.currentTarget.elements.namedItem("folder") as HTMLInputElement;
                const name = input.value.trim();
                if (!name) return;
                moveTo(teamFolders.createFolder(name), name);
              }}
              className="flex gap-2 border-t border-zinc-200 pt-3"
            >
              <input
                name="folder"
                placeholder={t.teamFolders.namePlaceholder}
                aria-label={t.teamFolders.name}
                maxLength={60}
                className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-field p-2 text-sm text-zinc-900 focus:ring-2 focus:ring-zinc-400 focus:outline-none"
              />
              <Button type="submit" variant="outline" className="shrink-0">
                {t.teamFolders.newAndMove}
              </Button>
            </form>
            <Button variant="outline" onClick={() => setMovingTeamId(null)} className="self-start">
              {t.common.cancel}
            </Button>
          </div>
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

      {/* Phones: the folder panel as a row of chips above the list, the picked
          folder's ⋮ beside it (outside the scrolling row, so its menu isn't cut off). */}
      {!isLoading && (
        <div className="flex items-center gap-1 md:hidden">
          <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
            {panelEntries.map((entry) => (
              <button
                key={entry.key}
                type="button"
                onClick={() => pickFolder(entry.pick)}
                aria-current={entry.isPicked ? "true" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm whitespace-nowrap",
                  entry.isPicked
                    ? "bg-chrome-600 font-medium text-white"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200",
                )}
              >
                {entry.name}
                <span className={entry.isPicked ? "text-white/70" : "text-zinc-500"}>
                  {entry.count}
                </span>
              </button>
            ))}
            {newFolderButton}
          </div>
          {openFolder && folderMenu(openFolder.id, openFolder.name)}
        </div>
      )}

      {/* The teams (left), and on desktop the folder panel (right). */}
      <div className="flex flex-col gap-6 md:grid md:grid-cols-[minmax(0,1fr)_15rem] md:items-start">
        <div className="min-w-0">
          {isLoading ? (
            <LoadingState />
          ) : tabTeams.length === 0 && !isFiltered ? (
            tab === "active" ? (
              <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-6 py-14 text-center">
                <h3 className="text-lg font-semibold text-zinc-900">
                  {regulationTeams.length === 0 ? t.myTeams.noTeams : t.myTeams.noActiveTeams}
                </h3>
                <p className="max-w-md text-sm text-zinc-600">
                  {regulationTeams.length === 0 ? t.myTeams.noTeamsBody : t.myTeams.allArchivedBody}
                </p>
                <Button onClick={createTeam}>{t.myTeams.createTeam}</Button>
              </div>
            ) : (
              <p className="py-12 text-center text-sm text-zinc-500">{t.myTeams.noArchived}</p>
            )
          ) : isSearching && visibleTeams.length === 0 ? (
            <p className="py-12 text-center text-sm text-zinc-500">
              {t.myTeams.noMatches(tab, searchQuery.trim())}
            </p>
          ) : visibleTeams.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">
              {openFolder ? t.teamFolders.empty : t.teamFolders.allFiled}
            </p>
          ) : (
            <ul className="flex flex-col overflow-hidden rounded-lg">
              {visibleTeams.map(renderTeamRow)}
            </ul>
          )}
        </div>

        {!isLoading && (
          <aside
            aria-label={t.teamFolders.folders}
            className="hidden flex-col gap-1 md:sticky md:top-4 md:flex"
          >
            <h3 className="px-3 pb-1 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
              {t.teamFolders.folders}
            </h3>
            <ul className="flex flex-col gap-0.5">{panelEntries.map(renderPanelEntry)}</ul>
            {newFolderButton}
          </aside>
        )}
      </div>
    </section>
  );
}
