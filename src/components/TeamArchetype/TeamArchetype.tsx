"use client";

import { useState } from "react";
import { Icon } from "../Icon";
import { IconName } from "@/enums";
import { useMessages } from "@/hooks/useLanguage";
import { useMetaArchetypes } from "@/hooks/useMetaArchetypes";
import {
  BALANCE_KEY,
  DEFAULT_ARCHETYPE_SET,
  archetypeMatchups,
  archetypeTempo,
  classificationKey,
  classificationLabel,
  classifyTeam,
  type Tempo,
  type VersusArchetype,
} from "@/lib/archetypes";
import { cn } from "@/lib/utils";
import type { ParsedPokemon } from "@/types";

/** The owner's tempo colors (docs/archetypes.md): red offense, blue positioning, green patient. */
const TEMPO_DOT: Record<Tempo, string> = {
  offense: "bg-red-500",
  positioning: "bg-blue-500",
  patient: "bg-green-600",
};

interface TeamArchetypeProps {
  pokemon: ParsedPokemon[];
  regulationId?: string;
}

const percent = (value: number) => `${Math.round(value * 100)}%`;

/**
 * The team's archetype — "Sun + Tailwind" — from src/lib/archetypes, with its
 * tempo color. Opens to the game plan, the other engines it has, the variants
 * folded into it, and how teams like it did in the regulation's official
 * tournaments: their record and the archetypes they struggled with or beat
 * (archetypeMatchups, from the metagame job's data — loaded on open). A
 * preview behind the `teamArchetype` flag.
 */
export function TeamArchetype({ pokemon, regulationId }: TeamArchetypeProps) {
  const t = useMessages();
  const [isOpen, setIsOpen] = useState(false);
  const { data, isLoading } = useMetaArchetypes(regulationId, isOpen);
  if (pokemon.length === 0) return null;

  const set = DEFAULT_ARCHETYPE_SET;
  const result = classifyTeam(pokemon, set, regulationId);
  const label = classificationLabel(result, set, t.teamArchetype.balance);
  const byId = new Map(set.archetypes.map((a) => [a.id, a]));
  const name = (id: string) => byId.get(id)?.name ?? id;
  const primary = result.primary ? byId.get(result.primary) : undefined;
  const tempo = result.primary ? archetypeTempo(result.primary, set) : undefined;
  const report = data ? archetypeMatchups(data, classificationKey(result)) : null;
  const opponentName = (id: string) => (id === BALANCE_KEY ? t.teamArchetype.balance : name(id));
  const versusList = (title: string, list: VersusArchetype[], titleClass: string) => (
    <div>
      <p className={cn("font-medium", titleClass)}>{title}</p>
      <ul className="mt-0.5 flex flex-col">
        {list.map((v) => (
          <li key={v.opponent} className="flex items-baseline justify-between gap-3">
            <span className="text-zinc-800">{opponentName(v.opponent)}</span>
            <span className="shrink-0 tabular-nums">
              <span className="font-semibold text-zinc-800">{percent(v.winRate)}</span>
              {" · "}
              {t.teamArchetype.games(v.games)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <details
      className="group relative w-fit max-w-full text-sm"
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
    >
      <summary
        className="flex w-fit cursor-pointer list-none items-center gap-2 rounded-full border border-zinc-200 bg-raised px-3 py-1 hover:bg-zinc-50 [&::-webkit-details-marker]:hidden"
        title={tempo ? t.teamArchetype.tempo[tempo] : undefined}
      >
        <span className="text-xs font-medium text-zinc-500">{t.teamArchetype.label}</span>
        <span
          aria-hidden="true"
          className={cn("size-2.5 shrink-0 rounded-full", tempo ? TEMPO_DOT[tempo] : "bg-zinc-400")}
        />
        <span className="font-semibold text-zinc-900">{label}</span>
        <Icon
          name={IconName.ExpandMore}
          size={16}
          className="text-zinc-500 transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="absolute top-full left-0 z-20 mt-2 flex w-[min(32rem,calc(100vw-2rem))] flex-col gap-1.5 rounded-lg border border-zinc-200 bg-raised p-3 text-xs text-zinc-600 shadow-lg">
        <p className="text-zinc-800">
          {primary ? primary.description : t.teamArchetype.balanceDescription}
        </p>
        {tempo && <p>{t.teamArchetype.tempo[tempo]}</p>}
        {result.tags.length > 0 && (
          <p>
            <span className="font-medium text-zinc-700">{t.teamArchetype.alsoHas}:</span>{" "}
            {result.tags.map(name).join(" · ")}
          </p>
        )}
        {result.folded.length > 0 && (
          <p>
            <span className="font-medium text-zinc-700">{t.teamArchetype.includes}:</span>{" "}
            {result.folded.map(name).join(" · ")}
          </p>
        )}

        <div className="mt-1.5 flex flex-col gap-1 border-t border-zinc-200 pt-2">
          <p className="font-medium text-zinc-800">{t.teamArchetype.tournaments}</p>
          {isLoading ? (
            <p>{t.teamArchetype.loading}</p>
          ) : !data ? (
            <p>{t.teamArchetype.noData}</p>
          ) : !report ? (
            <p>{t.teamArchetype.noTeams}</p>
          ) : (
            <>
              <p>
                <span className="font-medium text-zinc-700">
                  {report.scope === "label"
                    ? t.teamArchetype.likeYours
                    : t.teamArchetype.allOf(opponentName(report.key))}
                  :
                </span>{" "}
                {t.teamArchetype.record(
                  report.teams,
                  report.winRate === null ? "—" : percent(report.winRate),
                  report.topCut,
                )}
              </p>
              {report.hard.length > 0 &&
                versusList(t.teamArchetype.hard, report.hard, "text-red-700 dark:text-red-400")}
              {report.good.length > 0 &&
                versusList(t.teamArchetype.good, report.good, "text-green-700 dark:text-green-400")}
              {report.hard.length === 0 && report.good.length === 0 && (
                <p>{t.teamArchetype.noneStandsOut}</p>
              )}
              {data.version !== set.version && (
                <p className="text-zinc-400">{t.teamArchetype.outdated}</p>
              )}
            </>
          )}
        </div>
        <p className="text-zinc-400">{t.teamArchetype.preview}</p>
      </div>
    </details>
  );
}
