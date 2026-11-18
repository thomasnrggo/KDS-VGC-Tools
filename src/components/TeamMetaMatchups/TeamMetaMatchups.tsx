"use client";

import { useDeferredValue, useState } from "react";
import { TextAction, TogglePill } from "../Button";
import { LoadingState } from "../LoadingState";
import { PokemonSprite } from "../PokemonSprite";
import { useMessages, usePokemonText } from "@/hooks/useLanguage";
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
import {
  matchupLevel,
  metaTeamMatchups,
  withSpread,
  type MatchupLevel,
  type MetaTeamMatchup,
} from "@/lib/threats";
import { cn } from "@/lib/utils";
import type { ParsedPokemon } from "@/types";

/** A score this far from 0 lists a team as strong or weak. */
const LISTED_FROM = 0.25;
const SHOWN = 5;

type Level = MatchupLevel;

const LEVEL_CLASS: Record<Level, string> = {
  strong: "bg-green-500/20 text-green-800 dark:text-green-200",
  favored: "bg-green-500/10 text-green-700 dark:text-green-300",
  even: "bg-zinc-500/15 text-zinc-600",
  unfavored: "bg-red-500/10 text-red-700 dark:text-red-300",
  weak: "bg-red-500/20 text-red-700 dark:text-red-300",
};

const percent = (value: number) => `${Math.round(value * 100)}%`;

interface TeamMetaMatchupsProps {
  pokemon: ParsedPokemon[];
  regulationId: string | undefined;
}

/**
 * The team page's Meta matchups tab (docs/archetypes.md — "Meta matchups"):
 * the metagame's most common full teams and Pokémon combinations your team is
 * strong or weak against, from the calcs (src/lib/threats/metaTeamMatchups.ts),
 * each with why — their Pokémon that knock out yours and whether you answer
 * them, yours that knock out theirs — and how teams like yours did against
 * that archetype in real games. A preview behind the `teamArchetype` flag.
 */
export function TeamMetaMatchups({ pokemon: current, regulationId }: TeamMetaMatchupsProps) {
  const pokemon = useDeferredValue(current);
  const t = useMessages();
  const text = usePokemonText();
  const { meta, isLoading } = useMeta(regulationId);
  const { spreads, isLoading: spreadsLoading } = useMetaSpreads(regulationId);
  const { data: archetypes } = useMetaArchetypes(regulationId);
  const [kind, setKind] = useState<"teams" | "cores">("teams");
  const [showAll, setShowAll] = useState(false);

  if (pokemon.length === 0) return <p className="text-sm text-zinc-500">{t.metaMatchups.empty}</p>;
  if ((isLoading && !meta) || spreadsLoading) return <LoadingState />;
  if (!meta) return <p className="text-sm text-zinc-500">{t.metaMatchups.noMeta}</p>;

  const source = meta.official.recent ?? meta.official;
  const metaPokemon = meta.official.recent?.pokemon ?? meta.official.pokemon;
  const combos = source.combos ?? meta.official.combos;
  const events = meta.official.recent?.tournamentIds.length ?? meta.official.tournaments.length;
  const team = pokemon.map((mon) => withSpread(mon).pokemon);
  if (!combos) return <p className="text-sm text-zinc-500">{t.metaMatchups.noMeta}</p>;
  const report = metaTeamMatchups(team, combos, metaPokemon, spreads);
  const list = kind === "teams" ? report.teams : report.cores;

  // Real results: teams like yours against each archetype (by its primary).
  const set = DEFAULT_ARCHETYPE_SET;
  const yourKey = classificationKey(classifyTeam(pokemon, set, regulationId));
  const versus = archetypes ? archetypeMatchups(archetypes, yourKey)?.versus : undefined;

  const strong = list.filter((m) => m.score >= LISTED_FROM).slice(0, SHOWN);
  const weak = list
    .filter((m) => m.score <= -LISTED_FROM)
    .reverse()
    .slice(0, SHOWN);

  const card = (matchup: MetaTeamMatchup) => {
    const theirTeam = matchup.their.map((mon) => mon.set.pokemon);
    const classification = classifyTeam(theirTeam, set, regulationId);
    const archetype =
      kind === "teams" ? classificationLabel(classification, set, t.teamArchetype.balance) : null;
    const primary = primaryOfKey(classificationKey(classification));
    const real =
      kind === "teams" ? versus?.find((v) => v.opponent === primary && v.games >= 15) : undefined;
    const yours = (index: number) => text.species(pokemon[index].species);
    const theirs = (index: number) => text.species(matchup.their[index].set.pokemon.species);
    const names = (values: string[]) => values.join(", ");
    const threats = [...matchup.their].sort((a, b) => b.danger - a.danger).slice(0, 2);
    const answers = [...matchup.yours].sort((a, b) => b.danger - a.danger).slice(0, 2);
    const level = matchupLevel(matchup.score);

    return (
      <li
        key={matchup.combo.species.join("/")}
        className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-raised p-3 text-sm"
      >
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap">
            {matchup.their.map((mon) => (
              <PokemonSprite
                key={mon.set.id}
                species={mon.set.pokemon.species}
                item={mon.set.pokemon.item}
                size={40}
              />
            ))}
          </div>
          <span
            className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", LEVEL_CLASS[level])}
          >
            {t.metaMatchups.level[level]}
          </span>
        </div>
        <p className="text-xs text-zinc-500">
          {archetype && <span className="font-medium text-zinc-700">{archetype} · </span>}
          {t.metaMatchups.played(
            matchup.combo.teams,
            matchup.combo.winRate === null ? "—" : percent(matchup.combo.winRate),
          )}
        </p>
        <div className="grid gap-2 text-xs sm:grid-cols-2">
          <div>
            <p className="font-medium text-zinc-500">{t.metaMatchups.threat}</p>
            <ul>
              {threats.map((mon) => (
                <li key={mon.set.id} className="text-zinc-700">
                  <span className="font-medium text-zinc-900">
                    {text.species(mon.set.pokemon.species)}
                  </span>
                  :{" "}
                  {mon.ohkos.length
                    ? t.metaMatchups.ohkos(names(mon.ohkos.map(yours)))
                    : t.metaMatchups.noOhko}{" "}
                  ·{" "}
                  {mon.answeredBy.length ? (
                    t.metaMatchups.answeredBy(names(mon.answeredBy.map(yours)))
                  ) : (
                    <span className="text-red-700 dark:text-red-400">
                      {t.metaMatchups.unanswered}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-medium text-zinc-500">{t.metaMatchups.answer}</p>
            <ul>
              {answers.map((mon) => (
                <li key={mon.index} className="text-zinc-700">
                  <span className="font-medium text-zinc-900">{yours(mon.index)}</span>:{" "}
                  {mon.ohkos.length
                    ? t.metaMatchups.ohkos(names(mon.ohkos.map(theirs)))
                    : t.metaMatchups.noOhko}
                </li>
              ))}
            </ul>
          </div>
        </div>
        {real && (
          <p className="text-xs text-zinc-500">
            {t.metaMatchups.results(
              labelForKey(primary, set, t.teamArchetype.balance),
              percent(real.winRate),
              real.games,
            )}
          </p>
        )}
      </li>
    );
  };

  const section = (title: string, items: MetaTeamMatchup[], titleClass: string) => (
    <section className="flex flex-col gap-2">
      <h2 className={cn("text-sm font-semibold", titleClass)}>{title}</h2>
      {items.length ? (
        <ul className="flex flex-col gap-2">{items.map(card)}</ul>
      ) : (
        <p className="text-sm text-zinc-500">{t.metaMatchups.none}</p>
      )}
    </section>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex max-w-3xl flex-col gap-1 text-sm text-zinc-600">
        <p>{t.metaMatchups.intro}</p>
        <p className="text-xs text-zinc-500">
          {t.metaMatchups.basis(source.teams, events)} {t.metaMatchups.caveat}
        </p>
      </div>
      <div className="flex gap-1.5">
        <TogglePill
          active={kind === "teams"}
          onClick={() => {
            setKind("teams");
            setShowAll(false);
          }}
        >
          {t.metaMatchups.teams}
        </TogglePill>
        <TogglePill
          active={kind === "cores"}
          onClick={() => {
            setKind("cores");
            setShowAll(false);
          }}
        >
          {t.metaMatchups.cores}
        </TogglePill>
      </div>
      {showAll ? (
        <ul className="flex flex-col gap-2">{list.map(card)}</ul>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {section(t.metaMatchups.strong, strong, "text-green-700 dark:text-green-400")}
          {section(t.metaMatchups.weak, weak, "text-red-700 dark:text-red-400")}
        </div>
      )}
      {list.length > 0 && (
        <TextAction className="w-fit" onClick={() => setShowAll((value) => !value)}>
          {showAll ? t.metaMatchups.showLess : t.metaMatchups.showAll(list.length)}
        </TextAction>
      )}
    </div>
  );
}
