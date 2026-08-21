"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
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
  /** Which page this header is rendered on — swaps the single nav link so it never points at itself (Matchup Planner shows a link to the Damage Calc, and vice versa). */
  currentPage: "matchup-planner" | "damage-calc";
}

const NAV_LINKS = [
  { page: "matchup-planner", href: "/matchup-planner", label: "Matchup Planner" },
  { page: "damage-calc", href: "/damage-calc", label: "Damage Calculator" },
] as const;

export function MyTeamHeader({
  teams,
  activeTeamId,
  isLoading,
  addTeam,
  editTeam,
  removeTeam,
  setActiveTeamId,
  currentPage,
}: MyTeamHeaderProps) {
  const [modalMode, setModalMode] = useState<"add" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isTeamMenuOpen, setIsTeamMenuOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  // Mobile-only nav menu — the two page links move behind a hamburger below
  // the md breakpoint instead of squeezing in next to the logo (which, at
  // narrow widths, was crowding the always-visible team sprite row/switcher
  // — see PLANNING.md). Same click-outside/Escape-to-close pattern as the
  // team menu above, just a second independent instance.
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const mobileNavMenuRef = useRef<HTMLDivElement>(null);
  const mobileNavDropdownRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!isMobileNavOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      const clickedTrigger = mobileNavMenuRef.current?.contains(target);
      const clickedDropdown = mobileNavDropdownRef.current?.contains(target);
      if (!clickedTrigger && !clickedDropdown) {
        setIsMobileNavOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMobileNavOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobileNavOpen]);

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
    <header className="sticky top-0 z-40 relative flex items-center justify-between gap-2 border-b border-mauve-100 bg-mauve-600 px-4 py-4 backdrop-blur md:gap-4 md:px-6">
      <div className="flex min-w-0 shrink items-center gap-3 md:gap-6">
        <div className="flex shrink-0 items-center gap-2">
          <Image
            src="/resources/logo.png"
            alt="VGC Tools"
            title="VGC Tools"
            width={56}
            height={56}
            unoptimized
            priority
            className="h-12 w-12 shrink-0 md:h-14 md:w-14"
          />
          <span className="text-lg font-extrabold text-white md:text-xl">
            VGC<span className="font-light">Tools</span>
          </span>
        </div>

        {/* Desktop: both links inline next to the logo, same as before. */}
        <nav className="hidden shrink-0 items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => {
            const isActive = link.page === currentPage;
            return isActive ? (
              <span key={link.page} aria-current="page" className="text-sm font-bold text-white">
                {link.label}
              </span>
            ) : (
              <Link
                key={link.page}
                href={link.href}
                className="text-sm font-medium text-mauve-200 transition-colors hover:text-white"
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Mobile: a hamburger opening a dropdown, instead of squeezing
            abbreviated labels in next to the logo — narrow widths need that
            space for the always-visible team sprite row/switcher on the
            other side of the header (see PLANNING.md). */}
        <div ref={mobileNavMenuRef} className="relative shrink-0 md:hidden">
          <button
            type="button"
            onClick={() => setIsMobileNavOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={isMobileNavOpen}
            aria-label="Navigation menu"
            className="flex h-8 w-8 items-center justify-center rounded-full text-mauve-100 hover:bg-mauve-500"
          >
            <Icon name={IconName.Menu} size={22} />
          </button>

          {isMobileNavOpen && (
            <div
              ref={mobileNavDropdownRef}
              role="menu"
              aria-label="Navigation menu"
              className="absolute left-0 top-full z-20 mt-2 w-44 overflow-hidden rounded-lg border border-mauve-200 bg-white py-1 shadow-lg"
            >
              {NAV_LINKS.map((link) => {
                const isActive = link.page === currentPage;
                return isActive ? (
                  <span
                    key={link.page}
                    aria-current="page"
                    className="block px-3 py-2 text-sm font-bold text-mauve-900"
                  >
                    {link.label}
                  </span>
                ) : (
                  <Link
                    key={link.page}
                    href={link.href}
                    onClick={() => setIsMobileNavOpen(false)}
                    className="block px-3 py-2 text-sm font-medium text-mauve-700 hover:bg-mauve-100"
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-1 items-center justify-end gap-2 md:flex-none">
        {isLoading ? null : teams.length === 0 ? (
          <button
            type="button"
            onClick={openAddModal}
            className="rounded-full bg-mauve-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-mauve-950"
          >
            Add your team
          </button>
        ) : (
          <>
            {activeTeam && (
              <>
                <div ref={menuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setIsTeamMenuOpen((open) => !open)}
                    aria-haspopup="listbox"
                    aria-expanded={isTeamMenuOpen}
                    className="flex flex-col items-center gap-1"
                  >
                    <span className="flex items-end gap-1">
                      <span className="flex gap-1">
                        {activeTeam.pokemon.map((mon, index) => (
                          <span
                            key={index}
                            className="relative h-8 w-8 shrink-0 md:h-12 md:w-12"
                          >
                            <span className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-lg bg-mauve-100/50">
                              <PokemonSprite species={mon.species} fill />
                            </span>
                            {mon.item && (
                              <span className="absolute -bottom-1 -right-1">
                                <ItemIcon item={mon.item} size={16} />
                              </span>
                            )}
                          </span>
                        ))}
                      </span>
                      <Icon
                        name={IconName.ExpandMore}
                        size={28}
                        className="mb-2 h-5 w-5 text-mauve-100 cursor-pointer md:mb-3 md:h-7 md:w-7"
                      />
                    </span>
                  </button>
                </div>

                {isTeamMenuOpen && (
                  <div
                    ref={dropdownRef}
                    role="listbox"
                    aria-label="Select team"
                    className="absolute left-4 right-4 top-full z-20 mt-2 overflow-hidden rounded-lg border border-mauve-200 bg-white py-1 shadow-lg md:left-auto md:right-6 md:w-96"
                  >
                    {teams.map((team) => {
                      const isSelected = team.id === activeTeamId;
                      return (
                        <div
                          key={team.id}
                          role="option"
                          aria-selected={isSelected}
                          className={`flex items-center gap-2 px-3 py-2 hover:bg-mauve-100 ${
                            isSelected ? "bg-mauve-50" : ""
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => selectTeam(team.id)}
                            className={`flex flex-1 items-center gap-2 overflow-hidden text-left text-sm ${
                              isSelected
                                ? "font-medium text-mauve-900"
                                : "text-mauve-700"
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
                                    className="h-8 w-8 overflow-hidden rounded-full bg-mauve-100"
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
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-mauve-500 hover:bg-mauve-200 hover:text-mauve-700"
                          >
                            <Icon name={IconName.Edit} size={18} />
                          </button>
                          <button
                            type="button"
                            onClick={() => requestRemove(team.id)}
                            aria-label={`Remove ${team.name}`}
                            title={`Remove ${team.name}`}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-mauve-500 hover:bg-red-100 hover:text-red-600"
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
                      className="flex w-full items-center gap-2 border-t border-mauve-200 px-3 py-2 text-left text-sm text-mauve-700 hover:bg-mauve-100"
                    >
                      <Icon name={IconName.Add} size={16} />
                      Add a team
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {modalMode && (
        <Modal onClose={closeModal} labelledBy="my-team-modal-title">
          <h2
            id="my-team-modal-title"
            className="mb-4 text-lg font-semibold text-mauve-900"
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
        <Modal
          onClose={() => setConfirmDeleteId(null)}
          labelledBy="confirm-remove-team-title"
        >
          <h2
            id="confirm-remove-team-title"
            className="mb-2 text-lg font-semibold text-mauve-900"
          >
            Remove {confirmDeleteTeam.name}?
          </h2>
          <p className="mb-4 text-sm text-mauve-600">
            This can&apos;t be undone — you&apos;ll need to paste the team again
            to add it back.
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
              className="rounded-full border border-mauve-300 px-5 py-2 text-sm font-medium text-mauve-700 hover:bg-mauve-100"
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </header>
  );
}
