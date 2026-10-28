"use client";

import { PokemonSprite } from "../PokemonSprite";
import { Icon } from "../Icon";
import { IconName } from "@/enums";
import { calcLineParts, calcThreat, isCalcLine } from "@/lib/teamCalcs";
import { formatSpeciesDisplayName } from "@/lib/species/formatSpeciesDisplayName";
import { speciesIdentity } from "@/lib/teamIdentity";
import type { ParsedPokemon, TeamCalc, TeamCalcSide } from "@/types";
import { cn } from "@/lib/utils";
import { useMessages, usePokemonText } from "@/hooks/useLanguage";

interface TeamCalcsListProps {
  calcs: TeamCalc[];
  /** The team's roster — sections follow its order. */
  teamPokemon: ParsedPokemon[];
  /** Shows a remove button per entry when given. */
  onRemove?: (id: string) => void;
}

/** The groups under each of your Pokémon, in order — null is a plain note, not a calc. */
const SIDES: (TeamCalcSide | null)[] = ["offensive", "defensive", null];

/**
 * One calc: the other Pokémon's sprite and the whole Showdown line, written
 * the way the Damage Calculator shows its result — the % range and the KO
 * chance in bold (a dealt OHKO green, a taken one red), the rest plain.
 */
export function TeamCalcRow({
  calc,
  onRemove,
  removeLabel,
  sprite,
}: {
  calc: TeamCalc;
  onRemove?: () => void;
  removeLabel?: string;
  /** The species to show instead of the other Pokémon's; null for none (the rows sit under its name). */
  sprite?: string | null;
}) {
  const t = useMessages();
  const removeText = removeLabel ?? t.pokemonCard.removeCalc;
  const isCalc = isCalcLine(calc.text);
  const threat = isCalc ? calcThreat(calc) : undefined;
  const parts = isCalc ? calcLineParts(calc.text) : null;
  const isOhko = !!parts?.verdict && /OHKO/i.test(parts.verdict);
  const verdictTone = !isOhko
    ? undefined
    : calc.side === "offensive"
      ? "text-green-700"
      : calc.side === "defensive"
        ? "text-red-600"
        : undefined;

  return (
    <li className="flex items-start gap-2 py-1.5">
      {sprite !== null && (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center">
          {sprite ? (
            <PokemonSprite species={sprite} size={28} />
          ) : (
            threat && (
              <PokemonSprite species={formatSpeciesDisplayName(threat.spriteKey)} size={28} />
            )
          )}
        </span>
      )}
      <p
        className={cn("min-w-0 flex-1 text-xs", isCalc ? "text-zinc-900" : "text-zinc-500 italic")}
      >
        {parts ? (
          <>
            {parts.before}
            {parts.percent && (
              <span className="font-semibold whitespace-nowrap">{parts.percent}</span>
            )}
            {parts.between}
            {parts.verdict && (
              <span className={cn("font-semibold", verdictTone)}>{parts.verdict}</span>
            )}
          </>
        ) : (
          calc.text
        )}
      </p>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeText}
          title={removeText}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700"
        >
          <Icon name={IconName.Close} size={14} />
        </button>
      )}
    </li>
  );
}

/**
 * Calcs grouped the way a prep document is: per Pokémon of the team (in
 * roster order), then Offensive / Defensive. Entries filed under a Pokémon
 * that isn't on the roster (or none) go in a trailing "Other" section.
 */
export function TeamCalcsList({ calcs, teamPokemon, onRemove }: TeamCalcsListProps) {
  const t = useMessages();
  const text = usePokemonText();
  const sideLabel = (side: TeamCalcSide | null) =>
    side === "offensive"
      ? t.calc.offensive
      : side === "defensive"
        ? t.calc.defensive
        : t.opponentCard.notes;
  const rosterIdentities = teamPokemon.map((mon) => speciesIdentity(mon.species));
  const sections = [
    ...teamPokemon.map((mon, index) => ({
      key: rosterIdentities[index],
      mon: mon as ParsedPokemon | null,
      entries: calcs.filter((calc) => calc.species === rosterIdentities[index]),
    })),
    {
      key: "other",
      mon: null,
      entries: calcs.filter(
        (calc) => calc.species === null || !rosterIdentities.includes(calc.species),
      ),
    },
  ].filter((section) => section.entries.length > 0);

  return (
    <div className="flex flex-col">
      {sections.map((section, index) => (
        <section
          key={section.key}
          className={cn(
            "flex flex-col gap-2 px-4 py-3",
            index % 2 === 0 ? "bg-zinc-200" : "bg-zinc-100",
          )}
        >
          <h3 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-zinc-700 uppercase">
            {section.mon && (
              <PokemonSprite species={section.mon.species} item={section.mon.item} size={36} />
            )}
            {section.mon ? text.species(section.mon.species) : t.pokemonCard.otherPokemon}
          </h3>
          {SIDES.map((side) => {
            const label = sideLabel(side);
            const entries = section.entries.filter((calc) => calc.side === side);
            if (entries.length === 0) return null;
            return (
              <div key={label} className="flex flex-col">
                <h4 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                  {label}
                </h4>
                <ul className="flex flex-col divide-y divide-zinc-300/60">
                  {entries.map((calc) => (
                    <TeamCalcRow
                      key={calc.id}
                      calc={calc}
                      onRemove={onRemove ? () => onRemove(calc.id) : undefined}
                    />
                  ))}
                </ul>
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
