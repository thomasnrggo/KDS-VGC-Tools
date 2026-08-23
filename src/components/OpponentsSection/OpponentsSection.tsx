"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useOpponents } from "@/hooks/useOpponents";
import { useSeasons } from "@/hooks/useSeasons";
import { parseTeamFolder } from "@/lib/teamFolder";
import { REGULATIONS } from "@/data/regulations";
import type { ParsedPokemon, TeamFolderEntry } from "@/types";
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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (isSearchOpen) searchInputRef.current?.focus();
  }, [isSearchOpen]);

  useEffect(() => {
    if (!isMenuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      const clickedTrigger = menuRef.current?.contains(target);
      const clickedDropdown = dropdownRef.current?.contains(target);
      if (!clickedTrigger && !clickedDropdown) {
        setIsMenuOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsMenuOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

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
    setIsMenuOpen(false);
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
    setIsMenuOpen(false);
    setIsBulkImporting(true);
  }

  function startEditing(id: string) {
    setIsAdding(false);
    setIsBulkImporting(false);
    setEditingId(id);
  }

  function requestClearAll() {
    setIsMenuOpen(false);
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

  const MENU_ITEM_CLASSES =
    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-mauve-700 hover:bg-mauve-100";

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-mauve-900">
            Opposing Teams
          </h2>
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
          {!isLoading &&
            !isAdding &&
            !isBulkImporting &&
            regulationOpponents.length > 0 && (
              <button
                type="button"
                onClick={toggleSearch}
                aria-label={isSearchOpen ? "Hide search" : "Search opponents"}
                aria-expanded={isSearchOpen}
                title="Search by Pokémon or item"
                className={`flex h-8 w-8 items-center justify-center rounded-full text-mauve-500 hover:bg-mauve-100 hover:text-mauve-700 ${
                  isSearchOpen ? "bg-mauve-100 text-mauve-700" : ""
                }`}
              >
                <Icon name={IconName.Search} size={18} />
              </button>
            )}
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
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setIsMenuOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={isMenuOpen}
                aria-label="More opponent options"
                title="More options"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-mauve-300 text-mauve-700 hover:bg-mauve-100"
              >
                <Icon name={IconName.MoreVert} size={18} />
              </button>
              {isMenuOpen && (
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
                        onClick={() => loadPreset(season.rawPaste, season.regulationId)}
                        className={MENU_ITEM_CLASSES}
                      >
                        Load default set: {season.label}
                        {season.id === currentSeasonId ? " (current)" : ""}
                      </button>
                    ))}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={startBulkImporting}
                    className={MENU_ITEM_CLASSES}
                  >
                    Mass import
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={requestClearAll}
                    disabled={regulationOpponents.length === 0}
                    className="flex w-full items-center gap-2 border-t border-mauve-200 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-mauve-300 disabled:hover:bg-transparent"
                  >
                    Clear all data
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {isSearchOpen &&
        !isLoading &&
        !isAdding &&
        !isBulkImporting &&
        regulationOpponents.length > 0 && (
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
              placeholder='Search by Pokémon or item… (e.g. "charizard scarf")'
              aria-label="Search opponents by Pokémon or item"
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
        <OpponentForm
          onSubmit={handleSubmit}
          onCancel={() => setIsAdding(false)}
        />
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
          {visibleOpponents.map((opponent, index) =>
            editingId === opponent.id ? (
              <li key={opponent.id}>
                <OpponentForm
                  initialLabel={opponent.label}
                  initialPokepasteUrl={opponent.pokepasteUrl ?? ""}
                  initialRawPaste={opponent.team.rawPaste}
                  submitLabel="Save changes"
                  onSubmit={(label, rawPaste, pokepasteUrl) => {
                    const result = editOpponentTeam(
                      opponent.id,
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
              </li>
            ) : (
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
            ),
          )}
        </ul>
      )}
    </section>
  );
}
