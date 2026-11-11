"use client";

import { useState } from "react";
import Link from "next/link";
import { TeamSheetPreview } from "@/components/TeamSheetPreview";
import { GamePlanCard } from "@/components/GamePlanCard";
import { Button, TogglePill } from "@/components/Button";
import { RichTextEditor, RichTextView } from "@/components/RichTextEditor";
import { TeamCalcsList } from "@/components/TeamCalcs";
import { Icon } from "@/components/Icon";
import { IconName } from "@/enums";
import { useMessages } from "@/hooks/useLanguage";
import { addPlan, listPlans, movePlan, removePlan, updatePlanAt } from "@/lib/matchupPlans";
import { hasRichText } from "@/lib/richText";
import { calcsAgainst } from "@/lib/teamCalcs";
import { cn } from "@/lib/utils";
import type { MatchupPlan, Opponent, Team } from "@/types";

const SECTION_TITLE_CLASSES = "text-xs font-semibold uppercase tracking-wide text-zinc-500";

interface MatchupViewProps {
  team: Team;
  opponent: Opponent;
  plan: MatchupPlan;
  /** Set on a variant: its main's label. */
  mainLabel?: string;
  /** The "Copied from …" badge, while the plan is still a variant's untouched copy. */
  copiedFromLabel?: string;
  backHref: string;
  backLabel: string;
  /** The "Manage calcs" link under their team's calcs — omitted on a shared report. */
  calcsHref?: string;
  /** Omit to show the matchup read only — a shared report's. */
  onUpdatePlan?: (updater: (plan: MatchupPlan) => MatchupPlan) => void;
}

/**
 * One opponent's prep for one team (see docs/team-report.md): the plans
 * (their picks, yours, the game plan) beside their team, in tabs — a
 * compact sheet with a note per Pokémon, what they do, and the team's calcs
 * that involve their Pokémon. Editable on your own matchup page; read only
 * on a shared report's (docs/full-share.md).
 */
export function MatchupView({
  team,
  opponent,
  plan,
  mainLabel,
  copiedFromLabel,
  backHref,
  backLabel,
  calcsHref,
  onUpdatePlan,
}: MatchupViewProps) {
  const t = useMessages();
  const [teamTab, setTeamTab] = useState<"preview" | "notes" | "calcs">("preview");
  // Below xl, where the two would stack: which one the chips show.
  const [section, setSection] = useState<"plans" | "theirTeam">("plans");
  const TAB_LABELS = {
    preview: t.matchupPage.preview,
    notes: t.matchupPage.notesTab,
    calcs: t.matchupPage.calcsTab,
  };
  const relevantCalcs = calcsAgainst(team.calcs ?? [], opponent.team.pokemon);
  const plans = listPlans(plan);

  return (
    <div className="flex w-full flex-col gap-6 px-3 py-4 sm:p-6">
      <div className="flex flex-col gap-1">
        <div className="flex flex-col gap-x-4 gap-y-2 md:flex-row md:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Link
              href={backHref}
              aria-label={backLabel}
              title={backLabel}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
            >
              <Icon name={IconName.ExpandMore} size={20} className="rotate-90" />
            </Link>
            <h1 className="min-w-0 text-xl font-semibold text-zinc-900">
              {team.name} <span className="font-normal text-zinc-500">{t.matchupPage.vs}</span>{" "}
              {opponent.label}
            </h1>
          </div>
          {opponent.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pl-10 md:ml-auto md:max-w-1/2 md:justify-end md:pl-0">
              {opponent.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-zinc-300 px-2 py-0.5 text-[11px] text-zinc-600"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        {(mainLabel || opponent.pokepasteUrl) && (
          <div className="flex flex-wrap items-center gap-1.5 pl-10">
            {mainLabel && (
              <span className="text-xs text-zinc-500">{t.matchupPage.variantOf(mainLabel)}</span>
            )}
            {opponent.pokepasteUrl && (
              <a
                href={opponent.pokepasteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-zinc-600 hover:underline"
              >
                {t.common.poképaste}
                <Icon name={IconName.OpenInNew} size={12} />
              </a>
            )}
          </div>
        )}
      </div>

      {/* Wide screens split the page: the plans on the left, their team
          (sheet / notes / calcs) on the right, both in the page's normal
          flow. Narrower screens show one at a time, switched by chips —
          plans first. */}
      <div className="flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] xl:items-start xl:gap-6">
        <div className="flex flex-wrap gap-1.5 xl:hidden">
          {(["plans", "theirTeam"] as const).map((option) => (
            <TogglePill
              key={option}
              active={section === option}
              onClick={() => setSection(option)}
              className="px-3.5 py-1.5 text-sm"
            >
              {t.matchupPage[option]}
            </TogglePill>
          ))}
        </div>
        <div
          className={cn("min-w-0 flex-col gap-6 xl:flex", section === "plans" ? "flex" : "hidden")}
        >
          {/* Each plan: what they bring, what you bring against it, how you play it. */}
          <section aria-label={t.matchupPage.plans} className="flex flex-col gap-2">
            <div
              className={cn(
                "flex-wrap items-center gap-2 xl:flex",
                copiedFromLabel ? "flex" : "hidden",
              )}
            >
              <h2 className={cn(SECTION_TITLE_CLASSES, "hidden xl:block")}>
                {t.matchupPage.plans}
              </h2>
              {copiedFromLabel && (
                <span
                  title={t.opponentCard.copiedFromTitle(copiedFromLabel)}
                  className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800"
                >
                  {t.opponentCard.copiedFrom(copiedFromLabel)}
                </span>
              )}
            </div>
            {plans.map((gamePlan, index) => (
              <GamePlanCard
                key={gamePlan.id}
                plan={gamePlan}
                index={index}
                total={plans.length}
                myTeam={team.pokemon}
                theirTeam={opponent.team.pokemon}
                calcs={relevantCalcs}
                {...(onUpdatePlan && {
                  onChange: (updater) => onUpdatePlan((p) => updatePlanAt(p, index, updater)),
                  onMove: (direction) => onUpdatePlan((p) => movePlan(p, index, direction)),
                  onRemove: () => onUpdatePlan((p) => removePlan(p, index)),
                })}
              />
            ))}
            {onUpdatePlan && (
              <Button
                variant="outline"
                onClick={() => onUpdatePlan(addPlan)}
                className="flex items-center gap-1.5 self-start"
              >
                <Icon name={IconName.Add} size={16} />
                {t.matchupPage.addPlan}
              </Button>
            )}
          </section>
        </div>

        <section
          aria-label={t.matchupPage.theirTeam}
          className={cn(
            "min-w-0 flex-col gap-2 xl:flex",
            section === "theirTeam" ? "flex" : "hidden",
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className={cn(SECTION_TITLE_CLASSES, "hidden xl:block")}>
              {t.matchupPage.theirTeam}
            </h2>
            <div role="tablist" aria-label={t.matchupPage.theirTeam} className="flex gap-1">
              {(["preview", "notes", "calcs"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={teamTab === tab}
                  onClick={() => setTeamTab(tab)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    teamTab === tab
                      ? "bg-chrome-600 text-white"
                      : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200",
                  )}
                >
                  {TAB_LABELS[tab]}
                </button>
              ))}
            </div>
          </div>
          {teamTab === "preview" && (
            <TeamSheetPreview
              pokemon={opponent.team.pokemon}
              notes={plan.pokemonNotes}
              onNoteChange={
                onUpdatePlan &&
                ((index, note) =>
                  onUpdatePlan((p) => ({
                    ...p,
                    pokemonNotes: { ...p.pokemonNotes, [index]: note },
                  })))
              }
            />
          )}
          {teamTab === "notes" &&
            // What they do — the matchup's scouting notes, beside the sheet they're about.
            (onUpdatePlan ? (
              <RichTextEditor
                size="tall"
                value={plan.scoutingNotes ?? ""}
                onChange={(scoutingNotes) => onUpdatePlan((p) => ({ ...p, scoutingNotes }))}
                placeholder={t.matchupPage.whatTheyDoPlaceholder}
                ariaLabel={t.matchupPage.whatTheyDo}
              />
            ) : hasRichText(plan.scoutingNotes) ? (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                <RichTextView html={plan.scoutingNotes ?? ""} />
              </div>
            ) : (
              <p className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">
                {t.sharedPage.noScoutingNotes}
              </p>
            ))}
          {teamTab === "calcs" && (
            <div className="flex flex-col gap-2">
              {relevantCalcs.length === 0 ? (
                <p className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">
                  {t.matchupPage.noCalcs(team.name)}
                </p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-zinc-200">
                  <TeamCalcsList calcs={relevantCalcs} teamPokemon={team.pokemon} />
                </div>
              )}
              {calcsHref && (
                <Link
                  href={calcsHref}
                  className="self-end text-xs font-medium text-zinc-600 hover:underline"
                >
                  {t.matchupPage.manageCalcs}
                </Link>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
