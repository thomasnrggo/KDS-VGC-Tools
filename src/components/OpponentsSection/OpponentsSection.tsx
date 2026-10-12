"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { useOpponents } from "@/hooks/useOpponents";
import { useOpponentListReversed } from "@/hooks/useOpponentListReversed";
import { useSeasons } from "@/hooks/useSeasons";
import { parseTeamFolder } from "@/lib/teamFolder";
import { REGULATIONS } from "@/data/regulations";
import type {
  BulkImportResult,
  Opponent,
  ParsedPokemon,
  Season,
  TeamFolderEntry,
} from "@/types";
import {
  parseSearchTerms,
  pokemonMatchesQuery,
} from "@/lib/pokemonMatchesQuery";
import { tagsMatchQuery } from "@/lib/opponentTags";
import {
  defaultDecision,
  importNeedsReview,
  type ImportDecision,
  type ImportEntry,
  type ImportRow,
} from "@/lib/opponentImport";
import { groupOpponents, type OpponentGroup } from "@/lib/opponentVariants";
import { OpponentForm } from "../OpponentForm";
import { OpponentCard, type OpponentCardProps } from "../OpponentCard";
import { BulkImportForm } from "../BulkImportForm";
import { ImportReview } from "../ImportReview";
import { MakeVariantPicker } from "../MakeVariantPicker";
import type { RowAction } from "../RowActionsMenu";
import { Modal } from "../Modal";
import { SearchField } from "../SearchField";
import { Icon } from "../Icon";
import { IconName } from "@/enums";

interface OpponentsSectionProps {
  myTeamPokemon: ParsedPokemon[];
  activeTeamId: string | null;
  /** False when there's an active team but it isn't tagged for selectedRegulationId — passed through to OpponentCard so it blocks Lead/Back picking with an explanatory message instead of letting you plan with an off-regulation team. */
  activeTeamMatchesRegulation: boolean;
  /** Lifted up to the page (see matchup-planner/page.tsx) so MyTeamHeader's team switcher can scope its offered list to the same regulation this section is already filtering opponents/seasons by. */
  selectedRegulationId: string;
  setSelectedRegulationId: (id: string) => void;
}

const MENU_ITEM_CLASSES =
  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100";

/**
 * Its own component (rather than sharing OpponentsSection's isMenuOpen/refs
 * at both the mobile and desktop render sites below) so each site's trigger
 * gets its own ref and open state — the same ref object can't be shared
 * between two simultaneously-mounted DOM nodes.
 */
function OpponentsMoreMenu({
  isLoading,
  regulationSeasons,
  currentSeasonId,
  clearDisabled,
  onLoadPreset,
  onBulkImport,
  onClearAll,
}: {
  isLoading: boolean;
  regulationSeasons: Season[];
  currentSeasonId: string | null;
  clearDisabled: boolean;
  onLoadPreset: (rawPaste: string, regulationId: string) => void;
  onBulkImport: () => void;
  onClearAll: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      const clickedTrigger = menuRef.current?.contains(target);
      const clickedDropdown = dropdownRef.current?.contains(target);
      if (!clickedTrigger && !clickedDropdown) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={menuRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="More opponent options"
        title="More options"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-300 text-zinc-700 hover:bg-zinc-100"
      >
        <Icon name={IconName.MoreVert} size={18} />
      </button>
      {isOpen && (
        <div
          ref={dropdownRef}
          role="menu"
          aria-label="More opponent options"
          className="absolute right-0 top-full z-20 mt-2 w-56 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 py-1 shadow-lg"
        >
          {!isLoading &&
            regulationSeasons.map((season) => (
              <button
                key={season.id}
                type="button"
                role="menuitem"
                onClick={() => {
                  onLoadPreset(season.rawPaste, season.regulationId);
                  setIsOpen(false);
                }}
                className={MENU_ITEM_CLASSES}
              >
                Load default set: {season.label}
                {season.id === currentSeasonId ? " (current)" : ""}
              </button>
            ))}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onBulkImport();
              setIsOpen(false);
            }}
            className={MENU_ITEM_CLASSES}
          >
            Mass import
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onClearAll();
              setIsOpen(false);
            }}
            disabled={clearDisabled}
            className="flex w-full items-center gap-2 border-t border-zinc-200 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950 disabled:cursor-not-allowed disabled:text-zinc-300 disabled:hover:bg-transparent"
          >
            Clear all data
          </button>
        </div>
      )}
    </div>
  );
}


export function OpponentsSection({
  myTeamPokemon,
  activeTeamId,
  activeTeamMatchesRegulation,
  selectedRegulationId,
  setSelectedRegulationId,
}: OpponentsSectionProps) {
  const {
    opponents,
    isLoading,
    analyzeOpponentImport,
    importOpponents,
    removeOpponent,
    removeOpponents,
    moveOpponent,
    setGroupMain,
    makeVariant,
    detachVariant,
    updateOpponentPlan,
    setOpponentTags,
    editOpponentTeam,
  } = useOpponents();
  const { seasons, currentSeasonId } = useSeasons();
  const { isReversed, toggleReversed } = useOpponentListReversed();
  // Drag only starts from the handle (armedId is set on pointerdown there) —
  // the row itself is full of pickers and a notes editor, so making the whole
  // row draggable like My Teams' rows would hijack text selection.
  const [armedId, setArmedId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isBulkImporting, setIsBulkImporting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  /** An import waiting on the review step (only opened when some team has a variant candidate). */
  const [pendingImport, setPendingImport] = useState<{
    rows: ImportRow[];
    regulationId: string;
  } | null>(null);
  const [variantPickerId, setVariantPickerId] = useState<string | null>(null);
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(() => new Set());

  // Regulation filter comes first — everything below (search, the empty-state
  // check, "Clear all data") operates on the currently-viewed regulation's
  // opponents only, not the full cross-regulation list.
  const regulationOpponents = opponents.filter(
    (opponent) => opponent.regulationId === selectedRegulationId,
  );
  const regulationSeasons = seasons.filter(
    (season) => season.regulationId === selectedRegulationId,
  );

  // Space-separated terms are ANDed together per opponent — "charizard basculegion"
  // only matches a team that has a Pokémon/item/tag for *each* term, not either one
  // ("rain scarf" = a rain-tagged team with a Choice Scarf on someone).
  const searchTerms = parseSearchTerms(searchQuery);
  const isSearching = searchTerms.length > 0;
  function matchesSearch(opponent: Opponent): boolean {
    return searchTerms.every(
      (term) =>
        opponent.team.pokemon.some((mon) => pokemonMatchesQuery(mon, term)) ||
        tagsMatchQuery(opponent.tags, term),
    );
  }
  const knownTags = [...new Set(regulationOpponents.flatMap((opponent) => opponent.tags))].sort();
  const labelById = new Map(opponents.map((opponent) => [opponent.id, opponent.label]));

  // Mains in list order, each with its variants (see groupOpponents). While
  // searching, a group shows if its main or any variant matches, with only
  // the matching variants listed — and those shown expanded.
  const groups = groupOpponents(regulationOpponents);
  const visibleGroups = isSearching
    ? groups.flatMap((group) => {
        const variants = group.variants.filter(matchesSearch);
        return matchesSearch(group.main) || variants.length > 0 ? [{ ...group, variants }] : [];
      })
    : groups;
  // Reverse is view-only — sortOrder never changes, so flipping back is free.
  // It flips the groups; variants keep their order under their main.
  const displayedGroups = isReversed ? [...visibleGroups].reverse() : visibleGroups;
  // Only mains take part in the list order. Disabled while searching: the
  // filtered list isn't the full order a move is positioned against.
  const canReorder = !isSearching && groups.length > 1;

  function isGroupExpanded(group: OpponentGroup): boolean {
    return isSearching ? group.variants.length > 0 : expandedGroupIds.has(group.main.id);
  }

  function toggleGroup(mainId: string) {
    setExpandedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(mainId)) next.delete(mainId);
      else next.add(mainId);
      return next;
    });
  }

  /** Moves main `movedId` to `toDisplayIndex` of the list as shown, translating a reversed view back to list order. */
  function moveInDisplay(movedId: string, toDisplayIndex: number) {
    const displayIds = displayedGroups
      .map((group) => group.main.id)
      .filter((id) => id !== movedId);
    displayIds.splice(toDisplayIndex, 0, movedId);
    const listIds = isReversed ? displayIds.reverse() : displayIds;
    moveOpponent(
      groups.map((group) => group.main.id),
      movedId,
      listIds.indexOf(movedId),
    );
  }

  function endDrag() {
    setArmedId(null);
    setDraggedId(null);
    setDragOverId(null);
  }

  /** Moves variant `movedId` to `toIndex` among its group's variants — their order is separate from the main list's, and Reverse doesn't flip it. */
  function moveVariant(group: OpponentGroup, movedId: string, toIndex: number) {
    moveOpponent(
      group.variants.map((variant) => variant.id),
      movedId,
      toIndex,
    );
  }

  // A dragged variant can only be dropped among its own group's variants; a
  // dragged main only among the mains (dropping it on a variant row drops it
  // on that variant's group).
  const draggedVariantGroup = draggedId
    ? groups.find((group) => group.variants.some((variant) => variant.id === draggedId))
    : undefined;

  /** Dropping onto a row takes that row's place: below it when dragging down, above it when dragging up. */
  function handleDrop(targetId: string) {
    if (draggedId && draggedId !== targetId && !draggedVariantGroup) {
      moveInDisplay(
        draggedId,
        displayedGroups.findIndex((group) => group.main.id === targetId),
      );
    }
    endDrag();
  }

  function handleVariantDrop(group: OpponentGroup, targetId: string) {
    if (draggedId && draggedId !== targetId) {
      moveVariant(
        group,
        draggedId,
        group.variants.findIndex((variant) => variant.id === targetId),
      );
    }
    endDrag();
  }

  // Hidden below md: HTML5 drag-and-drop doesn't fire on most touch devices,
  // so mobile reorders through the ⋮ menu's Move items instead.
  function dragHandle(id: string) {
    return (
      <span
        onPointerDown={() => setArmedId(id)}
        onPointerUp={() => setArmedId(null)}
        title="Drag to reorder"
        className="-ml-1 hidden shrink-0 cursor-grab text-zinc-400 hover:text-zinc-600 active:cursor-grabbing md:flex"
      >
        <Icon name={IconName.DragIndicator} size={16} />
      </span>
    );
  }

  function reportImportResult({ importedCount, variantCount, skipped }: BulkImportResult) {
    if (importedCount === 0 && skipped.length === 0) {
      setImportNotice(
        "Couldn't import any teams from that paste — check the format and try again.",
      );
      return;
    }
    const imported = `Imported ${importedCount} team${importedCount === 1 ? "" : "s"}${
      variantCount > 0 ? ` (${variantCount} as variant${variantCount === 1 ? "" : "s"})` : ""
    }.`;
    setImportNotice(
      skipped.length > 0
        ? `${imported} Skipped ${skipped.length}: ${skipped.join("; ")}`
        : imported,
    );
  }

  /** Analyzes `entries`; opens the review step if any team could be a variant, otherwise imports straight away. */
  function runImport(entries: ImportEntry[], regulationId: string) {
    const rows = analyzeOpponentImport(entries, regulationId);
    if (importNeedsReview(rows)) {
      setPendingImport({ rows, regulationId });
    } else {
      reportImportResult(importOpponents(rows, rows.map(defaultDecision), regulationId));
    }
  }

  function confirmImportReview(decisions: ImportDecision[]) {
    if (!pendingImport) return;
    reportImportResult(importOpponents(pendingImport.rows, decisions, pendingImport.regulationId));
    setPendingImport(null);
  }

  function handleSubmit(label: string, rawPaste: string, pokepasteUrl: string) {
    if (!label.trim()) {
      return "Give this opponent a name.";
    }
    if (!rawPaste.trim()) {
      return "Paste the opponent's Showdown export.";
    }
    const rows = analyzeOpponentImport(
      [{ label, rawPaste, pokepasteUrl: pokepasteUrl || undefined }],
      selectedRegulationId,
    );
    const [row] = rows;
    if (row.error) {
      return row.error;
    }
    if (row.duplicateOf !== undefined) {
      return `"${row.duplicateOf}" is already this exact team (same Pokémon, items, and moves) under this regulation.`;
    }
    setIsAdding(false);
    if (importNeedsReview(rows)) {
      setPendingImport({ rows, regulationId: selectedRegulationId });
    } else {
      importOpponents(rows, rows.map(defaultDecision), selectedRegulationId);
    }
    return null;
  }

  function handleBulkImport(entries: TeamFolderEntry[]) {
    setIsBulkImporting(false);
    runImport(entries, selectedRegulationId);
  }

  function loadPreset(rawPaste: string, regulationId: string) {
    runImport(parseTeamFolder(rawPaste), regulationId);
  }

  function toggleSearch() {
    setIsSearchOpen((open) => {
      const next = !open;
      if (!next) setSearchQuery("");
      return next;
    });
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

  function requestClearAll() {
    setIsConfirmingClear(true);
  }

  function confirmClearAll() {
    removeOpponents(regulationOpponents.map((opponent) => opponent.id));
    setIsConfirmingClear(false);
  }

  function confirmRemove() {
    if (!confirmRemoveId) return;
    removeOpponent(confirmRemoveId);
    setConfirmRemoveId(null);
  }

  /** Move up/down/top/bottom for the row at `index` of a `count`-row list as shown — the mains, or one group's variants. */
  function moveActions(
    index: number,
    count: number,
    move: (toIndex: number) => void,
  ): RowAction[] {
    const lastIndex = count - 1;
    return [
      {
        label: "Move to top",
        icon: IconName.VerticalAlignTop,
        onClick: () => move(0),
        disabled: index === 0,
      },
      {
        label: "Move up",
        icon: IconName.ArrowUpward,
        onClick: () => move(index - 1),
        disabled: index === 0,
      },
      {
        label: "Move down",
        icon: IconName.ArrowDownward,
        onClick: () => move(index + 1),
        disabled: index === lastIndex,
      },
      {
        label: "Move to bottom",
        icon: IconName.VerticalAlignBottom,
        onClick: () => move(lastIndex),
        disabled: index === lastIndex,
      },
    ];
  }

  function renderCard(
    opponent: Opponent,
    options: {
      dragHandle?: ReactNode;
      extraActions: RowAction[];
      variantToggle?: OpponentCardProps["variantToggle"];
      isVariant?: boolean;
    },
  ) {
    const copiedFromId = activeTeamId ? opponent.copiedPlanFrom?.[activeTeamId] : undefined;
    return (
      <OpponentCard
        opponent={opponent}
        myTeamPokemon={myTeamPokemon}
        activeTeamId={activeTeamId}
        activeTeamMatchesRegulation={activeTeamMatchesRegulation}
        onEdit={() => startEditing(opponent.id)}
        onRemove={() => setConfirmRemoveId(opponent.id)}
        dragHandle={options.dragHandle}
        extraActions={options.extraActions}
        variantToggle={options.variantToggle}
        isVariant={options.isVariant}
        copiedFromLabel={
          copiedFromId ? (labelById.get(copiedFromId) ?? "the main team") : undefined
        }
        onUpdateTags={(tags) => setOpponentTags(opponent.id, tags)}
        knownTags={knownTags}
        onUpdatePlan={(updater) => {
          if (activeTeamId) {
            updateOpponentPlan(opponent.id, activeTeamId, updater);
          }
        }}
        isMatch={
          isSearching
            ? (mon) => searchTerms.some((term) => pokemonMatchesQuery(mon, term))
            : undefined
        }
        isTagMatch={
          isSearching ? (tag) => searchTerms.some((term) => tag.includes(term)) : undefined
        }
      />
    );
  }

  const confirmRemoveOpponent = confirmRemoveId
    ? (opponents.find((opponent) => opponent.id === confirmRemoveId) ?? null)
    : null;
  // Removing a main with variants promotes its first variant (see removeOpponent).
  const confirmRemoveSuccessor = confirmRemoveId
    ? groups.find((group) => group.main.id === confirmRemoveId)?.variants[0]
    : undefined;

  const variantPickerOpponent = variantPickerId
    ? (opponents.find((opponent) => opponent.id === variantPickerId) ?? null)
    : null;

  const editingOpponent = editingId
    ? (opponents.find((opponent) => opponent.id === editingId) ?? null)
    : null;

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

  const canSearch =
    !isLoading && !isAdding && !isBulkImporting && regulationOpponents.length > 0;

  // Hidden once search is open — the field itself (below) has its own icon,
  // and its trailing button takes over closing search (see PLANNING.md).
  const searchToggleButton = canSearch && !isSearchOpen && (
    <button
      type="button"
      onClick={toggleSearch}
      aria-label="Search opponents"
      aria-expanded={isSearchOpen}
      title="Search by Pokémon, item, or tag"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
    >
      <Icon name={IconName.Search} size={18} />
    </button>
  );

  const reverseButton = canSearch && regulationOpponents.length > 1 && (
    <button
      type="button"
      onClick={toggleReversed}
      aria-pressed={isReversed}
      aria-label="Reverse order"
      title={isReversed ? "Showing reversed — click for original order" : "Reverse order"}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
        isReversed
          ? "bg-zinc-200 text-zinc-900"
          : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
      }`}
    >
      <Icon name={IconName.SwapVert} size={18} />
    </button>
  );

  return (
    <section className="flex flex-col gap-4">
      {/* Mobile: title + regulation on their own row, search (left) and
          add/more (right) below — one row was cramming a big "Add opponent"
          pill against the title/regulation/search cluster (see PLANNING.md). */}
      <div className="flex flex-col gap-3 md:hidden">
        <div className="flex items-center justify-between gap-3">
          <h2 className="whitespace-nowrap text-xl font-semibold text-zinc-900">
            Opposing Teams
          </h2>
          {regulationControl}
        </div>
        <div className="flex items-center gap-2">
          {searchToggleButton}
          {isSearchOpen && canSearch && (
            <SearchField
              query={searchQuery}
              onQueryChange={setSearchQuery}
              placeholder='Search by Pokémon, item, or tag… (e.g. "rain scarf")'
              ariaLabel="Search opponents by Pokémon, item, or tag"
              onClose={toggleSearch}
              autoFocus
              className="min-w-0 flex-1"
            />
          )}
          {!isAdding && !isBulkImporting && (
            <div className="ml-auto flex gap-2">
              {reverseButton}
              <button
                type="button"
                onClick={startAdding}
                aria-label="Add opponent"
                title="Add opponent"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-600 dark:bg-zinc-400 text-white hover:bg-zinc-700 dark:hover:bg-zinc-300"
              >
                <Icon name={IconName.Add} size={20} />
              </button>
              <OpponentsMoreMenu
                isLoading={isLoading}
                regulationSeasons={regulationSeasons}
                currentSeasonId={currentSeasonId}
                clearDisabled={regulationOpponents.length === 0}
                onLoadPreset={loadPreset}
                onBulkImport={startBulkImporting}
                onClearAll={requestClearAll}
              />
            </div>
          )}
        </div>
      </div>

      {/* Desktop: unchanged single-row layout. */}
      <div className="hidden items-center justify-between md:flex">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-zinc-900">
            Opposing Teams
          </h2>
          {regulationControl}
        </div>
        {!isAdding && !isBulkImporting && (
          <div className="flex gap-2">
            {reverseButton}
            <button
              type="button"
              onClick={startAdding}
              className="rounded-full bg-zinc-600 dark:bg-zinc-400 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:hover:bg-zinc-300"
            >
              Add opponent
            </button>
            <OpponentsMoreMenu
              isLoading={isLoading}
              regulationSeasons={regulationSeasons}
              currentSeasonId={currentSeasonId}
              clearDisabled={regulationOpponents.length === 0}
              onLoadPreset={loadPreset}
              onBulkImport={startBulkImporting}
              onClearAll={requestClearAll}
            />
          </div>
        )}
      </div>

      {/* Desktop only — always visible rather than toggled, since there's
          room for it; mobile still shows a toggle-triggered version inline
          in the row above instead (see PLANNING.md). */}
      {canSearch && (
        <SearchField
          query={searchQuery}
          onQueryChange={setSearchQuery}
          placeholder='Search by Pokémon, item, or tag… (e.g. "rain scarf")'
          ariaLabel="Search opponents by Pokémon, item, or tag"
          className="hidden md:block"
        />
      )}

      {isAdding && (
        <Modal onClose={() => setIsAdding(false)} labelledBy="add-opponent-title">
          <h2
            id="add-opponent-title"
            className="mb-4 text-lg font-semibold text-zinc-900"
          >
            Add opponent
          </h2>
          <OpponentForm
            bordered={false}
            onSubmit={handleSubmit}
            onCancel={() => setIsAdding(false)}
          />
        </Modal>
      )}
      {editingOpponent && (
        <Modal
          onClose={() => setEditingId(null)}
          labelledBy="edit-opponent-title"
        >
          <h2
            id="edit-opponent-title"
            className="mb-4 text-lg font-semibold text-zinc-900"
          >
            Edit opponent
          </h2>
          <OpponentForm
            bordered={false}
            initialLabel={editingOpponent.label}
            initialPokepasteUrl={editingOpponent.pokepasteUrl ?? ""}
            initialRawPaste={editingOpponent.team.rawPaste}
            submitLabel="Save changes"
            onSubmit={(label, rawPaste, pokepasteUrl) => {
              const result = editOpponentTeam(
                editingOpponent.id,
                label,
                rawPaste,
                pokepasteUrl,
              );
              if (result) {
                return result;
              }
              setEditingId(null);
              return null;
            }}
            onCancel={() => setEditingId(null)}
          />
        </Modal>
      )}
      {isBulkImporting && (
        <BulkImportForm
          onImport={handleBulkImport}
          onCancel={() => setIsBulkImporting(false)}
        />
      )}
      {importNotice && (
        <div
          role="status"
          className="flex items-start justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700"
        >
          <span>{importNotice}</span>
          <button
            type="button"
            onClick={() => setImportNotice(null)}
            aria-label="Dismiss"
            className="shrink-0 text-zinc-500 hover:text-zinc-700"
          >
            ×
          </button>
        </div>
      )}

      {isConfirmingClear && (
        <Modal
          onClose={() => setIsConfirmingClear(false)}
          labelledBy="confirm-clear-opponents-title"
        >
          <h2
            id="confirm-clear-opponents-title"
            className="mb-2 text-lg font-semibold text-zinc-900"
          >
            Clear all {REGULATIONS.find((r) => r.id === selectedRegulationId)?.label} opponent
            teams?
          </h2>
          <p className="mb-4 text-sm text-zinc-600">
            This removes all {regulationOpponents.length} opponent
            {regulationOpponents.length === 1 ? "" : "s"} under this regulation and can&apos;t be
            undone — you&apos;ll need to re-add or re-import them. Opponents under other
            regulations aren&apos;t affected.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={confirmClearAll}
              className="rounded-full bg-red-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
            >
              Clear all data
            </button>
            <button
              type="button"
              onClick={() => setIsConfirmingClear(false)}
              className="rounded-full border border-zinc-300 px-5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {pendingImport && (
        <ImportReview
          rows={pendingImport.rows}
          onConfirm={confirmImportReview}
          onCancel={() => setPendingImport(null)}
        />
      )}

      {variantPickerOpponent && (
        <MakeVariantPicker
          opponent={variantPickerOpponent}
          groups={groups.filter((group) => group.main.id !== variantPickerOpponent.id)}
          onPick={(mainId) => {
            makeVariant(variantPickerOpponent.id, mainId);
            setExpandedGroupIds((prev) => new Set(prev).add(mainId));
            setVariantPickerId(null);
          }}
          onCancel={() => setVariantPickerId(null)}
        />
      )}

      {confirmRemoveOpponent && (
        <Modal
          onClose={() => setConfirmRemoveId(null)}
          labelledBy="confirm-remove-opponent-title"
        >
          <h2
            id="confirm-remove-opponent-title"
            className="mb-2 text-lg font-semibold text-zinc-900"
          >
            Remove {confirmRemoveOpponent.label}?
          </h2>
          <p className="mb-4 text-sm text-zinc-600">
            This can&apos;t be undone — you&apos;ll need to re-add or re-import
            this team.
            {confirmRemoveSuccessor && (
              <>
                {" "}
                Its variant &ldquo;{confirmRemoveSuccessor.label}&rdquo; becomes the
                group&apos;s main team.
              </>
            )}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={confirmRemove}
              className="rounded-full bg-red-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
            >
              Remove opponent
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
      ) : regulationOpponents.length === 0 && !isAdding && !isBulkImporting ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-6 py-14 text-center">
          <Image
            src="/resources/logo.png"
            alt=""
            width={56}
            height={56}
            unoptimized
            className="h-14 w-14"
          />
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-semibold text-zinc-900">
              Prepare against your rivals
            </h3>
            <p className="max-w-md text-sm text-zinc-600">
              Paste a Pokémon Showdown export for a team you want to prep
              against, we&apos;ll pull in the roster, held items, and movesets
              automatically so you can plan your leads and backs.
            </p>
          </div>
          <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-center">
            <button
              type="button"
              onClick={startAdding}
              className="rounded-full bg-zinc-600 dark:bg-zinc-400 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:hover:bg-zinc-300"
            >
              Add opponent
            </button>
            {regulationSeasons.map((season) => (
              <button
                key={season.id}
                type="button"
                onClick={() => loadPreset(season.rawPaste, season.regulationId)}
                className="rounded-full border border-zinc-300 bg-zinc-50 px-5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
              >
                Use default set: {season.label}
                {season.id === currentSeasonId ? " (current)" : ""}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={startBulkImporting}
            className="text-sm font-medium text-zinc-600 hover:underline"
          >
            Prepping for a big tournament? Import a whole folder of teams at
            once →
          </button>
        </div>
      ) : isSearching && displayedGroups.length === 0 ? (
        <p className="py-12 text-center text-sm text-zinc-500">
          No opponents have a Pokémon, item, or tag matching &ldquo;
          {searchQuery.trim()}&rdquo;.
        </p>
      ) : (
        <ul className="flex flex-col">
          {displayedGroups.map((group, index) => {
            const { main, variants } = group;
            const isExpanded = isGroupExpanded(group);
            // Same as canReorder: the filtered variants aren't the full order.
            const canReorderVariants = !isSearching && variants.length > 1;
            return (
              <div
                key={main.id}
                draggable={armedId === main.id}
                onPointerUp={() => setArmedId(null)}
                onDragStart={(event) => {
                  // Sprites inside the row are natively draggable images, and
                  // their dragstart bubbles here too — only a drag that began
                  // on this row's handle is a reorder.
                  if (armedId !== main.id) return;
                  setDraggedId(main.id);
                  event.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={endDrag}
                onDragOver={(event) => {
                  if (!draggedId || draggedVariantGroup) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  if (dragOverId !== main.id) setDragOverId(main.id);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  handleDrop(main.id);
                }}
                className={`${index % 2 === 0 ? "bg-zinc-200" : "bg-zinc-100"} ${
                  draggedId === main.id ? "opacity-40" : ""
                } ${
                  dragOverId === main.id && draggedId !== main.id
                    ? "outline outline-2 -outline-offset-2 outline-zinc-500"
                    : ""
                }`}
              >
                {renderCard(main, {
                  dragHandle: canReorder && dragHandle(main.id),
                  // Hidden while searching — matching variants are shown
                  // expanded automatically then.
                  variantToggle:
                    variants.length > 0 && !isSearching
                      ? {
                          count: variants.length,
                          isExpanded,
                          onToggle: () => toggleGroup(main.id),
                        }
                      : undefined,
                  extraActions: [
                    ...(canReorder
                      ? moveActions(index, displayedGroups.length, (toIndex) =>
                          moveInDisplay(main.id, toIndex),
                        )
                      : []),
                    ...(groups.length > 1
                      ? [
                          {
                            label: "Make variant of…",
                            icon: IconName.Merge,
                            onClick: () => setVariantPickerId(main.id),
                          },
                        ]
                      : []),
                  ],
                })}
                {isExpanded &&
                  variants.map((variant, variantIndex) => (
                    // An inset left bar (a shadow, so it takes no layout
                    // space) marks a variant as part of the main row above it
                    // while keeping its columns aligned with every other row.
                    // Its drag events stop here when they're a variant
                    // reorder within this group; a dragged main bubbles on up
                    // to the group's wrapper.
                    <div
                      key={variant.id}
                      draggable={armedId === variant.id}
                      onPointerUp={() => setArmedId(null)}
                      onDragStart={(event) => {
                        if (armedId !== variant.id) return;
                        event.stopPropagation();
                        setDraggedId(variant.id);
                        event.dataTransfer.effectAllowed = "move";
                      }}
                      onDragOver={(event) => {
                        if (draggedVariantGroup?.main.id !== main.id) return;
                        event.stopPropagation();
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                        if (dragOverId !== variant.id) setDragOverId(variant.id);
                      }}
                      onDrop={(event) => {
                        if (draggedVariantGroup?.main.id !== main.id) return;
                        event.stopPropagation();
                        event.preventDefault();
                        handleVariantDrop(group, variant.id);
                      }}
                      className={`border-t border-zinc-300 shadow-[inset_4px_0_0_0_var(--color-zinc-400)] ${
                        draggedId === variant.id ? "opacity-40" : ""
                      } ${
                        dragOverId === variant.id && draggedId !== variant.id
                          ? "outline outline-2 -outline-offset-2 outline-zinc-500"
                          : ""
                      }`}
                    >
                      {renderCard(variant, {
                        isVariant: true,
                        dragHandle: canReorderVariants && dragHandle(variant.id),
                        extraActions: [
                          ...(canReorderVariants
                            ? moveActions(variantIndex, variants.length, (toIndex) =>
                                moveVariant(group, variant.id, toIndex),
                              )
                            : []),
                          {
                            label: "Set as main",
                            icon: IconName.Star,
                            onClick: () => {
                              setGroupMain(main.id, variant.id);
                              // Expansion is tracked by main id — carry it over
                              // so the group stays open under its new main.
                              setExpandedGroupIds((prev) => new Set(prev).add(variant.id));
                            },
                          },
                          {
                            label: "Remove from group",
                            icon: IconName.CallSplit,
                            onClick: () => detachVariant(variant.id),
                          },
                        ],
                      })}
                    </div>
                  ))}
              </div>
            );
          })}
        </ul>
      )}
    </section>
  );
}
