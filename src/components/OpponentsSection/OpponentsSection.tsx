"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { useOpponents } from "@/hooks/useOpponents";
import { useOpponentListReversed } from "@/hooks/useOpponentListReversed";
import { useSeasons } from "@/hooks/useSeasons";
import { parseTeamFolder } from "@/lib/teamFolder";
import { REGULATIONS } from "@/data/regulations";
import type { BulkImportResult, Opponent, ParsedPokemon, Season, TeamFolderEntry } from "@/types";
import { parseSearchTerms, pokemonMatchesQuery } from "@/lib/pokemonMatchesQuery";
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
import { TEAM_REPORT_PREP_ENABLED } from "@/constants";
import { useMessages, usePokemonText } from "@/hooks/useLanguage";
import { cn } from "@/lib/utils";
import { Button } from "@/components/Button";
import { LoadingState } from "@/components/LoadingState";

/**
 * The opponent list the section shows and edits — the personal one
 * (useOpponents) or a prep group's (useGroupOpponents, which also says who
 * may remove each opponent).
 */
export type OpponentListSource = Omit<ReturnType<typeof useOpponents>, "addOpponents"> & {
  canRemove?: (opponent: Opponent) => boolean;
};

interface OpponentsSectionProps {
  source: OpponentListSource;
  /** Replaces the "Opposing Teams" heading — the planner puts its list switcher here. */
  title?: ReactNode;
  /** Shown under the header row — a prep group's bar. */
  banner?: ReactNode;
  /** A prep group belongs to one regulation: shown, not switchable. */
  regulationLocked?: boolean;
  /** False hides "Clear all data" (a prep group's members other than its owner). */
  canClearAll?: boolean;
  /** Extra ⋮ menu items for a card — e.g. copying it between the personal list and a group. */
  cardActions?: (opponent: Opponent) => RowAction[];
  /** Link that opens a card's team in the Damage Calculator. */
  calcHref?: (opponent: Opponent) => string;
  /** "Added by …" after a card's name, in a prep group. */
  addedByLabel?: (opponent: Opponent) => string | undefined;
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
  canClearAll,
  onLoadPreset,
  onBulkImport,
  onClearAll,
}: {
  isLoading: boolean;
  regulationSeasons: Season[];
  currentSeasonId: string | null;
  clearDisabled: boolean;
  canClearAll: boolean;
  onLoadPreset: (rawPaste: string, regulationId: string) => void;
  onBulkImport: () => void;
  onClearAll: () => void;
}) {
  const t = useMessages();
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
        aria-label={t.opponents.moreOptions}
        title={t.rowActions.moreOptions}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-300 text-zinc-700 hover:bg-zinc-100"
      >
        <Icon name={IconName.MoreVert} size={18} />
      </button>
      {isOpen && (
        <div
          ref={dropdownRef}
          role="menu"
          aria-label={t.opponents.moreOptions}
          className="absolute top-full right-0 z-20 mt-2 w-56 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 py-1 shadow-lg"
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
                {t.opponents.loadDefaultSet(season.label, season.id === currentSeasonId)}
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
            {t.opponents.massImport}
          </button>
          {canClearAll && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onClearAll();
                setIsOpen(false);
              }}
              disabled={clearDisabled}
              className="flex w-full items-center gap-2 border-t border-zinc-200 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-zinc-300 disabled:hover:bg-transparent dark:hover:bg-red-950"
            >
              {t.opponents.clearAll}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function OpponentsSection({
  source,
  title,
  banner,
  regulationLocked = false,
  canClearAll = true,
  cardActions,
  calcHref,
  addedByLabel,
  myTeamPokemon,
  activeTeamId,
  activeTeamMatchesRegulation,
  selectedRegulationId,
  setSelectedRegulationId,
}: OpponentsSectionProps) {
  const t = useMessages();
  const pokemonText = usePokemonText();
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
    canRemove,
  } = source;
  const { seasons, currentSeasonId } = useSeasons();
  const router = useRouter();
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
        opponent.team.pokemon.some((mon) => pokemonMatchesQuery(mon, term, pokemonText)) ||
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
    const displayIds = displayedGroups.map((group) => group.main.id).filter((id) => id !== movedId);
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
        title={t.opponents.dragToReorder}
        className="-ml-1 hidden shrink-0 cursor-grab text-zinc-400 hover:text-zinc-600 active:cursor-grabbing md:flex"
      >
        <Icon name={IconName.DragIndicator} size={16} />
      </span>
    );
  }

  function reportImportResult({ importedCount, variantCount, skipped }: BulkImportResult) {
    if (importedCount === 0 && skipped.length === 0) {
      setImportNotice(t.opponents.importFailed);
      return;
    }
    const imported = t.opponents.imported(importedCount, variantCount);
    setImportNotice(
      skipped.length > 0
        ? `${imported} ${t.opponents.skipped(skipped.length, skipped.join("; "))}`
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
      return t.errors.opponentNameRequired;
    }
    if (!rawPaste.trim()) {
      return t.errors.opponentPasteRequired;
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
      return t.opponents.duplicate(row.duplicateOf);
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
  function moveActions(index: number, count: number, move: (toIndex: number) => void): RowAction[] {
    const lastIndex = count - 1;
    return [
      {
        label: t.opponents.moveToTop,
        icon: IconName.VerticalAlignTop,
        onClick: () => move(0),
        disabled: index === 0,
      },
      {
        label: t.opponents.moveUp,
        icon: IconName.ArrowUpward,
        onClick: () => move(index - 1),
        disabled: index === 0,
      },
      {
        label: t.opponents.moveDown,
        icon: IconName.ArrowDownward,
        onClick: () => move(index + 1),
        disabled: index === lastIndex,
      },
      {
        label: t.opponents.moveToBottom,
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
        onRemove={
          !canRemove || canRemove(opponent) ? () => setConfirmRemoveId(opponent.id) : undefined
        }
        addedByLabel={addedByLabel?.(opponent)}
        calcHref={calcHref?.(opponent)}
        dragHandle={options.dragHandle}
        extraActions={[
          // The prep page for this opponent vs the selected team — see
          // docs/team-report.md.
          ...(activeTeamId && TEAM_REPORT_PREP_ENABLED
            ? [
                {
                  label: t.opponents.matchupReport,
                  icon: IconName.Description,
                  onClick: () => router.push(`/teams/${activeTeamId}/matchups/${opponent.id}`),
                },
              ]
            : []),
          ...options.extraActions,
          ...(cardActions?.(opponent) ?? []),
        ]}
        variantToggle={options.variantToggle}
        isVariant={options.isVariant}
        copiedFromLabel={
          copiedFromId ? (labelById.get(copiedFromId) ?? t.opponents.theMainTeam) : undefined
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
            ? (mon) => searchTerms.some((term) => pokemonMatchesQuery(mon, term, pokemonText))
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
    REGULATIONS.length > 1 && !regulationLocked ? (
      <div className="relative shrink-0">
        <select
          value={selectedRegulationId}
          onChange={(event) => setSelectedRegulationId(event.target.value)}
          aria-label={t.common.regulation}
          className="appearance-none rounded-full border border-zinc-300 bg-zinc-50 py-1 pr-8 pl-3 text-xs font-medium text-zinc-700"
        >
          {REGULATIONS.map((regulation) => (
            <option key={regulation.id} value={regulation.id}>
              {t.common.regulationLabel(regulation.label)}
            </option>
          ))}
        </select>
        <Icon
          name={IconName.ExpandMore}
          size={14}
          className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-zinc-500"
        />
      </div>
    ) : (
      <span className="shrink-0 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-500">
        {t.common.regulationLabel(
          REGULATIONS.find((regulation) => regulation.id === selectedRegulationId)?.label ??
            REGULATIONS[0]?.label ??
            "",
        )}
      </span>
    );

  const canSearch = !isLoading && !isAdding && !isBulkImporting && regulationOpponents.length > 0;

  // Hidden once search is open — the field itself (below) has its own icon,
  // and its trailing button takes over closing search (see PLANNING.md).
  const searchToggleButton = canSearch && !isSearchOpen && (
    <button
      type="button"
      onClick={toggleSearch}
      aria-label={t.opponents.search}
      aria-expanded={isSearchOpen}
      title={t.opponents.searchHint}
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
      aria-label={t.opponents.reverse}
      title={isReversed ? t.opponents.reversed : t.opponents.reverse}
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
        isReversed
          ? "bg-zinc-200 text-zinc-900"
          : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700",
      )}
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
          <h2 className="text-xl font-semibold whitespace-nowrap text-zinc-900">
            {title ?? t.opponents.title}
          </h2>
          {regulationControl}
        </div>
        <div className="flex items-center gap-2">
          {searchToggleButton}
          {isSearchOpen && canSearch && (
            <SearchField
              query={searchQuery}
              onQueryChange={setSearchQuery}
              placeholder={t.opponents.searchPlaceholder}
              ariaLabel={t.opponents.searchLabel}
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
                aria-label={t.opponents.add}
                title={t.opponents.add}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-chrome-600 text-white hover:bg-chrome-700"
              >
                <Icon name={IconName.Add} size={20} />
              </button>
              <OpponentsMoreMenu
                isLoading={isLoading}
                regulationSeasons={regulationSeasons}
                currentSeasonId={currentSeasonId}
                clearDisabled={regulationOpponents.length === 0}
                canClearAll={canClearAll}
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
          <h2 className="text-xl font-semibold text-zinc-900">{title ?? t.opponents.title}</h2>
          {regulationControl}
        </div>
        {!isAdding && !isBulkImporting && (
          <div className="flex gap-2">
            {reverseButton}
            <Button onClick={startAdding}>{t.opponents.add}</Button>
            <OpponentsMoreMenu
              isLoading={isLoading}
              regulationSeasons={regulationSeasons}
              currentSeasonId={currentSeasonId}
              clearDisabled={regulationOpponents.length === 0}
              canClearAll={canClearAll}
              onLoadPreset={loadPreset}
              onBulkImport={startBulkImporting}
              onClearAll={requestClearAll}
            />
          </div>
        )}
      </div>

      {banner}

      {/* Desktop only — always visible rather than toggled, since there's
          room for it; mobile still shows a toggle-triggered version inline
          in the row above instead (see PLANNING.md). */}
      {canSearch && (
        <SearchField
          query={searchQuery}
          onQueryChange={setSearchQuery}
          placeholder={t.opponents.searchPlaceholder}
          ariaLabel={t.opponents.searchLabel}
          className="hidden md:block"
        />
      )}

      {isAdding && (
        <Modal onClose={() => setIsAdding(false)} labelledBy="add-opponent-title">
          <h2 id="add-opponent-title" className="mb-4 text-lg font-semibold text-zinc-900">
            {t.opponents.add}
          </h2>
          <OpponentForm
            bordered={false}
            onSubmit={handleSubmit}
            onCancel={() => setIsAdding(false)}
          />
        </Modal>
      )}
      {editingOpponent && (
        <Modal onClose={() => setEditingId(null)} labelledBy="edit-opponent-title">
          <h2 id="edit-opponent-title" className="mb-4 text-lg font-semibold text-zinc-900">
            {t.opponents.edit}
          </h2>
          <OpponentForm
            bordered={false}
            initialLabel={editingOpponent.label}
            initialPokepasteUrl={editingOpponent.pokepasteUrl ?? ""}
            initialRawPaste={editingOpponent.team.rawPaste}
            submitLabel={t.opponents.saveChanges}
            onSubmit={(label, rawPaste, pokepasteUrl) => {
              const result = editOpponentTeam(editingOpponent.id, label, rawPaste, pokepasteUrl);
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
        <BulkImportForm onImport={handleBulkImport} onCancel={() => setIsBulkImporting(false)} />
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
            aria-label={t.opponents.dismiss}
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
            {t.opponents.clearTitle(
              t.common.regulationLabel(
                REGULATIONS.find((r) => r.id === selectedRegulationId)?.label ?? "",
              ),
            )}
          </h2>
          <p className="mb-4 text-sm text-zinc-600">
            {t.opponents.clearBody(regulationOpponents.length)}
          </p>
          <div className="flex gap-2">
            <Button variant="danger" onClick={confirmClearAll}>
              {t.opponents.clearAll}
            </Button>
            <Button variant="outline" onClick={() => setIsConfirmingClear(false)}>
              {t.common.cancel}
            </Button>
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
        <Modal onClose={() => setConfirmRemoveId(null)} labelledBy="confirm-remove-opponent-title">
          <h2
            id="confirm-remove-opponent-title"
            className="mb-2 text-lg font-semibold text-zinc-900"
          >
            {t.opponents.removeTitle(confirmRemoveOpponent.label)}
          </h2>
          <p className="mb-4 text-sm text-zinc-600">
            {t.opponents.removeBody}
            {confirmRemoveSuccessor &&
              ` ${t.opponents.removeSuccessor(confirmRemoveSuccessor.label)}`}
          </p>
          <div className="flex gap-2">
            <Button variant="danger" onClick={confirmRemove}>
              {t.opponents.remove}
            </Button>
            <Button variant="outline" onClick={() => setConfirmRemoveId(null)}>
              {t.common.cancel}
            </Button>
          </div>
        </Modal>
      )}

      {isLoading ? (
        <LoadingState />
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
            <h3 className="text-lg font-semibold text-zinc-900">{t.opponents.emptyTitle}</h3>
            <p className="max-w-md text-sm text-zinc-600">{t.opponents.emptyBody}</p>
          </div>
          <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-center">
            <Button onClick={startAdding}>{t.opponents.add}</Button>
            {regulationSeasons.map((season) => (
              <Button
                variant="outline"
                key={season.id}
                onClick={() => loadPreset(season.rawPaste, season.regulationId)}
                className="bg-zinc-50"
              >
                {t.opponents.useDefaultSet(season.label, season.id === currentSeasonId)}
              </Button>
            ))}
          </div>
          <button
            type="button"
            onClick={startBulkImporting}
            className="text-sm font-medium text-zinc-600 hover:underline"
          >
            {t.opponents.bulkImportPrompt}
          </button>
        </div>
      ) : isSearching && displayedGroups.length === 0 ? (
        <p className="py-12 text-center text-sm text-zinc-500">
          {t.opponents.noMatches(searchQuery.trim())}
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
                className={cn(
                  index % 2 === 0 ? "bg-zinc-200" : "bg-zinc-100",
                  draggedId === main.id && "opacity-40",
                  dragOverId === main.id &&
                    draggedId !== main.id &&
                    "outline outline-2 -outline-offset-2 outline-zinc-500",
                )}
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
                            label: t.opponents.makeVariantOf,
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
                      className={cn(
                        "border-t border-zinc-300 shadow-[inset_4px_0_0_0_var(--color-zinc-400)]",
                        draggedId === variant.id && "opacity-40",
                        dragOverId === variant.id &&
                          draggedId !== variant.id &&
                          "outline outline-2 -outline-offset-2 outline-zinc-500",
                      )}
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
                            label: t.opponents.setAsMain,
                            icon: IconName.Star,
                            onClick: () => {
                              setGroupMain(main.id, variant.id);
                              // Expansion is tracked by main id — carry it over
                              // so the group stays open under its new main.
                              setExpandedGroupIds((prev) => new Set(prev).add(variant.id));
                            },
                          },
                          {
                            label: t.opponents.removeFromGroup,
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
