"use client";

import { useEffect, useState } from "react";
import { MemberAvatar } from "../PrepGroups";
import { LoadingState } from "../LoadingState";
import { useLanguageSettings, useMessages, usePokemonText } from "@/hooks/useLanguage";
import { subscribeTeamActivity } from "@/lib/firebase";
import { ACTIVITY_TTL_DAYS, isEmptyActivity } from "@/lib/teamActivity";
import type { PokemonText } from "@/lib/i18n/pokemonNames";
import { timeAgo } from "@/lib/timeAgo";
import type { Messages } from "@/lib/i18n/messages";
import type { PrepGroup, TeamActivity } from "@/types";

type ListFormat = (items: string[]) => string;

/** One entry's headline, in the app language. */
function describe(entry: TeamActivity, t: Messages, list: ListFormat): string {
  const name = entry.by.name;
  const { change } = entry;
  switch (change.kind) {
    case "created":
      return t.activity.created(name);
    case "joined":
      return t.activity.joined(name);
    case "left":
      return t.activity.left(name);
    case "removedMember":
      return t.activity.removedMember(name, change.memberName);
    case "fields": {
      const names = [
        ...new Set(
          change.fields.map((field) => t.activity.fieldNames[field] ?? t.activity.otherField),
        ),
      ];
      return t.activity.edited(name, list(names));
    }
    case "combinations":
    case "calcs": {
      const counts = list([
        ...(change.added > 0 ? [t.activity.added(change.added)] : []),
        ...(change.changed > 0 ? [t.activity.changed(change.changed)] : []),
        ...(change.removed > 0 ? [t.activity.removed(change.removed)] : []),
      ]);
      const total = change.added + change.changed + change.removed;
      return change.kind === "calcs"
        ? t.activity.calcs(name, counts, total)
        : t.activity.combinations(name, counts, total);
    }
    case "plan":
      return change.parts?.length
        ? t.activity.planParts(
            name,
            list(change.parts.map((part) => t.activity.planPartNames[part])),
            change.opponentLabel,
          )
        : t.activity.plan(name, change.opponentLabel);
  }
}

/** The most detail lines an entry shows before "+N more". */
const MAX_DETAILS = 6;

function capped(lines: string[], t: Messages): string[] {
  return lines.length > MAX_DETAILS
    ? [...lines.slice(0, MAX_DETAILS - 1), t.activity.more(lines.length - MAX_DETAILS + 1)]
    : lines;
}

/** What exactly changed, a line each: Pokémon, moves and items; combinations; calcs. */
function details(entry: TeamActivity, t: Messages, text: PokemonText, list: ListFormat): string[] {
  const { change } = entry;
  const value = (name: string | null, translate: (name: string) => string) =>
    name ? translate(name) : t.activity.none;

  if (change.kind === "fields") {
    const lines: string[] = [];
    if (change.name) lines.push(t.activity.renamed(change.name.from, change.name.to));
    const roster = change.roster;
    if (roster) {
      if (roster.added.length > 0) {
        lines.push(t.activity.rosterAdded(list(roster.added.map(text.species))));
      }
      if (roster.removed.length > 0) {
        lines.push(t.activity.rosterRemoved(list(roster.removed.map(text.species))));
      }
      for (const mon of roster.edited) {
        const parts = [
          ...(mon.movesAdded ? [t.activity.movesAdded(list(mon.movesAdded.map(text.move)))] : []),
          ...(mon.movesRemoved
            ? [t.activity.movesRemoved(list(mon.movesRemoved.map(text.move)))]
            : []),
          ...(mon.item
            ? [
                t.activity.itemChange(
                  value(mon.item.from, text.item),
                  value(mon.item.to, text.item),
                ),
              ]
            : []),
          ...(mon.ability
            ? [
                t.activity.abilityChange(
                  value(mon.ability.from, text.ability),
                  value(mon.ability.to, text.ability),
                ),
              ]
            : []),
          ...(mon.nature
            ? [
                t.activity.natureChange(
                  value(mon.nature.from, text.nature),
                  value(mon.nature.to, text.nature),
                ),
              ]
            : []),
          // Each stat's Stat Points (older entries only know they changed).
          ...(Array.isArray(mon.spread)
            ? [
                t.activity.spreadChanges(
                  mon.spread
                    .map(({ stat, from, to }) =>
                      t.activity.statPoints(t.stats.long[stat], from, to),
                    )
                    .join(", "),
                ),
              ]
            : mon.spread
              ? [t.activity.spreadChanged]
              : []),
        ];
        lines.push(t.activity.monChanges(text.species(mon.species), parts.join(", ")));
      }
    }
    return capped(lines, t);
  }

  if (change.kind === "combinations") {
    const pair = (species: string[]) =>
      species.length > 0 ? species.map(text.species).join(" + ") : t.activity.noPicks;
    return capped(
      (change.items ?? []).map(
        (item) =>
          `${t.activity.actions[item.action]}: ${t.activity.combinationLine(pair(item.leads), pair(item.back))}`,
      ),
      t,
    );
  }

  if (change.kind === "calcs") {
    // The same Pokémon vs the same target on the same side, once with a count.
    const groups = new Map<string, { line: string; count: number }>();
    for (const item of change.items ?? []) {
      const species = item.species ? text.species(item.species) : t.activity.unknownPokemon;
      const against = item.against ? text.species(item.against) : t.activity.unknownPokemon;
      const side = item.side ? ` (${t.activity.sides[item.side]})` : "";
      const line = `${t.activity.actions[item.action]}: ${t.activity.calcLine(species, against)}${side}`;
      const group = groups.get(line);
      if (group) group.count += 1;
      else groups.set(line, { line, count: 1 });
    }
    return capped(
      [...groups.values()].map(({ line, count }) =>
        count > 1 ? `${line} ${t.activity.times(count)}` : line,
      ),
      t,
    );
  }

  return [];
}

/**
 * A collaborative team's activity log, newest first — the Team Report's
 * Activity panel (docs/collaborative-teams.md). Live while shown.
 */
export function TeamActivityList({ teamId, group }: { teamId: string; group: PrepGroup | null }) {
  const t = useMessages();
  const text = usePokemonText();
  const { appLanguage } = useLanguageSettings();
  const listFormat = new Intl.ListFormat(appLanguage, { style: "long", type: "conjunction" });
  const list: ListFormat = (items) => listFormat.format(items);
  const [state, setState] = useState<{
    teamId: string;
    entries: TeamActivity[] | null;
    failed: boolean;
  }>({ teamId, entries: null, failed: false });

  useEffect(
    () =>
      subscribeTeamActivity(
        teamId,
        (entries) => setState({ teamId, entries, failed: false }),
        (error) => {
          console.error("[collab team] activity listener failed:", error);
          setState({ teamId, entries: null, failed: true });
        },
      ),
    [teamId],
  );

  const current = state.teamId === teamId ? state : null;
  if (current?.failed) return <p className="text-sm text-red-600">{t.activity.loadFailed}</p>;
  if (!current?.entries) return <LoadingState />;
  // Edits that cancelled out (a calc added, then removed) say nothing.
  const entries = current.entries.filter((entry) => !isEmptyActivity(entry));
  if (entries.length === 0) {
    return <p className="text-sm text-zinc-500">{t.activity.empty}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col">
        {entries.map((entry) => {
          const member = group?.members[entry.by.uid] ?? { name: entry.by.name };
          const lines = details(entry, t, text, list);
          return (
            <li
              key={entry.id}
              className="flex items-start gap-2.5 border-b border-zinc-200 py-2.5 last:border-b-0"
            >
              <MemberAvatar member={member} />
              <div className="flex min-w-0 flex-col">
                <span className="text-sm text-zinc-900">{describe(entry, t, list)}</span>
                {lines.length > 0 && (
                  <ul className="mt-1 flex flex-col gap-0.5 text-xs text-zinc-600">
                    {lines.map((line, index) => (
                      <li key={index} className="flex gap-1.5">
                        <span aria-hidden="true" className="text-zinc-400">
                          •
                        </span>
                        <span className="min-w-0">{line}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <time dateTime={entry.lastAt} className="text-xs text-zinc-500">
                  {timeAgo(entry.lastAt, appLanguage)}
                </time>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-zinc-500">{t.activity.keptFor(ACTIVITY_TTL_DAYS)}</p>
    </div>
  );
}
