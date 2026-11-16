"use client";

import { Icon } from "../Icon";
import { IconName } from "@/enums";
import { useMessages } from "@/hooks/useLanguage";
import {
  DEFAULT_ARCHETYPE_SET,
  archetypeTempo,
  classificationLabel,
  classifyTeam,
  type Tempo,
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

/**
 * The team's archetype — "Sun + Tailwind" — from src/lib/archetypes, with its
 * tempo color. Opens to the game plan, the other engines it has, and the
 * variants folded into it. A preview behind the `teamArchetype` flag.
 */
export function TeamArchetype({ pokemon, regulationId }: TeamArchetypeProps) {
  const t = useMessages();
  if (pokemon.length === 0) return null;

  const set = DEFAULT_ARCHETYPE_SET;
  const result = classifyTeam(pokemon, set, regulationId);
  const label = classificationLabel(result, set, t.teamArchetype.balance);
  const byId = new Map(set.archetypes.map((a) => [a.id, a]));
  const name = (id: string) => byId.get(id)?.name ?? id;
  const primary = result.primary ? byId.get(result.primary) : undefined;
  const tempo = result.primary ? archetypeTempo(result.primary, set) : undefined;

  return (
    <details className="group relative w-fit max-w-full text-sm">
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
        <p className="text-zinc-400">{t.teamArchetype.preview}</p>
      </div>
    </details>
  );
}
