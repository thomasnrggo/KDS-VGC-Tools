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
import { LanguageMenu } from "../LanguageMenu";
import { MobileMenu } from "./MobileMenu";
import { IconName } from "@/enums";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useMessages } from "@/hooks/useLanguage";
import { isAdminUid } from "@/lib/admin";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { Button } from "@/components/Button";

interface MyTeamHeaderProps {
  teams: Team[];
  activeTeamId: string | null;
  isLoading: boolean;
  addTeam: (rawPaste: string, name: string, regulationId: string) => string | null;
  editTeam: (id: string, rawPaste: string, name: string) => string | null;
  removeTeam: (id: string) => void;
  setActiveTeamId: (id: string | null) => void;
  /** Which page this header is rendered on — swaps the nav links so the current page never links to itself. */
  currentPage:
    "matchup-planner" | "damage-calc" | "teams" | "tournaments" | "speed-tiers" | "team-builder";
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
  { page: "teams", href: "/teams", labelKey: "myTeams", flagKey: "teams" },
  {
    page: "matchup-planner",
    href: "/matchup-planner",
    labelKey: "matchupPlanner",
    flagKey: "matchupPlanner",
  },
  // Available to everyone — no feature flag of its own.
  { page: "damage-calc", href: "/damage-calc", labelKey: "damageCalc", flagKey: null },
  { page: "speed-tiers", href: "/speed-tiers", labelKey: "speedTiers", flagKey: "speedTiers" },
  { page: "tournaments", href: "/tournaments", labelKey: "tournaments", flagKey: "tournaments" },
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
  const t = useMessages();
  return (
    <div
      role="option"
      aria-selected={isSelected}
      className={cn(
        "flex items-center gap-2 px-3 py-2 hover:bg-zinc-100",
        isSelected && "bg-zinc-50",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "flex flex-1 items-center gap-2 overflow-hidden text-left text-sm",
          isSelected ? "font-medium text-zinc-900" : "text-zinc-700",
        )}
      >
        <span className="flex shrink-0 flex-col gap-0.5">
          <span className="truncate text-sm font-bold">{team.name}</span>
          <div className="flex">
            {team.pokemon.map((mon, index) => (
              <div key={index} className="h-8 w-8 overflow-hidden rounded-full bg-zinc-100">
                <PokemonSprite species={mon.species} size={32} />
              </div>
            ))}
          </div>
        </span>
      </button>
      <button
        type="button"
        onClick={onEdit}
        aria-label={t.header.editNamed(team.name)}
        title={t.header.editNamed(team.name)}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700"
      >
        <Icon name={IconName.Edit} size={18} />
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label={t.header.removeNamed(team.name)}
        title={t.header.removeNamed(team.name)}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950"
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
  const t = useMessages();
  const [modalMode, setModalMode] = useState<"add" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isTeamMenuOpen, setIsTeamMenuOpen] = useState(false);
  const [isMobileTeamDrawerOpen, setIsMobileTeamDrawerOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mobileTeamNavRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  const editingTeam = editingId ? (teams.find((team) => team.id === editingId) ?? null) : null;
  const confirmDeleteTeam = confirmDeleteId
    ? (teams.find((team) => team.id === confirmDeleteId) ?? null)
    : null;
  const activeTeam = teams.find((team) => team.id === activeTeamId) ?? null;
  // Only what the switcher *offers* is regulation-scoped — the already-active
  // team (above) stays whatever it was regardless of a mismatch, so changing
  // this page's regulation filter never silently swaps your active team out
  // from under you.
  const regulationTeams = teams.filter((team) => team.regulationIds.includes(selectedRegulationId));
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
  const visibleNavLinks = NAV_LINKS.filter(
    (link) => link.flagKey === null || flags[link.flagKey] || isAdmin,
  );

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

  // The phone menu covers everything under the header row, so there's no
  // "outside" to click — only Escape, plus the menu button and the links.
  useEffect(() => {
    if (!isMobileNavOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsMobileNavOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isMobileNavOpen]);

  // Exposes the sticky header's height as --site-header-height, so a page's
  // own sticky bar (the Damage Calculator's) can pin just below it rather than
  // sliding over it. The phone menu is fixed, so it never changes this. The exact
  // (fractional) height, not offsetHeight's rounded one: rounding down left a
  // sub-pixel gap under the header that the page flickered through while
  // scrolling on phones.
  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const setHeight = () =>
      document.documentElement.style.setProperty(
        "--site-header-height",
        `${el.getBoundingClientRect().height}px`,
      );
    setHeight();
    const observer = new ResizeObserver(setHeight);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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
      document.documentElement.style.setProperty("--mobile-bar-height", `${el!.offsetHeight}px`);
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
      <header
        ref={headerRef}
        // Above the Matchup Planner's fixed team bar (also z-40) while the phone
        // menu is open, since the menu is drawn inside this header.
        className={cn(
          "sticky top-0 border-b border-chrome-700 bg-chrome-800",
          isMobileNavOpen ? "z-50" : "z-40",
        )}
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
                  <span
                    key={link.page}
                    aria-current="page"
                    className="text-sm font-bold text-white"
                  >
                    {t.nav[link.labelKey]}
                  </span>
                ) : (
                  <Link
                    key={link.page}
                    href={link.href}
                    className="text-sm font-medium text-chrome-200 transition-colors hover:text-white"
                  >
                    {t.nav[link.labelKey]}
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
                className="rounded-full bg-chrome-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-chrome-950"
              >
                {t.header.addYourTeam}
              </button>
            ) : (
              <>
                {activeTeam && (
                  <>
                    {/* Wide screens (1280px+) only — below that the team preview/switcher
                    lives in the fixed bottom drawer instead (see below): with
                    the page links inline from 1024px there's no room for both
                    until 1280px (see PLANNING.md). */}
                    <div ref={menuRef} className="relative hidden xl:block">
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
                              title={t.header.regulationMismatch(activeTeam.name)}
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
                                <span className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-lg bg-chrome-100/50">
                                  <PokemonSprite species={mon.species} fill />
                                </span>
                                {mon.item && (
                                  <span className="absolute -right-1 -bottom-1">
                                    <ItemIcon item={mon.item} size={16} />
                                  </span>
                                )}
                              </span>
                            ))}
                          </span>
                          <Icon
                            name={IconName.ExpandMore}
                            size={28}
                            className="mb-2 h-5 w-5 cursor-pointer text-chrome-100 lg:mb-3 lg:h-7 lg:w-7"
                          />
                        </span>
                      </button>
                    </div>

                    {isTeamMenuOpen && (
                      <div
                        ref={dropdownRef}
                        role="listbox"
                        aria-label={t.header.selectTeam}
                        className="absolute top-full right-6 z-20 mt-2 hidden w-96 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 py-1 shadow-lg xl:block"
                      >
                        {regulationTeams.length === 0 ? (
                          <p className="px-3 py-2 text-sm text-zinc-500">
                            {t.header.noTeamsForRegulation}
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
                          {t.header.addTeam}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
            {/* Phones and tablets: a menu button that opens MobileMenu, a full
            screen under this header row holding the page links, account and
            settings (see PLANNING.md). */}
            <button
              type="button"
              onClick={() => setIsMobileNavOpen((open) => !open)}
              aria-label={isMobileNavOpen ? t.nav.closeMenu : t.nav.openMenu}
              aria-expanded={isMobileNavOpen}
              className="flex h-10 w-10 items-center justify-center rounded-full text-chrome-100 hover:bg-zinc-500 lg:hidden"
            >
              <Icon name={isMobileNavOpen ? IconName.Close : IconName.Menu} size={24} />
            </button>
            {/* Wide screens only: on phones and tablets these live in the menu
            phone menu (MobileMenu), so the header row is just the logo
            and the menu button. */}
            <div className="hidden items-center gap-2 lg:flex">
              <LanguageMenu />
              <ThemeToggle />
              <AuthMenu
                user={authUser}
                isLoading={isAuthLoading}
                onSignIn={onSignIn}
                onSignOut={onSignOut}
              />
            </div>
          </div>
        </div>

        {isMobileNavOpen && (
          <MobileMenu
            links={visibleNavLinks.map((link) => ({
              page: link.page,
              href: link.href,
              label: t.nav[link.labelKey],
            }))}
            currentPage={currentPage}
            user={authUser}
            isAuthLoading={isAuthLoading}
            onSignIn={() => {
              setIsMobileNavOpen(false);
              onSignIn();
            }}
            onSignOut={() => {
              setIsMobileNavOpen(false);
              onSignOut();
            }}
            onClose={() => setIsMobileNavOpen(false)}
          />
        )}

        {modalMode && (
          <Modal onClose={closeModal} labelledBy="my-team-modal-title">
            <h2 id="my-team-modal-title" className="mb-4 text-lg font-semibold text-zinc-900">
              {modalMode === "edit" ? t.header.editTeam : t.header.addTeam}
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
            <h2 id="confirm-remove-team-title" className="mb-2 text-lg font-semibold text-zinc-900">
              {t.header.confirmRemoveTitle(confirmDeleteTeam.name)}
            </h2>
            <p className="mb-4 text-sm text-zinc-600">{t.header.confirmRemoveBody}</p>
            <div className="flex gap-2">
              <Button variant="danger" onClick={confirmRemove}>
                {t.header.removeTeam}
              </Button>
              <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>
                {t.common.cancel}
              </Button>
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
          aria-label={t.header.mobileTeamSwitcher}
          className="fixed inset-x-0 bottom-0 z-40 border-t border-chrome-700 bg-chrome-800 pb-[env(safe-area-inset-bottom)] xl:hidden"
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
                  aria-label={t.header.switchTeamCurrent(activeTeam.name)}
                  aria-haspopup="listbox"
                  className="flex w-full items-center gap-2 px-3 py-3"
                />
              }
            >
              {activeTeamMismatched && (
                <span
                  title={t.header.regulationMismatch(activeTeam.name)}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white"
                >
                  <Icon name={IconName.Warning} size={15} />
                </span>
              )}
              <span className="flex min-w-0 flex-1 items-center gap-2">
                {activeTeam.pokemon.map((mon, index) => (
                  <span key={index} className="relative aspect-square max-w-16 min-w-0 flex-1">
                    <span className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-lg bg-chrome-100/50">
                      <PokemonSprite species={mon.species} fill />
                    </span>
                    {mon.item && (
                      <span className="absolute -right-1 -bottom-1">
                        <ItemIcon item={mon.item} size={18} />
                      </span>
                    )}
                  </span>
                ))}
              </span>
              <Icon name={IconName.ExpandLess} size={24} className="shrink-0 text-chrome-200" />
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>{t.header.switchTeam}</DrawerTitle>
              </DrawerHeader>
              <div
                role="listbox"
                aria-label={t.header.selectTeam}
                className="flex flex-col gap-1 overflow-y-auto p-4 pt-2"
              >
                {regulationTeams.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-zinc-500">{t.header.noTeamsForRegulation}</p>
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
                  {t.header.addTeam}
                </button>
              </div>
            </DrawerContent>
          </Drawer>
        </nav>
      )}
    </>
  );
}
