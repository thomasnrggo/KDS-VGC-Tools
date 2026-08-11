"use client";

import { useEffect, useRef, useState } from "react";
import { useOpponents } from "@/hooks/useOpponents";
import { parseTeamFolder } from "@/lib/teamFolder";
import { TEAM_PRESETS } from "@/data/presets";
import type { ParsedPokemon, TeamFolderEntry } from "@/types";
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
    removeAllOpponents,
    updateOpponentPlan,
    editOpponentTeam,
  } = useOpponents();
  const [isAdding, setIsAdding] = useState(false);
  const [isBulkImporting, setIsBulkImporting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
    const result = addOpponent(label, rawPaste, pokepasteUrl);
    if (typeof result === "string") {
      return result;
    }
    setIsAdding(false);
    return null;
  }

  function reportImportResult(importedCount: number, skipped: string[]) {
    if (importedCount === 0) {
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
    const { importedCount, skipped } = addOpponentsFromFolder(entries);
    setIsBulkImporting(false);
    reportImportResult(importedCount, skipped);
  }

  function loadPreset(rawPaste: string) {
    const { importedCount, skipped } = addOpponentsFromFolder(parseTeamFolder(rawPaste));
    setIsMenuOpen(false);
    reportImportResult(importedCount, skipped);
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
    removeAllOpponents();
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
        <h2 className="text-xl font-semibold text-mauve-900">
          Opponents
        </h2>
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
                    opponents.length === 0 &&
                    TEAM_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        role="menuitem"
                        onClick={() => loadPreset(preset.rawPaste)}
                        className={MENU_ITEM_CLASSES}
                      >
                        Load default set: {preset.label}
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
                    disabled={opponents.length === 0}
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
            Clear all opponent teams?
          </h2>
          <p className="mb-4 text-sm text-mauve-600">
            This removes all {opponents.length} opponent
            {opponents.length === 1 ? "" : "s"} and can&apos;t be undone — you&apos;ll
            need to re-add or re-import them.
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
            This can&apos;t be undone — you&apos;ll need to re-add or re-import this
            team.
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
      ) : opponents.length === 0 && !isAdding && !isBulkImporting ? (
        <div className="flex flex-col items-center gap-4 py-24 text-center">
          <p className="text-sm text-mauve-500">
            No opponents yet. Add one to start planning matchups.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={startAdding}
              className="rounded-full bg-mauve-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-mauve-700"
            >
              Add a team
            </button>
            {TEAM_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => loadPreset(preset.rawPaste)}
                className="rounded-full border border-mauve-300 px-5 py-2 text-sm font-medium text-mauve-700 hover:bg-mauve-100"
              >
                Use default set: {preset.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <ul className="flex flex-col">
          {opponents.map((opponent, index) =>
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
                />
              </div>
            ),
          )}
        </ul>
      )}
    </section>
  );
}
