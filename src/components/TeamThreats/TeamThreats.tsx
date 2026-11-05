"use client";

import { useDeferredValue, useState, type ReactNode } from "react";
import type { ParsedPokemon } from "@/types";
import {
  metaThreatSets,
  protectCount,
  rankThreats,
  setIssues,
  speedControlReport,
  teamRoles,
  teamStyle,
  threatMatchups,
  withSpread,
  type Counter,
  type Hit,
  type SetIssue,
  type SpeedControlReport,
  type SpeedMode,
  type PokemonRole,
  type TeamRole,
  type TeamStyle,
  type ThreatResult,
} from "@/lib/threats";
import { useLanguageSettings, useMessages, usePokemonText } from "@/hooks/useLanguage";
import { useMeta } from "@/hooks/useMeta";
import { useMetaSpreads } from "@/hooks/useMetaSpreads";
import { resolveEffectiveAbility } from "@/lib/species/resolveEffectiveAbility";
import { speciesLabel } from "@/lib/species/speciesLabel";
import { shortTournamentName } from "@/lib/meta/metaDocument";
import { cn } from "@/lib/utils";
import { IconName } from "@/enums";
import { TextAction, TogglePill } from "../Button";
import { Icon } from "../Icon";
import { ItemIcon } from "../ItemIcon";
import { LoadingState } from "../LoadingState";
import { PokemonSprite } from "../PokemonSprite";

const SPEED_MODES: SpeedMode[] = ["normal", "tailwind", "theirTailwind", "trickRoom"];
const ROLES: TeamRole[] = [
  "speedControl",
  "trickRoom",
  "fakeOut",
  "redirection",
  "intimidate",
  "weather",
  "terrain",
  "spreadDamage",
];
/** Threats (Pokémon) shown before "Show more". */
const SHOWN = 5;
/** How many of the top threats the summary names. */
const SUMMARY_COUNT = 3;
/** The summary's "Nothing answers" looks at this many of the top sets. */
const UNANSWERED_FROM = 15;

const SECTION_TITLE = "text-xs font-semibold tracking-wide text-zinc-500 uppercase";
const PANEL = "rounded-lg border border-zinc-200 bg-zinc-50";

const DOTS: Record<ThreatResult["level"], number> = { high: 3, medium: 2, low: 1 };

const VERDICT_CLASS: Record<SpeedControlReport["verdict"], string> = {
  unaffected: "bg-zinc-500/15 text-zinc-600",
  covered: "bg-green-500/20 text-green-800 dark:text-green-200",
  partial: "bg-amber-500/20 text-amber-800 dark:text-amber-200",
  exposed: "bg-red-500/20 text-red-700 dark:text-red-300",
};

function percent(value: number): string {
  return `${Math.round(value * 1000) / 10}%`;
}

/** A threat Pokémon with its sets (one per common item), most dangerous set first. */
interface ThreatGroup {
  species: string;
  results: ThreatResult[];
}

function groupBySpecies(results: ThreatResult[]): ThreatGroup[] {
  const groups = new Map<string, ThreatResult[]>();
  for (const result of results) {
    const group = groups.get(result.set.species);
    if (group) group.push(result);
    else groups.set(result.set.species, [result]);
  }
  return [...groups].map(([species, sets]) => ({ species, results: sets }));
}

interface TeamThreatsProps {
  pokemon: ParsedPokemon[];
  /** The team's regulation, for its metagame data. */
  regulationId: string | undefined;
}

/**
 * The team page's Threats tab, answer first: a short summary (the biggest
 * threats, what nothing answers, what outspeeds the whole team, how it
 * stands against Trick Room and Tailwind, set problems), then one row per
 * threatening Pokémon — whom it KOs ringed red, who answers it ringed green,
 * its sets (one per common item) as pills, the numbers on tap — then speed
 * control in detail and the team's roles. See src/lib/threats/.
 */
export function TeamThreats({ pokemon: current, regulationId }: TeamThreatsProps) {
  // The calcs take ~80ms: beside the Team Builder (which edits the team as
  // it's shown here), they redo at low priority, so dragging a Stat Points
  // slider doesn't wait on them.
  const pokemon = useDeferredValue(current);
  const t = useMessages();
  const text = usePokemonText();
  const { appLanguage } = useLanguageSettings();
  const { meta, isLoading } = useMeta(regulationId);
  // The admin's common spreads for the meta's sets, in place of estimates.
  const { spreads: metaSpreads, isLoading: spreadsLoading } = useMetaSpreads(regulationId);
  const [mode, setMode] = useState<SpeedMode>("normal");
  const [showAll, setShowAll] = useState(false);

  if (pokemon.length === 0) return <p className="text-sm text-zinc-500">{t.threats.empty}</p>;
  if ((isLoading && !meta) || spreadsLoading) return <LoadingState />;

  const spreads = pokemon.map(withSpread);
  const team = spreads.map((entry) => entry.pokemon);
  const estimated = pokemon.filter((_, index) => spreads[index].estimated);
  const roles = teamRoles(pokemon);
  const issues = setIssues(pokemon);
  // The recent events, like the Metagame page's default — the metagame as it is now.
  const metaPokemon = meta ? (meta.official.recent?.pokemon ?? meta.official.pokemon) : [];
  // The calcs once; each speed mode only re-ranks them.
  const matchups = threatMatchups(team, metaThreatSets(metaPokemon, { spreads: metaSpreads }));
  const asBuilt = rankThreats(matchups, "normal");
  const groups = groupBySpecies(mode === "normal" ? asBuilt : rankThreats(matchups, mode));
  const shown = showAll ? groups : groups.slice(0, SHOWN);
  const reports = (["trickRoom", "tailwind"] as const).map((kind) =>
    speedControlReport(team, metaPokemon, matchups, kind, metaSpreads),
  );
  const style = teamStyle(team, matchups);
  const noMeta = groups.length === 0;
  // What it's built from: the recent events (else the whole regulation), by name.
  const recent = meta?.official.recent;
  const basis = meta && {
    teams: (recent ?? meta.official).teams,
    tournaments: meta.official.tournaments
      .filter((tournament) => !recent || recent.tournamentIds.includes(tournament.id))
      .map((tournament) => shortTournamentName(tournament.title)),
    updated: new Date(meta.updatedAt).toLocaleDateString(appLanguage, {
      month: "short",
      day: "numeric",
    }),
  };

  const name = (index: number) => text.species(pokemon[index].species);

  // The summary reads the team as built.
  const biggest = groupBySpecies(asBuilt).slice(0, SUMMARY_COUNT);
  const unanswered = groupBySpecies(
    asBuilt
      .slice(0, UNANSWERED_FROM)
      .filter((result) => result.duels.every((duel) => !duel.answer)),
  );
  const outspeedAll = asBuilt.filter((result) => result.duels.every((duel) => duel.theyMoveFirst));
  const withTailwind = roles.speedControl.some((member) => member.via === "Tailwind")
    ? rankThreats(matchups, "tailwind")
    : [];
  const tailwindFixes = outspeedAll.filter((result) => {
    const under = withTailwind.find((other) => other.set.id === result.set.id);
    return under && !under.duels.every((duel) => duel.theyMoveFirst);
  }).length;

  function issueText(issue: SetIssue): string {
    switch (issue.kind) {
      case "terrainNeverSet":
        return t.threats.issue.terrainNeverSet(
          name(issue.index),
          issue.via === pokemon[issue.index].item ? text.item(issue.via) : text.ability(issue.via),
          t.calc.terrains[issue.terrain],
          issue.clashes && t.calc.terrains[issue.clashes],
        );
      case "weatherNeverSet":
        return t.threats.issue.weatherNeverSet(
          name(issue.index),
          text.ability(issue.via),
          t.calc.weathers[issue.weather],
        );
      case "choiceProtect":
        return t.threats.issue.choiceProtect(
          name(issue.index),
          text.item(issue.via),
          text.move(issue.move),
        );
      case "vestStatus":
        return t.threats.issue.vestStatus(name(issue.index), text.move(issue.move));
    }
  }

  const none = <span className="text-sm text-zinc-500">{t.threats.noneFound}</span>;

  return (
    // A container: laid out by the space it's given (the team page's tab, or the Team Builder's drawer).
    <div className="@container flex flex-col gap-6">
      {/* What it's based on, before anything it says. */}
      {basis && !noMeta && (
        <div className="flex flex-col gap-1 rounded-lg bg-zinc-100 px-3 py-2.5">
          <p className="text-sm text-zinc-700">
            {t.threats.basedOn(
              basis.teams.toLocaleString(appLanguage),
              basis.tournaments.length,
              basis.tournaments.join(", "),
              basis.updated,
            )}
          </p>
          <p className="text-xs text-zinc-500">{t.threats.caveat}</p>
        </div>
      )}

      {/* Who the team is: its game plan, and each Pokémon's job in it. */}
      <TeamStyleSection style={style} pokemon={pokemon} />

      {/* The answer first: what to worry about, in a few lines. */}
      <section className="flex flex-col gap-2">
        <h2 className={SECTION_TITLE}>{t.threats.summary}</h2>
        <ul className={cn(PANEL, "flex flex-col divide-y divide-zinc-200")}>
          {!noMeta && (
            <>
              <SummaryRow label={t.threats.biggest}>
                {biggest.map((group) => (
                  <ThreatName key={group.species} group={group} />
                ))}
              </SummaryRow>
              <SummaryRow label={t.threats.noAnswer}>
                {unanswered.length === 0
                  ? none
                  : unanswered.map((group) => <ThreatName key={group.species} group={group} />)}
              </SummaryRow>
              <SummaryRow label={t.threats.outspeedAll}>
                {outspeedAll.length === 0 ? (
                  none
                ) : (
                  <>
                    {outspeedAll.map((result) => (
                      <ThreatName
                        key={result.set.id}
                        group={{ species: result.set.species, results: [result] }}
                        withItem
                        compact={outspeedAll.length > SUMMARY_COUNT}
                      />
                    ))}
                    {tailwindFixes > 0 && (
                      <span className="text-sm text-green-700 dark:text-green-300">
                        {t.threats.tailwindFixes(tailwindFixes)}
                      </span>
                    )}
                  </>
                )}
              </SummaryRow>
              {reports.map((report) => (
                <SummaryRow key={report.kind} label={t.threats.against[report.kind]}>
                  <VerdictBadge verdict={report.verdict} />
                </SummaryRow>
              ))}
            </>
          )}
          <SummaryRow label={t.threats.setProblems}>
            {issues.length === 0 ? (
              none
            ) : (
              <ul className="flex flex-col gap-1.5">
                {issues.map((issue, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm text-zinc-800">
                    <MemberSprite mon={pokemon[issue.index]} />
                    {issueText(issue)}
                  </li>
                ))}
              </ul>
            )}
          </SummaryRow>
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className={SECTION_TITLE}>{t.threats.title}</h2>
          <div role="group" aria-label={t.threats.speedMode} className="flex flex-wrap gap-1.5">
            {SPEED_MODES.map((option) => (
              <TogglePill
                key={option}
                active={mode === option}
                onClick={() => setMode(option)}
                className="px-3 py-1 text-sm"
              >
                {t.threats.speedModes[option]}
              </TogglePill>
            ))}
          </div>
        </div>
        {noMeta ? (
          <p className="text-sm text-zinc-500">{t.threats.noMeta}</p>
        ) : (
          <>
            <p className="text-xs text-zinc-500">{t.threats.intro}</p>
            <ol className={cn(PANEL, "flex flex-col divide-y divide-zinc-200")}>
              {shown.map((group) => (
                <ThreatRow key={group.species} group={group} pokemon={pokemon} />
              ))}
            </ol>
            {groups.length > SHOWN && (
              <TextAction onClick={() => setShowAll(!showAll)} className="self-start">
                {showAll ? t.threats.showFewer : t.threats.showMore(groups.length - SHOWN)}
              </TextAction>
            )}
          </>
        )}
      </section>

      {!noMeta && (
        <section className="flex flex-col gap-2">
          <h2 className={SECTION_TITLE}>{t.threats.speedControl}</h2>
          <div className="grid gap-2 @4xl:grid-cols-2">
            {reports.map((report) => (
              <SpeedControlCard key={report.kind} report={report} pokemon={pokemon} />
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className={SECTION_TITLE}>{t.threats.roles}</h2>
        <ul className="flex flex-wrap gap-1.5">
          {ROLES.map((role) => {
            const members = roles[role];
            return (
              <li
                key={role}
                className={cn(
                  "flex h-9 items-center gap-1.5 rounded-full border text-sm",
                  members.length > 0
                    ? "border-zinc-300 bg-zinc-50 py-1 pr-1 pl-3 text-zinc-800"
                    : "border-dashed border-zinc-300 px-3 text-zinc-400",
                )}
              >
                {t.threats.roleNames[role]}
                {members.map((member, index) => (
                  <MemberSprite
                    key={index}
                    mon={pokemon[member.index]}
                    small
                    title={`${name(member.index)} · ${member.kind === "move" ? text.move(member.via) : text.ability(member.via)}`}
                  />
                ))}
              </li>
            );
          })}
          <li className="flex h-9 items-center rounded-full border border-zinc-300 bg-zinc-50 px-3 text-sm text-zinc-800">
            {t.threats.protect(protectCount(pokemon), pokemon.length)}
          </li>
        </ul>
      </section>

      <details className="group border-t border-zinc-200 pt-3 text-xs text-zinc-500">
        <summary className="flex cursor-pointer list-none items-center gap-1 font-medium text-zinc-600 hover:text-zinc-900">
          <Icon
            name={IconName.ExpandMore}
            size={16}
            className="-rotate-90 transition-transform group-open:rotate-0"
          />
          {t.threats.howCalculated}
        </summary>
        <div className="mt-2 flex flex-col gap-1">
          {estimated.length > 0 && (
            <p>
              {t.threats.estimated(estimated.map((mon) => text.species(mon.species)).join(", "))}
            </p>
          )}
          <p>{t.threats.method}</p>
          {meta && (
            <p>
              {t.coverage.metaSource(
                meta.official.tournaments.length,
                meta.official.teams,
                new Date(meta.updatedAt).toLocaleDateString(appLanguage, {
                  month: "short",
                  day: "numeric",
                }),
                meta.official.source,
              )}
            </p>
          )}
        </div>
      </details>
    </div>
  );
}

/** The roles in the order they're listed. */
const STYLE_ROLES: PokemonRole[] = ["pressure", "support", "revengeKiller", "setup"];

/** The team's archetype (and what else it leans on), then who does what — and who has no clear job. */
function TeamStyleSection({ style, pokemon }: { style: TeamStyle; pokemon: ParsedPokemon[] }) {
  const t = useMessages();
  const text = usePokemonText();
  const name = (index: number) => text.species(pokemon[index].species);
  const total = style.commonSets;
  const title =
    style.archetype === "weather" && style.weather
      ? t.threats.style.weatherTeam(t.calc.weathers[style.weather as keyof typeof t.calc.weathers])
      : t.threats.style.archetypes[style.archetype];
  const description =
    style.archetype === "weather" && style.weather
      ? t.threats.style.weatherDescription(
          t.calc.weathers[style.weather as keyof typeof t.calc.weathers],
        )
      : t.threats.style.descriptions[style.archetype];
  const extras = style.extras.map((extra) => {
    switch (extra.kind) {
      case "tailwind":
        return `${t.threats.style.extras.tailwind} (${name(extra.index)})`;
      case "trickRoomMode":
        return `${t.threats.style.extras.trickRoomMode} (${name(extra.index)})`;
      case "setupOptions":
        return `${t.threats.style.extras.setupOptions} (${extra.indexes.map(name).join(", ")})`;
      case "terrain":
        return `${t.threats.style.extras.terrain(
          t.calc.terrains[extra.terrain as keyof typeof t.calc.terrains],
        )} (${name(extra.index)})`;
    }
  });
  const noJob = style.pokemon.filter((mon) => mon.roles.length === 0);

  return (
    <section className="flex flex-col gap-2">
      <h2 className={SECTION_TITLE}>{t.threats.style.title}</h2>
      <div className={cn(PANEL, "flex flex-col")}>
        <div className="flex flex-col gap-1 border-b border-zinc-200 px-3 py-2.5">
          <span className="text-base font-semibold text-zinc-900">{title}</span>
          <p className="text-sm text-zinc-600">{description}</p>
          {extras.length > 0 && (
            <p className="text-xs text-zinc-500">{t.threats.style.alsoHas(extras.join(" · "))}</p>
          )}
        </div>
        <ul className="flex flex-col divide-y divide-zinc-200">
          {STYLE_ROLES.map((role) => {
            const members = style.pokemon.flatMap((mon) => {
              const reason = mon.roles.find((candidate) => candidate.role === role);
              return reason ? [{ index: mon.index, reason }] : [];
            });
            if (members.length === 0) return null;
            return (
              <SummaryRow key={role} label={t.threats.style.roles[role]}>
                {members.map(({ index, reason }) => (
                  <StyleMember
                    key={index}
                    mon={pokemon[index]}
                    note={
                      reason.count != null
                        ? role === "pressure"
                          ? t.threats.style.ohkos(reason.count, total)
                          : t.threats.style.beforeTheyMove(reason.count, total)
                        : [
                            ...(reason.ability ? [text.ability(reason.ability)] : []),
                            ...(reason.via ?? []).map((move) => text.move(move)),
                          ].join(", ")
                    }
                  />
                ))}
              </SummaryRow>
            );
          })}
          {noJob.length > 0 && (
            <SummaryRow label={t.threats.style.noJob}>
              {noJob.map((mon) => (
                <StyleMember
                  key={mon.index}
                  mon={pokemon[mon.index]}
                  note={t.threats.style.ohkos(mon.kos, total)}
                  muted
                />
              ))}
            </SummaryRow>
          )}
        </ul>
        <p className="border-t border-zinc-200 px-3 py-2 text-xs text-zinc-500">
          {t.threats.style.measured(total)}
        </p>
      </div>
    </section>
  );
}

/** A team member in a role row: sprite, name, and what earns it the role. */
function StyleMember({ mon, note, muted }: { mon: ParsedPokemon; note: string; muted?: boolean }) {
  const text = usePokemonText();
  return (
    <span className="flex items-center gap-1.5">
      <MemberSprite mon={mon} small />
      <span className="flex flex-col leading-tight">
        <span className={cn("text-sm", muted ? "text-zinc-500" : "text-zinc-800")}>
          {text.species(mon.species)}
        </span>
        {note && <span className="text-[11px] text-zinc-500">{note}</span>}
      </span>
    </span>
  );
}

function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <li className="flex flex-col gap-1.5 px-3 py-2.5 @xl:flex-row @xl:items-center @xl:gap-4">
      <span className="shrink-0 text-sm font-medium text-zinc-700 @xl:w-56">{label}</span>
      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1.5">{children}</div>
    </li>
  );
}

/** A threat's sprite and name (and, for one set, its item) — `compact`: the sprite (and item) alone, the name in its tooltip. */
function ThreatName({
  group,
  withItem,
  compact,
}: {
  group: ThreatGroup;
  withItem?: boolean;
  compact?: boolean;
}) {
  const text = usePokemonText();
  const item = group.results[0].set.pokemon.item;
  const label = speciesLabel(text, group.species);
  const sprite = (
    <span className="relative h-7 w-7 shrink-0">
      <PokemonSprite species={group.species} item={item} fill />
    </span>
  );
  if (compact) {
    return (
      <span
        title={withItem && item ? `${label} · ${text.item(item)}` : label}
        className="flex items-center"
      >
        {sprite}
        {withItem && item && <ItemIcon item={item} size={16} />}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-sm text-zinc-800">
      {sprite}
      {label}
      {withItem && item && <span className="text-zinc-500">· {text.item(item)}</span>}
    </span>
  );
}

function VerdictBadge({ verdict }: { verdict: SpeedControlReport["verdict"] }) {
  const t = useMessages();
  return (
    <span
      className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", VERDICT_CLASS[verdict])}
    >
      {t.threats.verdicts[verdict]}
    </span>
  );
}

/** One threatening Pokémon: its danger, whom it KOs, who answers it — its sets as pills, the numbers on tap. */
function ThreatRow({ group, pokemon }: { group: ThreatGroup; pokemon: ParsedPokemon[] }) {
  const t = useMessages();
  const text = usePokemonText();
  const [selected, setSelected] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const result = group.results[Math.min(selected, group.results.length - 1)];
  const { set } = result;
  // The Pokémon's usage: the set's, over its share of the Pokémon.
  const usage = set.share > 0 ? set.usage / set.share : set.usage;
  // The row shows OHKOs (sure or on a high roll); 2HKOs are in the details.
  const kos = result.duels.flatMap((duel, index) =>
    duel.ko === "ohko" || duel.ko === "rollOhko" ? [index] : [],
  );
  const answers = result.duels.flatMap((duel, index) => (duel.answer ? [index] : []));

  return (
    <li className="flex flex-col">
      <div className="flex flex-col gap-2 px-3 py-2.5 @4xl:flex-row @4xl:items-center @4xl:gap-4">
        <div className="flex min-w-0 items-center gap-2.5 @4xl:w-72 @4xl:shrink-0">
          <span className="relative h-10 w-10 shrink-0">
            <PokemonSprite species={group.species} item={set.pokemon.item} fill />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="flex items-center gap-2">
              <span className="truncate font-medium text-zinc-900">
                {speciesLabel(text, group.species)}
              </span>
              <DangerDots level={result.level} />
            </span>
            <span className="text-xs text-zinc-500">{t.threats.ofTeams(percent(usage))}</span>
          </div>
          {/* Narrow: the toggle stays on the name's row. */}
          <DetailsToggle
            isOpen={isOpen}
            onToggle={() => setIsOpen(!isOpen)}
            className="@4xl:hidden"
          />
        </div>

        {group.results.length > 1 && (
          <div className="flex flex-wrap gap-1 @4xl:w-56 @4xl:shrink-0">
            {group.results.map((option, index) => (
              <button
                key={option.set.id}
                type="button"
                aria-pressed={index === selected}
                onClick={() => setSelected(index)}
                title={percent(option.set.share)}
                className={cn(
                  "flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs",
                  index === selected
                    ? "border-chrome-800 bg-chrome-800 text-chrome-100"
                    : "border-zinc-300 text-zinc-600 hover:border-zinc-500",
                )}
              >
                {option.set.pokemon.item && <ItemIcon item={option.set.pokemon.item} size={14} />}
                {option.set.pokemon.item && text.item(option.set.pokemon.item)}
              </button>
            ))}
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-5 gap-y-1.5">
          <SpriteGroup
            label={t.threats.kos}
            tone="bad"
            members={kos.map((index) => pokemon[index])}
            emptyLabel={t.threats.noKos}
          />
          <SpriteGroup
            label={t.threats.answeredBy}
            tone="good"
            members={answers.map((index) => pokemon[index])}
            emptyLabel={t.threats.nobody}
          />
        </div>

        <DetailsToggle
          isOpen={isOpen}
          onToggle={() => setIsOpen(!isOpen)}
          className="hidden @4xl:flex"
        />
      </div>
      {isOpen && <ThreatDetails result={result} pokemon={pokemon} />}
    </li>
  );
}

function DetailsToggle({
  isOpen,
  onToggle,
  className,
}: {
  isOpen: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const t = useMessages();
  return (
    <button
      type="button"
      aria-expanded={isOpen}
      aria-label={t.threats.showDetails}
      title={t.threats.showDetails}
      onClick={onToggle}
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-200",
        className,
      )}
    >
      <Icon
        name={IconName.ExpandMore}
        size={20}
        className={cn("transition-transform", isOpen && "rotate-180")}
      />
    </button>
  );
}

function DangerDots({ level }: { level: ThreatResult["level"] }) {
  const t = useMessages();
  return (
    <span title={t.threats.levels[level]} className="flex shrink-0 gap-0.5">
      <span className="sr-only">{t.threats.levels[level]}</span>
      {[1, 2, 3].map((dot) => (
        <span
          key={dot}
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            dot > DOTS[level]
              ? "bg-zinc-300"
              : level === "high"
                ? "bg-red-500"
                : level === "medium"
                  ? "bg-amber-500"
                  : "bg-zinc-500",
          )}
        />
      ))}
    </span>
  );
}

function SpriteGroup({
  label,
  tone,
  members,
  emptyLabel,
}: {
  label: string;
  tone: "good" | "bad";
  members: ParsedPokemon[];
  emptyLabel: string;
}) {
  return (
    <span className="flex items-center gap-2">
      <span className="text-xs text-zinc-500">{label}</span>
      {members.length === 0 ? (
        <span
          className={cn(
            "text-sm",
            tone === "good" ? "font-semibold text-red-600 dark:text-red-300" : "text-zinc-400",
          )}
        >
          {emptyLabel}
        </span>
      ) : (
        <span className="flex flex-wrap gap-1.5">
          {members.map((mon, index) => (
            <MemberSprite key={index} mon={mon} tone={tone} />
          ))}
        </span>
      )}
    </span>
  );
}

/** The set and, per Pokémon of yours, both best hits. */
function ThreatDetails({ result, pokemon }: { result: ThreatResult; pokemon: ParsedPokemon[] }) {
  const t = useMessages();
  const text = usePokemonText();
  const { set } = result;
  // A Mega's own ability, not its base form's (Mega Raichu Y: No Guard).
  const ability = resolveEffectiveAbility(
    set.pokemon.species,
    set.pokemon.item,
    set.pokemon.ability,
  );
  const field = [
    result.weather && t.calc.weathers[result.weather],
    result.terrain && t.calc.terrains[result.terrain],
  ].filter(Boolean);
  const first = result.duels.filter((duel) => duel.theyMoveFirst).length;

  function hit(value: Hit | null) {
    return value
      ? t.threats.hit(
          text.move(value.move),
          value.minPercent.toFixed(1),
          value.maxPercent.toFixed(1),
        )
      : "—";
  }

  return (
    <div className="flex flex-col gap-3 border-t border-zinc-200 bg-zinc-100/60 px-3 py-3 text-sm">
      <div className="flex flex-col gap-0.5 text-xs text-zinc-600">
        <span>
          {[ability && text.ability(ability), set.pokemon.nature && text.nature(set.pokemon.nature)]
            .filter(Boolean)
            .join(" · ")}
        </span>
        <span>{(set.pokemon.moves ?? []).map((move) => text.move(move)).join(" / ")}</span>
        <span>
          {[
            field.length > 0 && t.threats.inField(field.join(", ")),
            t.threats.movesFirst(first, pokemon.length),
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </div>
      <div
        role="table"
        className="grid max-w-2xl grid-cols-[2rem_1fr_1fr] items-center gap-x-3 gap-y-2"
      >
        <div role="row" className="contents">
          {/* Its text is for screen readers; the cell itself keeps the sprite column. */}
          <span role="columnheader">
            <span className="sr-only">{t.threats.yours}</span>
          </span>
          <span role="columnheader" className="text-xs font-semibold text-zinc-500">
            {t.threats.itsHit}
          </span>
          <span role="columnheader" className="text-xs font-semibold text-zinc-500">
            {t.threats.yourHit}
          </span>
        </div>
        {result.duels.map((duel, index) => (
          <div key={index} role="row" className="contents">
            <MemberSprite mon={pokemon[index]} />
            <span className="flex flex-col text-xs">
              <span className="text-zinc-700">{hit(duel.theirs)}</span>
              <span className="text-[11px]">
                {duel.ko && (
                  <span className="font-semibold text-red-600 dark:text-red-300">
                    {t.threats.koLong[duel.ko]} ·{" "}
                  </span>
                )}
                <span className="text-zinc-500">
                  {duel.theyMoveFirst ? t.threats.first : t.threats.after}
                </span>
              </span>
            </span>
            <span className="flex flex-col text-xs">
              <span className="text-zinc-700">{hit(duel.yours)}</span>
              {duel.answer && (
                <span className="text-[11px] font-semibold text-green-700 dark:text-green-300">
                  {t.threats.answerLong[duel.answer]}
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Their Trick Room or Tailwind: how much it hurts, who sets it, and your answers. */
function SpeedControlCard({
  report,
  pokemon,
}: {
  report: SpeedControlReport;
  pokemon: ParsedPokemon[];
}) {
  const t = useMessages();
  const text = usePokemonText();
  const total = pokemon.length;
  // One chip per kind of counter, with everyone who has it.
  const kinds = [...new Set(report.counters.map((counter) => counter.kind))];

  function counterTitle(counter: Counter) {
    const via = counter.kind === "choiceScarf" ? text.item(counter.via) : text.move(counter.via);
    return `${text.species(pokemon[counter.index].species)} · ${via}`;
  }

  return (
    <div className={cn(PANEL, "flex flex-col gap-3 p-3")}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-zinc-900">{t.threats.against[report.kind]}</h3>
        <VerdictBadge verdict={report.verdict} />
      </div>
      <p className="text-sm text-zinc-600">
        {t.threats.exposure(
          Math.round(report.exposure.under * total),
          Math.round(report.exposure.normal * total),
          total,
        )}
      </p>
      {report.setters.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-zinc-500">{t.threats.setters}</span>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {report.setters.map((setter) => (
              <span key={setter.species} className="flex items-center gap-1.5">
                <span className="relative h-8 w-8 shrink-0">
                  <PokemonSprite species={setter.species} fill />
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="text-sm text-zinc-800">
                    {speciesLabel(text, setter.species)}
                  </span>
                  <span className="text-[11px] text-zinc-500">
                    {[
                      t.threats.ofTeams(percent(setter.usage)),
                      report.kind === "trickRoom" &&
                        setter.fakeOutBlockedBy &&
                        t.threats.fakeOutFails(
                          setter.fakeOutBlockedBy === "Psychic Terrain"
                            ? t.calc.terrains.Psychic
                            : text.ability(setter.fakeOutBlockedBy),
                        ),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-zinc-500">{t.threats.counters}</span>
        {kinds.length === 0 ? (
          <p className="text-sm font-medium text-red-600 dark:text-red-300">
            {t.threats.noCounters[report.kind]}
          </p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {kinds.map((kind) => (
              <li
                key={kind}
                className="flex h-9 items-center gap-1.5 rounded-full border border-zinc-300 bg-raised py-1 pr-1 pl-3 text-sm text-zinc-800"
              >
                {t.threats.counterKinds[kind]}
                {report.counters
                  .filter((counter) => counter.kind === kind)
                  .map((counter, index) => (
                    <MemberSprite
                      key={index}
                      mon={pokemon[counter.index]}
                      small
                      title={counterTitle(counter)}
                    />
                  ))}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function MemberSprite({
  mon,
  title,
  tone,
  small,
}: {
  mon: ParsedPokemon;
  title?: string;
  /** A red ring (it KOs this one) or green (this one answers it). */
  tone?: "good" | "bad";
  small?: boolean;
}) {
  const text = usePokemonText();
  return (
    <span
      title={title ?? text.species(mon.species)}
      className={cn(
        "relative block shrink-0 overflow-hidden rounded-md bg-zinc-500/10",
        small ? "h-7 w-7" : "h-8 w-8",
        tone === "bad" && "ring-2 ring-red-400 dark:ring-red-500",
        tone === "good" && "ring-2 ring-green-500",
      )}
    >
      <PokemonSprite species={mon.species} item={mon.item} fill />
    </span>
  );
}
