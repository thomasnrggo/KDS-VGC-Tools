"use client";

import { useState } from "react";
import { useMyTeams } from "@/hooks/useMyTeams";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useMessages } from "@/hooks/useLanguage";
import { MyTeamHeader } from "@/components/MyTeamHeader";
import { SpeedTiersTable } from "@/components/SpeedTiersTable";
import { SpeedTiersList } from "@/components/SpeedTiersList";
import { SpeedLine } from "@/components/SpeedLine";
import { REGULATIONS } from "@/data/regulations";
import { Icon } from "@/components/Icon";
import { IconName } from "@/enums";
import { cn } from "@/lib/utils";

type View = "table" | "list" | "speedline";

export default function SpeedTiersPage() {
  const t = useMessages();
  const { activeTeams, activeTeamId, isLoading, addTeam, editTeam, removeTeam, setActiveTeamId } =
    useMyTeams();
  const { user, isLoading: isAuthLoading, signInWithGoogle, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();

  const [selectedRegulationId, setSelectedRegulationId] = useState(REGULATIONS[0]?.id ?? "");
  const selectedRegulation =
    REGULATIONS.find((regulation) => regulation.id === selectedRegulationId) ?? REGULATIONS[0];

  const [view, setView] = useState<View>("table");
  // Belt-and-suspenders: the tab below only ever lets an admin select
  // "speedline", but if admin status changes out from under an already-open
  // tab (e.g. signing out), derive back to Table for render rather than
  // leaving a non-admin viewing a view they can no longer reach through the
  // UI — computed here instead of synced via an effect, so there's no
  // separate "wrong view for a tick" render to worry about.
  const effectiveView: View = view === "speedline" && !isAdmin ? "table" : view;

  return (
    <div className="flex flex-1 flex-col">
      <MyTeamHeader
        teams={activeTeams}
        activeTeamId={activeTeamId}
        isLoading={isLoading}
        addTeam={addTeam}
        editTeam={editTeam}
        removeTeam={removeTeam}
        setActiveTeamId={setActiveTeamId}
        currentPage="speed-tiers"
        selectedRegulationId={selectedRegulationId}
        authUser={user}
        isAuthLoading={isAuthLoading}
        onSignIn={signInWithGoogle}
        onSignOut={signOut}
      />
      <div className="flex w-full flex-col gap-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-zinc-900">{t.speedTiers.title}</h2>
          {REGULATIONS.length > 1 ? (
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
              {REGULATIONS[0] && t.common.regulationLabel(REGULATIONS[0].label)}
            </span>
          )}
        </div>

        {/* Table = one row per Pokémon, every config as its own column.
            Tiers ("list" internally) = one row per (Pokémon, config) record,
            all sorted together by real Speed value — the pikalytics-style
            true speed tier list, vs. Table's full per-Pokémon stat spread.
            SpeedLine ("speedline" internally) = not the hypothetical-spread
            reference data the other two views show — your active team's
            actual Speed (real pasted item/nature/Stat Points) against one
            saved opponent's, on a shared horizontal line. */}
        <div role="tablist" aria-label={t.speedTiers.viewLabel} className="flex gap-1.5">
          <button
            type="button"
            role="tab"
            aria-selected={effectiveView === "table"}
            onClick={() => setView("table")}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
              effectiveView === "table"
                ? "bg-chrome-600 text-white"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200",
            )}
          >
            {t.speedTiers.table}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={effectiveView === "list"}
            onClick={() => setView("list")}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
              effectiveView === "list"
                ? "bg-chrome-600 text-white"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200",
            )}
          >
            {t.speedTiers.tiers}
          </button>
          {isAdmin && (
            <button
              type="button"
              role="tab"
              aria-selected={view === "speedline"}
              onClick={() => setView("speedline")}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                view === "speedline"
                  ? "bg-chrome-600 text-white"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200",
              )}
            >
              {t.speedTiers.speedLine}
            </button>
          )}
        </div>

        {selectedRegulation && effectiveView === "table" && (
          <SpeedTiersTable
            speciesKeys={selectedRegulation.speciesKeys}
            megaStoneItemsForSpecies={selectedRegulation.megaStoneItemsForSpecies}
          />
        )}
        {selectedRegulation && effectiveView === "list" && (
          <SpeedTiersList
            speciesKeys={selectedRegulation.speciesKeys}
            megaStoneItemsForSpecies={selectedRegulation.megaStoneItemsForSpecies}
          />
        )}
        {isAdmin && view === "speedline" && (
          <SpeedLine
            myTeams={activeTeams}
            defaultTeamId={activeTeamId ?? undefined}
            regulationId={selectedRegulationId}
          />
        )}
      </div>
    </div>
  );
}
