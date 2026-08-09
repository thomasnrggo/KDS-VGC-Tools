"use client";

import { useEffect, useRef, useState } from "react";
import type { Team } from "@/types";
import { Modal } from "../Modal";
import { TeamPasteForm } from "../TeamPasteForm";
import { PokemonSprite } from "../PokemonSprite";
import { ItemIcon } from "../ItemIcon";
import { Icon } from "../Icon";
import { IconName } from "@/enums";

interface MyTeamHeaderProps {
  teams: Team[];
  activeTeamId: string | null;
  isLoading: boolean;
  addTeam: (rawPaste: string, name: string) => string | null;
  editTeam: (id: string, rawPaste: string, name: string) => string | null;
  removeTeam: (id: string) => void;
  setActiveTeamId: (id: string | null) => void;
}

export function MyTeamHeader({
  teams,
  activeTeamId,
  isLoading,
  addTeam,
  editTeam,
  removeTeam,
  setActiveTeamId,
}: MyTeamHeaderProps) {
  const [modalMode, setModalMode] = useState<"add" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isTeamMenuOpen, setIsTeamMenuOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const editingTeam = editingId
    ? (teams.find((team) => team.id === editingId) ?? null)
    : null;
  const confirmDeleteTeam = confirmDeleteId
    ? (teams.find((team) => team.id === confirmDeleteId) ?? null)
    : null;
  const activeTeam = teams.find((team) => team.id === activeTeamId) ?? null;

  useEffect(() => {
    if (!isTeamMenuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      const clickedTrigger = menuRef.current?.contains(target);
      const clickedDropdown = dropdownRef.current?.contains(target);
      if (!clickedTrigger && !clickedDropdown) {
        setIsTeamMenuOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsTeamMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isTeamMenuOpen]);

  function selectTeam(id: string) {
    setActiveTeamId(id);
    setIsTeamMenuOpen(false);
  }

  function openAddModal() {
    setEditingId(null);
    setModalMode("add");
  }

  function openEditModal(id: string) {
    setEditingId(id);
    setModalMode("edit");
    setIsTeamMenuOpen(false);
  }

  function closeModal() {
    setModalMode(null);
    setEditingId(null);
  }

  function handleSubmit(raw: string, name: string) {
    const error =
      modalMode === "edit" && editingId
        ? editTeam(editingId, raw, name)
        : addTeam(raw, name);
    if (!error) {
      closeModal();
    }
    return error;
  }

  function requestRemove(id: string) {
    setConfirmDeleteId(id);
    setIsTeamMenuOpen(false);
  }

  function confirmRemove() {
    if (!confirmDeleteId) return;
    removeTeam(confirmDeleteId);
    if (editingId === confirmDeleteId) {
      closeModal();
    }
    setConfirmDeleteId(null);
  }

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between gap-4 border-b border-zinc-200 bg-zinc-100/95 px-6 py-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
      <h1 className="leading-tight">
        <span className="block text-base text-zinc-500 dark:text-zinc-400">
          Matchup
        </span>
        <span className="block text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Planner
        </span>
      </h1>

      <div className="flex flex-1 items-center gap-2 md:flex-none">
        {isLoading ? null : teams.length === 0 ? (
          <button
            type="button"
            onClick={openAddModal}
            className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            Add your team
          </button>
        ) : (
          <>
            {activeTeam && (
              <>
                <div ref={menuRef} className="relative flex-1 md:flex-none">
                  <button
                    type="button"
                    onClick={() => setIsTeamMenuOpen((open) => !open)}
                    aria-haspopup="listbox"
                    aria-expanded={isTeamMenuOpen}
                    className="flex w-full flex-col items-center gap-1 md:w-auto md:items-start"
                  >
                    <span className="flex items-end gap-1">
                      <span className="flex gap-1">
                        {activeTeam.pokemon.map((mon, index) => (
                          <span
                            key={index}
                            className="relative h-12 w-12 shrink-0"
                          >
                            <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg bg-white dark:bg-zinc-900">
                              <PokemonSprite species={mon.species} size={44} />
                            </span>
                            {mon.item && (
                              <span className="absolute -bottom-1 -right-1">
                                <ItemIcon item={mon.item} size={20} />
                              </span>
                            )}
                          </span>
                        ))}
                      </span>
                      <Icon
                        name={IconName.ExpandMore}
                        size={24}
                        className="mb-3 text-zinc-500 opacity-70 dark:text-zinc-400 cursor-pointer"
                      />
                    </span>
                  </button>
                </div>

                {isTeamMenuOpen && (
                  <div
                    ref={dropdownRef}
                    role="listbox"
                    aria-label="Select team"
                    className="absolute left-6 right-6 top-full z-20 mt-2 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-lg md:left-auto md:right-6 md:w-96 dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    {teams.map((team) => {
                      const isSelected = team.id === activeTeamId;
                      return (
                        <div
                          key={team.id}
                          role="option"
                          aria-selected={isSelected}
                          className={`flex items-center gap-2 px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                            isSelected ? "bg-zinc-50 dark:bg-zinc-800/60" : ""
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => selectTeam(team.id)}
                            className={`flex flex-1 items-center gap-2 overflow-hidden text-left text-sm ${
                              isSelected
                                ? "font-medium text-zinc-900 dark:text-zinc-50"
                                : "text-zinc-700 dark:text-zinc-300"
                            }`}
                          >
                            <span className="flex flex-col shrink-0 gap-0.5">
                              <span className="truncate font-bold text-sm">
                                {team.name}
                              </span>
                              <div className="flex">
                                {team.pokemon.map((mon, index) => (
                                  <div
                                    key={index}
                                    className="h-8 w-8 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
                                  >
                                    <PokemonSprite
                                      species={mon.species}
                                      size={32}
                                    />
                                  </div>
                                ))}
                              </div>
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(team.id)}
                            aria-label={`Edit ${team.name}`}
                            title={`Edit ${team.name}`}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                          >
                            <Icon name={IconName.Edit} size={18} />
                          </button>
                          <button
                            type="button"
                            onClick={() => requestRemove(team.id)}
                            aria-label={`Remove ${team.name}`}
                            title={`Remove ${team.name}`}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-red-100 hover:text-red-600 dark:text-zinc-400 dark:hover:bg-red-950 dark:hover:text-red-400"
                          >
                            <Icon name={IconName.Delete} size={18} />
                          </button>
                        </div>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => {
                        openAddModal();
                        setIsTeamMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-2 border-t border-zinc-200 px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 md:hidden dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      <Icon name={IconName.Add} size={16} />
                      Add a team
                    </button>
                  </div>
                )}
              </>
            )}

            <button
              type="button"
              onClick={openAddModal}
              aria-label="Add a team"
              title="Add a team"
              className="hidden md:flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-zinc-400 text-zinc-500 hover:border-zinc-500 hover:text-zinc-700 dark:border-zinc-600 dark:text-zinc-400 dark:hover:border-zinc-400 dark:hover:text-zinc-200 "
            >
              <Icon name={IconName.Add} size={16} />
            </button>
          </>
        )}
      </div>

      {modalMode && (
        <Modal onClose={closeModal} labelledBy="my-team-modal-title">
          <h2
            id="my-team-modal-title"
            className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50"
          >
            {modalMode === "edit" ? "Edit team" : "Add a team"}
          </h2>
          <TeamPasteForm
            initialName={editingTeam?.name}
            initialValue={editingTeam?.rawPaste}
            onSubmit={handleSubmit}
            onCancel={closeModal}
          />
        </Modal>
      )}

      {confirmDeleteTeam && (
        <Modal onClose={() => setConfirmDeleteId(null)} labelledBy="confirm-remove-team-title">
          <h2
            id="confirm-remove-team-title"
            className="mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50"
          >
            Remove {confirmDeleteTeam.name}?
          </h2>
          <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
            This can&apos;t be undone — you&apos;ll need to paste the team again to add it back.
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
              onClick={() => setConfirmDeleteId(null)}
              className="rounded-full border border-zinc-300 px-5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </header>
  );
}
