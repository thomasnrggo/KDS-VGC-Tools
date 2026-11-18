"use client";

import { useDeferredValue, useState } from "react";
import { Popover } from "@base-ui/react/popover";
import Link from "next/link";
import { Button, buttonVariants, TextAction } from "../Button";
import { Icon } from "../Icon";
import { ItemIcon } from "../ItemIcon";
import { ArchetypeChip } from "../TeamArchetype";
import { TypeName, WeakSpotRow } from "../TeamCoverage";
import { NoSpriteTitles, PokemonSprite } from "../PokemonSprite";
import { SearchableSelect, type SearchableSelectOption } from "../SearchableSelect";
import { IconName } from "@/enums";
import { useMessages, usePokemonText } from "@/hooks/useLanguage";
import { useCollapsedWatchouts } from "@/hooks/useCollapsedWatchouts";
import { useMeta } from "@/hooks/useMeta";
import { useMetaArchetypes } from "@/hooks/useMetaArchetypes";
import { useMetaSpreads } from "@/hooks/useMetaSpreads";
import {
  DEFAULT_ARCHETYPE_SET,
  archetypeMatchups,
  classificationKey,
  classificationLabel,
  classifyTeam,
  labelForKey,
  primaryOfKey,
} from "@/lib/archetypes";
import { analyzeTeamCoverage } from "@/lib/teamCoverage";
import { speciesLabel } from "@/lib/species/speciesLabel";
import { signedStage } from "@/lib/threats/signedStage";
import { fieldChange } from "@/lib/threats/fieldChange";
import {
  metaTeamMatchups,
  metaThreatSets,
  rankThreats,
  setIssues,
  threatMatchups,
  withSpread,
  type FieldSource,
  matchupLevel,
  teamMatchup,
  type MetaTeamMatchup,
  type Hit,
  type SetIssue,
} from "@/lib/threats";
import {
  setIssueWatchouts,
  carefulWithWatchouts,
  prepKeyThreats,
  threatWatchout,
  prepWatchouts,
  prepWithPinned,
  opponentWatchKey,
  teamKey,
  PREP_SCORE,
  typingWatchouts,
  watchoutGroup,
  weakCoreWatchouts,
  type KoHit,
  type ThreatWatchout,
  type Watchout,
  type WatchoutGroup,
} from "@/lib/teamWatchouts";

type Weather = NonNullable<DamageCalcOptions["weather"]>;
type Terrain = NonNullable<DamageCalcOptions["terrain"]>;
import { cn } from "@/lib/utils";
import type { DamageCalcOptions, ParsedPokemon } from "@/types";

/** A meta team's archetype (its classification primary), as archetypeMatchups names opponents. */
function primaryOfTeam(matchup: MetaTeamMatchup, regulationId?: string): string {
  const theirs = matchup.their.map((mon) => mon.set.pokemon);
  return primaryOfKey(classificationKey(classifyTeam(theirs, DEFAULT_ARCHETYPE_SET, regulationId)));
}

/** Where each group's details live: the team page tab it links to. */
export type WatchoutTab = "threats" | "meta" | "coverage";

const GROUP_TAB: Record<WatchoutGroup, WatchoutTab> = {
  threats: "threats",
  matchups: "meta",
  typing: "coverage",
  sets: "threats",
};

const GROUPS: WatchoutGroup[] = ["threats", "matchups", "typing", "sets"];

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

interface TeamWatchoutsProps {
  pokemon: ParsedPokemon[];
  regulationId: string | undefined;
  /** The Threats tab's preview: its calcs feed the threat and set lines. */
  showThreats: boolean;
  /** The archetype preview: the Meta matchups calcs and real results feed the matchup lines. */
  showMeta: boolean;
  /** Opens a tab with the details. */
  onOpenTab: (tab: WatchoutTab) => void;
  /**
   * Adds a line to the team's own notes, as HTML — only on a team that still
   * has notes from before (the free-text notes are gone); without it, no
   * "+ Add to notes".
   */
  onAddToNotes?: (html: string) => void;
  /** Meta Pokémon added by hand to "Be careful with" (Team.watchPokemon). */
  pinned: string[];
  onPinnedChange: (species: string[]) => void;
  /** Common meta teams added by hand to "Prep for" (Team.watchTeams, teamKey). */
  pinnedTeams: string[];
  onPinnedTeamsChange: (keys: string[]) => void;
  /** Adds a meta team to the Matchup Planner's opponents, to prep against it. */
  onPrepTeam: (name: string, pokemon: ParsedPokemon[]) => void;
  /** Your Matchup Planner opponents (this regulation's) — teams to prep for can be added from them too. */
  opponents: { id: string; label: string; pokemon: ParsedPokemon[] }[];
  /** An opponent in the Matchup Planner with the same six Pokémon (any sets), if there's one. */
  findOpponent: (pokemon: ParsedPokemon[]) => { label: string } | undefined;
}

/**
 * The Strategy tab's "Auto-detected" watch-outs (src/lib/teamWatchouts.ts):
 * the threats, matchups, typing and set problems worth knowing, worked out
 * live from the other tabs' data — so it's never stale — each linking to
 * where it comes from.
 */
export function TeamWatchouts({
  pokemon: current,
  regulationId,
  showThreats,
  showMeta,
  onOpenTab,
  onAddToNotes,
  pinned,
  onPinnedChange,
  pinnedTeams,
  onPinnedTeamsChange,
  onPrepTeam,
  opponents,
  findOpponent,
}: TeamWatchoutsProps) {
  // The calcs take ~100ms: redone at low priority while the team is edited.
  const pokemon = useDeferredValue(current);
  const t = useMessages();
  const w = t.watchouts;
  const text = usePokemonText();
  // Pokémon added by hand get their card whatever the preview flags say.
  const needsCalcs = showThreats || showMeta || pinned.length > 0 || pinnedTeams.length > 0;
  const { meta, isLoading } = useMeta(needsCalcs ? regulationId : undefined);
  const { spreads, isLoading: spreadsLoading } = useMetaSpreads(
    needsCalcs ? regulationId : undefined,
  );
  const { data: archetypes } = useMetaArchetypes(regulationId, showMeta);

  const { collapsed, toggleCollapsed: toggleGroup } = useCollapsedWatchouts();

  if (pokemon.length === 0) return null;
  const loading = needsCalcs && ((isLoading && !meta) || spreadsLoading);

  const set = DEFAULT_ARCHETYPE_SET;
  const watchouts: Watchout[] = [];
  // The common teams the calcs scored — what a team to prep for is added from.
  let scoredTeams: MetaTeamMatchup[] = [];
  const recentPokemon = meta ? (meta.official.recent?.pokemon ?? meta.official.pokemon) : [];
  if (needsCalcs && meta && !loading) {
    const team = pokemon.map((mon) => withSpread(mon).pokemon);
    if (showThreats || pinned.length > 0) {
      const ranked = rankThreats(
        threatMatchups(team, metaThreatSets(recentPokemon, { spreads })),
        "normal",
      );
      const careful = carefulWithWatchouts(ranked, pinned);
      // Without the Threats preview, only the ones added by hand.
      watchouts.push(
        ...(showThreats
          ? careful
          : careful.filter((watchout) => watchout.kind === "threat" && watchout.pinned)),
      );
    }
    if (showMeta || pinnedTeams.length > 0) {
      const source = meta.official.recent ?? meta.official;
      const combos = source.combos ?? meta.official.combos;
      const metaPokemon = meta.official.recent?.pokemon ?? meta.official.pokemon;
      const key = classificationKey(classifyTeam(pokemon, set, regulationId));
      const report = archetypes ? archetypeMatchups(archetypes, key) : null;
      const scored = combos ? metaTeamMatchups(team, combos, metaPokemon, spreads) : null;
      scoredTeams = scored?.teams ?? [];
      const primaryOf = (matchup: MetaTeamMatchup) => primaryOfTeam(matchup, regulationId);
      // The archetypes to prep for, each with a specific common team of it —
      // the teams added by hand first. Without the preview, only those.
      const picked = showMeta ? prepWatchouts(scoredTeams, primaryOf, report?.hard) : [];
      // A team added by hand: a common meta team (teamKey), or one of your
      // opponents (opponentWatchKey) — calced with its own sets.
      const resolve = (key: string) => {
        const opponent = opponents.find((entry) => opponentWatchKey(entry.id) === key);
        if (opponent) {
          const matchup = teamMatchup(team, opponent.pokemon);
          return matchup ? { matchup, label: opponent.label } : undefined;
        }
        const matchup = scoredTeams.find((entry) => teamKey(entry.combo.species) === key);
        return matchup ? { matchup } : undefined;
      };
      watchouts.push(...prepWithPinned(picked, pinnedTeams, resolve, primaryOf));
      if (scored && showMeta) watchouts.push(...weakCoreWatchouts(scored.cores));
    }
  }
  watchouts.push(...typingWatchouts(analyzeTeamCoverage(pokemon)));
  if (showThreats) watchouts.push(...setIssueWatchouts(setIssues(pokemon)));

  // "Mega Swampert", as the metagame pages name it.
  const archetypeName = (id: string) => labelForKey(id, set, t.teamArchetype.balance);
  const nameOf = (species: string) => speciesLabel(text, species);
  const yours = (index: number) => nameOf(pokemon[index].species);
  const list = (names: string[]) => names.join(", ");
  const typeName = (type: string) => text.type(type);

  function issueText(issue: SetIssue): string {
    switch (issue.kind) {
      case "terrainNeverSet":
        return t.threats.issue.terrainNeverSet(
          yours(issue.index),
          issue.via === pokemon[issue.index].item ? text.item(issue.via) : text.ability(issue.via),
          t.calc.terrains[issue.terrain],
          issue.clashes && t.calc.terrains[issue.clashes],
        );
      case "weatherNeverSet":
        return t.threats.issue.weatherNeverSet(
          yours(issue.index),
          text.ability(issue.via),
          t.calc.weathers[issue.weather],
        );
      case "choiceProtect":
        return t.threats.issue.choiceProtect(
          yours(issue.index),
          text.item(issue.via),
          text.move(issue.move),
        );
      case "vestStatus":
        return t.threats.issue.vestStatus(yours(issue.index), text.move(issue.move));
    }
  }

  /** Who answers a threat: "nothing answers it", "only Floette answers it", "Raichu, Floette answer it" — "Sneasler (after Swords Dance)" for one that sets up first. */
  function answerSummary(watchout: ThreatWatchout): string {
    const answerer = (index: number) => {
      const setup = watchout.result.duels[index]?.setup;
      return setup ? w.withSetup(yours(index), text.move(setup.setup)) : yours(index);
    };
    if (watchout.answeredBy.length === 0) return w.unanswered;
    if (watchout.answeredBy.length === 1) return w.onlyAnswer(answerer(watchout.answeredBy[0]));
    return w.answeredByMany(list(watchout.answeredBy.map(answerer)));
  }

  /** "Sun, Grassy Terrain": the field a threat's calcs ran in, or null. */
  function fieldText(watchout: ThreatWatchout): string | null {
    // Credited to whoever sets it: "your Grassy Terrain (Rillaboom)", "its Sun".
    const credit = (label: string, by: FieldSource | undefined) =>
      !by || by.from === "own"
        ? w.itsField(label)
        : by.from === "yours"
          ? w.yourField(label, nameOf(by.by))
          : w.partnerField(label, nameOf(by.by));
    const parts = [
      watchout.weather && credit(t.calc.weathers[watchout.weather as Weather], watchout.weatherBy),
      watchout.terrain &&
        credit(w.terrain(t.calc.terrains[watchout.terrain as Terrain]), watchout.terrainBy),
    ].filter(Boolean);
    return parts.length ? parts.join(", ") : null;
  }

  /** What a threat KOs: "OHKOs Rillaboom · may OHKO Raichu, Sneasler", else its 2HKOs; null when neither. */
  function koSummary(watchout: ThreatWatchout): string | null {
    const parts = [
      watchout.ohkos.length > 0 && w.ohkos(list(watchout.ohkos.map((hit) => yours(hit.index)))),
      watchout.rollOhkos.length > 0 &&
        w.mayOhko(list(watchout.rollOhkos.map((hit) => yours(hit.index)))),
      watchout.ohkos.length + watchout.rollOhkos.length === 0 &&
        watchout.twoHkos.length > 0 &&
        w.twoHkos(list(watchout.twoHkos.map(yours))),
    ].filter(Boolean);
    return parts.length ? parts.join(" · ") : null;
  }

  /** Why an archetype's worth prepping for: the calcs, real games, or both. */
  function prepReasons(watchout: Extract<Watchout, { kind: "prepFor" }>): string[] {
    const reasons: string[] = [];
    // One added by hand says what the calcs say, whatever it is.
    if (watchout.matchup && (watchout.pinned || watchout.matchup.score <= PREP_SCORE)) {
      reasons.push(w.prepCalc(t.metaMatchups.level[matchupLevel(watchout.matchup.score)]));
    }
    if (watchout.real) {
      reasons.push(w.prepReal(`${Math.round(watchout.real.winRate * 100)}%`, watchout.real.games));
    }
    return reasons;
  }

  /** The line as text — added to notes as is (a threat's is shown short, with a details card). */
  function lineText(watchout: Watchout): string {
    switch (watchout.kind) {
      case "threat": {
        const name = nameOf(watchout.species);
        const detail = (hit: KoHit) =>
          w.hitDetail(
            yours(hit.index),
            text.move(hit.move),
            Math.round(hit.minPercent),
            Math.round(hit.maxPercent),
          );
        const parts = [
          watchout.ohkos.length > 0 && w.ohkos(list(watchout.ohkos.map(detail))),
          watchout.rollOhkos.length > 0 && w.mayOhko(list(watchout.rollOhkos.map(detail))),
          watchout.twoHkos.length > 0 && w.twoHkos(list(watchout.twoHkos.map(yours))),
          answerSummary(watchout),
          // The field that shaped the numbers: its own, else your team's.
          fieldText(watchout) && w.inField(fieldText(watchout)!),
        ].filter(Boolean);
        return `${name}: ${parts.join(" · ")}`;
      }
      case "prepFor":
        return w.prepLine(
          archetypeName(watchout.archetype),
          prepReasons(watchout).join("; "),
          watchout.matchup
            ? list(watchout.matchup.their.map((mon) => nameOf(mon.set.species)))
            : null,
        );
      case "weakCore":
        return w.weakCore(watchout.matchup.their.map((mon) => nameOf(mon.set.species)).join(" + "));
      case "weakTeam": {
        const theirs = watchout.matchup.their.map((mon) => mon.set.pokemon);
        const label = classificationLabel(
          classifyTeam(theirs, set, regulationId),
          set,
          t.teamArchetype.balance,
        );
        return w.weakTeam(label, list(theirs.slice(0, 3).map((mon) => nameOf(mon.species))));
      }
      case "archetype":
        return w.archetype(
          labelForKey(watchout.versus.opponent, set, t.teamArchetype.balance),
          `${Math.round(watchout.versus.winRate * 100)}%`,
          watchout.versus.games,
        );
      case "weakType":
        return w.weakType(typeName(watchout.type), watchout.weak, watchout.resist);
      case "coverageGap":
        return w.coverageGap(list(watchout.types.map(typeName)));
      case "setIssue":
        return issueText(watchout.issue);
    }
  }

  /** Sprites beside a line about specific Pokémon. */
  function sprites(watchout: Watchout): { species: string; item?: string }[] {
    switch (watchout.kind) {
      case "threat":
        return [{ species: watchout.species, item: watchout.item }];
      case "weakTeam":
      case "weakCore":
        return watchout.matchup.their.map((mon) => ({
          species: mon.set.pokemon.species,
          item: mon.set.pokemon.item,
        }));
      default:
        return [];
    }
  }

  // "Be careful with" stays, even empty, once there's a metagame to add from.
  const canPin = !!meta && !loading && recentPokemon.length > 0;
  const byGroup = GROUPS.map((group) => ({
    group,
    items: watchouts.filter((watchout) => watchoutGroup(watchout) === group),
  })).filter(
    (entry) =>
      entry.items.length > 0 ||
      (entry.group === "threats" && canPin) ||
      (entry.group === "matchups" && (scoredTeams.length > 0 || opponents.length > 0)),
  );

  return (
    <section
      aria-label={w.title}
      className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-raised p-3"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-sm font-semibold text-zinc-900">{w.title}</h3>
        <p className="text-xs text-zinc-500">{w.hint}</p>
      </div>
      {loading && <p className="text-xs text-zinc-500">{w.loading}</p>}
      {!loading && byGroup.length === 0 && <p className="text-sm text-zinc-600">{w.none}</p>}
      {byGroup.map(({ group, items }) => {
        const isCollapsed = collapsed.includes(group);
        // Tiles and lines: the count a collapsed group shows.
        const count = items.length;
        return (
          <div key={group} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2">
              <h4>
                <button
                  type="button"
                  onClick={() => toggleGroup(group)}
                  aria-expanded={!isCollapsed}
                  className="flex items-center gap-1 text-xs font-semibold tracking-wide text-zinc-500 uppercase hover:text-zinc-700"
                >
                  <Icon
                    name={IconName.ExpandMore}
                    size={16}
                    className={cn("transition-transform", isCollapsed && "-rotate-90")}
                  />
                  {w.groups[group]}
                  {isCollapsed && count > 0 && (
                    <span className="font-normal tracking-normal text-zinc-400 normal-case">
                      ({count})
                    </span>
                  )}
                </button>
              </h4>
              <TextAction className="text-xs" onClick={() => onOpenTab(GROUP_TAB[group])}>
                {w.details[group]}
              </TextAction>
            </div>
            {!isCollapsed && (
              <>
                {/* Threats as Pokémon tiles: hover (or tap) one for why it's a threat. */}
                {group === "threats" && (
                  <div className="flex flex-wrap gap-2 py-1">
                    {items.map((watchout, index) =>
                      watchout.kind === "threat" ? (
                        <ThreatDetails
                          key={index}
                          watchout={watchout}
                          pokemon={pokemon}
                          koText={koSummary(watchout)}
                          summary={answerSummary(watchout)}
                          onRemove={
                            watchout.pinned
                              ? () =>
                                  onPinnedChange(
                                    pinned.filter((species) => species !== watchout.species),
                                  )
                              : undefined
                          }
                          onAddToNotes={
                            onAddToNotes
                              ? () => onAddToNotes(`<p>${escapeHtml(lineText(watchout))}</p>`)
                              : undefined
                          }
                        />
                      ) : null,
                    )}
                    {canPin && (
                      <AddCarefulWith
                        options={recentPokemon
                          .filter((entry) => !pinned.includes(entry.species))
                          .map((entry) => ({
                            id: entry.species,
                            label: nameOf(entry.species),
                            searchText: entry.species,
                            sprite: entry.species,
                          }))}
                        onAdd={(species) => onPinnedChange([...pinned, species])}
                      />
                    )}
                  </div>
                )}
                <ul className="flex flex-col divide-y divide-zinc-100">
                  {items.map((watchout, index) => {
                    const line = lineText(watchout);
                    const shown = sprites(watchout);
                    if (watchout.kind === "threat") return null;
                    // A type it's weak to: who's weak, who resists — the Coverage tab's row.
                    if (watchout.kind === "weakType") {
                      return (
                        <li key={index} className="py-2">
                          <WeakSpotRow row={watchout.row} pokemon={pokemon} />
                        </li>
                      );
                    }
                    // Types nothing hits super effectively, as type chips.
                    if (watchout.kind === "coverageGap") {
                      return (
                        <li
                          key={index}
                          className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2"
                        >
                          <span className="text-xs font-semibold text-zinc-500">
                            {w.coverageGapLabel}
                          </span>
                          {watchout.types.map((type) => (
                            <TypeName key={type} type={type} small />
                          ))}
                        </li>
                      );
                    }
                    if (watchout.kind === "prepFor") {
                      const matchup = watchout.matchup;
                      const keys = matchup ? prepKeyThreats(matchup) : [];
                      return (
                        <li
                          key={index}
                          className="flex flex-col gap-2 py-2.5 text-sm text-zinc-800"
                        >
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            {/* No common team of it to show: the archetype itself, as a chip — why, on hover. */}
                            {matchup ? (
                              <>
                                <span className="flex items-center gap-1 font-semibold text-zinc-900">
                                  {watchout.pinned && (
                                    <Icon
                                      name={IconName.StarFilled}
                                      size={12}
                                      className="text-zinc-500"
                                    />
                                  )}
                                  {watchout.label ?? archetypeName(watchout.archetype)}
                                </span>
                                {/* An opponent: its archetype beside its name. */}
                                {watchout.label && (
                                  <span className="text-xs text-zinc-500">
                                    {archetypeName(watchout.archetype)}
                                  </span>
                                )}
                                <span className="min-w-0 flex-1 text-xs text-zinc-500">
                                  {prepReasons(watchout).join(" · ")}
                                </span>
                              </>
                            ) : (
                              <span className="min-w-0 flex-1">
                                <ArchetypeChip
                                  id={watchout.archetype}
                                  label={archetypeName(watchout.archetype)}
                                  detail={prepReasons(watchout).join(" · ")}
                                />
                              </span>
                            )}
                            {watchout.pinnedKey && (
                              <TextAction
                                className="shrink-0 text-xs"
                                onClick={() =>
                                  onPinnedTeamsChange(
                                    pinnedTeams.filter((key) => key !== watchout.pinnedKey),
                                  )
                                }
                                title={w.addedByYou}
                              >
                                {w.remove}
                              </TextAction>
                            )}
                            {onAddToNotes && (
                              <TextAction
                                className="shrink-0 text-xs"
                                onClick={() => onAddToNotes(`<p>${escapeHtml(line)}</p>`)}
                                aria-label={w.addToNotesLabel(line)}
                              >
                                {w.addToNotes}
                              </TextAction>
                            )}
                            {matchup && (
                              <PrepButton
                                inPlanner={findOpponent(
                                  matchup.their.map((mon) => mon.set.pokemon),
                                )}
                                onPrep={() =>
                                  onPrepTeam(
                                    w.prepName(archetypeName(watchout.archetype)),
                                    matchup.their.map((mon) => mon.set.pokemon),
                                  )
                                }
                              />
                            )}
                          </div>
                          {matchup ? (
                            <>
                              {/* The team as tiles, like a roster: the members that make it a
                          challenge stand out; hover (tap) any for its card, calced in the
                          field it fights in beside its partners. */}
                              <div className="flex flex-wrap gap-2">
                                {matchup.their.map((mon) => {
                                  const member =
                                    keys.find((key) => key.result.set.id === mon.set.id) ??
                                    threatWatchout(mon.result);
                                  return (
                                    <ThreatDetails
                                      key={mon.set.id}
                                      watchout={member}
                                      pokemon={pokemon}
                                      koText={koSummary(member)}
                                      summary={answerSummary(member)}
                                      isKey={keys.includes(member)}
                                    />
                                  );
                                })}
                              </div>
                            </>
                          ) : null}
                        </li>
                      );
                    }
                    return (
                      <li
                        key={index}
                        className="flex items-center gap-2 py-1.5 text-sm text-zinc-800"
                      >
                        {shown.length > 0 && (
                          <span className="flex shrink-0">
                            {shown.slice(0, 6).map((mon, at) => (
                              <PokemonSprite
                                key={at}
                                species={mon.species}
                                item={mon.item}
                                size={28}
                              />
                            ))}
                          </span>
                        )}
                        <span className="min-w-0 flex-1">{line}</span>
                        {onAddToNotes && (
                          <TextAction
                            className="shrink-0 text-xs"
                            onClick={() => onAddToNotes(`<p>${escapeHtml(line)}</p>`)}
                            aria-label={w.addToNotesLabel(line)}
                          >
                            {w.addToNotes}
                          </TextAction>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {group === "matchups" && (scoredTeams.length > 0 || opponents.length > 0) && (
                  <AddPrepTeam
                    options={[
                      // Your opponents first: the teams you actually expect to face, with their sets.
                      ...opponents
                        .filter((opponent) => !pinnedTeams.includes(opponentWatchKey(opponent.id)))
                        .map((opponent): PrepTeamOption => ({
                          id: opponentWatchKey(opponent.id),
                          section: "opponents",
                          title: opponent.label,
                          subtitle: archetypeName(
                            primaryOfKey(
                              classificationKey(classifyTeam(opponent.pokemon, set, regulationId)),
                            ),
                          ),
                          pokemon: opponent.pokemon,
                        })),
                      ...scoredTeams
                        .filter((matchup) => !pinnedTeams.includes(teamKey(matchup.combo.species)))
                        .map((matchup): PrepTeamOption => ({
                          id: teamKey(matchup.combo.species),
                          section: "meta",
                          title: archetypeName(primaryOfTeam(matchup, regulationId)),
                          subtitle: w.prepTeamPlayers(matchup.combo.teams),
                          pokemon: matchup.their.map((mon) => mon.set.pokemon),
                        })),
                    ]}
                    onAdd={(key) => onPinnedTeamsChange([...pinnedTeams, key])}
                  />
                )}
              </>
            )}
          </div>
        );
      })}
    </section>
  );
}

/**
 * Why a meta Pokémon is a threat to the team — its card, opened by hovering
 * its name (or tapping it on a phone): its set, the field the calcs ran in,
 * and each of your Pokémon: its best hit on it (and whether that KOs), who
 * moves first, and your best hit back (and whether that answers it).
 */
function ThreatDetails({
  watchout,
  pokemon,
  koText,
  summary,
  onAddToNotes,
  onRemove,
  isKey = true,
}: {
  watchout: ThreatWatchout;
  pokemon: ParsedPokemon[];
  /** "OHKOs Rillaboom · may OHKO Raichu, Sneasler". */
  koText: string | null;
  /** "only Volcarona answers it" / "nothing answers it". */
  summary: string;
  onAddToNotes?: () => void;
  /** Added by hand: takes it off "Be careful with". */
  onRemove?: () => void;
  /** On a prep team: false fades a member that isn't what makes the team a challenge. */
  isKey?: boolean;
}) {
  const t = useMessages();
  const w = t.watchouts;
  const text = usePokemonText();
  const set = watchout.result.set.pokemon;
  const percent = (hit: { minPercent: number; maxPercent: number }) =>
    `${Math.round(hit.minPercent)}–${Math.round(hit.maxPercent)}%`;
  // "*" on a hit the shown weather or terrain changed — the note says which field.
  const fieldMark = (hit: Hit) =>
    (hit.weatherApplied && watchout.weather) || (hit.terrainApplied && watchout.terrain) ? (
      <span className="text-zinc-400" title={w.fieldChangedHit}>
        *
      </span>
    ) : null;
  // The field in words, per weather and terrain: who sets it and what it does
  // to the hits ("Charizard's Sun powers up its Flare Blitz and weakens your
  // Wave Crash."), or that it only changes who moves first.
  const fieldLines = (
    [
      watchout.weather && {
        field: { weather: watchout.weather as Weather },
        label: t.calc.weathers[watchout.weather as Weather],
        by: watchout.weatherBy,
      },
      watchout.terrain && {
        field: { terrain: watchout.terrain as Terrain },
        label: w.terrain(t.calc.terrains[watchout.terrain as Terrain]),
        by: watchout.terrainBy,
      },
    ].filter(Boolean) as {
      field: { weather: Weather } | { terrain: Terrain };
      label: string;
      by?: FieldSource;
    }[]
  ).map(({ field, label, by }) => {
    const source =
      !by || by.from === "own" ? w.fieldOwn(label) : w.fieldBy(label, speciesLabel(text, by.by));
    const change = fieldChange(watchout.result.duels, field);
    if (!change) return w.fieldSpeedOnly(source);
    const moves = (names: string[]) => names.map(text.move).join(", ");
    const effects = (["its", "yours"] as const).flatMap((side) =>
      (["up", "down", "changed"] as const).flatMap((direction) =>
        change[side][direction].length
          ? [w.fieldEffect[side][direction](moves(change[side][direction]))]
          : [],
      ),
    );
    return w.fieldSentence(source, effects);
  });
  // Yours it moves before.
  const outspeeds = watchout.result.duels.flatMap((duel, index) =>
    duel.theyMoveFirst ? [speciesLabel(text, pokemon[index].species)] : [],
  );
  // Who covers a setup answer's turn (Fake Out, Follow Me, Rage Powder).
  const setupDuel = watchout.result.duels.find((duel) => duel.setup);
  const setupCover =
    setupDuel?.setup &&
    t.threats.setupCover(
      setupDuel.setup.support.map((species) => speciesLabel(text, species)).join(", "),
    );
  const setLine = [
    set.item && text.item(set.item),
    set.ability && text.ability(set.ability),
    set.nature && text.nature(set.nature),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Popover.Root>
      <Popover.Trigger
        openOnHover
        delay={120}
        closeDelay={120}
        className={cn(
          "relative flex size-16 shrink-0 items-center justify-center rounded-lg bg-zinc-100 hover:bg-zinc-200 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-none data-[popup-open]:bg-zinc-200 data-[popup-open]:opacity-100",
          !isKey && "opacity-60",
        )}
        aria-label={`${w.whyLabel(speciesLabel(text, watchout.species))}: ${summary}`}
      >
        {/* Its card names it: no browser name tooltip on top of it. */}
        <NoSpriteTitles>
          <PokemonSprite species={watchout.species} item={watchout.item} size={56} />
        </NoSpriteTitles>
        {/* Its item, as on a team's roster (TeamRoster). */}
        {watchout.item && (
          <span className="absolute -right-1 -bottom-1">
            <ItemIcon item={watchout.item} size={22} />
          </span>
        )}
        {/* Added by hand. */}
        {watchout.pinned && (
          <Icon
            name={IconName.StarFilled}
            size={12}
            className="absolute bottom-1 left-1 text-zinc-500"
          />
        )}
        {/* Nothing answers it: the ones to look at first. */}
        {watchout.answeredBy.length === 0 && (
          <span
            aria-hidden="true"
            className="absolute top-1 right-1 size-2.5 rounded-full bg-red-500 ring-2 ring-zinc-100"
          />
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={6} className="z-50">
          <Popover.Popup className="flex w-[min(28rem,calc(100vw-2rem))] flex-col gap-2.5 rounded-lg border border-zinc-200 bg-raised p-3 text-xs text-zinc-700 shadow-lg outline-none">
            {/* Who it is: the set, its moves small. */}
            <div className="flex items-start gap-2">
              <PokemonSprite species={watchout.species} item={set.item} size={40} />
              <div className="flex min-w-0 flex-col">
                <span className="text-sm font-semibold text-zinc-900">
                  {speciesLabel(text, watchout.species)}
                </span>
                {setLine && <span className="text-zinc-500">{setLine}</span>}
                {set.moves && set.moves.length > 0 && (
                  <span className="text-zinc-400">{set.moves.map(text.move).join(" · ")}</span>
                )}
              </div>
            </div>

            {/* Why it's a threat, most important first: what it KOs, who answers it, the field, Speed. */}
            <ul className="flex flex-col gap-1 rounded-md bg-zinc-50 p-2 text-[13px] leading-snug dark:bg-zinc-100">
              {koText && <li className="font-medium text-red-700 dark:text-red-400">{koText}</li>}
              <li
                className={cn(
                  "font-medium",
                  watchout.answeredBy.length === 0
                    ? "text-red-700 dark:text-red-400"
                    : "text-green-700 dark:text-green-400",
                )}
              >
                {capitalize(summary)}
                {setupCover && <span className="font-normal text-zinc-500"> · {setupCover}</span>}
              </li>
              {fieldLines.map((line) => (
                <li key={line} className="text-zinc-600">
                  {line}
                </li>
              ))}
              <li className="text-zinc-600">
                {outspeeds.length === 0
                  ? w.cardAllFaster
                  : outspeeds.length === pokemon.length
                    ? w.cardOutspeedsAll
                    : w.cardOutspeeds(outspeeds.join(", "))}
              </li>
            </ul>

            {/* Each of yours, one line: its hit on it, your hit back. */}
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-left text-[11px] text-zinc-500">
                  <th className="pb-1 font-normal">{w.cardYours}</th>
                  <th className="pb-1 font-normal">{w.cardItsHit}</th>
                  <th className="pb-1 font-normal">{w.cardYourHit}</th>
                </tr>
              </thead>
              <tbody>
                {watchout.result.duels.map((duel, index) => (
                  <tr key={index} className="border-t border-zinc-100 align-top">
                    <td className="py-1 pr-2">
                      <span className="flex items-center gap-1 whitespace-nowrap text-zinc-900">
                        <PokemonSprite
                          species={pokemon[index].species}
                          item={pokemon[index].item}
                          size={22}
                        />
                        {speciesLabel(text, pokemon[index].species)}
                      </span>
                    </td>
                    <td className="py-1 pr-2">
                      {duel.theirs ? (
                        <>
                          <span className="block">
                            {text.move(duel.theirs.move)} {percent(duel.theirs)}
                            {fieldMark(duel.theirs)}
                          </span>
                          {duel.ko && (
                            <span
                              className={cn(
                                "block text-[11px] font-semibold",
                                duel.ko === "twoHko"
                                  ? "text-amber-700 dark:text-amber-400"
                                  : "text-red-700 dark:text-red-400",
                              )}
                            >
                              {t.threats.koLong[duel.ko]}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="py-1">
                      {/* Answers only after setting up: show the boosted hit — that's the one that counts. */}
                      {duel.setup ? (
                        <>
                          <span className="block">
                            {signedStage(duel.setup.stage)} {text.move(duel.setup.move)}{" "}
                            {percent(duel.setup)}
                            {fieldMark(duel.setup)}
                          </span>
                          <span className="block text-[11px] font-semibold text-green-700 dark:text-green-400">
                            {w.cardAfterSetup(text.move(duel.setup.setup))}
                          </span>
                        </>
                      ) : duel.yours ? (
                        <>
                          <span className="block">
                            {text.move(duel.yours.move)} {percent(duel.yours)}
                            {fieldMark(duel.yours)}
                          </span>
                          {duel.answer && (
                            <span className="block text-[11px] font-semibold text-green-700 dark:text-green-400">
                              {t.threats.answerLong[duel.answer]}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex items-center justify-end gap-4">
              {onRemove && (
                <>
                  <span className="mr-auto text-zinc-500">{w.addedByYou}</span>
                  <TextAction className="text-xs" onClick={onRemove}>
                    {w.remove}
                  </TextAction>
                </>
              )}
              {onAddToNotes && (
                <TextAction className="text-xs" onClick={onAddToNotes}>
                  {w.addToNotes}
                </TextAction>
              )}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

/**
 * The "+" tile ending "Be careful with": opens a search of the metagame's
 * Pokémon right below the tiles (inline — the search's own dropdown can't
 * sit inside a popover) to add one.
 */
function AddCarefulWith({
  options,
  onAdd,
}: {
  options: SearchableSelectOption[];
  onAdd: (species: string) => void;
}) {
  const w = useMessages().watchouts;
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className={cn(
          "flex size-16 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-none",
          isOpen && "border-zinc-500 text-zinc-700",
        )}
        aria-label={w.addCareful}
        title={w.addCareful}
      >
        <Icon name={IconName.Add} size={24} />
      </button>
      {isOpen && (
        <div className="flex basis-full flex-col gap-1.5 text-xs text-zinc-600">
          <p>{w.addCarefulHint}</p>
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <SearchableSelect
                options={options}
                placeholder={w.addCarefulPlaceholder}
                ariaLabel={w.addCareful}
                autoFocus
                onSelect={(option) => {
                  onAdd(option.id);
                  setIsOpen(false);
                }}
              />
            </div>
            <TextAction className="text-xs" onClick={() => setIsOpen(false)}>
              {w.cancel}
            </TextAction>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * A prep team's button: adds it to the Matchup Planner's opponents — or, when
 * an opponent there already has the same six Pokémon (any sets), says so and
 * links to the planner instead of adding a near copy.
 */
function PrepButton({
  inPlanner,
  onPrep,
}: {
  inPlanner: { label: string } | undefined;
  onPrep: () => void;
}) {
  const w = useMessages().watchouts;
  if (inPlanner) {
    return (
      <Link
        href="/matchup-planner"
        className={cn(
          buttonVariants({ variant: "outline" }),
          "flex shrink-0 items-center gap-1 px-3 py-1 text-xs",
        )}
        title={w.inPlannerAs(inPlanner.label)}
      >
        <Icon name={IconName.Check} size={14} className="text-green-700 dark:text-green-400" />
        {w.inPlanner}
      </Link>
    );
  }
  return (
    <Button variant="outline" className="shrink-0 px-3 py-1 text-xs" onClick={onPrep}>
      {w.prep}
    </Button>
  );
}

/** A team "+ Add a team" offers: one of your opponents, or a common meta team. */
interface PrepTeamOption {
  /** Its key in Team.watchTeams (opponentWatchKey, teamKey). */
  id: string;
  section: "opponents" | "meta";
  /** The opponent's name, or the meta team's archetype. */
  title: string;
  /** The opponent's archetype, or how many players brought the meta team. */
  subtitle?: string;
  pokemon: ParsedPokemon[];
}

/**
 * "+ Add a team" ending "Prep for": your opponents and the common meta teams,
 * each as its six sprites with items — searchable by name, archetype or
 * Pokémon — inline below the list, to prep for one whatever the calcs say.
 */
function AddPrepTeam({
  options,
  onAdd,
}: {
  options: PrepTeamOption[];
  onAdd: (key: string) => void;
}) {
  const w = useMessages().watchouts;
  const text = usePokemonText();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  if (!isOpen) {
    return (
      <TextAction
        className="flex w-fit items-center gap-1 py-1 text-xs"
        onClick={() => setIsOpen(true)}
      >
        <Icon name={IconName.Add} size={14} />
        {w.addPrepTeam}
      </TextAction>
    );
  }
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (option: PrepTeamOption) => {
    const haystack = [
      option.title,
      option.subtitle ?? "",
      ...option.pokemon.flatMap((mon) => [mon.species, speciesLabel(text, mon.species)]),
    ]
      .join(" ")
      .toLowerCase();
    return terms.every((term) => haystack.includes(term));
  };
  const sections = (["opponents", "meta"] as const)
    .map((section) => ({
      section,
      list: options.filter((option) => option.section === section && matches(option)),
    }))
    .filter((entry) => entry.list.length > 0);
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-2 text-xs text-zinc-600">
      <div className="flex items-center gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={w.addPrepTeamPlaceholder}
          aria-label={w.addPrepTeam}
          autoFocus
          className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-field px-3 py-1.5 text-sm text-zinc-900 focus:ring-2 focus:ring-zinc-400 focus:outline-none"
        />
        <TextAction
          className="text-xs"
          onClick={() => {
            setIsOpen(false);
            setQuery("");
          }}
        >
          {w.cancel}
        </TextAction>
      </div>
      <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
        {sections.length === 0 && <p className="px-1 py-2 text-zinc-500">{w.addPrepTeamNone}</p>}
        {sections.map(({ section, list }) => (
          <div key={section} className="flex flex-col">
            <p className="px-1 pb-1 text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">
              {w.addPrepTeamSection[section]}
            </p>
            <ul className="flex flex-col">
              {list.map((option) => (
                <li key={option.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onAdd(option.id);
                      setIsOpen(false);
                      setQuery("");
                    }}
                    className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-1 py-1.5 text-left hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-none"
                  >
                    <span className="flex shrink-0">
                      {option.pokemon.map((mon, index) => (
                        <span key={index} className="relative">
                          <PokemonSprite species={mon.species} item={mon.item} size={36} />
                          {mon.item && (
                            <span className="absolute -right-0.5 -bottom-0.5">
                              <ItemIcon item={mon.item} size={14} />
                            </span>
                          )}
                        </span>
                      ))}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="text-sm font-medium text-zinc-900">{option.title}</span>
                      {option.subtitle && (
                        <span className="text-[11px] text-zinc-500">{option.subtitle}</span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

/** "only Sneasler answers it" → "Only Sneasler answers it". */
function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
