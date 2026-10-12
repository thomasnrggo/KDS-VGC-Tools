"use client";

import { use, useEffect, useRef } from "react";
import Link from "next/link";
import { useMyTeams } from "@/hooks/useMyTeams";
import { useOpponents } from "@/hooks/useOpponents";
import { useAuth } from "@/hooks/useAuth";
import { MyTeamHeader } from "@/components/MyTeamHeader";
import { OpponentPokemonCard } from "@/components/OpponentPokemonCard";
import { PokemonSlotPicker } from "@/components/PokemonSlotPicker";
import { RichTextEditor } from "@/components/RichTextEditor";
import { TeamCalcsList } from "@/components/TeamCalcs";
import { Icon } from "@/components/Icon";
import { IconName } from "@/enums";
import { getPlanForTeam } from "@/lib/opponent";
import { calcsAgainst } from "@/lib/teamCalcs";
import { REGULATIONS } from "@/data/regulations";
import type { MatchupPlan, PokemonSlot } from "@/types";

interface MatchupPageProps {
  params: Promise<{ teamId: string; opponentId: string }>;
}

const SECTION_TITLE_CLASSES = "text-xs font-semibold uppercase tracking-wide text-zinc-500";
const CARD_CLASSES = "flex flex-col gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4";

type PairKey = "leadPair" | "backPair";
const MEGA_KEY = { leadPair: "leadMega", backPair: "backMega" } as const;

/**
 * One opponent's prep page for one of your teams (see docs/team-report.md):
 * their roster with notes, your lead/back and game plan, what they do, and
 * the team's calcs that involve their Pokémon. The plan is the same
 * MatchupPlan the Matchup Planner row edits — not a copy.
 */
export default function MatchupPage({ params }: MatchupPageProps) {
  const { teamId, opponentId } = use(params);
  const {
    teams,
    activeTeams,
    activeTeamId,
    isLoading: isTeamsLoading,
    addTeam,
    editTeam,
    removeTeam,
    setActiveTeamId,
  } = useMyTeams();
  const { opponents, isLoading: isOpponentsLoading, updateOpponentPlan } = useOpponents();
  const { user, isLoading: isAuthLoading, signInWithGoogle, signOut } = useAuth();
  const notesRef = useRef<HTMLTextAreaElement>(null);

  const team = teams.find((t) => t.id === teamId) ?? null;
  const opponent = opponents.find((o) => o.id === opponentId) ?? null;
  const plan = opponent ? getPlanForTeam(opponent, teamId) : null;
  const mainLabel = opponent?.variantOf
    ? opponents.find((o) => o.id === opponent.variantOf)?.label
    : undefined;
  const copiedFromId = opponent?.copiedPlanFrom?.[teamId];
  const copiedFromLabel = copiedFromId
    ? (opponents.find((o) => o.id === copiedFromId)?.label ?? "the main team")
    : undefined;
  const relevantCalcs = team && opponent ? calcsAgainst(team.calcs ?? [], opponent.team.pokemon) : [];
  const selectedRegulationId = team?.regulationIds[0] ?? REGULATIONS[0]?.id ?? "";
  const reportHref = `/teams/${teamId}?tab=matchups`;

  // Same grow-to-fit as the Matchup Planner's game plan box.
  const notes = plan?.notes;
  useEffect(() => {
    const el = notesRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [notes]);

  function updatePlan(updater: (plan: MatchupPlan) => MatchupPlan) {
    updateOpponentPlan(opponentId, teamId, updater);
  }

  function setSlot(key: PairKey, slot: 0 | 1, index: PokemonSlot) {
    updatePlan((p) => {
      const next: [PokemonSlot, PokemonSlot] = [...p[key]];
      next[slot] = index;
      return { ...p, [key]: next };
    });
  }

  function toggleMega(key: PairKey, slot: 0 | 1) {
    const megaKey = MEGA_KEY[key];
    updatePlan((p) => {
      const next: [boolean, boolean] = [...p[megaKey]];
      next[slot] = !next[slot];
      return { ...p, [megaKey]: next };
    });
  }

  const isLoading = isTeamsLoading || isOpponentsLoading;

  return (
    <div className="flex flex-1 flex-col">
      <MyTeamHeader
        teams={activeTeams}
        activeTeamId={activeTeamId}
        isLoading={isTeamsLoading}
        addTeam={addTeam}
        editTeam={editTeam}
        removeTeam={removeTeam}
        setActiveTeamId={setActiveTeamId}
        currentPage="teams"
        selectedRegulationId={selectedRegulationId}
        authUser={user}
        isAuthLoading={isAuthLoading}
        onSignIn={signInWithGoogle}
        onSignOut={signOut}
      />

      {isLoading ? (
        <p className="p-6 text-sm text-zinc-500">Loading…</p>
      ) : !team || !opponent || !plan ? (
        <div className="flex flex-col items-center gap-3 p-14 text-center">
          <p className="text-lg font-semibold text-zinc-900">
            {!team ? "Team not found" : "Opponent not found"}
          </p>
          <p className="text-sm text-zinc-600">It may have been removed on another device.</p>
          <Link
            href={team ? reportHref : "/teams"}
            className="text-sm font-medium text-zinc-600 hover:underline"
          >
            ← Back to {team ? "the team report" : "My Teams"}
          </Link>
        </div>
      ) : (
        <div className="flex w-full flex-col gap-6 p-6">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Link
                href={reportHref}
                aria-label="Back to matchups"
                title="Back to matchups"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
              >
                <Icon name={IconName.ExpandMore} size={20} className="rotate-90" />
              </Link>
              <h1 className="min-w-0 text-xl font-semibold text-zinc-900">
                {team.name} <span className="font-normal text-zinc-500">vs</span>{" "}
                {opponent.label}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 pl-10">
              {mainLabel && (
                <span className="text-xs text-zinc-500">Variant of {mainLabel}</span>
              )}
              {opponent.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-zinc-300 px-2 py-0.5 text-[11px] text-zinc-600"
                >
                  {tag}
                </span>
              ))}
              {opponent.pokepasteUrl && (
                <a
                  href={opponent.pokepasteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-zinc-600 hover:underline"
                >
                  Poképaste
                  <Icon name={IconName.OpenInNew} size={12} />
                </a>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className={CARD_CLASSES}>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className={SECTION_TITLE_CLASSES}>Your plan</h2>
                {copiedFromLabel && (
                  <span
                    title="This plan started as a copy of the main team's — editing it makes it this variant's own."
                    className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800"
                  >
                    Copied from {copiedFromLabel}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-6">
                {(
                  [
                    ["leadPair", "Lead"],
                    ["backPair", "Back"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="flex flex-col gap-1">
                    <h3 className={SECTION_TITLE_CLASSES}>{label}</h3>
                    <div className="flex gap-2">
                      {([0, 1] as const).map((slot) => (
                        <PokemonSlotPicker
                          key={slot}
                          label={`${label} ${slot + 1}`}
                          myTeamPokemon={team.pokemon}
                          value={plan[key][slot]}
                          onChange={(index) => setSlot(key, slot, index)}
                          megaEnabled={plan[MEGA_KEY[key]][slot]}
                          onMegaToggle={() => toggleMega(key, slot)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-1">
                <h3 className={SECTION_TITLE_CLASSES}>Game plan</h3>
                <textarea
                  ref={notesRef}
                  value={plan.notes}
                  onChange={(event) => {
                    const value = event.target.value;
                    updatePlan((p) => ({ ...p, notes: value }));
                  }}
                  rows={3}
                  placeholder="What would you do against this team?"
                  aria-label="Game plan"
                  className="min-h-20 w-full resize-none rounded-lg border border-zinc-200 bg-zinc-100 p-2 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                />
              </div>
            </section>

            <section className={CARD_CLASSES}>
              <h2 className={SECTION_TITLE_CLASSES}>What they do</h2>
              <RichTextEditor
                value={plan.scoutingNotes ?? ""}
                onChange={(scoutingNotes) => updatePlan((p) => ({ ...p, scoutingNotes }))}
                placeholder="Their likely leads, common plays, what to watch for…"
                ariaLabel="What they do"
              />
            </section>
          </div>

          <section className="flex flex-col gap-2">
            <h2 className={SECTION_TITLE_CLASSES}>Their team</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {opponent.team.pokemon.map((mon, index) => (
                <OpponentPokemonCard
                  key={`${mon.species}-${index}`}
                  pokemon={mon}
                  note={plan.pokemonNotes?.[index] ?? ""}
                  onNoteChange={(note) =>
                    updatePlan((p) => ({
                      ...p,
                      pokemonNotes: { ...p.pokemonNotes, [index]: note },
                    }))
                  }
                />
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <h2 className={SECTION_TITLE_CLASSES}>Calcs vs this team</h2>
              <Link
                href={`/teams/${teamId}?tab=calcs`}
                className="text-xs font-medium text-zinc-600 hover:underline"
              >
                Manage calcs →
              </Link>
            </div>
            {relevantCalcs.length === 0 ? (
              <p className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">
                None of {team.name}&apos;s calcs involve this team&apos;s Pokémon yet.
              </p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-zinc-200">
                <TeamCalcsList calcs={relevantCalcs} teamPokemon={team.pokemon} />
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
