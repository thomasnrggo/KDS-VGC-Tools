"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { User } from "firebase/auth";
import type { Team } from "@/types";
import { Modal } from "../Modal";
import { TeamPasteForm } from "../TeamPasteForm";
import { PokemonSprite } from "../PokemonSprite";
import { ItemIcon } from "../ItemIcon";
import { Icon } from "../Icon";
import { AuthMenu } from "../AuthMenu";
import { ThemeToggle } from "../ThemeToggle";
import { IconName } from "@/enums";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { isAdminUid } from "@/lib/admin";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface MyTeamHeaderProps {
  teams: Team[];
  activeTeamId: string | null;
  isLoading: boolean;
  addTeam: (rawPaste: string, name: string, regulationId: string) => string | null;
  editTeam: (id: string, rawPaste: string, name: string) => string | null;
  removeTeam: (id: string) => void;
  setActiveTeamId: (id: string | null) => void;
  /** Which page this header is rendered on — swaps the nav links so the current page never links to itself. */
  currentPage: "matchup-planner" | "damage-calc" | "teams" | "tournaments" | "speed-tiers" | "team-builder";
  /**
   * The regulation currently selected on this page (each page owns its own
   * "Regulation" dropdown — see OpponentsSection/MyTeamsSection/
   * TournamentsSection/speed-tiers page.tsx) — scopes the team switcher's
   * offered list to teams tagged for it (see Team.regulationIds), the same
   * way it already scopes that page's own opponent/team/tournament list.
   * Newly added teams get tagged with this regulation too. The currently
   * *active* team is left alone regardless of a mismatch (see `activeTeam`
   * below) — switching regulation filters what you can pick next, it never
   * silently swaps out the team you already picked.
   */
  selectedRegulationId: string;
  authUser: User | null;
  isAuthLoading: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
}

const NAV_LINKS = [
  { page: "matchup-planner", href: "/matchup-planner", label: "Matchup Planner", flagKey: "matchupPlanner" },
  { page: "teams", href: "/teams", label: "My Teams", flagKey: "teams" },
  { page: "tournaments", href: "/tournaments", label: "Tournaments", flagKey: "tournaments" },
  { page: "speed-tiers", href: "/speed-tiers", label: "Speed Tiers", flagKey: "speedTiers" },
  // Damage Calculator nav link hidden — feature has known bugs, not ready to
  // publish yet. Re-add here once it's stable (see PLANNING.md).
] as const;

function TeamSwitcherRow({
  team,
  isSelected,
  onSelect,
  onEdit,
  onRemove,
}: {
  team: Team;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      role="option"
      aria-selected={isSelected}
      className={`flex items-center gap-2 px-3 py-2 hover:bg-zinc-100 ${
        isSelected ? "bg-zinc-50" : ""
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className={`flex flex-1 items-center gap-2 overflow-hidden text-left text-sm ${
          isSelected ? "font-medium text-zinc-900" : "text-zinc-700"
        }`}
      >
        <span className="flex flex-col shrink-0 gap-0.5">
          <span className="truncate font-bold text-sm">{team.name}</span>
          <div className="flex">
            {team.pokemon.map((mon, index) => (
              <div
                key={index}
                className="h-8 w-8 overflow-hidden rounded-full bg-zinc-100"
              >
                <PokemonSprite species={mon.species} size={32} />
              </div>
            ))}
          </div>
        </span>
      </button>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${team.name}`}
        title={`Edit ${team.name}`}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700"
      >
        <Icon name={IconName.Edit} size={18} />
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${team.name}`}
        title={`Remove ${team.name}`}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-red-100 dark:hover:bg-red-950 hover:text-red-600"
      >
        <Icon name={IconName.Delete} size={18} />
      </button>
    </div>
  );
}

export function MyTeamHeader({
  teams,
  activeTeamId,
  isLoading,
  addTeam,
  editTeam,
  removeTeam,
  setActiveTeamId,
  currentPage,
  selectedRegulationId,
  authUser,
  isAuthLoading,
  onSignIn,
  onSignOut,
}: MyTeamHeaderProps) {
  const [modalMode, setModalMode] = useState<"add" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isTeamMenuOpen, setIsTeamMenuOpen] = useState(false);
  const [isMobileTeamDrawerOpen, setIsMobileTeamDrawerOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mobileTeamNavRef = useRef<HTMLElement>(null);
  const mobileNavRef = useRef<HTMLDivElement>(null);

  const editingTeam = editingId
    ? (teams.find((team) => team.id === editingId) ?? null)
    : null;
  const confirmDeleteTeam = confirmDeleteId
    ? (teams.find((team) => team.id === confirmDeleteId) ?? null)
    : null;
  const activeTeam = teams.find((team) => team.id === activeTeamId) ?? null;
  // Only what the switcher *offers* is regulation-scoped — the already-active
  // team (above) stays whatever it was regardless of a mismatch, so changing
  // this page's regulation filter never silently swaps your active team out
  // from under you.
  const regulationTeams = teams.filter((team) =>
    team.regulationIds.includes(selectedRegulationId),
  );
  // True when the active team itself is one of these mismatches — shown as a
  // small warning badge on the avatar button below, since OpponentCard's
  // Lead/Back pickers also refuse to use this team's roster until either the
  // team or the page's regulation changes to agree (see matchup-planner's
  // activeTeamMatchesRegulation).
  const activeTeamMismatched =
    activeTeam !== null && !activeTeam.regulationIds.includes(selectedRegulationId);

  // A disabled section's link only shows for the admin (so they can still
  // reach/preview it) — everyone else loses it entirely, matching what
  // FeatureGate does at the route level for anyone who navigates there
  // directly. Reuses the authUser prop this component already receives
  // rather than calling useAuth() a second time.
  const isAdmin = isAdminUid(authUser?.uid);
  const { flags } = useFeatureFlags();
  const visibleNavLinks = NAV_LINKS.filter((link) => flags[link.flagKey] || isAdmin);

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

  // Non-modal (unlike the Drawer it replaced), so it doesn't get click-outside/
  // Escape-to-close for free — same pattern as the desktop team-switcher
  // dropdown above.
  useEffect(() => {
    if (!isMobileNavOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (!mobileNavRef.current?.contains(target)) {
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

  // Exposes the fixed mobile team-switcher bar's real rendered height as a
  // CSS var, so layout.tsx's <body> can reserve exactly that much bottom
  // padding (its height varies with roster size and safe-area-inset-bottom,
  // so a hardcoded padding either leaves a gap above the footer or clips
  // under the bar — see PLANNING.md). Synchronous initial read (useLayoutEffect,
  // before paint) avoids a flash; the ResizeObserver keeps it correct as the
  // bar's content changes size afterwards. Cleared to 0px when there's no
  // active team, since the bar itself doesn't render then.
  useLayoutEffect(() => {
    const el = mobileTeamNavRef.current;
    if (!el) {
      document.documentElement.style.setProperty("--mobile-bar-height", "0px");
      return;
    }

    function setHeight() {
      document.documentElement.style.setProperty(
        "--mobile-bar-height",
        `${el!.offsetHeight}px`,
      );
    }

    setHeight();
    const observer = new ResizeObserver(setHeight);
    observer.observe(el);
    return () => {
      observer.disconnect();
      document.documentElement.style.setProperty("--mobile-bar-height", "0px");
    };
    // Re-run when the bar starts/stops existing (activeTeam id going
    // null <-> set) so the ref is re-read; the ResizeObserver alone already
    // tracks size changes within an existing bar (e.g. roster edits).
  }, [activeTeam?.id]);

  function selectTeam(id: string) {
    setActiveTeamId(id);
    setIsTeamMenuOpen(false);
    setIsMobileTeamDrawerOpen(false);
  }

  function openAddModal() {
    setEditingId(null);
    setModalMode("add");
    setIsTeamMenuOpen(false);
    setIsMobileTeamDrawerOpen(false);
  }

  function openEditModal(id: string) {
    setEditingId(id);
    setModalMode("edit");
    setIsTeamMenuOpen(false);
    setIsMobileTeamDrawerOpen(false);
  }

  function closeModal() {
    setModalMode(null);
    setEditingId(null);
  }

  function handleSubmit(raw: string, name: string) {
    const error =
      modalMode === "edit" && editingId
        ? editTeam(editingId, raw, name)
        : addTeam(raw, name, selectedRegulationId);
    if (!error) {
      closeModal();
    }
    return error;
  }

  function requestRemove(id: string) {
    setConfirmDeleteId(id);
    setIsTeamMenuOpen(false);
    setIsMobileTeamDrawerOpen(false);
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
    <>
    <header className="sticky top-0 z-40 border-b border-zinc-100 bg-zinc-800 dark:bg-zinc-200 backdrop-blur">
    {/* Wraps the whole header row + the mobile nav panel below, so opening
        the panel visually grows this one sticky header instead of overlaying
        a separate sheet — className="contents" keeps it out of the flex/box
        layout entirely, it's just here to share Collapsible context between
        the trigger (in the row) and the content (below it) (see PLANNING.md). */}
    <Collapsible
      ref={mobileNavRef}
      open={isMobileNavOpen}
      onOpenChange={setIsMobileNavOpen}
      className="contents"
    >
    <div className="relative flex items-center justify-between gap-2 px-4 py-4 lg:gap-4 lg:px-6">
      <div className="flex min-w-0 shrink items-center gap-3 lg:gap-6">
        <div className="flex shrink-0 items-center gap-2">
          <Image
            src="/resources/logo.png"
            alt="VGC Box"
            title="VGC Box"
            width={56}
            height={56}
            unoptimized
            priority
            className="h-12 w-12 shrink-0 lg:h-14 lg:w-14"
          />
          <span className="text-lg font-extrabold text-white lg:text-xl">
            VGC<span className="font-light">Box</span>
          </span>
        </div>

        {/* Regular (1024px+): both links inline next to the logo, same as before. */}
        <nav className="hidden shrink-0 items-center gap-6 lg:flex">
          {visibleNavLinks.map((link) => {
            const isActive = link.page === currentPage;
            return isActive ? (
              <span key={link.page} aria-current="page" className="text-sm font-bold text-white">
                {link.label}
              </span>
            ) : (
              <Link
                key={link.page}
                href={link.href}
                className="text-sm font-medium text-zinc-200 dark:text-zinc-800 transition-colors hover:text-white"
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex flex-1 items-center justify-end gap-2 lg:flex-none">
        {isLoading ? null : teams.length === 0 ? (
          <button
            type="button"
            onClick={openAddModal}
            className="rounded-full bg-zinc-900 dark:bg-zinc-100 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-950 dark:hover:bg-zinc-50"
          >
            Add your team
          </button>
        ) : (
          <>
            {activeTeam && (
              <>
                {/* Regular (1024px+) only — below that the team preview/switcher
                    lives in the fixed bottom drawer instead (see below); narrow
                    widths don't have room for both (see PLANNING.md). */}
                <div ref={menuRef} className="relative hidden lg:block">
                  <button
                    type="button"
                    onClick={() => setIsTeamMenuOpen((open) => !open)}
                    aria-haspopup="listbox"
                    aria-expanded={isTeamMenuOpen}
                    className="flex flex-col items-center gap-1"
                  >
                    <span className="flex items-end gap-1">
                      {activeTeamMismatched && (
                        <span
                          title={`${activeTeam.name} isn't tagged for the currently selected regulation — pick a different team, or add this one to it, to plan leads/backs`}
                          className="flex h-5 w-5 shrink-0 items-center justify-center self-center rounded-full bg-amber-500 text-white"
                        >
                          <Icon name={IconName.Warning} size={13} />
                        </span>
                      )}
                      <span className="flex gap-1">
                        {activeTeam.pokemon.map((mon, index) => (
                          <span
                            key={index}
                            className="relative h-8 w-8 shrink-0 lg:h-12 lg:w-12"
                          >
                            <span className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-lg bg-zinc-100/50 dark:bg-zinc-900/50">
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
                        className="mb-2 h-5 w-5 text-zinc-100 dark:text-zinc-900 cursor-pointer lg:mb-3 lg:h-7 lg:w-7"
                      />
                    </span>
                  </button>
                </div>

                {isTeamMenuOpen && (
                  <div
                    ref={dropdownRef}
                    role="listbox"
                    aria-label="Select team"
                    className="absolute right-6 top-full z-20 mt-2 hidden w-96 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 py-1 shadow-lg lg:block"
                  >
                    {regulationTeams.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-zinc-500">
                        No teams for this regulation yet.
                      </p>
                    ) : (
                      regulationTeams.map((team) => (
                        <TeamSwitcherRow
                          key={team.id}
                          team={team}
                          isSelected={team.id === activeTeamId}
                          onSelect={() => selectTeam(team.id)}
                          onEdit={() => openEditModal(team.id)}
                          onRemove={() => requestRemove(team.id)}
                        />
                      ))
                    )}
                    <button
                      type="button"
                      onClick={openAddModal}
                      className="flex w-full items-center gap-2 border-t border-zinc-200 px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100"
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
        {/* Mobile: a hamburger that expands this same sticky header downward
            to reveal the page links, instead of overlaying a sheet — a
            Collapsible, not a Drawer, since it's simpler and non-modal fits
            a plain nav menu better; the team switcher below still uses a
            Drawer, which earns its modality (see PLANNING.md). */}
        <CollapsibleTrigger
          aria-label={isMobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-haspopup="menu"
          className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-100 dark:text-zinc-900 hover:bg-zinc-500 lg:hidden"
        >
          <Icon name={isMobileNavOpen ? IconName.Close : IconName.Menu} size={22} />
        </CollapsibleTrigger>
        <ThemeToggle />
        <AuthMenu
          user={authUser}
          isLoading={isAuthLoading}
          onSignIn={onSignIn}
          onSignOut={onSignOut}
        />
      </div>
    </div>

    <CollapsibleContent className="lg:hidden">
      <nav className="flex flex-col gap-1 border-t border-zinc-500 p-4">
        {visibleNavLinks.map((link) => {
          const isActive = link.page === currentPage;
          return isActive ? (
            <span
              key={link.page}
              aria-current="page"
              className="rounded-lg bg-zinc-500 px-3 py-2.5 text-sm font-bold text-white"
            >
              {link.label}
            </span>
          ) : (
            <Link
              key={link.page}
              href={link.href}
              onClick={() => setIsMobileNavOpen(false)}
              className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-zinc-200 dark:text-zinc-800 hover:bg-zinc-500 hover:text-white"
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </CollapsibleContent>
    </Collapsible>

      {modalMode && (
        <Modal onClose={closeModal} labelledBy="my-team-modal-title">
          <h2
            id="my-team-modal-title"
            className="mb-4 text-lg font-semibold text-zinc-900"
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
            className="mb-2 text-lg font-semibold text-zinc-900"
          >
            Remove {confirmDeleteTeam.name}?
          </h2>
          <p className="mb-4 text-sm text-zinc-600">
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
              className="rounded-full border border-zinc-300 px-5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </header>

    {/* Mobile: the team preview/switcher moves into a fixed footer that opens
        a bottom-sheet drawer, instead of the small avatar-row/chevron next
        to the logo — narrow widths don't have room for both that and the
        page nav (see PLANNING.md). Only shown once there's a team to
        preview; with zero teams the "Add your team" button above covers it.
        Same zinc-600 as the header so it reads as one matching bar. Scoped
        to the Matchup Planner — that's the only page where switching teams
        mid-task is useful; elsewhere it's just a redundant control. */}
    {currentPage === "matchup-planner" && activeTeam && (
      <nav
        ref={mobileTeamNavRef}
        aria-label="Mobile team switcher"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-100 bg-zinc-800 dark:bg-zinc-200 pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <Drawer
          open={isMobileTeamDrawerOpen}
          onOpenChange={setIsMobileTeamDrawerOpen}
          showSwipeHandle
        >
          <DrawerTrigger
            render={
              <button
                type="button"
                aria-label={`Switch team (currently ${activeTeam.name})`}
                aria-haspopup="listbox"
                className="flex w-full items-center gap-2 px-3 py-3"
              />
            }
          >
            {activeTeamMismatched && (
              <span
                title={`${activeTeam.name} isn't tagged for the currently selected regulation — pick a different team, or add this one to it, to plan leads/backs`}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white"
              >
                <Icon name={IconName.Warning} size={15} />
              </span>
            )}
            <span className="flex min-w-0 flex-1 items-center gap-2">
              {activeTeam.pokemon.map((mon, index) => (
                <span
                  key={index}
                  className="relative aspect-square min-w-0 max-w-16 flex-1"
                >
                  <span className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-lg bg-zinc-100/50 dark:bg-zinc-900/50">
                    <PokemonSprite species={mon.species} fill />
                  </span>
                  {mon.item && (
                    <span className="absolute -bottom-1 -right-1">
                      <ItemIcon item={mon.item} size={18} />
                    </span>
                  )}
                </span>
              ))}
            </span>
            <Icon
              name={IconName.ExpandLess}
              size={24}
              className="shrink-0 text-zinc-200 dark:text-zinc-800"
            />
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Switch team</DrawerTitle>
            </DrawerHeader>
            <div
              role="listbox"
              aria-label="Select team"
              className="flex flex-col gap-1 overflow-y-auto p-4 pt-2"
            >
              {regulationTeams.length === 0 ? (
                <p className="px-3 py-2 text-sm text-zinc-500">
                  No teams for this regulation yet.
                </p>
              ) : (
                regulationTeams.map((team) => (
                  <TeamSwitcherRow
                    key={team.id}
                    team={team}
                    isSelected={team.id === activeTeamId}
                    onSelect={() => selectTeam(team.id)}
                    onEdit={() => openEditModal(team.id)}
                    onRemove={() => requestRemove(team.id)}
                  />
                ))
              )}
              <button
                type="button"
                onClick={openAddModal}
                className="mt-1 flex items-center gap-2 border-t border-zinc-200 px-3 py-3 text-left text-sm text-zinc-700 hover:bg-zinc-100"
              >
                <Icon name={IconName.Add} size={16} />
                Add a team
              </button>
            </div>
          </DrawerContent>
        </Drawer>
      </nav>
    )}
    </>
  );
}
