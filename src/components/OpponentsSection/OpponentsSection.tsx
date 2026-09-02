"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useOpponents } from "@/hooks/useOpponents";
import { useSeasons } from "@/hooks/useSeasons";
import { parseTeamFolder } from "@/lib/teamFolder";
import { REGULATIONS } from "@/data/regulations";
import type { ParsedPokemon, Season, TeamFolderEntry } from "@/types";
import {
  parseSearchTerms,
  pokemonMatchesQuery,
} from "@/lib/pokemonMatchesQuery";
import { OpponentForm } from "../OpponentForm";
import { OpponentCard } from "../OpponentCard";
import { BulkImportForm } from "../BulkImportForm";
import { Modal } from "../Modal";
import { Icon } from "../Icon";
import { IconName } from "@/enums";

interface OpponentsSectionProps {
  myTeamPokemon: ParsedPokemon[];
  activeTeamId: string | null;
}

const MENU_ITEM_CLASSES =
  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-mauve-700 hover:bg-mauve-100";

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
        className="flex h-9 w-9 items-center justify-center rounded-full border border-mauve-300 text-mauve-700 hover:bg-mauve-100"
      >
        <Icon name={IconName.MoreVert} size={18} />
      </button>
      {isOpen && (
        <div
          ref={dropdownRef}
          role="menu"
          aria-label="More opponent options"
          className="absolute right-0 top-full z-20 mt-2 w-56 overflow-hidden rounded-lg border border-mauve-200 bg-white py-1 shadow-lg"
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
            className="flex w-full items-center gap-2 border-t border-mauve-200 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-mauve-300 disabled:hover:bg-transparent"
          >
            Clear all data
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Its own component (rather than one shared input reused at both the mobile
 * and desktop render sites below) so each site's input gets its own
 * autofocus-on-mount ref — the same ref object can't be shared between two
 * simultaneously-mounted DOM nodes.
 */
function OpponentSearchField({
  query,
  onQueryChange,
  onClose,
  autoFocus = false,
  className,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  /** Omit on desktop, where the field is always visible and there's nothing to "close" — the trailing button then only clears, and only once there's a query. */
  onClose?: () => void;
  /** Only for the mobile field, which mounts in response to the user tapping the search icon — desktop's is always mounted, so autofocusing it would steal focus on every render. */
  autoFocus?: boolean;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  return (
    <div className={`relative ${className ?? ""}`}>
      <Icon
        name={IconName.Search}
        size={18}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mauve-400"
      />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder='Search by Pokémon or item… (e.g. "charizard scarf")'
        aria-label="Search opponents by Pokémon or item"
        className="w-full rounded-full border border-mauve-300 bg-white py-2 pl-9 pr-9 text-sm text-mauve-800 placeholder:text-mauve-400 focus:outline-none focus:ring-2 focus:ring-mauve-400"
      />
      {/* Doubles as "close search" (once the query is empty) when onClose is
          given — the leading search-icon toggle button, the only other way
          to close it, is hidden while the field is showing since it's
          redundant with this field's own icon (see PLANNING.md). */}
      {(query || onClose) && (
        <button
          type="button"
          onClick={() => (query ? onQueryChange("") : onClose?.())}
          aria-label={query ? "Clear search" : "Close search"}
          title={query ? "Clear search" : "Close search"}
          className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-mauve-400 hover:bg-mauve-100 hover:text-mauve-700"
        >
          <Icon name={IconName.Close} size={14} />
        </button>
      )}
    </div>
  );
}

export function OpponentsSection({
  myTeamPokemon,
  activeTeamId,
}: OpponentsSectionProps) {
  const {
    opponents,
    isLoading,
    addOpponent,
    addOpponentsFromFolder,
    removeOpponent,
    removeOpponents,
    updateOpponentPlan,
    editOpponentTeam,
  } = useOpponents();
  const { seasons, currentSeasonId } = useSeasons();
  const [selectedRegulationId, setSelectedRegulationId] = useState(
    REGULATIONS[0]?.id ?? "",
  );
  const [isAdding, setIsAdding] = useState(false);
  const [isBulkImporting, setIsBulkImporting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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
  // only matches a team that has a Pokémon/item for *each* term, not either one.
  const searchTerms = parseSearchTerms(searchQuery);
  const isSearching = searchTerms.length > 0;
  const visibleOpponents = isSearching
    ? regulationOpponents.filter((opponent) =>
        searchTerms.every((term) =>
          opponent.team.pokemon.some((mon) => pokemonMatchesQuery(mon, term)),
        ),
      )
    : regulationOpponents;

  function handleSubmit(label: string, rawPaste: string, pokepasteUrl: string) {
    const result = addOpponent(label, rawPaste, selectedRegulationId, pokepasteUrl);
    if (typeof result === "string") {
      return result;
    }
    setIsAdding(false);
    return null;
  }

  function reportImportResult(importedCount: number, skipped: string[]) {
    if (importedCount === 0 && skipped.length === 0) {
      setImportNotice(
        "Couldn't import any teams from that paste — check the format and try again.",
      );
    } else if (skipped.length > 0) {
      setImportNotice(
        `Imported ${importedCount} team${importedCount === 1 ? "" : "s"}. Skipped ${skipped.length}: ${skipped.join("; ")}`,
      );
    } else {
      setImportNotice(
        `Imported ${importedCount} team${importedCount === 1 ? "" : "s"}.`,
      );
    }
  }

  function handleBulkImport(entries: TeamFolderEntry[]) {
    const { importedCount, skipped } = addOpponentsFromFolder(entries, selectedRegulationId);
    setIsBulkImporting(false);
    reportImportResult(importedCount, skipped);
  }

  function loadPreset(rawPaste: string, regulationId: string) {
    const { importedCount, skipped } = addOpponentsFromFolder(
      parseTeamFolder(rawPaste),
      regulationId,
    );
    reportImportResult(importedCount, skipped);
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

  const confirmRemoveOpponent = confirmRemoveId
    ? (opponents.find((opponent) => opponent.id === confirmRemoveId) ?? null)
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
      <span className="shrink-0 rounded-full border border-mauve-200 bg-mauve-50 px-3 py-1 text-xs font-medium text-mauve-500">
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
      title="Search by Pokémon or item"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-mauve-500 hover:bg-mauve-100 hover:text-mauve-700"
    >
      <Icon name={IconName.Search} size={18} />
    </button>
  );

  return (
    <section className="flex flex-col gap-4">
      {/* Mobile: title + regulation on their own row, search (left) and
          add/more (right) below — one row was cramming a big "Add opponent"
          pill against the title/regulation/search cluster (see PLANNING.md). */}
      <div className="flex flex-col gap-3 md:hidden">
        <div className="flex items-center justify-between gap-3">
          <h2 className="whitespace-nowrap text-xl font-semibold text-mauve-900">
            Opposing Teams
          </h2>
          {regulationControl}
        </div>
        <div className="flex items-center gap-2">
          {searchToggleButton}
          {isSearchOpen && canSearch && (
            <OpponentSearchField
              query={searchQuery}
              onQueryChange={setSearchQuery}
              onClose={toggleSearch}
              autoFocus
              className="min-w-0 flex-1"
            />
          )}
          {!isAdding && !isBulkImporting && (
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={startAdding}
                aria-label="Add opponent"
                title="Add opponent"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-mauve-600 text-white hover:bg-mauve-700"
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
          <h2 className="text-xl font-semibold text-mauve-900">
            Opposing Teams
          </h2>
          {regulationControl}
        </div>
        {!isAdding && !isBulkImporting && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={startAdding}
              className="rounded-full bg-mauve-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-mauve-700"
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
        <OpponentSearchField
          query={searchQuery}
          onQueryChange={setSearchQuery}
          className="hidden md:block"
        />
      )}

      {isAdding && (
        <Modal onClose={() => setIsAdding(false)} labelledBy="add-opponent-title">
          <h2
            id="add-opponent-title"
            className="mb-4 text-lg font-semibold text-mauve-900"
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
            className="mb-4 text-lg font-semibold text-mauve-900"
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
          className="flex items-start justify-between gap-3 rounded-lg border border-mauve-200 bg-mauve-50 p-3 text-sm text-mauve-700"
        >
          <span>{importNotice}</span>
          <button
            type="button"
            onClick={() => setImportNotice(null)}
            aria-label="Dismiss"
            className="shrink-0 text-mauve-500 hover:text-mauve-700"
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
            className="mb-2 text-lg font-semibold text-mauve-900"
          >
            Clear all {REGULATIONS.find((r) => r.id === selectedRegulationId)?.label} opponent
            teams?
          </h2>
          <p className="mb-4 text-sm text-mauve-600">
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
              className="rounded-full border border-mauve-300 px-5 py-2 text-sm font-medium text-mauve-700 hover:bg-mauve-100"
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {confirmRemoveOpponent && (
        <Modal
          onClose={() => setConfirmRemoveId(null)}
          labelledBy="confirm-remove-opponent-title"
        >
          <h2
            id="confirm-remove-opponent-title"
            className="mb-2 text-lg font-semibold text-mauve-900"
          >
            Remove {confirmRemoveOpponent.label}?
          </h2>
          <p className="mb-4 text-sm text-mauve-600">
            This can&apos;t be undone — you&apos;ll need to re-add or re-import
            this team.
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
              className="rounded-full border border-mauve-300 px-5 py-2 text-sm font-medium text-mauve-700 hover:bg-mauve-100"
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {isLoading ? (
        <p className="text-sm text-mauve-500">Loading…</p>
      ) : regulationOpponents.length === 0 && !isAdding && !isBulkImporting ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-mauve-300 bg-mauve-50 px-6 py-14 text-center">
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
              Prepare against your rivals
            </h3>
            <p className="max-w-md text-sm text-mauve-600">
              Paste a Pokémon Showdown export for a team you want to prep
              against, we&apos;ll pull in the roster, held items, and movesets
              automatically so you can plan your leads and backs.
            </p>
          </div>
          <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-center">
            <button
              type="button"
              onClick={startAdding}
              className="rounded-full bg-mauve-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-mauve-700"
            >
              Add opponent
            </button>
            {regulationSeasons.map((season) => (
              <button
                key={season.id}
                type="button"
                onClick={() => loadPreset(season.rawPaste, season.regulationId)}
                className="rounded-full border border-mauve-300 bg-white px-5 py-2 text-sm font-medium text-mauve-700 hover:bg-mauve-100"
              >
                Use default set: {season.label}
                {season.id === currentSeasonId ? " (current)" : ""}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={startBulkImporting}
            className="text-sm font-medium text-mauve-600 hover:underline"
          >
            Prepping for a big tournament? Import a whole folder of teams at
            once →
          </button>
        </div>
      ) : isSearching && visibleOpponents.length === 0 ? (
        <p className="py-12 text-center text-sm text-mauve-500">
          No opponents have a Pokémon or item matching &ldquo;
          {searchQuery.trim()}&rdquo;.
        </p>
      ) : (
        <ul className="flex flex-col">
          {visibleOpponents.map((opponent, index) => (
            <div
              key={opponent.id}
              className={index % 2 === 0 ? "bg-mauve-200" : "bg-mauve-100"}
            >
              <OpponentCard
                opponent={opponent}
                myTeamPokemon={myTeamPokemon}
                activeTeamId={activeTeamId}
                onEdit={() => startEditing(opponent.id)}
                onRemove={() => setConfirmRemoveId(opponent.id)}
                onUpdatePlan={(updater) => {
                  if (activeTeamId) {
                    updateOpponentPlan(opponent.id, activeTeamId, updater);
                  }
                }}
                isMatch={
                  isSearching
                    ? (mon) =>
                        searchTerms.some((term) =>
                          pokemonMatchesQuery(mon, term),
                        )
                    : undefined
                }
              />
            </div>
          ))}
        </ul>
      )}
    </section>
  );
}
