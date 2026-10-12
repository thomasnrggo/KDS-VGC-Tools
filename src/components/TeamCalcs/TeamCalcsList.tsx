"use client";

import { PokemonSprite } from "../PokemonSprite";
import { Icon } from "../Icon";
import { IconName } from "@/enums";
import { calcThreat, isCalcLine, parseCalcLine } from "@/lib/teamCalcs";
import { formatSpeciesDisplayName } from "@/lib/species/formatSpeciesDisplayName";
import { speciesIdentity } from "@/lib/teamIdentity";
import type { ParsedPokemon, TeamCalc, TeamCalcSide } from "@/types";

interface TeamCalcsListProps {
  calcs: TeamCalc[];
  /** The team's roster — sections follow its order. */
  teamPokemon: ParsedPokemon[];
  /** Shows a remove button per entry when given. */
  onRemove?: (id: string) => void;
}

const SIDES: { side: TeamCalcSide | null; label: string }[] = [
  { side: "offensive", label: "Offensive" },
  { side: "defensive", label: "Defensive" },
  { side: null, label: "Notes" },
];

function CalcRow({ calc, onRemove }: { calc: TeamCalc; onRemove?: () => void }) {
  const isCalc = isCalcLine(calc.text);
  const { percent, verdict } = isCalc ? parseCalcLine(calc.text) : {};
  const threat = isCalc ? calcThreat(calc) : undefined;
  const colonIndex = calc.text.indexOf(":");
  // The setup ("… vs. …") reads as the line; the result is pulled out as a
  // badge so the % and KO verdict scan down the list.
  const setup = isCalc && colonIndex !== -1 ? calc.text.slice(0, colonIndex) : calc.text;
  const isOhko = !!verdict && /OHKO/i.test(verdict);
  const verdictTone = !isOhko
    ? "text-zinc-700"
    : calc.side === "offensive"
      ? "text-green-700"
      : calc.side === "defensive"
        ? "text-red-600"
        : "text-zinc-900";

  return (
    <li className="flex items-start gap-2 py-1.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center">
        {threat && (
          <PokemonSprite species={formatSpeciesDisplayName(threat.spriteKey)} size={28} />
        )}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 md:flex-row md:items-start md:justify-between md:gap-3">
        <span className={`min-w-0 text-xs ${isCalc ? "text-zinc-700" : "italic text-zinc-500"}`}>
          {setup}
        </span>
        {(percent || verdict) && (
          <span className={`shrink-0 text-xs font-medium md:text-right ${verdictTone}`}>
            {percent}
            {percent && verdict ? " · " : ""}
            {verdict}
          </span>
        )}
      </div>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove calc"
          title="Remove calc"
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
          className={`flex flex-col gap-2 px-4 py-3 ${index % 2 === 0 ? "bg-zinc-200" : "bg-zinc-100"}`}
        >
          <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-zinc-700">
            {section.mon && (
              <PokemonSprite species={section.mon.species} item={section.mon.item} size={36} />
            )}
            {section.mon?.species ?? "Other"}
          </h3>
          {SIDES.map(({ side, label }) => {
            const entries = section.entries.filter((calc) => calc.side === side);
            if (entries.length === 0) return null;
            return (
              <div key={label} className="flex flex-col">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {label}
                </h4>
                <ul className="flex flex-col divide-y divide-zinc-300/60">
                  {entries.map((calc) => (
                    <CalcRow
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
